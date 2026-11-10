import { RARITY, type Card } from '../data/gacha';
import { renderPortrait } from '../game/character';
import type { AudioEngine } from '../audio';
import { RULES, type DrawStatus } from '../state/save';
import type { Fortune } from '../data/rituals';

export const EMOJIS = ['👋', '😊', '😂', '😮', '😢', '❤️', '👍', '💤', '☕', '🌙'];

const ICON = {
  list: '<svg viewBox="0 0 32 32"><rect x="7" y="5" width="18" height="23" rx="2"/><path d="M12 5v-1.5h8V5"/><path d="M11 13l2 2 3-4M18 13h4M11 21l2 2 3-4M18 21h4"/></svg>',
  emote: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11"/><path d="M11 19c2.5 3 7.5 3 10 0"/><path d="M12 12.5v1M20 12.5v1"/></svg>',
  wardrobe: '<svg viewBox="0 0 32 32"><path d="M16 9a2.5 2.5 0 1 1 2.5-2.5"/><path d="M16 9v2L4 20h24L16 11"/><path d="M8 20v7h16v-7"/></svg>',
  settings: '<svg viewBox="0 0 32 32"><path d="M6 12h6l6-5v18l-6-5H6z"/><path d="M22 12c1.5 1.2 1.5 6.8 0 8M25 9c3 3 3 11 0 14"/></svg>',
  jump: '<svg viewBox="0 0 32 32"><path d="M16 25V8M9 14l7-7 7 7"/></svg>',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface ChecklistItem {
  text: string;
  sub?: string;
  state: 'todo' | 'doing' | 'done';
  head?: boolean;
}

export interface ActionButton {
  label: string;
  key?: string;
  primary?: boolean;
  onClick: (b: HTMLButtonElement) => void;
}

export interface UIHandlers {
  onEnter: () => void;
  onEmoji: (i: number) => void;
  onWear: (id: string) => void;
  onDraw: () => Card | null;
  drawStatus: () => DrawStatus;
  wardrobe: () => { cards: Card[]; wearing: string | null };
  onStand: () => void;
  onMusic: (on: boolean) => void;
  onSfx: (on: boolean) => void;
  settings: () => { music: boolean; sfx: boolean };
  onPanel: (open: boolean) => void;
}

type PanelName = 'checklist' | 'emoji' | 'gacha' | 'wardrobe' | 'settings';

export class UI {
  readonly root = el('div');
  readonly anchors = el('div');
  private hud = el('div', 'hud');
  private title = el('div', 'title-screen');
  private toasts = el('div', 'toasts');
  private ticketChip = el('div', 'chip');
  private idChip = el('div', 'chip');
  private buttons: Partial<Record<PanelName, HTMLButtonElement>> = {};
  private panel: { name: PanelName; el: HTMLElement; backdrop?: HTMLElement } | null = null;
  private dialogEl: HTMLElement | null = null;
  private sitbar: HTMLElement | null = null;
  private extraModal = false;
  private portraits = new Map<string, string>();
  readonly promptEl = el('div', 'anchor');
  readonly joy = el('div', 'joy hit', '<div class="knob"></div>');
  readonly jumpBtn = el('button', 'side jump', ICON.jump);
  checklist: () => { items: ChecklistItem[]; tally: string } = () => ({ items: [], tally: '' });
  h!: UIHandlers;

  constructor(private audio: AudioEngine, touch: boolean) {
    this.root.id = 'ui';
    if (touch) this.root.classList.add('touch');
    this.anchors.style.cssText = 'position:fixed;inset:0;';
    this.root.append(this.anchors, this.hud, this.title, this.toasts);
    document.body.append(this.root);
    this.buildTitle();
    this.buildHud();
  }

  portrait(card: Card) {
    let p = this.portraits.get(card.id);
    if (!p) {
      p = renderPortrait(card.look);
      this.portraits.set(card.id, p);
    }
    return p;
  }

  private buildTitle() {
    this.title.innerHTML = `
      <div class="logo"><span>余</span><span>晖</span><span>站</span></div>
      <div class="tag">一颗很小的星球。两班之间，总得有人在站台上坐一会儿。</div>
      <div class="loading">正在铺站台……</div>
      <div class="foot">WASD / 方向键走路 · 空格跳 · Shift 跑 · E 互动 · 拖动转视角 · 多开几个标签页，就能在站台上看见彼此</div>`;
  }

  ready() {
    const loading = this.title.querySelector('.loading')!;
    const btn = el('button', 'btn enter', '进站');
    btn.onclick = () => {
      this.h.onEnter();
      this.audio.play('open');
    };
    loading.replaceWith(btn);
  }

  hideTitle() {
    this.title.classList.add('gone');
    setTimeout(() => this.title.remove(), 800);
    this.hud.classList.add('on');
  }

  private sideButton(name: PanelName, icon: string, style: string, cls = '') {
    const b = el('button', `side ${cls}`, icon + '<span class="dot"></span>');
    b.style.cssText = style;
    b.onclick = () => this.toggle(name);
    b.onmouseenter = () => this.audio.play('hover');
    this.buttons[name] = b;
    this.hud.append(b);
    return b;
  }

  private buildHud() {
    const row = el('div', 'chip-row');
    row.append(this.idChip, this.ticketChip);
    this.hud.append(row);
    this.sideButton('checklist', ICON.list, 'top:18px;right:18px;');
    this.sideButton('emoji', ICON.emote, 'bottom:176px;right:18px;', 'emote');
    this.sideButton('wardrobe', ICON.wardrobe, 'bottom:102px;right:18px;', 'wardrobe-btn');
    this.sideButton('settings', ICON.settings, 'bottom:28px;right:18px;', 'settings-btn');
    this.hud.append(this.joy, this.jumpBtn);
    this.anchors.append(this.promptEl);
  }

  setIdentity(card: Card | null) {
    this.idChip.innerHTML = card
      ? `<small>今晚是</small>${esc(card.name)}<small>${esc(card.jobName)}</small>`
      : `<small>今晚是</small>过客<small>去站台的盲盒机抽一个自己</small>`;
  }

  setTickets(n: number, bump = false) {
    this.ticketChip.innerHTML = `<span class="ticket"></span>${n}<small>零钱券</small>`;
    if (bump) {
      this.ticketChip.classList.remove('bump');
      void this.ticketChip.offsetWidth;
      this.ticketChip.classList.add('bump');
    }
  }

  notify(name: PanelName, on: boolean) {
    this.buttons[name]?.classList.toggle('notify', on);
  }

  toast(text: string, ms = 2600) {
    const t = el('div', 'toast paper', esc(text));
    this.toasts.append(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 260);
    }, ms);
  }

  get panelOpen() {
    return this.panel !== null;
  }

  get modalOpen() {
    return this.panel?.backdrop !== undefined || this.dialogEl !== null || this.extraModal;
  }

  toggle(name: PanelName) {
    if (this.panel?.name === name) this.closePanel();
    else this.openPanel(name);
  }

  closePanel() {
    if (!this.panel) return;
    this.panel.el.remove();
    this.panel.backdrop?.remove();
    this.buttons[this.panel.name]?.classList.remove('active');
    this.panel = null;
    this.audio.play('close');
    this.h.onPanel(false);
  }

  openPanel(name: PanelName) {
    if (this.panel) this.closePanel();
    let p: HTMLElement;
    let backdrop: HTMLElement | undefined;
    switch (name) {
      case 'checklist':
        p = this.buildChecklist();
        break;
      case 'emoji':
        p = this.buildEmoji();
        break;
      case 'settings':
        p = this.buildSettings();
        break;
      case 'gacha':
      case 'wardrobe':
        backdrop = el('div', 'backdrop');
        backdrop.onclick = () => this.closePanel();
        this.hud.append(backdrop);
        p = name === 'gacha' ? this.buildGacha() : this.buildWardrobe();
        break;
    }
    const x = el('button', 'x', '×');
    x.onclick = () => this.closePanel();
    p.append(x);
    this.hud.append(p);
    this.panel = { name, el: p, backdrop };
    this.buttons[name]?.classList.add('active');
    this.audio.play('open');
    this.h.onPanel(true);
  }

  refreshPanel() {
    if (this.panel && this.panel.name !== 'gacha') {
      const name = this.panel.name;
      this.panel.el.remove();
      this.panel.backdrop?.remove();
      this.panel = null;
      this.openPanelSilently(name);
    }
  }

  private openPanelSilently(name: PanelName) {
    const was = this.audio.sfxOn;
    this.audio.sfxOn = false;
    this.openPanel(name);
    this.audio.sfxOn = was;
  }

  private buildChecklist() {
    const p = el('div', 'panel paper checklist');
    const { items, tally } = this.checklist();
    p.innerHTML = `<h3>今晚的清单</h3><ul>${items
      .map((i) =>
        i.head
          ? `<li class="head">${esc(i.text)}</li>`
          : `<li class="${i.state}"><span class="box">${i.state === 'done' ? '✓' : i.state === 'doing' ? '✉' : ''}</span><span><span class="t">${esc(i.text)}</span>${i.sub ? `<span class="s">${esc(i.sub)}</span>` : ''}</span></li>`,
      )
      .join('')}</ul><div class="tally">${esc(tally)}</div>`;
    return p;
  }

  private buildEmoji() {
    const p = el('div', 'panel paper emojis');
    EMOJIS.forEach((e, i) => {
      const b = el('button', '', e);
      b.onclick = () => {
        this.h.onEmoji(i);
        this.closePanel();
      };
      p.append(b);
    });
    p.append(el('div', 'k', '只能用表情打招呼 · 数字键 1–0 也行'));
    return p;
  }

  private buildSettings() {
    const p = el('div', 'panel paper settings');
    const s = this.h.settings();
    const row = (label: string, on: boolean, fn: (v: boolean) => void) => {
      const l = el('label', '', `${label}<span class="tg ${on ? 'on' : ''}"></span>`);
      l.onclick = () => {
        const tg = l.querySelector('.tg')!;
        const v = !tg.classList.contains('on');
        tg.classList.toggle('on', v);
        fn(v);
        this.audio.play('click');
      };
      return l;
    };
    p.append(el('h3', '', '声音'), row('音乐', s.music, this.h.onMusic), row('音效', s.sfx, this.h.onSfx));
    p.append(
      el(
        'div',
        'help',
        'WASD / 方向键走路，Shift 跑，空格跳<br>E 或点提示气泡：对话、坐下、抽盲盒、上香、拜佛……<br>敲木鱼时按空格或 E 敲一下<br>拖动画面转视角，滚轮拉远拉近<br>坐着、跪着、打坐满 ' +
          Math.round(RULES.idleSeconds / 60 || 1) +
          ' 分钟得 1 张零钱券<br>寺在南边，教堂在北坡，道观在南边山里',
      ),
    );
    return p;
  }

  cardEl(card: Card, reveal = false) {
    const r = RARITY[card.rarity];
    const c = el('div', `card ${card.rarity}${reveal ? ' reveal' : ''}`);
    c.innerHTML = `
      <div class="band" style="background-color:${r.color}"><span>${r.label}</span><span>余晖站</span></div>
      <div class="portrait"><img alt="" src="${this.portrait(card)}"></div>
      <div class="body">
        <div class="nm">${esc(card.name)}</div>
        <div class="job">${esc(card.jobName)}</div>
        <div class="meta">小动作：${esc(card.action)}</div>
        <div class="meta">随身：${esc(card.accName)}</div>
        <div class="quote">「${esc(card.line)}」</div>
        <div class="serial"><span>No.${String(card.serial).padStart(4, '0')}</span><span>${card.day}</span></div>
      </div>`;
    return c;
  }

  private buildGacha() {
    const p = el('div', 'panel paper modal');
    const status = this.h.drawStatus();
    p.innerHTML = `<h3>盲盒机</h3><p class="sub">投进去的不是钱，是今晚。抽到的人，就是今晚的你。</p>`;
    const stage = el('div', 'gacha-stage');
    const capsule = el('div', 'capsule idle', '<div class="half top"></div><div class="half bot"></div>');
    const info = el('div', '', `<div style="font-family:var(--display);font-size:20px;text-align:center">${esc(status.title)}</div><div class="sub" style="text-align:center;margin-top:4px">${esc(status.detail)}</div>`);
    const actions = el('div', 'gacha-actions');
    const go = el('button', 'btn', status.free ? '扭一下' : status.can ? `用 ${status.cost} 券扭一下` : '扭不动了');
    go.disabled = !status.can;
    actions.append(go);
    stage.append(capsule, info, actions);
    p.append(stage);
    p.append(
      el(
        'div',
        'odds',
        `普通 ${RARITY.common.p * 100}% · 少见 ${RARITY.uncommon.p * 100}% · 稀有 ${RARITY.rare.p * 100}%<br>稀有只让你更好看，不让你更厉害。抽到的都会留在衣柜里。`,
      ),
    );
    const roll = () => {
      go.disabled = true;
      capsule.classList.remove('idle');
      capsule.classList.add('shake');
      this.audio.play('rattle');
      setTimeout(() => {
        const card = this.h.onDraw();
        if (!card) {
          this.closePanel();
          return;
        }
        capsule.classList.remove('shake');
        capsule.classList.add('open');
        this.audio.play(card.rarity === 'rare' ? 'rare' : 'reveal');
        setTimeout(() => this.showReveal(p, stage, card), 380);
      }, 900);
    };
    go.onclick = roll;
    capsule.onclick = () => !go.disabled && roll();
    return p;
  }

  private showReveal(p: HTMLElement, stage: HTMLElement, card: Card) {
    stage.innerHTML = '';
    const view = el('div', 'wardrobe-view');
    view.append(this.cardEl(card, true));
    stage.append(view);
    const st = this.h.drawStatus();
    const wardrobe = this.h.wardrobe();
    const actions = el('div', 'gacha-actions');
    const wear = el('button', 'btn', wardrobe.wearing === card.id ? '已经穿上了' : '今晚就是 TA');
    wear.disabled = wardrobe.wearing === card.id;
    wear.onclick = () => {
      this.h.onWear(card.id);
      wear.textContent = '已经穿上了';
      wear.disabled = true;
      this.audio.play('click');
    };
    const save = el('button', 'btn ghost', '存成图片');
    save.onclick = () => {
      this.saveCard(card);
      this.audio.play('click');
    };
    const again = el('button', 'btn ghost', st.can ? (st.free ? '再扭一个' : `用 ${st.cost} 券再扭`) : '今天到这儿');
    again.disabled = !st.can;
    again.onclick = () => {
      this.closePanel();
      this.openPanel('gacha');
    };
    actions.append(wear, save, again);
    stage.append(actions, el('div', 'sub', esc(st.title)));
  }

  private buildWardrobe() {
    const p = el('div', 'panel paper modal');
    const { cards, wearing } = this.h.wardrobe();
    p.innerHTML = `<h3>衣柜</h3><p class="sub">${cards.length ? `抽到过 ${cards.length} 个自己。点一下，就换成 TA。` : '还是空的。站台边上有一台盲盒机。'}</p>`;
    if (!cards.length) return p;
    const cur = cards.find((c) => c.id === wearing) ?? cards[0];
    const view = el('div', 'wardrobe-view');
    const big = this.cardEl(cur);
    view.append(big);
    const side = el('div', '');
    side.style.cssText = 'display:flex;flex-direction:column;gap:10px;align-items:center;';
    const save = el('button', 'btn ghost small', '存成图片');
    save.onclick = () => this.saveCard(cur);
    side.append(save);
    view.append(side);
    p.append(view);
    const grid = el('div', 'wardrobe');
    for (const c of cards) {
      const r = RARITY[c.rarity];
      const b = el(
        'button',
        `mini ${c.id === wearing ? 'on' : ''}`,
        `<div class="pt"><img alt="" src="${this.portrait(c)}"><i style="background:${r.color}">${r.label}</i></div><div class="tx"><b>${esc(c.name)}</b><span>${esc(c.jobName)}</span></div>`,
      );
      b.onclick = () => {
        this.h.onWear(c.id);
        this.audio.play('click');
        this.refreshPanel();
      };
      grid.append(b);
    }
    p.append(grid);
    return p;
  }

  saveCard(card: Card) {
    const W = 720, H = 1040;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const r = RARITY[card.rarity];
    const ink = '#2b3236';
    g.fillStyle = '#75bdc3';
    g.fillRect(0, 0, W, H);
    const rr = (x: number, y: number, w: number, h: number, rad: number) => {
      g.beginPath();
      g.roundRect(x, y, w, h, rad);
    };
    rr(60, 60, 600, 920, 28);
    g.fillStyle = ink;
    g.save();
    g.translate(0, 12);
    g.fill();
    g.restore();
    g.fillStyle = '#f8f6ef';
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = ink;
    g.stroke();
    g.save();
    rr(60, 60, 600, 920, 28);
    g.clip();
    g.fillStyle = r.color;
    g.fillRect(60, 60, 600, 70);
    g.fillStyle = '#75bdc3';
    g.fillRect(60, 130, 600, 470);
    g.fillStyle = '#a3dcdc';
    g.beginPath();
    g.ellipse(150, 230, 190, 80, 0, 0, Math.PI * 2);
    g.ellipse(560, 520, 160, 66, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = ink;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(60, 130);
    g.lineTo(660, 130);
    g.moveTo(60, 600);
    g.lineTo(660, 600);
    g.stroke();
    const font = '"ZCOOL QingKe HuangYou", "PingFang SC", sans-serif';
    g.fillStyle = ink;
    g.font = `36px ${font}`;
    g.textBaseline = 'middle';
    g.fillText(r.label, 92, 96);
    g.textAlign = 'right';
    g.fillText('余晖站', 628, 96);
    g.textAlign = 'left';
    const img = new Image();
    img.onload = () => {
      g.drawImage(img, 150, 140, 420, 460);
      g.fillStyle = ink;
      g.textBaseline = 'alphabetic';
      g.font = `84px ${font}`;
      g.fillText(card.name, 96, 700);
      g.font = `40px ${font}`;
      g.fillStyle = '#647a87';
      g.fillText(card.jobName, 96, 756);
      g.fillStyle = ink;
      g.font = '28px "PingFang SC", sans-serif';
      g.fillText(`小动作：${card.action}`, 96, 812);
      g.fillText(`随身：${card.accName}`, 96, 852);
      g.fillStyle = '#f3c258';
      g.fillRect(96, 878, 8, 44);
      g.fillStyle = ink;
      g.font = 'italic 30px "PingFang SC", sans-serif';
      g.fillText(`「${card.line}」`, 120, 912, 520);
      g.globalAlpha = 0.55;
      g.font = '22px "PingFang SC", sans-serif';
      g.fillText(`No.${String(card.serial).padStart(4, '0')} · ${card.day}`, 96, 956);
      g.globalAlpha = 1;
      const a = document.createElement('a');
      a.download = `余晖站-${card.name}.png`;
      a.href = c.toDataURL('image/png');
      a.click();
      this.toast('卡片存好了');
    };
    img.src = renderPortrait(card.look, 420, 460);
  }

  dialog(who: string, title: string, lines: string[], options: string[] = []): Promise<number> {
    this.closePanel();
    return new Promise((resolve) => {
      const d = el('div', 'dialog paper');
      d.innerHTML = `<div class="who">${esc(who)}<small>${esc(title)}</small></div><div class="text"></div><div class="next">▼</div>`;
      const textEl = d.querySelector('.text') as HTMLElement;
      const nextEl = d.querySelector('.next') as HTMLElement;
      this.hud.append(d);
      this.dialogEl = d;
      let i = 0;
      let typing = 0;
      let full = '';
      let timer = 0;
      const render = (s: string) => {
        textEl.innerHTML = esc(s).replace(/【(.+?)】/g, '<span class="item">$1</span>');
      };
      const finish = (choice: number) => {
        clearInterval(timer);
        window.removeEventListener('keydown', onKey);
        d.remove();
        this.dialogEl = null;
        resolve(choice);
      };
      const showOpts = () => {
        if (!options.length || i < lines.length - 1) return;
        nextEl.style.display = 'none';
        const box = el('div', 'opts');
        options.forEach((o, k) => {
          const b = el('button', `btn small ${k ? 'ghost' : ''}`, esc(o));
          b.onclick = (e) => {
            e.stopPropagation();
            this.audio.play('click');
            finish(k);
          };
          box.append(b);
        });
        d.append(box);
      };
      const type = () => {
        full = lines[i];
        typing = 0;
        nextEl.style.display = '';
        clearInterval(timer);
        timer = window.setInterval(() => {
          typing += 1;
          render([...full].slice(0, typing).join(''));
          if (typing % 2 === 0) this.audio.play('blip');
          if (typing >= [...full].length) {
            clearInterval(timer);
            typing = -1;
            showOpts();
          }
        }, 32);
      };
      const advance = () => {
        if (typing >= 0) {
          clearInterval(timer);
          typing = -1;
          render(full);
          showOpts();
          return;
        }
        if (options.length && i === lines.length - 1) return;
        i += 1;
        if (i >= lines.length) {
          this.audio.play('close');
          finish(-1);
          return;
        }
        type();
      };
      const onKey = (e: KeyboardEvent) => {
        if (['Space', 'Enter', 'KeyE'].includes(e.code)) {
          e.preventDefault();
          e.stopPropagation();
          advance();
        }
        if (e.code === 'Escape') finish(-1);
      };
      d.onclick = advance;
      setTimeout(() => window.addEventListener('keydown', onKey), 50);
      type();
    });
  }

  get inDialog() {
    return this.dialogEl !== null;
  }

  showAction(title: string, buttons: ActionButton[]) {
    this.hideAction();
    const s = el('div', 'sitbar paper', `<span class="ring"></span><span class="txt"><b class="lbl">${esc(title)}</b><small class="sub"></small></span>`);
    for (const btn of buttons) {
      const b = el('button', `btn small ${btn.primary ? '' : 'ghost'}`, esc(btn.label));
      b.dataset.key = btn.key ?? '';
      b.onclick = (e) => {
        e.stopPropagation();
        btn.onClick(b);
      };
      s.append(b);
    }
    this.hud.append(s);
    this.sitbar = s;
  }

  updateAction(progress: number, text: string, sub = '') {
    if (!this.sitbar) return;
    (this.sitbar.querySelector('.ring') as HTMLElement).style.setProperty('--p', `${Math.round(progress * 100)}%`);
    const lbl = this.sitbar.querySelector('.lbl') as HTMLElement;
    if (lbl.textContent !== text) lbl.textContent = text;
    const s = this.sitbar.querySelector('.sub') as HTMLElement;
    if (s.textContent !== sub) s.textContent = sub;
  }

  setActionButton(key: string, label: string) {
    const b = this.sitbar?.querySelector(`button[data-key="${key}"]`);
    if (b) b.textContent = label;
  }

  hideAction() {
    this.sitbar?.remove();
    this.sitbar = null;
  }

  floatText(text: string, x: number, y: number, cls = '') {
    const f = el('div', `float ${cls}`, esc(text));
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    this.anchors.append(f);
    setTimeout(() => f.remove(), 1300);
  }

  banner(title: string, text: string, ms = 3200) {
    this.hud.querySelector('.banner')?.remove();
    const b = el('div', 'banner paper', `<h3>${esc(title)}</h3><p>${esc(text)}</p>`);
    this.hud.append(b);
    setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => b.remove(), 300);
    }, ms);
  }

  showFortune(f: Fortune, fresh: boolean) {
    this.closePanel();
    const backdrop = el('div', 'backdrop');
    const p = el('div', 'panel paper modal fortune');
    p.innerHTML = `
      <div class="lot"><span>${esc(f.no)}</span><b class="lv lv-${f.level}">${esc(f.level)}签</b></div>
      <div class="poem">${f.poem.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="read"><b>解签</b>${esc(f.read)}</div>
      <p class="sub" style="text-align:center">${fresh ? '一天只求一签。明天再来，会是新的。' : '今天已经求过了，签还是这一支。'}</p>`;
    const ok = el('button', 'btn', '收下');
    const row = el('div', 'gacha-actions');
    row.append(ok);
    p.append(row);
    const close = () => {
      p.remove();
      backdrop.remove();
      this.extraModal = false;
      this.h.onPanel(false);
      this.audio.play('close');
    };
    ok.onclick = close;
    backdrop.onclick = close;
    this.hud.append(backdrop, p);
    this.extraModal = true;
    this.h.onPanel(true);
    this.audio.play('open');
  }

  setPrompt(text: string | null, x = 0, y = 0, onClick?: () => void) {
    if (!text) {
      this.promptEl.style.display = 'none';
      this.promptEl.dataset.t = '';
      return;
    }
    this.promptEl.style.display = '';
    if (this.promptEl.dataset.t !== text) {
      this.promptEl.dataset.t = text;
      this.promptEl.innerHTML = '';
      const p = el('div', 'prompt hit', `<span class="key">E</span>${esc(text)}`);
      p.onclick = () => onClick?.();
      this.promptEl.append(p);
    }
    this.promptEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}
