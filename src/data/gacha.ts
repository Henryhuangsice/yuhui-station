import type { AccKind, HairKind, HatKind, Look } from '../game/character';

export type Rarity = 'common' | 'uncommon' | 'rare';

export const RARITY: Record<Rarity, { label: string; p: number; color: string }> = {
  common: { label: '普通', p: 0.7, color: '#a0a8a6' },
  uncommon: { label: '少见', p: 0.25, color: '#66BDE6' },
  rare: { label: '稀有', p: 0.05, color: '#f3c258' },
};

interface Job {
  id: string;
  name: string;
  hat: HatKind;
  hatColor: string;
  jacket: string;
  action: string;
  lines: string[];
}

export const JOBS: Job[] = [
  { id: 'elevator', name: '电梯守夜人', hat: 'cap', hatColor: '#3c4a5c', jacket: '#4a5d73', action: '坐下时会看一眼楼层灯', lines: ['这一层没有人按，我就待着。', '上去的人都会下来的。', '今晚的电梯很乖。'] },
  { id: 'tuner', name: '雨夜调音师', hat: 'headphones', hatColor: '#2b3236', jacket: '#3f8f8a', action: '走路时跟着雨点点头', lines: ['这点雨够用了。', '城市今天跑调了半个音。', '听，空调外机在打拍子。'] },
  { id: 'barista', name: '记忆咖啡师', hat: 'beanie', hatColor: '#7a6252', jacket: '#b9785a', action: '手里一直端着没喝的杯子', lines: ['你的那杯我记成热的。', '今天的苦，我少放了一点。', '有些味道明天才想起来。'] },
  { id: 'scavenger', name: '信号拾荒者', hat: 'antenna', hatColor: '#647A87', jacket: '#8a8f5a', action: '偶尔抬头看看天线', lines: ['今晚的信号很干净。', '有人在很远的地方说晚安。', '我捡到半句没发出去的话。'] },
  { id: 'billboard', name: '广告牌修补员', hat: 'helmet', hatColor: '#f3c258', jacket: '#de794e', action: '路过灯箱会顺手拍一下', lines: ['那块字我补好了，没人会发现。', '「今晚不加班」这四个字最难修。', '亮着就行，不用多亮。'] },
  { id: 'announcer', name: '站台广播员', hat: 'cap', hatColor: '#8f3f3f', jacket: '#c25959', action: '站着的时候会清一下嗓子', lines: ['下一班车，会来的。', '请在黄线后面，慢慢来。', '本站是余晖站，不着急的乘客请下车。'] },
  { id: 'window', name: '橱窗布景师', hat: 'beret', hatColor: '#2b3236', jacket: '#d9a7b0', action: '会把歪掉的东西扶正', lines: ['把一盏灯摆正，也算下班。', '橱窗里的人比我早睡。', '今天的布景叫「什么都不用做」。'] },
  { id: 'gardener', name: '夜间植物员', hat: 'straw', hatColor: '#e6cf8e', jacket: '#6f9e6f', action: '蹲下来摸一摸叶子', lines: ['它们晚上也在长。', '浇水不用急，土会等你。', '这盆薄荷今天心情不错。'] },
];

const PREFIX = ['慢', '暖', '潮', '晚', '微', '浅', '旧', '软', '静', '迟', '小', '淡', '半', '远', '轻', '雾', '夜', '余', '闲', '青', '白', '回', '落', '空'];
const SUFFIX = ['灯', '声', '云', '线', '雨', '站', '舟', '叶', '光', '风', '桥', '窗', '猫', '栈', '眠', '汐', '屿', '港', '巷', '帆', '铃', '川', '灰', '星'];

const OUTFITS: { pants: string; shoes: string; hair: HairKind; hairColor: string; skin: string }[] = [
  { pants: '#565c5f', shoes: '#2b3236', hair: 'short', hairColor: '#2f2a2a', skin: '#f1d3bd' },
  { pants: '#9aa58a', shoes: '#f8f8f8', hair: 'buns', hairColor: '#3a2e2a', skin: '#eac4a8' },
  { pants: '#3e4a5e', shoes: '#c25959', hair: 'bob', hairColor: '#5a4032', skin: '#f6dcc8' },
  { pants: '#bcb1a4', shoes: '#647A87', hair: 'pony', hairColor: '#1f1d1d', skin: '#e2b896' },
  { pants: '#2b3236', shoes: '#f3c258', hair: 'spiky', hairColor: '#6b5a4a', skin: '#f1d3bd' },
  { pants: '#7d8f9a', shoes: '#ebced0', hair: 'short', hairColor: '#b9b0a6', skin: '#d9ab88' },
];

const ACCS: { kind: AccKind; name: string }[] = [
  { kind: 'none', name: '空着手' },
  { kind: 'backpack', name: '双肩包' },
  { kind: 'satchel', name: '斜挎包' },
  { kind: 'scarf', name: '围巾' },
  { kind: 'glasses', name: '圆眼镜' },
  { kind: 'apron', name: '围裙' },
];

const ACC_COLORS = ['#c25959', '#75B9B5', '#f3c258', '#647A87', '#ebced0', '#8cc48c'];
const NEONS = ['#ff8fd6', '#7af0ff', '#d4ff7a'];

export interface Card {
  id: string;
  serial: number;
  name: string;
  jobId: string;
  jobName: string;
  rarity: Rarity;
  accName: string;
  action: string;
  line: string;
  day: string;
  look: Look;
}

function pick<T>(list: T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

export function rollRarity(rnd: () => number): Rarity {
  const r = rnd();
  if (r < RARITY.rare.p) return 'rare';
  if (r < RARITY.rare.p + RARITY.uncommon.p) return 'uncommon';
  return 'common';
}

export function rollCard(serial: number, day: string, rnd: () => number = Math.random): Card {
  const job = pick(JOBS, rnd);
  const outfit = pick(OUTFITS, rnd);
  const acc = pick(ACCS, rnd);
  const rarity = rollRarity(rnd);
  const name = pick(PREFIX, rnd) + pick(SUFFIX, rnd);
  let accColor = pick(ACC_COLORS, rnd);
  let hatColor = job.hatColor;
  let neon: string | null = null;
  if (rarity === 'uncommon') {
    accColor = '#66BDE6';
    hatColor = '#f8f8f8';
  }
  if (rarity === 'rare') {
    neon = pick(NEONS, rnd);
    accColor = '#2b3236';
  }
  const look: Look = {
    skin: outfit.skin,
    hair: outfit.hair,
    hairColor: outfit.hairColor,
    hat: job.hat,
    hatColor,
    jacket: job.jacket,
    pants: outfit.pants,
    shoes: outfit.shoes,
    acc: acc.kind,
    accColor,
    neon,
  };
  return {
    id: `${Date.now().toString(36)}-${Math.floor(rnd() * 1e6).toString(36)}`,
    serial,
    name,
    jobId: job.id,
    jobName: job.name,
    rarity,
    accName: acc.name,
    action: job.action,
    line: pick(job.lines, rnd),
    day,
    look,
  };
}

export const NAME_PREFIX = PREFIX;
export const NAME_SUFFIX = SUFFIX;
