import { rollCard, type Card } from '../data/gacha';

export const RULES = {
  firstNight: 3,
  dailyCap: 3,
  drawCost: 6,
  taskReward: 2,
  taskCap: 2,
  idleReward: 1,
  idleCap: 3,
  idleSeconds: new URLSearchParams(location.search).has('dev') ? 15 : 300,
};

export interface SaveData {
  v: 1;
  deviceId: string;
  createdDay: string;
  firstNightLeft: number;
  tickets: number;
  serial: number;
  wardrobe: Card[];
  wearing: string | null;
  draws: { day: string; count: number; freeUsed: boolean };
  earned: { day: string; tasks: number; idle: number };
  quests: { done: string[]; active: string | null };
  flags: string[];
  sat: boolean;
  settings: { music: boolean; sfx: boolean };
  merit: number;
  bows: number;
  incense: number;
  candles: number;
  prayers: number;
  cultivation: number;
  pills: number;
  fortune: { day: string; index: number } | null;
}

export type Counter = 'merit' | 'bows' | 'incense' | 'candles' | 'prayers' | 'cultivation' | 'pills';

const KEY = 'yuhui.save.v1';

export function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function fresh(): SaveData {
  const day = todayKey();
  return {
    v: 1,
    deviceId: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    createdDay: day,
    firstNightLeft: RULES.firstNight,
    tickets: 0,
    serial: 0,
    wardrobe: [],
    wearing: null,
    draws: { day, count: 0, freeUsed: false },
    earned: { day, tasks: 0, idle: 0 },
    quests: { done: [], active: null },
    flags: [],
    sat: false,
    settings: { music: true, sfx: true },
    merit: 0,
    bows: 0,
    incense: 0,
    candles: 0,
    prayers: 0,
    cultivation: 0,
    pills: 0,
    fortune: null,
  };
}

export interface DrawStatus {
  can: boolean;
  free: boolean;
  cost: number;
  title: string;
  detail: string;
}

type Listener = () => void;

export class Store {
  data: SaveData;
  private listeners = new Set<Listener>();

  constructor() {
    let d: SaveData | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) d = JSON.parse(raw) as SaveData;
    } catch {
      d = null;
    }
    this.data = d && d.v === 1 ? { ...fresh(), ...d } : fresh();
    this.rollDay();
  }

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit() {
    localStorage.setItem(KEY, JSON.stringify(this.data));
    this.listeners.forEach((fn) => fn());
  }

  private rollDay() {
    const day = todayKey();
    const d = this.data;
    if (d.draws.day !== day) d.draws = { day, count: 0, freeUsed: false };
    if (d.earned.day !== day) d.earned = { day, tasks: 0, idle: 0 };
  }

  get wearingCard(): Card | null {
    return this.data.wardrobe.find((c) => c.id === this.data.wearing) ?? null;
  }

  drawStatus(): DrawStatus {
    this.rollDay();
    const d = this.data;
    if (d.firstNightLeft > 0) {
      return { can: true, free: true, cost: 0, title: `首夜赠送，还剩 ${d.firstNightLeft} 次`, detail: '三次抽到的都会留在衣柜里。' };
    }
    if (d.draws.count >= RULES.dailyCap) {
      return { can: false, free: false, cost: 0, title: `今天已经抽了 ${RULES.dailyCap} 次`, detail: '明天再来。盲盒机也要睡一会儿。' };
    }
    if (!d.draws.freeUsed) {
      return { can: true, free: true, cost: 0, title: '今天的免费一次', detail: `今天已抽 ${d.draws.count}/${RULES.dailyCap}` };
    }
    const enough = d.tickets >= RULES.drawCost;
    return {
      can: enough,
      free: false,
      cost: RULES.drawCost,
      title: enough ? `用 ${RULES.drawCost} 张零钱券再抽一次` : `再抽一次需要 ${RULES.drawCost} 张零钱券`,
      detail: `今天已抽 ${d.draws.count}/${RULES.dailyCap} · 帮人跑腿或在长椅上发呆可以攒券`,
    };
  }

  draw(): Card | null {
    const s = this.drawStatus();
    if (!s.can) return null;
    const d = this.data;
    if (d.firstNightLeft > 0) d.firstNightLeft -= 1;
    else if (s.free) d.draws.freeUsed = true;
    else d.tickets -= s.cost;
    d.draws.count += 1;
    d.serial += 1;
    const card = rollCard(d.serial, todayKey());
    d.wardrobe.unshift(card);
    if (!d.wearing) d.wearing = card.id;
    this.commit();
    return card;
  }

  wear(id: string) {
    this.data.wearing = id;
    this.commit();
  }

  earnTask(): number {
    this.rollDay();
    const e = this.data.earned;
    if (e.tasks >= RULES.taskCap) return 0;
    e.tasks += 1;
    this.data.tickets += RULES.taskReward;
    this.commit();
    return RULES.taskReward;
  }

  earnIdle(): number {
    this.rollDay();
    const e = this.data.earned;
    if (e.idle >= RULES.idleCap) return 0;
    e.idle += 1;
    this.data.tickets += RULES.idleReward;
    this.commit();
    return RULES.idleReward;
  }

  startQuest(id: string) {
    this.data.quests.active = id;
    this.commit();
  }

  finishQuest(id: string) {
    if (!this.data.quests.done.includes(id)) this.data.quests.done.push(id);
    if (this.data.quests.active === id) this.data.quests.active = null;
    this.commit();
  }

  setFlag(f: string) {
    if (!this.data.flags.includes(f)) this.data.flags.push(f);
    this.commit();
  }

  hasFlag(f: string) {
    return this.data.flags.includes(f);
  }

  markSat() {
    if (this.data.sat) return;
    this.data.sat = true;
    this.commit();
  }

  setSetting(k: 'music' | 'sfx', v: boolean) {
    this.data.settings[k] = v;
    this.commit();
  }

  add(k: Counter, n = 1) {
    this.data[k] += n;
    this.commit();
    return this.data[k];
  }

  /** Today's fortune stick, drawn once per day. */
  fortuneToday(roll: () => number): { index: number; fresh: boolean } {
    const day = todayKey();
    const f = this.data.fortune;
    if (f && f.day === day) return { index: f.index, fresh: false };
    const index = roll();
    this.data.fortune = { day, index };
    this.commit();
    return { index, fresh: true };
  }
}
