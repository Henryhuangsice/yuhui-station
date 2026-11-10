import type { Look } from '../game/character';

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  /** Either a fixed lat/lon or a named spot inside one of the sites. */
  lat?: number;
  lon?: number;
  at?: string;
  yaw: number;
  sit?: boolean;
  look: Look;
  idle: string[];
}

const base = { skin: '#f1d3bd', shoes: '#2b3236', neon: null } as const;

export const NPCS: NpcDef[] = [
  {
    id: 'zhou',
    name: '老周',
    title: '站长',
    lat: -6.3,
    lon: -8.6,
    yaw: 180,
    look: { ...base, skin: '#e2b896', hair: 'short', hairColor: '#b9b0a6', hat: 'cap', hatColor: '#3c4a5c', jacket: '#4a5d73', pants: '#3e4a5e', acc: 'none', accColor: '#c9cdc5' },
    idle: [
      '班车一圈大概一分多钟。不赶的话，坐下一班也一样。',
      '盲盒机就在站台边上。投进去的不是钱，是今晚。',
      '站台旁边那块路标写着：北边是晚钟教堂，南边是余晖寺，西南是云栖观。',
      '寺里可以烧香、拜佛、抽签、敲木鱼；教堂能点蜡烛、祈祷、坐着听管风琴；道观能打坐、炼丹。都不赶时间。',
    ],
  },
  {
    id: 'chen',
    name: '小陈',
    title: '便利店夜班',
    lat: 9.2,
    lon: 16,
    yaw: 0,
    look: { ...base, hair: 'bob', hairColor: '#2f2a2a', hat: 'none', hatColor: '#c9cdc5', jacket: '#75B9B5', pants: '#565c5f', acc: 'apron', accColor: '#f8f8f8' },
    idle: ['凌晨三点进来的人，一般只买一瓶水，然后站很久。', '关东煮的萝卜是这条街最懂事的东西。'],
  },
  {
    id: 'gan',
    name: '阿甘',
    title: '变电所值班',
    lat: 6.6,
    lon: 190,
    yaw: 0,
    look: { ...base, skin: '#d9ab88', hair: 'spiky', hairColor: '#2f2a2a', hat: 'helmet', hatColor: '#f3c258', jacket: '#de794e', pants: '#3e4a5e', acc: 'none', accColor: '#c9cdc5' },
    idle: ['这一片的灯都从这里出去。我负责让它们别太累。', '变压器嗡嗡响，是它在打呼噜。'],
  },
  {
    id: 'wu',
    name: '吴阿姨',
    title: '自助洗衣店',
    lat: 14.5,
    lon: 132,
    yaw: 0,
    look: { ...base, skin: '#eac4a8', hair: 'buns', hairColor: '#4a3e3a', hat: 'none', hatColor: '#c9cdc5', jacket: '#ebced0', pants: '#647A87', acc: 'none', accColor: '#c9cdc5' },
    idle: ['烘干机转一圈四十分钟。很多人就在这里把一天想完。', '衣服洗干净了，人也会轻一点。'],
  },
  {
    id: 'mian',
    name: '老板娘',
    title: '拉面摊',
    lat: 19.5,
    lon: 62,
    yaw: 0,
    look: { ...base, hair: 'pony', hairColor: '#1f1d1d', hat: 'none', hatColor: '#c9cdc5', jacket: '#c25959', pants: '#2b3236', acc: 'apron', accColor: '#f8f8f8' },
    idle: ['汤从傍晚熬到现在，刚好。', '下班的人点面不看菜单，只说「老样子」。'],
  },
  {
    id: 'lin',
    name: '林工',
    title: '加班大厦',
    lat: -8.7,
    lon: 236.5,
    yaw: 180,
    sit: true,
    look: { ...base, hair: 'short', hairColor: '#2f2a2a', hat: 'none', hatColor: '#c9cdc5', jacket: '#d6d2c4', pants: '#2b3236', acc: 'glasses', accColor: '#2b3236' },
    idle: ['我在等电梯。……不对，我在长椅上。', '今天不想回消息。消息也不想被我回。'],
  },
  {
    id: 'man',
    name: '小满',
    title: '夜间植物员',
    lat: -19,
    lon: 141,
    yaw: 180,
    look: { ...base, skin: '#eac4a8', hair: 'buns', hairColor: '#3a2e2a', hat: 'straw', hatColor: '#e6cf8e', jacket: '#6f9e6f', pants: '#9aa58a', acc: 'none', accColor: '#c9cdc5' },
    idle: ['它们晚上也在长，只是不让人看见。', '池塘里的鱼比我早下班。'],
  },
  {
    id: 'tang',
    name: '老唐',
    title: '信号塔',
    lat: 83,
    lon: 10,
    yaw: 200,
    look: { ...base, skin: '#d9ab88', hair: 'short', hairColor: '#b9b0a6', hat: 'beanie', hatColor: '#647A87', jacket: '#8a8f5a', pants: '#565c5f', acc: 'scarf', accColor: '#c25959' },
    idle: ['从这儿能听见整颗星球的晚安。', '信号塔顶上的红灯，是给路过的鸟看的。'],
  },
  {
    id: 'huiming',
    name: '慧明师父',
    title: '余晖寺',
    at: 'huiming',
    yaw: 0,
    look: { ...base, skin: '#eac4a8', hair: 'bald', hairColor: '#2f2a2a', hat: 'none', hatColor: '#c9cdc5', jacket: '#a08a6a', pants: '#7a6a52', acc: 'scarf', accColor: '#c9a36a' },
    idle: ['香不用多，一炷就够。心意不按根数算。', '木鱼敲一下，功德加一。敲多了，手会酸，这也是修行。', '来拜佛的，一半是来求事的，一半是来歇脚的。歇脚也很好。'],
  },
  {
    id: 'qiao',
    name: '小乔',
    title: '晚钟教堂唱诗班',
    at: 'qiao',
    yaw: 0,
    look: { ...base, hair: 'bob', hairColor: '#5a4032', hat: 'none', hatColor: '#c9cdc5', jacket: '#f1ece0', pants: '#647A87', acc: 'none', accColor: '#c9cdc5' },
    idle: ['坐在长椅上就能听歌。管风琴是自己会弹的，别问为什么。', '点一支蜡烛吧。不用许愿也可以，就当给自己留盏灯。', '我们唱诗班只有我一个人，但我唱得很认真。'],
  },
  {
    id: 'xuanqing',
    name: '玄青道长',
    title: '云栖观',
    at: 'xuanqing',
    yaw: 0,
    look: { ...base, skin: '#e2b896', hair: 'topknot', hairColor: '#2b2626', hat: 'none', hatColor: '#c9cdc5', jacket: '#3e4a5e', pants: '#2b3236', acc: 'none', accColor: '#c9cdc5' },
    idle: ['修仙不难。先把手机放下，在太极图上坐一会儿。', '丹炉十次炸三次，剩下七次也不一定是好丹。', '飞升？下班就算小飞升了。'],
  },
];

