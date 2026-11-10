export interface Fortune {
  no: string;
  level: '上上' | '上' | '中' | '下';
  poem: [string, string, string, string];
  read: string;
}

export const FORTUNES: Fortune[] = [
  { no: '第一签', level: '上上', poem: ['晚风吹过旧站台', '班车不催人自来', '今宵且把灯关早', '明日花从窗外开'], read: '该来的会自己来。今晚早点睡，就是最好的安排。' },
  { no: '第二签', level: '上', poem: ['案头文件叠成山', '一页一页总能翻', '莫急莫慌先喝水', '山也会被你看完'], read: '事情很多，但一件一件做，总会做完。先去喝口水。' },
  { no: '第三签', level: '中', poem: ['消息未回心难安', '屏幕亮了又熄灭', '人间多少急事情', '过了今晚都变闲'], read: '没回的消息，明天回也来得及。' },
  { no: '第四签', level: '上上', poem: ['雨停街灯一盏盏', '路过的猫不赶时间', '你也可以慢下来', '月亮从不迟到半点'], read: '这阵子会顺。别把自己逼太紧。' },
  { no: '第五签', level: '下', poem: ['地铁晚点雨又大', '伞骨折在半路上', '若问今天怎么办', '早早收工回家吧'], read: '今天不太顺。不顺的日子，早点结束它就好。' },
  { no: '第六签', level: '中', poem: ['会开三个钟头长', '结论还是下次讲', '与其怪那张白板', '不如先把肩放下'], read: '有些事急也没用。先照顾好自己的肩膀和脖子。' },
  { no: '第七签', level: '上', poem: ['便利店里热饭团', '握在手心刚刚好', '小小暖意不算多', '够撑过这个凌晨'], read: '小的好事正在路上，记得接住它。' },
  { no: '第八签', level: '上上', poem: ['你走过的那条路', '有人替你点了灯', '不必回头说谢谢', '往前走就是回应'], read: '有人在悄悄支持你。好好走下去。' },
  { no: '第九签', level: '中', poem: ['计划写得满满当当', '一半没做也无妨', '剩下那半留给明天', '明天的你会更强'], read: '没做完不等于失败。给明天留一点。' },
  { no: '第十签', level: '下', poem: ['熬夜改稿到天光', '咖啡凉了第三杯', '身体说它想罢工', '这回你要听它的'], read: '最近太累了。这支签只是想提醒你：去睡觉。' },
  { no: '第十一签', level: '上', poem: ['想见的人在远方', '信号塔替你传话', '一句晚安走得慢', '天亮之前会到达'], read: '想念的人也在想你。发条消息吧，或者不发也行。' },
  { no: '第十二签', level: '上上', poem: ['盆里薄荷长新芽', '没人催它也发芽', '你的进度别人看不见', '根已经扎得很深啦'], read: '你一直在变好，只是还没被看见。' },
  { no: '第十三签', level: '中', poem: ['工位窗边一盆草', '晒不到太阳也不恼', '人生偶尔像这样', '先活着，再说别的好'], read: '先把最基本的照顾好：吃饭、睡觉、喝水。' },
  { no: '第十四签', level: '上', poem: ['周五傍晚风刚好', '谁也别找你开会', '这一段空白时光', '是你自己挣来的'], read: '属于你的休息，不用心虚。' },
  { no: '第十五签', level: '下', poem: ['方案被退回三遍', '甲方说再改一点', '你笑一笑说好的', '心里已经下了班'], read: '可以生气，也可以先下班。明天再说。' },
  { no: '第十六签', level: '上上', poem: ['小小星球转一圈', '只要一分多钟', '烦恼若是也这样', '转一转就放下了'], read: '再大的事，绕星球走一圈回来，也就小了。' },
];

export const WISHES = [
  '希望明天的会取消',
  '希望家里人都睡得好',
  '希望我不再半夜醒来',
  '希望这个项目顺利上线',
  '希望能准点下班',
  '希望我想念的人也过得好',
  '希望房租别再涨了',
  '希望自己对自己好一点',
  '希望明天的天气好',
  '希望猫猫长命百岁',
];

export const REALMS = [
  { name: '炼气期', at: 0, color: '#c8ffb0' },
  { name: '筑基期', at: 60, color: '#7af0ff' },
  { name: '金丹期', at: 180, color: '#ffd36a' },
  { name: '元婴期', at: 400, color: '#ff9ad6' },
  { name: '化神期', at: 800, color: '#b8a6ff' },
  { name: '渡劫期', at: 1500, color: '#ffffff' },
  { name: '大乘期', at: 3000, color: '#fff1c4' },
];

export function realmOf(cult: number) {
  let i = 0;
  while (i + 1 < REALMS.length && cult >= REALMS[i + 1].at) i++;
  return { ...REALMS[i], index: i, next: REALMS[i + 1] ?? null };
}

export type PillKind = 'light' | 'swift' | 'glow' | 'small' | 'tall' | 'sleep' | 'calm' | 'boom';

export interface Pill {
  kind: PillKind;
  name: string;
  text: string;
  seconds: number;
  w: number;
}

export const PILLS: Pill[] = [
  { kind: 'light', name: '轻身丹', text: '身子一轻，跳得比平时高。', seconds: 90, w: 18 },
  { kind: 'swift', name: '疾行丹', text: '脚底生风，走得快了一倍。', seconds: 90, w: 18 },
  { kind: 'glow', name: '夜光丹', text: '浑身亮起来了，走夜路不怕黑。', seconds: 120, w: 14 },
  { kind: 'small', name: '缩骨丹', text: '你变小了。世界看起来大了一点。', seconds: 60, w: 12 },
  { kind: 'tall', name: '长高丹', text: '你长高了。终于能看清信号塔顶了。', seconds: 60, w: 12 },
  { kind: 'sleep', name: '早睡丹', text: '吃完有点困。去长椅上坐会儿吧。', seconds: 0, w: 8 },
  { kind: 'calm', name: '不焦虑丹', text: '药效：今晚不想工作的事。持续时间：看你自己。', seconds: 0, w: 8 },
  { kind: 'boom', name: '炸炉了', text: '砰。道长说没关系，他也炸过。', seconds: 0, w: 10 },
];

export function rollPill(): Pill {
  const total = PILLS.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of PILLS) {
    r -= p.w;
    if (r <= 0) return p;
  }
  return PILLS[0];
}
