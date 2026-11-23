// Shared between the browser and the local dev-server proxy (server/aiProxy.ts).
// Everything the model may output is checked here, so the game never shows unchecked text.

export type FortuneLevel = '上上' | '上' | '中' | '下';

export interface AiFortune {
  level: FortuneLevel;
  poem: [string, string, string, string];
  read: string;
}

export interface AiLetter {
  /** A small, gentle physical object the worry turns into. */
  item: string;
  /** Recipient NPC id (whitelisted, never the station master). */
  to: string;
  /** What 老周 says when handing the item over. */
  offer: [string, string];
  /** What the recipient says on delivery. */
  thanks: [string, string];
  /** The reply letter shown after delivery. */
  reply: string;
}

export type AiTask = 'fortune' | 'letter';

export interface AiRequest {
  task: AiTask;
  text: string;
  /** Residents who received the player's recent letters; the model should pick someone else. */
  avoid?: string[];
}

export type AiSource = 'ai' | 'fallback' | 'safety';

export interface AiResponse<T> {
  source: AiSource;
  data: T | null;
  /** Why we fell back (no key, timeout, invalid output, refusal ...). */
  reason?: string;
  ms?: number;
}

export const MAX_INPUT = 60;

/** Recipients the model may pick. 老周 is the post office, so he is not a recipient. */
export const RECIPIENTS: { id: string; name: string; title: string; voice: string; good: string }[] = [
  { id: 'chen', name: '小陈', title: '便利店夜班', voice: '年轻，话少，观察细，偶尔冷幽默', good: '深夜睡不着、一个人的晚上、说不出口的小事' },
  { id: 'gan', name: '阿甘', title: '变电所值班', voice: '憨厚，嘴硬心软，爱用电和灯打比方', good: '压力大、快撑不住、电量耗尽的感觉' },
  { id: 'wu', name: '吴阿姨', title: '自助洗衣店', voice: '温和的长辈，不说教，常说"放我这儿吧"', good: '一时想不清、需要先放一放的事、犹豫要不要放弃' },
  { id: 'mian', name: '老板娘', title: '拉面摊', voice: '爽利，记得每个人的口味，用吃饭打比方', good: '钱、房租、没好好吃饭、生活琐碎' },
  { id: 'lin', name: '林工', title: '加班大厦', voice: '同样被工作困住的人，自嘲，感同身受', good: '被退回的工作、开不完的会、职场里的委屈' },
  { id: 'man', name: '小满', title: '夜间植物员', voice: '轻声细语，用植物生长打比方，很慢', good: '进步太慢、焦虑、和别人比较、等结果' },
  { id: 'tang', name: '老唐', title: '信号塔', voice: '孤独的老人，看得远，话短，像电报', good: '想念远方的人、异地、联系不上、没人回消息' },
  { id: 'huiming', name: '慧明师父', title: '余晖寺', voice: '平和幽默的和尚，不讲大道理，讲小事', good: '放不下的执念、后悔、生气' },
  { id: 'qiao', name: '小乔', title: '晚钟教堂唱诗班', voice: '天真善良的孩子，直接，会用歌打比方', good: '和家人朋友闹别扭、被误会、委屈' },
  { id: 'xuanqing', name: '玄青道长', title: '云栖观', voice: '不正经的道士，把修仙和下班画等号', good: '想躺平、想逃离、假期被占用、计划泡汤' },
];

// ---------------------------------------------------------------- safety

const CRISIS = ['想死', '不想活', '自杀', '轻生', '结束生命', '跳楼', '割腕', '活不下去', '去死'];

/** Crisis text never enters the game loop and never reaches the model. */
export function isCrisis(text: string) {
  const t = text.replace(/\s/g, '');
  return CRISIS.some((k) => t.includes(k));
}

export const CRISIS_LINES = [
  '……这句话太重了，我不想把它变成游戏里的东西。',
  '这种重量不该由一颗小星球来接。如果你现在很难受，请联系身边信得过的人，或者拨打全国心理援助热线 12356。',
  '有危险的话，打 120 或 110。余晖站一直在这儿，等你好一点了再回来。',
];

// ---------------------------------------------------------------- validation

const len = (s: unknown) => (typeof s === 'string' ? [...s].length : -1);
const LEVELS: FortuneLevel[] = ['上上', '上', '中', '下'];
const HAN = /^[一-鿿]+$/;

/** Every reason this fortune should not be shown. Empty list = OK. */
export function fortuneProblems(x: unknown): string[] {
  const f = x as AiFortune;
  if (!f || !LEVELS.includes(f.level) || !Array.isArray(f.poem) || f.poem.length !== 4) return ['JSON 字段缺失：需要 level、恰好 4 行的 poem、read'];
  const out: string[] = [];
  const bad = f.poem.filter((l) => typeof l !== 'string' || len(l) !== 7 || !HAN.test(l));
  if (bad.length) out.push(`签诗每行必须恰好 7 个汉字、不带标点，这几行不合格：${bad.map((l) => `「${l}」`).join('')}`);
  if (len(f.read) < 6 || len(f.read) > 40) out.push('解签要 6～40 字');
  return out;
}

export function checkFortune(x: unknown): AiFortune | null {
  return fortuneProblems(x).length ? null : (x as AiFortune);
}

// Two-character words that carry no meaning of their own and may appear anywhere.
const FILLER = /[的了又是我你他她它也就都在被把着过吗吧呢啊一个这那有没不很太还]/;