export interface QuestDef {
  id: string;
  from: string;
  to: string;
  item: string;
  offer: string[];
  thanks: string[];
  flag?: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'onigiri',
    from: 'chen',
    to: 'gan',
    item: '一个热饭团',
    offer: ['阿甘在变电所值夜班，饭点早过了。', '能帮我把这个热饭团带过去吗？沿着路一直走，看见橙色管子就是。'],
    thanks: ['……还是热的。', '跟小陈说，明天的我请。今天的我已经没钱了。'],
  },
  {
    id: 'umbrella',
    from: 'gan',
    to: 'chen',
    item: '一把修好的伞',
    offer: ['小陈那把伞的伞骨断了，我顺手修好了。', '别说是我修的。就说……伞自己好了。'],
    thanks: ['修得比新的还结实。', '伞自己好了？……嗯，那替我谢谢伞。'],
  },
  {
    id: 'coat',
    from: 'wu',
    to: 'lin',
    item: '一件没人认领的外套',
    offer: ['这件外套在烘干机里转了三天，口袋里有张工牌，写着加班大厦。', '大厦对面的长椅上常坐着一个人，你去问问？'],
    thanks: ['啊，是我的。我以为忘在会议室了。', '……原来那天我就没回去拿。'],
  },
  {
    id: 'letter',
    from: 'lin',
    to: 'wu',
    item: '一封没封口的辞职信',
    offer: ['帮我把这个交给洗衣店的吴阿姨。不是给公司。', '她说可以先替我保管，等我想好了再来拿。'],
    thanks: ['放我这儿吧。', '烘干机转得慢，他也可以慢慢想。'],
  },
  {
    id: 'noodle',
    from: 'mian',
    to: 'tang',
    item: '一碗不加葱的面',
    offer: ['信号塔那个老唐，每晚都点不加葱。今天他没下来。', '塔在星球最北边，一直往「上」走就到了。面会凉，你走快点也行，走慢点也行。'],
    thanks: ['她又记得不加葱。', '塔上信号好，面凉得快。你也坐会儿再走。'],
  },
  {
    id: 'mint',
    from: 'man',
    to: 'zhou',
    item: '一盆会发光的薄荷',
    offer: ['站长说站台晚上太暗了。', '这盆薄荷到了夜里会亮一点点，帮我拿给他。'],
    thanks: ['嗯，比广告牌温柔。', '就放在长椅旁边吧。以后等车的人有个东西可以看。'],
    flag: 'mint',
  },
  {
    id: 'sumian',
    from: 'huiming',
    to: 'mian',
    item: '一包素面',
    offer: ['寺里的素面做多了。', '拉面摊的老板娘熬汤辛苦，带一包给她，就说是师父请的。'],
    thanks: ['素面？师父又多做了。', '每回都说做多了，每回都刚好一包。'],
  },
  {
    id: 'hymn',
    from: 'qiao',
    to: 'tang',
    item: '一张手抄的歌单',
    offer: ['信号塔的老唐说晚上太安静，想听点歌。', '我抄了几首，帮我送上去。他要是听不懂谱，就让他看字。'],
    thanks: ['歌单？我一首都不会。', '……第三首我好像小时候听过。替我谢谢那孩子。'],
  },
  {
    id: 'pill',
    from: 'xuanqing',
    to: 'lin',
    item: '一颗定神丹',
    offer: ['加班大厦那边有个人，眉头已经皱了三年了。', '这颗定神丹给他。吃不吃随他，拿着就有用。'],
    thanks: ['定神丹？……这不是一颗薄荷糖吗。', '算了，拿着就有用。我先放兜里。'],
  },
];
