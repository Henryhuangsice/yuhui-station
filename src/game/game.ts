import * as THREE from 'three';
import { R, dirFromLatLon, projectTangent, quatFromUpForward, surfaceStep, tangentFrame } from './planet';
import { Avatar, DEFAULT_LOOK, type Gesture, type Look, type Pose, type PropKind } from './character';
import { buildWorld, SIGN_TEXT, type WorldInfo } from './world';
import { Sky } from './sky';
import { Tram } from './tram';
import { Input } from './input';
import { pointBlocked, resolveCollisions, type Collider } from './colliders';
import { INK } from './toon';
import { Effects, Smoke } from './fx';
import type { Seat, Spot, SpotKind } from './types';
import { AudioEngine, type Scene } from '../audio';
import { Store, RULES, todayKey } from '../state/save';
import { Presence, MAX_WORLD, type Anim } from '../net/presence';
import { UI, EMOJIS, type ChecklistItem } from '../ui/ui';
import { Tag } from '../ui/tags';
import { NPCS, QUESTS, type NpcDef } from '../data/npcs';
import { rollCard, type Card } from '../data/gacha';
import { FORTUNES, WISHES, realmOf, rollPill, type PillKind } from '../data/rituals';

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

const WALK = 3.9;
const RUN = 6.4;
const JUMP = 6.4;
const GRAVITY = 18;

interface Body {
  avatar: Avatar;
  dir: THREE.Vector3;
  fwd: THREE.Vector3;
  h: number;
  ground: number;
  speed: number;
  tag: Tag;
  shadow: THREE.Mesh;
  wave: number;
  pose: Pose;
  gesture: Gesture;
  gt: number;
  scale: number;
}

interface Npc extends Body {
  def: NpcDef;
  home: THREE.Vector3;
  talking: boolean;
}

interface Peer extends Body {
  tDir: THREE.Vector3;
  tFwd: THREE.Vector3;
  tH: number;
  anim: Anim;
  lookKey: string;
  auraKey: string | null;
}

interface Resident extends Body {
  target: THREE.Vector3;
  pause: number;
  stuck: number;
  nextEmote: number;
  card: Card;
}

type Interactable =
  | { kind: 'npc'; npc: Npc; dist: number }
  | { kind: 'gacha'; dist: number }
  | { kind: 'seat'; seat: Seat; dist: number }
  | { kind: 'spot'; spot: Spot; dist: number };

type ActKind = 'sit' | SpotKind;

interface Activity {
  kind: ActKind;
  spot: Spot | null;
  seat: Seat | null;
  t: number;
  pose: Pose;
  gesture: Gesture;
  idle: boolean;
  auto: boolean;
  clock: number;
  count: number;
  fired: number;
  ready: boolean;
}

const ACT: Record<SpotKind, { pose: Pose; gesture: Gesture; prop: PropKind; idle: boolean; title: string }> = {
  bow: { pose: 'kneel', gesture: 'bow', prop: null, idle: true, title: '拜佛' },
  muyu: { pose: 'kneel', gesture: 'tap', prop: 'mallet', idle: true, title: '敲木鱼' },
  fortune: { pose: 'kneel', gesture: 'shake', prop: 'tube', idle: false, title: '摇签' },
  incense: { pose: 'stand', gesture: 'incense', prop: 'incense', idle: false, title: '上香' },
  bell: { pose: 'stand', gesture: 'strike', prop: null, idle: false, title: '敲钟' },
  candle: { pose: 'stand', gesture: 'reach', prop: 'candle', idle: false, title: '点蜡烛' },
  pray: { pose: 'kneel', gesture: 'pray', prop: null, idle: true, title: '祈祷' },
  meditate: { pose: 'lotus', gesture: 'none', prop: null, idle: true, title: '打坐' },
  alchemy: { pose: 'stand', gesture: 'fan', prop: 'fan', idle: false, title: '炼丹' },
};

const BLESSINGS = ['愿你今晚睡得好。', '愿明天的路不堵。', '愿你想念的人也在想你。', '愿你少一点着急。', '愿家里的灯一直亮着。'];

const shadowGeo = new THREE.CircleGeometry(0.42, 18);
const shadowMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.2, depthWrite: false });