/** Meaningful two-character words from the player's text, e.g. 房租, 方案, 加班. */
export function keywords(text: string): string[] {
  const han = [...text].filter((c) => HAN.test(c));
  const out = new Set<string>();
  for (let i = 0; i + 2 <= han.length; i++) {
    const w = han[i] + han[i + 1];
    if (!FILLER.test(w)) out.add(w);
  }
  return [...out];
}

/** Every reason this letter should not be shown. Empty list = OK. */
export function letterProblems(x: unknown, text: string, avoid: string[] = []): string[] {
  const l = x as AiLetter;
  if (!l || !RECIPIENTS.some((r) => r.id === l.to)) return ['to 必须是居民列表里的 id'];
  const out: string[] = [];
  if (len(l.item) < 2 || len(l.item) > 16) out.push('item 要 2～16 字');
  const lines = (a: unknown) => Array.isArray(a) && a.length === 2 && a.every((s) => len(s) > 0 && len(s) <= 50);
  if (!lines(l.offer) || !lines(l.thanks)) out.push('offer 和 thanks 都要恰好两句，每句 50 字以内');
  if (len(l.reply) < 10 || len(l.reply) > 120) out.push('reply 要 10～120 字');
  if (out.length) return out;

  const used = keywords(text).filter((w) => l.item.includes(w));
  if (used.length) out.push(`物件太直白，直接用了玩家原话里的词${used.map((w) => `「${w}」`).join('')}。换一个只有比喻关系的具体小物件`);
  const flat = [l.item, ...l.offer, ...l.thanks, l.reply].join('');
  const chars = [...text.replace(/[\s，。！？、,.!?]/g, '')];
  for (let i = 0; i + 4 <= chars.length; i++) {
    const run = chars.slice(i, i + 4).join('');
    if (flat.includes(run)) {
      out.push(`原样引用了玩家的原话「${run}」，任何字段都不要出现玩家的原句`);
      break;
    }
  }
  if (avoid.includes(l.to)) {
    const name = RECIPIENTS.find((r) => r.id === l.to)!.name;
    out.push(`${name}最近刚收过这位玩家的信，换一个同样合适的居民`);
  }
  return out;
}

export function checkLetter(x: unknown, text = '', avoid: string[] = []): AiLetter | null {
  return letterProblems(x, text, avoid).length ? null : (x as AiLetter);
}

// ---------------------------------------------------------------- handwritten fallbacks

interface LetterTemplate {
  keys: string[];
  letter: AiLetter;
}

const LETTERS: LetterTemplate[] = [
  {
    keys: ['加班', '老板', '领导', '方案', '项目', '改', '甲方', '会', 'ddl', 'DDL', '工作', '上班'],
    letter: {
      item: '一支没电的荧光笔',
      to: 'lin',
      offer: ['这支笔划了一整天的重点，没电了。', '加班大厦的林工也天天划重点，拿给他吧。'],
      thanks: ['……我抽屉里也有一支一模一样的。', '原来划不完的不只我一个。'],
      reply: '收到你的笔了。今天的重点，就到这里吧。剩下的，明天的我们再划。——林工',
    },
  },
  {
    keys: ['钱', '房租', '工资', '穷', '贷', '花呗', '存'],
    letter: {
      item: '一个只剩三块钱的零钱包',
      to: 'mian',
      offer: ['零钱包瘪了。', '拉面摊的老板娘说过，三块钱也能吃上一碗汤。你送过去？'],
      thanks: ['三块钱？够了，汤管够。', '钱的事慢慢来，饭得按时吃。'],
      reply: '下次路过，来喝碗汤。不收钱，记账上，等你哪天有空再说。——拉面摊',
    },
  },
  {
    keys: ['吵', '朋友', '对象', '分手', '家', '妈', '爸', '误会', '人'],
    letter: {
      item: '一把没送出去的伞',
      to: 'wu',
      offer: ['这把伞本来想借给谁的，后来没借成。', '洗衣店的吴阿姨会替人保管东西，交给她吧。'],
      thanks: ['放我这儿吧。', '伞等得起，人也等得起。'],
      reply: '伞先放我这儿，晾干了。哪天你想送了，就来拿。不想送也没关系。——吴阿姨',
    },
  },
  {
    keys: ['累', '困', '睡', '失眠', '焦虑', '烦', '没劲', '没意思'],
    letter: {
      item: '一颗快要发芽的种子',
      to: 'man',
      offer: ['这颗种子好像累了，一直没动静。', '小满照顾夜里的植物，交给她最合适。'],
      thanks: ['它不是累了，是在长根。', '根长好了，芽自己会出来的。'],
      reply: '种子我埋好了。它说今晚想早点睡，你也是。——小满',
    },
  },
];

const DEFAULT_LETTER: AiLetter = {
  item: '一封叠得很小的信',
  to: 'tang',
  offer: ['这封信叠得很小，不知道该给谁。', '信号塔的老唐什么都收。拿上去吧。'],
  thanks: ['收到。', '塔上风大，我替你把它念给风听了。'],
  reply: '信收到。风也收到了。今晚信号很好，你早点休息。——老唐',
};

export function fallbackLetter(text: string): AiLetter {
  return LETTERS.find((t) => t.keys.some((k) => text.includes(k)))?.letter ?? DEFAULT_LETTER;
}