function surfDist(a: THREE.Vector3, b: THREE.Vector3) {
  return tmpV.copy(a).sub(b).length() * R;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2000);
  private light = new THREE.DirectionalLight('#ffffff', 2.1);
  private sky = new Sky();
  private tram = new Tram();
  private effects = new Effects();
  private qi!: Smoke;
  private world!: WorldInfo;
  private input: Input;
  private audio = new AudioEngine();
  private store = new Store();
  private presence = new Presence();
  private ui: UI;
  private siteTags: { tag: Tag; dir: THREE.Vector3; name: string }[] = [];
  private clock = new THREE.Clock();
  private time = 0;
  private mode: 'title' | 'fly' | 'play' = 'title';
  private flyT = 0;
  private flyFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

  private me!: Body;
  private vh = 0;
  private onGround = true;
  private moveDir = new THREE.Vector3();
  private act: Activity | null = null;
  private idleClock = 0;
  private inWater = false;
  private pill: { kind: PillKind; until: number } | null = null;

  private cam = { dir: new THREE.Vector3(), yaw: 0, pitch: 0.3, dist: 6.4, up: new THREE.Vector3(0, 1, 0), focus: new THREE.Vector3() };
  private npcs: Npc[] = [];
  private peers = new Map<string, Peer>();
  private residents: Resident[] = [];
  private colliders: Collider[] = [];
  private sendClock = 0;
  private arrivals = 0;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.className = 'gl';
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);
    this.ui = new UI(this.audio, this.input.touch);
    this.scene.background = new THREE.Color('#75bdc3');
    this.scene.add(this.light, this.light.target, new THREE.AmbientLight('#ffffff', 1.05));
    this.scene.add(this.sky.group, this.tram.group, this.effects.group);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private get smokeScale() {
    return window.innerHeight * this.renderer.getPixelRatio() * 0.9;
  }

  async boot() {
    try {
      await Promise.race([
        document.fonts.load('48px "ZCOOL QingKe HuangYou"', SIGN_TEXT + '余晖站'),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* fall back to system font */
    }
    this.world = buildWorld(this.scene, this.smokeScale);
    this.colliders = [...this.world.colliders, ...this.tram.colliders];
    if (this.world.report.length) console.warn('[layout]', this.world.report);
    if (this.store.hasFlag('mint')) this.world.mint.visible = true;
    this.world.temple.setIncense(this.store.data.incense);
    this.world.church.setCandles(this.store.data.candles);
    const siteHints: Record<string, string> = {
      temple: '烧香 · 拜佛 · 抽签 · 敲木鱼',
      church: '听歌 · 点蜡烛 · 祈祷',
      dao: '打坐修仙 · 炼丹',
    };
    for (const s of this.world.sites) {
      this.siteTags.push({
        tag: new Tag(this.ui.anchors, s.name, siteHints[s.id] ?? '', 'site'),
        dir: s.frame.center.clone(),
        name: s.name,
      });
    }
    this.qi = new Smoke({ color: '#c8ffb0', rate: 0, life: 2.4, size: 0.35, rise: 0.9, spread: 0.7, alpha: 0.8, max: 50 }, this.smokeScale);
    this.scene.add(this.qi.points);

    this.audio.musicOn = this.store.data.settings.music;
    this.audio.sfxOn = this.store.data.settings.sfx;

    const spawnDir = dirFromLatLon(-6.2, -3.5);
    const { east } = tangentFrame(spawnDir);
    this.me = this.makeBody(this.store.wearingCard?.look ?? DEFAULT_LOOK, spawnDir, east, '', '', 'me');
    this.me.avatar.onStep = () => this.audio.play(this.inWater ? 'splash' : 'step');
    this.cam.dir.copy(east);
    this.refreshIdentity();

    for (const def of NPCS) {
      let dir: THREE.Vector3;
      let fwd: THREE.Vector3;
      if (def.at && this.world.npcAt[def.at]) {
        dir = this.world.npcAt[def.at].dir.clone();
        fwd = this.world.npcAt[def.at].fwd.clone();
      } else {
        dir = dirFromLatLon(def.lat ?? 0, def.lon ?? 0);
        const { south } = tangentFrame(dir);
        fwd = south.clone().applyAxisAngle(dir, (def.yaw * Math.PI) / 180);
      }
      const n: Npc = { ...this.makeBody(def.look, dir, fwd, def.name, def.title, 'npc'), def, home: fwd.clone(), talking: false };
      if (def.sit) {
        const seat = this.world.seats.find((s) => surfDist(s.dir, dir) < 1.2);
        if (seat) {
          seat.occupiedBy = def.id;
          n.dir.copy(seat.dir);
          n.fwd.copy(seat.fwd);
          n.home.copy(seat.fwd);
          n.h = seat.h;
          n.ground = seat.h - 0.3;
          n.pose = 'sit';
        }
      }
      this.npcs.push(n);
    }

    for (let i = 0; i < 3; i++) this.spawnResident(i);

    this.presence.onEmoji = (id, e) => {
      const p = this.peers.get(id);
      if (!p) return;
      p.tag.bubble(e);
      p.wave = 1.2;
    };
    this.presence.onLeave = (id) => this.dropPeer(id);

    this.tram.onArrive = () => {
      if (this.mode !== 'play') return;
      if (surfDist(this.me.dir, dirFromLatLon(0, 0)) < 26) {
        this.audio.play('bell');
        if (this.arrivals++ < 2) this.ui.toast('班车到站了。不上车也没关系。');
      }
    };

    this.wireUI();
    this.store.on(() => this.onStoreChange());
    this.onStoreChange();
    this.ui.ready();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private makeBody(look: Look, dir: THREE.Vector3, fwd: THREE.Vector3, name: string, sub: string, cls: string): Body {
    const avatar = new Avatar(look);
    this.scene.add(avatar.root);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.renderOrder = 1;
    this.scene.add(shadow);
    const tag = new Tag(this.ui.anchors, name, sub, cls);
    return { avatar, dir: dir.clone(), fwd: fwd.clone(), h: 0, ground: 0, speed: 0, tag, shadow, wave: 0, pose: 'stand', gesture: 'none', gt: 0, scale: 1 };
  }

  private removeBody(b: Body) {
    this.scene.remove(b.avatar.root, b.shadow);
    b.tag.remove();
  }

  private spawnResident(i: number) {
    const card = rollCard(0, '', Math.random);
    const lon = [60, 170, 280][i] + Math.random() * 20;
    const dir = dirFromLatLon(-5.5 + Math.random() * 11, lon);
    const { east } = tangentFrame(dir);
    const r: Resident = {
      ...this.makeBody(card.look, dir, east, card.name, `常驻 · ${card.jobName}`, 'resident'),
      target: dir.clone(),
      pause: Math.random() * 4,
      stuck: 0,
      nextEmote: 10 + Math.random() * 30,
      card,
    };
    this.residents.push(r);
  }

  private wireUI() {
    const ui = this.ui;
    ui.h = {
      onEnter: () => this.enter(),
      onEmoji: (i) => this.emote(i),
      onWear: (id) => {
        this.store.wear(id);
        this.ui.toast(`今晚是「${this.store.wearingCard?.name}」`);
      },
      onDraw: () => {
        const card = this.store.draw();
        if (card) {
          ui.notify('wardrobe', true);
          const s = this.store.drawStatus();
          if (card.rarity === 'rare') ui.toast('稀有！今晚你会发一点光');
          else if (!s.can && this.store.data.firstNightLeft === 0 && this.store.data.wardrobe.length === RULES.firstNight) ui.toast('首夜的三次用完了，都在衣柜里');
        }
        return card;
      },
      drawStatus: () => this.store.drawStatus(),
      wardrobe: () => ({ cards: this.store.data.wardrobe, wearing: this.store.data.wearing }),
      onStand: () => this.endActivity(),
      onMusic: (on) => {
        this.audio.setMusic(on);
        this.store.setSetting('music', on);
      },
      onSfx: (on) => {
        this.audio.setSfx(on);
        this.store.setSetting('sfx', on);
      },
      settings: () => ({ ...this.store.data.settings }),
      onPanel: (open) => {
        this.input.locked = open && this.ui.modalOpen;
        if (!open) this.ui.notify('wardrobe', false);
      },
    };
    ui.checklist = () => this.checklist();
    this.input.bindJoystick(ui.joy, ui.joy.querySelector('.knob') as HTMLElement);
    ui.jumpBtn.onpointerdown = (e) => {
      e.preventDefault();
      this.input.queueJump();
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.ui.panelOpen) this.ui.closePanel();
    });
  }

  private onStoreChange() {
    this.ui.setTickets(this.store.data.tickets);
    this.refreshIdentity();
  }

  private refreshIdentity() {
    const card = this.store.wearingCard;
    this.ui.setIdentity(card);
    if (!this.me) return;
    const look = card?.look ?? DEFAULT_LOOK;
    if (JSON.stringify(look) !== JSON.stringify(this.me.avatar.look)) {
      this.me.avatar.setLook(look);
      this.me.avatar.onStep = () => this.audio.play(this.inWater ? 'splash' : 'step');
    }
    this.me.tag.setText(card?.name ?? '过客', card ? card.jobName : '');
  }

  private checklist(): { items: ChecklistItem[]; tally: string } {
    const d = this.store.data;
    const realm = realmOf(d.cultivation);
    const fortuneToday = d.fortune?.day === todayKey();
    const items: ChecklistItem[] = [
      { text: '抽一个今晚的自己', sub: '站台边上的红色盲盒机', state: d.wardrobe.length ? 'done' : 'todo' },
      { text: '找一张长椅坐一会儿', sub: `坐满 ${RULES.idleSeconds >= 60 ? RULES.idleSeconds / 60 + ' 分钟' : RULES.idleSeconds + ' 秒'}能攒 1 张零钱券`, state: d.sat ? 'done' : 'todo' },
      { head: true, text: '四处走走', state: 'todo' },
      { text: '在余晖寺上一炷香', sub: d.incense ? `一共上了 ${d.incense} 炷` : '寺在南边，顺着石板路往下走', state: d.incense ? 'done' : 'todo' },
      { text: '敲木鱼', sub: `功德 ${d.merit}`, state: d.merit ? 'done' : 'todo' },
      { text: '在蒲团上拜一拜', sub: `一共拜了 ${d.bows} 拜`, state: d.bows ? 'done' : 'todo' },
      { text: '求一支签', sub: fortuneToday ? `今天是${FORTUNES[d.fortune!.index].no}` : '一天一支', state: fortuneToday ? 'done' : 'todo' },
      { text: '在晚钟教堂点一支蜡烛', sub: d.candles ? `一共点了 ${d.candles} 支` : '教堂在北坡上，尖顶很好认', state: d.candles ? 'done' : 'todo' },
      { text: '跪下来祈祷一次', sub: `祈祷过 ${d.prayers} 次`, state: d.prayers ? 'done' : 'todo' },
      { text: '在云栖观的太极图上打坐', sub: `修为 ${d.cultivation} · ${realm.name}`, state: d.cultivation ? 'done' : 'todo' },
      { text: '炼一炉丹', sub: d.pills ? `炼过 ${d.pills} 炉` : '丹炉在太极图旁边', state: d.pills ? 'done' : 'todo' },
      { head: true, text: '跑腿', state: 'todo' },
    ];
    const name = (id: string) => NPCS.find((n) => n.id === id)!;
    for (const q of QUESTS) {
      const from = name(q.from);
      const to = name(q.to);
      const state = d.quests.done.includes(q.id) ? 'done' : d.quests.active === q.id ? 'doing' : 'todo';
      items.push({
        text: state === 'todo' ? `${from.title}的${from.name}好像有事` : `把${q.item}交给${to.name}`,
        sub: state === 'doing' ? `${to.title} · ${from.name}拜托的` : state === 'done' ? '送到了' : '去找找看',
        state,
      });
    }
    const tally = `今天 · 跑腿零钱 ${d.earned.tasks}/${RULES.taskCap} · 发呆零钱 ${d.earned.idle}/${RULES.idleCap} · 抽取 ${d.draws.count}/${RULES.dailyCap}`;
    return { items, tally };
  }

  private enter() {
    if (this.mode !== 'title') return;
    this.audio.start();
    this.audio.setMusic(this.store.data.settings.music);
    this.audio.setSfx(this.store.data.settings.sfx);
    this.ui.hideTitle();
    this.mode = 'fly';
    this.flyT = 0;
    this.flyFrom.pos.copy(this.camera.position);
    this.flyFrom.quat.copy(this.camera.quaternion);
    this.cam.up.copy(this.me.dir);
    this.renderer.domElement.focus();
  }

  private emote(i: number) {
    const e = EMOJIS[i];
    if (!e) return;
    this.me.tag.bubble(e);
    if (!this.act) this.me.wave = 1.2;
    this.audio.play('emoji');
    this.presence.emoji(e);
    for (const r of this.residents) {
      if (r.avatar.root.visible && surfDist(r.dir, this.me.dir) < 6 && Math.random() < 0.8) {
        setTimeout(() => {
          r.tag.bubble(EMOJIS[[0, 1, 6, 5][Math.floor(Math.random() * 4)]]);
          r.wave = 1.2;
        }, 600 + Math.random() * 900);
      }
    }
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 68 : 58;
    this.camera.updateProjectionMatrix();
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.sky.update(dt, this.time);
    this.tram.update(dt);
    for (const b of this.world.blinkers) {
      const period = b.userData.blink as number;
      b.visible = Math.sin((this.time * Math.PI * 2) / period) > -0.3;
    }
    for (const e of this.world.emitters) e.update(dt, this.time);
    this.qi.update(dt, this.time);
    this.effects.update(dt);
    this.world.flames.forEach((f, i) => {
      if (f.visible) f.scale.set(1, 1 + Math.sin(this.time * 13 + i * 1.7) * 0.18, 1);
    });

    if (this.mode === 'title') this.titleCamera();
    else {
      if (this.mode === 'play') {
        this.updatePlayer(dt);
        this.updateScene();
        this.updatePill();
      }
      this.updateCamera(dt);
      if (this.mode === 'play') this.updateInteract();
    }

    this.updateNpcs(dt);
    this.updateResidents(dt);
    this.updatePeers(dt);
    this.poseBody(this.me, dt, !this.onGround && !this.act, this.inWater);
    this.updateLight();
    this.renderer.render(this.scene, this.camera);
    this.placeTags();

    this.sendClock -= dt;
    if (this.mode !== 'title' && this.sendClock <= 0) {
      this.sendClock = 0.1;
      const card = this.store.wearingCard;
      this.presence.send({
        name: card?.name ?? '过客',
        job: card?.jobName ?? '',
        look: this.me.avatar.look,
        d: this.me.dir.toArray() as [number, number, number],
        f: this.me.fwd.toArray() as [number, number, number],
        h: this.me.h,
        sp: this.me.speed,
        anim: !this.onGround && !this.act ? 'air' : this.me.speed > 0.2 ? 'walk' : 'idle',
        pose: this.me.pose,
        gesture: this.me.gesture,
        scale: this.me.scale,
        aura: this.auraColor(),
      });
      this.presence.prune();
    }
  }

  private titleCamera() {
    const base = dirFromLatLon(-16, -8 + Math.sin(this.time * 0.08) * 22);
    const pos = base.multiplyScalar(96);
    pos.y += 10;
    this.camera.position.copy(pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, -2, 0);
  }

  private updateScene() {
    let scene: Scene = 'town';
    for (const s of this.world.sites) {
      if (surfDist(this.me.dir, s.frame.center) < s.radius) scene = s.id;
    }
    this.audio.setScene(scene);
  }

  private updatePill() {
    if (!this.pill) return;
    if (this.time >= this.pill.until) {
      this.pill = null;
      this.ui.toast('药效过了。');
      this.refreshAura();
    }
  }

  private auraColor(): string | null {
    if (this.act?.kind === 'meditate') return realmOf(this.store.data.cultivation).color;
    if (this.pill?.kind === 'glow') return '#fff1c4';
    return null;
  }

  private refreshAura() {
    this.me.avatar.setAura(this.auraColor());
  }

  private tickIdle(dt: number, label: string) {
    this.idleClock += dt;
    const left = Math.max(0, RULES.idleSeconds - this.idleClock);
    const capped = this.store.data.earned.idle >= RULES.idleCap;
    if (this.idleClock >= RULES.idleSeconds) {
      this.idleClock = 0;
      const got = this.store.earnIdle();
      if (got) {
        this.audio.play('coin');
        this.ui.setTickets(this.store.data.tickets, true);
        this.ui.toast(`待了一会儿 · +${got} 零钱券`);
      }
    }
    return {
      progress: capped ? 1 : Math.min(1, this.idleClock / RULES.idleSeconds),
      sub: capped ? `${label} · 今天的发呆零钱攒满了` : `${label} · 再待 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} 得 1 张零钱券`,
    };
  }

  private updatePlayer(dt: number) {
    const me = this.me;
    const up = me.dir;
    const ax = this.input.axis();
    const emote = this.input.consumeEmote();
    if (emote !== null) this.emote(emote);

    if (this.act) {
      this.updateActivity(dt, ax.mag);
      me.speed = 0;
      return;
    }
    me.pose = 'stand';
    me.gesture = 'none';
    const jump = this.input.consumeJump();

    const camF = tmpV2.copy(this.cam.dir).applyAxisAngle(up, this.cam.yaw);
    projectTangent(camF, up).normalize();
    const camR = new THREE.Vector3().crossVectors(camF, up).normalize();
    const want = new THREE.Vector3().addScaledVector(camF, ax.y).addScaledVector(camR, ax.x);
    const swift = this.pill?.kind === 'swift' ? 1.6 : 1;
    const targetSpeed = ax.mag * (ax.run ? RUN : WALK) * (this.inWater ? 0.6 : 1) * swift;
    if (want.lengthSq() > 1e-4) {
      want.normalize();
      this.moveDir.copy(want);
      if (me.fwd.dot(want) < -0.9) me.fwd.addScaledVector(camR, 0.2);
      me.fwd.lerp(want, 1 - Math.exp(-dt * 12)).normalize();
    }
    me.speed += (targetSpeed - me.speed) * (1 - Math.exp(-dt * (targetSpeed > me.speed ? 10 : 7)));
    if (me.speed > 0.01 && this.moveDir.lengthSq() > 0.5) {
      surfaceStep(up, this.moveDir, me.speed * dt, tmpQ);
      for (const v of [me.dir, me.fwd, this.cam.dir, this.moveDir]) v.applyQuaternion(tmpQ);
    }

    const ground = resolveCollisions(this.colliders, me.dir, me.h);
    for (const v of [me.fwd, this.cam.dir, this.moveDir]) projectTangent(v, me.dir).normalize();

    if (jump && this.onGround) {
      this.vh = JUMP * (this.pill?.kind === 'light' ? 1.55 : 1);
      this.onGround = false;
      this.audio.play('jump');
    }
    if (ground > me.h && ground - me.h < 0.4 && this.onGround) me.h = ground;
    this.vh -= GRAVITY * dt;
    me.h += this.vh * dt;
    if (me.h <= ground) {
      if (!this.onGround && this.vh < -4) this.audio.play('land');
      me.h = ground;
      this.vh = 0;
      this.onGround = true;
    } else if (me.h - ground > 0.05) {
      this.onGround = false;
    }
    me.ground = ground;
    const pd = Math.acos(THREE.MathUtils.clamp(me.dir.dot(this.world.pondDir), -1, 1)) * (180 / Math.PI);
    this.inWater = pd < this.world.pondRadius - 0.6 && ground === 0;
  }

  private begin(kind: ActKind, dir: THREE.Vector3, fwd: THREE.Vector3, h: number, ground: number, extra: Partial<Activity> = {}) {
    const me = this.me;
    me.dir.copy(dir);
    me.fwd.copy(fwd);
    me.h = h;
    me.ground = ground;
    me.speed = 0;
    this.vh = 0;
    this.onGround = true;
    this.inWater = false;
    this.cam.dir.copy(fwd);
    this.cam.yaw = 0;
    this.idleClock = 0;
    this.input.consumeJump();
    this.input.consumeInteract();
    this.act = { kind, spot: null, seat: null, t: 0, pose: 'stand', gesture: 'none', idle: false, auto: false, clock: 0, count: 0, fired: 0, ready: true, ...extra };
  }

  private sit(seat: Seat) {
    if (seat.occupiedBy) return;
    seat.occupiedBy = 'me';
    this.begin('sit', seat.dir, seat.fwd, seat.h, seat.h - 0.3, { seat, pose: 'sit', idle: true });
    this.store.markSat();
    this.ui.showAction(seat.label ? '坐着听歌' : '坐着发呆', [{ label: '起身', onClick: () => this.endActivity() }]);
    this.audio.play('click');
  }

  private startSpot(spot: Spot) {
    const a = ACT[spot.kind];
    if (spot.kind === 'fortune') {
      const today = this.store.data.fortune;
      if (today && today.day === todayKey()) {
        this.ui.showFortune(FORTUNES[today.index], false);
        return;
      }
    }
    this.begin(spot.kind, spot.dir, spot.fwd, spot.h, spot.h, { spot, pose: a.pose, gesture: a.gesture, idle: a.idle });
    this.me.avatar.setProp(a.prop);
    const stand = { label: '起身', onClick: () => this.endActivity() };
    switch (spot.kind) {
      case 'bow':
        this.ui.showAction('拜佛', [stand]);
        this.audio.play('qing');
        break;
      case 'muyu':
        this.ui.showAction('敲木鱼', [
          { label: '敲一下', primary: true, onClick: () => this.tapMuyu() },
          {
            label: '自动',
            key: 'auto',
            onClick: () => {
              if (!this.act) return;
              this.act.auto = !this.act.auto;
              this.ui.setActionButton('auto', this.act.auto ? '停下' : '自动');
            },
          },
          stand,
        ]);
        break;
      case 'meditate':
        this.ui.showAction('打坐', [{ label: '出关', onClick: () => this.endActivity() }]);
        this.audio.play('qing');
        this.refreshAura();
        break;
      case 'pray': {
        this.act!.ready = false;
        const options = [...WISHES].sort(() => Math.random() - 0.5).slice(0, 3);
        options.push('什么都不求，就待一会儿');
        this.input.locked = true;
        void this.ui.dialog('晚钟教堂', '跪下来，想一想', ['闭上眼睛。今晚想把什么放进晚钟里？'], options).then((choice) => {
          this.input.locked = this.ui.modalOpen;
          if (!this.act || this.act.kind !== 'pray') return;
          this.act.ready = true;
          const wish = choice >= 0 ? options[choice] : options[options.length - 1];
          this.store.add('prayers');
          this.audio.play('chime');
          this.effects.orb(this.me.dir.clone().multiplyScalar(R + this.me.h + 1.0), this.me.dir.clone(), '#fff1c4');
          this.ui.toast(choice === options.length - 1 || choice < 0 ? '安静地待一会儿。' : `「${wish}」，放进晚钟里了。`, 3600);
          this.ui.showAction('祈祷', [stand]);
        });
        break;
      }
      case 'incense':
      case 'candle':
        this.ui.showAction(a.title, []);
        this.audio.play('match');
        break;
      case 'fortune':
        this.ui.showAction('摇签', []);
        this.audio.play('rattle');
        break;
      case 'bell':
        this.ui.showAction('敲钟', []);
        break;
      case 'alchemy':
        this.ui.showAction('炼丹', []);
        this.audio.play('whoosh');
        break;
    }
  }

  private tapMuyu() {
    const a = this.act;
    if (!a || a.kind !== 'muyu') return;
    a.clock = 0;
    this.me.gt = 0;
    a.count++;
    this.audio.play('knock');
    const merit = this.store.add('merit');
    const scr = this.toScreen(a.spot!.focus);
    this.ui.floatText('功德 +1', scr.x + (Math.random() - 0.5) * 30, scr.y - 10);
    if (merit % 100 === 0) this.ui.banner(`功德 ${merit}`, '手酸了吧。歇一歇，功德不会跑。');
  }

  private updateActivity(dt: number, move: number) {
    const a = this.act!;
    const me = this.me;
    a.t += dt;
    me.gt += dt;
    me.pose = a.pose;
    me.gesture = a.gesture;
    const jump = this.input.consumeJump();
    const interact = this.input.consumeInteract();
    if (a.idle && a.ready && (move > 0.25 || (a.kind !== 'muyu' && (jump || interact)))) {
      this.endActivity();
      return;
    }
    const d = this.store.data;
    switch (a.kind) {
      case 'sit': {
        const s = this.tickIdle(dt, a.seat?.label ? '管风琴在弹一首老歌' : '什么都不用做');
        this.ui.updateAction(s.progress, a.seat?.label ? '坐着听歌' : '坐着发呆', s.sub);
        break;
      }
      case 'bow': {
        const n = Math.floor(me.gt / 2.4);
        if (n > a.count) {
          a.count = n;
          this.store.add('bows');
          this.audio.play('knock');
          if (a.count === 108) this.ui.banner('一百零八拜', '圆满了。起来活动一下腿吧。');
        }
        const s = this.tickIdle(dt, `一共 ${d.bows} 拜`);
        this.ui.updateAction(s.progress, `第 ${a.count} 拜`, s.sub);
        break;
      }
      case 'muyu': {
        if (jump || interact) this.tapMuyu();
        if (a.auto) {
          a.clock += dt;
          if (a.clock >= 0.6) this.tapMuyu();
        }
        const s = this.tickIdle(dt, '空格 / E 敲一下');
        this.ui.updateAction(s.progress, `功德 ${d.merit}`, s.sub);
        break;
      }
      case 'incense': {
        const dur = 5.1;
        this.ui.updateAction(Math.min(1, a.t / dur), ['一拜', '二拜', '三拜'][Math.min(2, Math.floor(a.t / 1.7))], '心里想一件事就好');
        if (a.t >= dur) {
          const n = this.store.add('incense');
          this.world.temple.setIncense(n);
          this.world.temple.smoke.burst(10);
          this.audio.play('qing');
          this.ui.toast(`上了一炷香。${pick(BLESSINGS)}`, 3400);
          this.endActivity();
        }
        break;
      }
      case 'fortune': {
        this.ui.updateAction(Math.min(1, a.t / 2.2), '摇签', '心里默念想问的事');
        if (a.t >= 2.2) {
          this.audio.play('stick');
          const { index, fresh } = this.store.fortuneToday(() => Math.floor(Math.random() * FORTUNES.length));
          this.endActivity();
          this.ui.showFortune(FORTUNES[index], fresh);
        }
        break;
      }
      case 'bell': {
        this.ui.updateAction(Math.min(1, a.t / 1.3), '敲钟', '');
        if (a.t >= 0.45 && a.fired === 0) {
          a.fired = 1;
          this.audio.play('bigbell');
          this.effects.ring(this.world.temple.bell, this.world.temple.bellUp, '#fff1c4', 7);
          setTimeout(() => this.effects.ring(this.world.temple.bell, this.world.temple.bellUp, '#fff1c4', 11), 350);
        }
        if (a.t >= 1.3) this.endActivity();
        break;
      }
      case 'candle': {
        this.ui.updateAction(Math.min(1, a.t / 1.6), '点蜡烛', '');
        if (a.t >= 1.1 && a.fired === 0) {
          a.fired = 1;
          const n = this.store.add('candles');
          this.world.church.setCandles(n);
          this.audio.play('chime');
          this.ui.toast(n <= 24 ? `点亮了第 ${n} 支蜡烛。` : '蜡烛架满了，你的这支也亮着。');
        }
        if (a.t >= 1.6) this.endActivity();
        break;
      }
      case 'pray': {
        if (!a.ready) break;
        const s = this.tickIdle(dt, '安静地待一会儿');
        this.ui.updateAction(s.progress, '祈祷', s.sub);
        break;
      }
      case 'meditate': {
        const hover = Math.min(0.55, a.t * 0.035) + Math.sin(a.t * 1.3) * 0.04;
        me.h = a.spot!.h + hover;
        a.clock += dt;
        if (a.clock >= 2) {
          a.clock = 0;
          const before = realmOf(d.cultivation).index;
          const total = this.store.add('cultivation');
          const r = realmOf(total);
          const scr = this.toScreen(me.dir.clone().multiplyScalar(R + me.h + 1.6));
          this.ui.floatText('修为 +1', scr.x, scr.y, 'qi');
          if (r.index > before) {
            this.audio.play('levelup');
            this.ui.banner('突破了', `你进入了${r.name}。道长说：先别急着飞升，明天还要上班。`, 4200);
            this.refreshAura();
          }
        }
        this.qi.set(me.dir.clone().multiplyScalar(R + me.h + 0.3), me.dir);
        this.qi.rate = 7;
        const r = realmOf(d.cultivation);
        const s = this.tickIdle(dt, r.next ? `距${r.next.name}还差 ${r.next.at - d.cultivation}` : '已经到顶了');
        this.ui.updateAction(s.progress, `修为 ${d.cultivation} · ${r.name}`, s.sub);
        break;
      }
      case 'alchemy': {
        const dur = 6;
        const k = Math.min(1, a.t / dur);
        this.world.dao.setFire(k);
        if (a.t >= 3 && a.fired === 0) {
          a.fired = 1;
          this.audio.play('whoosh');
        }
        this.ui.updateAction(k, k < 0.5 ? '扇火' : k < 0.9 ? '丹要成了' : '开炉', '火候到了自己会停');
        if (a.t >= dur) {
          const pill = rollPill();
          this.store.add('pills');
          this.endActivity();
          this.world.dao.setFire(0.15);
          setTimeout(() => this.world.dao.setFire(0), 1500);
          if (pill.kind === 'boom') {
            this.audio.play('boom');
            this.world.dao.smoke.burst(40);
            this.ui.banner(pill.name, pill.text);
          } else {
            this.audio.play('pop');
            this.effects.arc(this.world.dao.furnace, () => this.me.dir.clone().multiplyScalar(R + this.me.h + 1.1), this.me.dir.clone(), '#ffd36a', 0.8, () => {
              this.ui.banner(`炼成了「${pill.name}」`, pill.text);
              if (pill.seconds > 0) {
                this.pill = { kind: pill.kind, until: this.time + pill.seconds };
                this.refreshAura();
              }
            });
          }
        }
        break;
      }
    }
  }

  private endActivity() {
    const a = this.act;
    if (!a) return;
    this.act = null;
    this.me.avatar.setProp(null);
    this.me.pose = 'stand';
    this.me.gesture = 'none';
    this.ui.hideAction();
    this.qi.rate = 0;
    if (a.seat) {
      a.seat.occupiedBy = null;
      surfaceStep(this.me.dir, this.me.fwd, 0.7, tmpQ);
      this.me.dir.applyQuaternion(tmpQ);
      this.me.fwd.applyQuaternion(tmpQ);
      this.cam.dir.applyQuaternion(tmpQ);
      this.me.h = this.me.ground;
    }
    if (a.spot) this.me.h = a.spot.h;
    if (a.kind === 'alchemy') this.world.dao.setFire(0);
    this.refreshAura();
  }

  private updateCamera(dt: number) {
    const me = this.me;
    const up = this.cam.up.lerp(me.dir, 1 - Math.exp(-dt * 10)).normalize();
    const cin = this.input.consumeCamera();
    if (this.mode === 'play') {
      this.cam.yaw -= cin.dx * 0.0065;
      this.cam.pitch = THREE.MathUtils.clamp(this.cam.pitch + cin.dy * 0.004, 0.05, 1.0);
      this.cam.dist = THREE.MathUtils.clamp(this.cam.dist + cin.zoom * 0.7, 3.6, 12);
    }
    projectTangent(this.cam.dir, me.dir).normalize();
    if (me.speed > 0.6 && !this.input.dragging && !this.act) {
      if (Math.abs(this.cam.yaw) > 1e-4) {
        this.cam.dir.applyAxisAngle(me.dir, this.cam.yaw);
        this.cam.yaw = 0;
      }
      const align = (1 + this.cam.dir.dot(me.fwd)) / 2;
      this.cam.dir.lerp(me.fwd, (1 - Math.exp(-dt * 1.8)) * align * align).normalize();
    }
    const camF = tmpV2.copy(this.cam.dir).applyAxisAngle(me.dir, this.cam.yaw);
    const pos = me.dir.clone().multiplyScalar(R + me.h);
    const focus = this.cam.focus.lerp(pos.clone().addScaledVector(me.dir, 1.2), this.mode === 'fly' ? 1 : 1 - Math.exp(-dt * 12));
    const desired = focus
      .clone()
      .addScaledVector(camF, -this.cam.dist * Math.cos(this.cam.pitch))
      .addScaledVector(up, this.cam.dist * Math.sin(this.cam.pitch) + 0.4);
    const lookAt = focus.clone().addScaledVector(camF, 1.6);

    if (this.mode === 'fly') {
      this.flyT += dt / 2.6;
      const t = Math.min(1, this.flyT);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const m = new THREE.Matrix4().lookAt(desired, lookAt, up);
      const qTo = new THREE.Quaternion().setFromRotationMatrix(m);
      const fromDir = this.flyFrom.pos.clone().normalize();
      const toDir = desired.clone().normalize();
      const qd = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir);
      const dirNow = fromDir.applyQuaternion(new THREE.Quaternion().slerp(qd, e));
      const r = THREE.MathUtils.lerp(this.flyFrom.pos.length(), desired.length(), e);
      this.camera.position.copy(dirNow.multiplyScalar(r));
      this.camera.quaternion.copy(this.flyFrom.quat).slerp(qTo, e);
      if (t >= 1) {
        this.mode = 'play';
        this.onPlayStart();
      }
      return;
    }
    let target = desired;
    let blocked = false;
    const probe = new THREE.Vector3();
    for (let pass = 0; pass < 2 && !blocked; pass++) {
      for (let i = 2; i <= 14; i++) {
        probe.copy(focus).lerp(target, i / 14);
        const hit = pointBlocked(this.colliders, probe, 0.25, 0.7);
        if (!hit) continue;
        if (hit.bottom !== undefined && pass === 0) {
          const local = probe.clone().normalize().sub(hit.c).multiplyScalar(R).lengthSq() / (2 * R);
          const over = target.length() - R - (hit.bottom + local - 0.45);
          target = target.clone().addScaledVector(up, -Math.max(0, over));
          break;
        }
        target = focus.clone().lerp(target, Math.max(0.1, (i - 1.5) / 14));
        blocked = true;
        break;
      }
    }
    if (blocked && pointBlocked(this.colliders, this.camera.position, 0.1, 0.7)) this.camera.position.copy(target);
    else this.camera.position.lerp(target, 1 - Math.exp(-dt * (blocked ? 18 : 7)));
    this.camera.up.copy(up);
    this.camera.lookAt(lookAt);
  }

  private onPlayStart() {
    if (!this.store.data.wardrobe.length) {
      setTimeout(() => this.ui.toast('站台边上有一台红色盲盒机。去扭一个今晚的自己。', 4200), 400);
      this.ui.notify('checklist', true);
    } else {
      const c = this.store.wearingCard;
      if (c) this.ui.toast(`欢迎回来，${c.name}`);
    }
  }

  private updateLight() {
    let focus: THREE.Vector3;
    let up: THREE.Vector3;
    if (this.mode === 'title') {
      focus = new THREE.Vector3();
      up = this.camera.position.clone().normalize();
    } else {
      focus = this.me.dir.clone().multiplyScalar(R);
      up = this.cam.up;
    }
    const toCam = this.camera.position.clone().sub(focus).normalize();
    const right = new THREE.Vector3().crossVectors(toCam, up).normalize();
    const L = up.clone().multiplyScalar(1).addScaledVector(toCam, 0.55).addScaledVector(right, -0.45).normalize();
    this.light.position.copy(focus).addScaledVector(L, 60);
    this.light.target.position.copy(focus);
  }

  private poseBody(b: Body, dt: number, airborne: boolean, water = false) {
    b.wave = Math.max(0, b.wave - dt);
    if (b !== this.me) b.gt += dt;
    const lower = water && !airborne ? -0.22 : 0;
    b.avatar.root.position.copy(b.dir).multiplyScalar(R + b.h + lower);
    quatFromUpForward(b.dir, b.fwd, b.avatar.root.quaternion);
    const target = b === this.me ? (this.pill?.kind === 'small' ? 0.65 : this.pill?.kind === 'tall' ? 1.35 : 1) : b.scale;
    if (b === this.me) b.scale += (target - b.scale) * (1 - Math.exp(-dt * 6));
    b.avatar.root.scale.setScalar(b.scale);
    const gesture = b.gesture === 'none' && b.wave > 0 ? 'wave' : b.gesture;
    b.avatar.update(dt, { speed: b.speed / WALK, airborne, pose: b.pose, gesture, gt: b.gt });
    b.shadow.position.copy(b.dir).multiplyScalar(R + b.ground + 0.03);
    b.shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.dir);
    const s = Math.max(0.4, 1 - (b.h - b.ground) * 0.25) * b.scale;
    b.shadow.scale.setScalar(b.pose === 'stand' ? s : 1.2 * b.scale);
  }

  private updateNpcs(dt: number) {
    const active = QUESTS.find((q) => q.id === this.store.data.quests.active);
    const done = this.store.data.quests.done;
    for (const n of this.npcs) {
      const want = n.talking ? projectTangent(this.me.dir.clone().sub(n.dir), n.dir).normalize() : n.home;
      if (!n.def.sit && want.lengthSq() > 0.5) n.fwd.lerp(want, 1 - Math.exp(-dt * 5)).normalize();
      let mark: 'quest' | 'deliver' | null = null;
      if (active?.to === n.def.id) mark = 'deliver';
      else if (!active && QUESTS.some((q) => q.from === n.def.id && !done.includes(q.id))) mark = 'quest';
      n.tag.setMark(mark);
      if (!n.def.sit) {
        n.ground = resolveCollisions(this.colliders, n.dir.clone(), 5);
        n.h = n.ground;
      }
      this.poseBody(n, dt, false);
    }
  }

  private updateResidents(dt: number) {
    const show = this.peers.size < 4;
    for (const r of this.residents) {
      r.avatar.root.visible = show;
      r.shadow.visible = show;
      if (!show) {
        r.tag.place(0, 0, false);
        continue;
      }
      if (r.pause > 0) {
        r.pause -= dt;
        r.speed += (0 - r.speed) * (1 - Math.exp(-dt * 6));
      } else {
        const to = projectTangent(r.target.clone().sub(r.dir), r.dir);
        const dist = to.length() * R;
        if (dist < 0.8) {
          r.pause = 3 + Math.random() * 8;
          r.target = dirFromLatLon(-6 + Math.random() * 12, Math.atan2(r.dir.x, r.dir.z) * (180 / Math.PI) + (Math.random() - 0.5) * 70);
        } else {
          to.normalize();
          r.fwd.lerp(to, 1 - Math.exp(-dt * 4)).normalize();
          r.speed += (2.3 - r.speed) * (1 - Math.exp(-dt * 4));
        }
      }
      const before = r.dir.clone();
      if (r.speed > 0.01) {
        surfaceStep(r.dir, r.fwd, r.speed * dt, tmpQ);
        r.dir.applyQuaternion(tmpQ);
        r.fwd.applyQuaternion(tmpQ);
      }
      r.ground = resolveCollisions(this.colliders, r.dir, r.h);
      r.h = r.ground;
      projectTangent(r.fwd, r.dir).normalize();
      if (r.pause <= 0 && r.speed > 1 && surfDist(before, r.dir) < r.speed * dt * 0.3) {
        r.stuck += dt;
        if (r.stuck > 1) {
          r.stuck = 0;
          r.pause = 1;
          r.target = dirFromLatLon(-6 + Math.random() * 12, Math.atan2(r.dir.x, r.dir.z) * (180 / Math.PI) + (Math.random() - 0.5) * 40);
        }
      } else r.stuck = 0;
      r.nextEmote -= dt;
      if (r.nextEmote <= 0) {
        r.nextEmote = 25 + Math.random() * 40;
        r.tag.bubble(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
        r.wave = 1;
      }
      this.poseBody(r, dt, false);
    }
  }

  private updatePeers(dt: number) {
    for (const [id, s] of this.presence.peers) {
      let p = this.peers.get(id);
      const dir = new THREE.Vector3().fromArray(s.d);
      const fwd = new THREE.Vector3().fromArray(s.f);
      const key = JSON.stringify(s.look);
      if (!p) {
        if (this.peers.size >= MAX_WORLD - 1) continue;
        p = { ...this.makeBody(s.look, dir, fwd, s.name, s.job, ''), tDir: dir, tFwd: fwd, tH: s.h, anim: s.anim, lookKey: key, auraKey: null };
        this.peers.set(id, p);
        if (this.mode === 'play') this.ui.toast(`${s.name} 来到了站台`);
      }
      p.tDir.copy(dir);
      p.tFwd.copy(fwd);
      p.tH = s.h;
      p.anim = s.anim;
      p.speed = s.sp;
      p.pose = s.pose;
      if (p.gesture !== s.gesture) p.gt = 0;
      p.gesture = s.gesture;
      p.scale = s.scale;
      if (p.lookKey !== key) {
        p.lookKey = key;
        p.avatar.setLook(s.look);
      }
      if (p.auraKey !== s.aura) {
        p.auraKey = s.aura;
        p.avatar.setAura(s.aura);
      }
      p.tag.setText(s.name, s.job);
    }
    for (const p of this.peers.values()) {
      const k = 1 - Math.exp(-dt * 12);
      p.dir.lerp(p.tDir, k).normalize();
      p.fwd.lerp(p.tFwd, k);
      projectTangent(p.fwd, p.dir).normalize();
      p.h += (p.tH - p.h) * k;
      p.ground = p.pose === 'stand' ? resolveCollisions(this.colliders, p.dir.clone(), p.h) : Math.max(0, p.h - (p.pose === 'sit' ? 0.3 : 0));
      this.poseBody(p, dt, p.anim === 'air');
    }
  }

  private dropPeer(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    this.removeBody(p);
    this.peers.delete(id);
  }

  private updateInteract() {
    const me = this.me;
    let best: Interactable | null = null;
    const consider = (c: Interactable) => {
      if (!best || c.dist < best.dist) best = c;
    };
    if (!this.act && !this.ui.inDialog) {
      for (const n of this.npcs) {
        const d = surfDist(n.dir, me.dir);
        if (d < 2.4) consider({ kind: 'npc', npc: n, dist: d });
      }
      const gd = surfDist(this.world.gacha.dir, me.dir);
      if (gd < 2.0) consider({ kind: 'gacha', dist: gd - 0.5 });
      for (const s of this.world.seats) {
        if (s.occupiedBy) continue;
        const d = surfDist(s.dir, me.dir);
        if (d < 1.3) consider({ kind: 'seat', seat: s, dist: d + 0.3 });
      }
      for (const s of this.world.spots) {
        const d = surfDist(s.dir, me.dir);
        if (d < 1.4 && Math.abs(me.h - s.h) < 0.8) consider({ kind: 'spot', spot: s, dist: d });
      }
    }
    const t = best as Interactable | null;
    if (!t || this.ui.modalOpen) {
      this.ui.setPrompt(null);
      if (!this.act) this.input.consumeInteract();
      return;
    }
    let anchor: THREE.Vector3;
    let text: string;
    if (t.kind === 'npc') {
      anchor = t.npc.dir.clone().multiplyScalar(R + t.npc.h + (t.npc.def.sit ? 1.6 : 2.25));
      text = `和${t.npc.def.name}说话`;
    } else if (t.kind === 'gacha') {
      anchor = this.world.gacha.dir.clone().multiplyScalar(R + 3.0);
      text = '扭盲盒';
    } else if (t.kind === 'seat') {
      anchor = t.seat.dir.clone().multiplyScalar(R + t.seat.h + 1.1);
      text = t.seat.label ?? '坐下发呆';
    } else {
      anchor = t.spot.dir.clone().multiplyScalar(R + t.spot.h + 2.0);
      text = t.spot.label;
    }
    const scr = this.toScreen(anchor);
    const go = () => this.interact(t);
    this.ui.setPrompt(text, scr.x, scr.y, go);
    if (this.input.consumeInteract()) go();
  }

  private interact(t: Interactable) {
    this.ui.setPrompt(null);
    if (t.kind === 'gacha') this.ui.openPanel('gacha');
    else if (t.kind === 'seat') this.sit(t.seat);
    else if (t.kind === 'spot') this.startSpot(t.spot);
    else void this.talk(t.npc);
  }

  private async talk(n: Npc) {
    this.input.locked = true;
    n.talking = true;
    this.me.fwd.copy(projectTangent(n.dir.clone().sub(this.me.dir), this.me.dir).normalize());
    this.me.speed = 0;
    const def = n.def;
    const say = (lines: string[], opts: string[] = []) => this.ui.dialog(def.name, def.title, lines, opts);
    const d = this.store.data;
    const active = QUESTS.find((q) => q.id === d.quests.active);
    const own = QUESTS.find((q) => q.from === def.id && !d.quests.done.includes(q.id));
    const npcName = (id: string) => NPCS.find((x) => x.id === id)!.name;

    if (def.id === 'zhou' && !d.wardrobe.length) {
      await say(['新来的？', '先去站台东头那台红色【盲盒机】扭一个自己。首夜送你三次，抽到的都算数。', '扭完了，就随便走走。往南有寺，北坡有教堂，南边山里还有道观。']);
    } else if (active && active.to === def.id) {
      await say(active.thanks);
      this.store.finishQuest(active.id);
      if (active.flag) {
        this.store.setFlag(active.flag);
        if (active.flag === 'mint') this.world.mint.visible = true;
      }
      const got = this.store.earnTask();
      this.audio.play('quest');
      if (got) {
        setTimeout(() => this.audio.play('coin'), 300);
        this.ui.setTickets(this.store.data.tickets, true);
        this.ui.toast(`送到了 · +${got} 零钱券`);
      } else this.ui.toast('送到了 · 今天的跑腿零钱已经攒满');
      this.ui.notify('checklist', true);
    } else if (own && !active) {
      const choice = await say(own.offer, ['好，我带过去', '下次吧']);
      if (choice === 0) {
        this.store.startQuest(own.id);
        this.audio.play('quest');
        this.ui.toast(`收下了：${own.item} → ${npcName(own.to)}`);
        this.ui.notify('checklist', true);
      }
    } else if (own && active?.id === own.id) {
      await say([`【${own.item}】在你那儿了。`, `交给${npcName(own.to)}就好，不急。`]);
    } else if (own && active) {
      await say([pick(def.idle), `你手上还有给${npcName(active.to)}的东西，先送过去吧。`]);
    } else {
      await say([pick(def.idle)]);
    }
    n.talking = false;
    this.input.locked = this.ui.modalOpen;
  }

  private toScreen(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return {
      x: ((p.x + 1) / 2) * window.innerWidth,
      y: ((1 - p.y) / 2) * window.innerHeight,
      front: p.z < 1 && p.z > -1,
    };
  }

  private placeTag(b: Body, maxDist = 24) {
    const head = b.pose === 'stand' ? 1.95 : b.pose === 'sit' ? 1.45 : 1.35;
    const top = b.dir.clone().multiplyScalar(R + b.h + head * b.scale);
    const camPos = this.camera.position;
    const dist = top.distanceTo(camPos);
    const facing = tmpV.copy(camPos).sub(top).normalize().dot(b.dir) > -0.15;
    const scr = this.toScreen(top);
    const visible = this.mode !== 'title' && b.avatar.root.visible && scr.front && facing && dist < maxDist;
    b.tag.place(scr.x, scr.y, visible, THREE.MathUtils.clamp(10 / dist, 0.85, 1.2));
  }

  private placeTags() {
    this.placeTag(this.me);
    for (const n of this.npcs) this.placeTag(n);
    for (const r of this.residents) if (r.avatar.root.visible) this.placeTag(r);
    for (const p of this.peers.values()) this.placeTag(p);
    for (const s of this.siteTags) {
      const top = s.dir.clone().multiplyScalar(R + 7.5);
      const dist = top.distanceTo(this.camera.position);
      const scr = this.toScreen(top);
      const visible = this.mode !== 'title' && scr.front && dist > 12 && dist < 70;
      s.tag.place(scr.x, scr.y, visible, THREE.MathUtils.clamp(18 / dist, 0.75, 1.25));
    }
  }

  /** Dev helper: jump to a spot on the planet (`?dev`). */
  teleport(lat: number, lon: number, faceDeg = 0) {
    this.endActivity();
    const dir = dirFromLatLon(lat, lon);
    const { south } = tangentFrame(dir);
    this.me.dir.copy(dir);
    this.me.fwd.copy(south.applyAxisAngle(dir, (faceDeg * Math.PI) / 180));
    this.cam.dir.copy(this.me.fwd);
    this.cam.yaw = 0;
    this.me.h = 0;
  }
}
