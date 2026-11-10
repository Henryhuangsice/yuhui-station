# 余晖站 · 产品报告 & 技术报告
# Yuhui Station · Product & Technical Report

**版本 / Version**：0.1.0  
**日期 / Date**：2026-11-11  
**仓库 / Repo**：https://github.com/Henryhuangsice/yuhui-station  
**形态 / Form**：浏览器本地先行（local-first）轻量 3D 多人 hangout

---

# 一、产品报告 / Product Report

## 1. 产品一句话 / Elevator Pitch

**中文**  
余晖站是一颗很小的卡通星球站台：你抽一个「今晚的自己」，在站台上发呆攒券、帮邻居跑腿，或去寺庙、教堂、道观做安静互动；看得见别人，只能用表情打招呼——没有聊天，也没有胜负。

**English**  
Yuhui Station is a tiny toon planet hangout: draw tonight’s self from a blind box, idle on the platform for tickets, run small errands, or visit a temple, church, and Taoist abbey for quiet rituals. Presence is visible; chat is not. There is no win condition.

---

## 2. 灵感来源 / Inspiration

### 2.1 直接参照 Direct references

| 来源 Source | 取了什么 What we took | 刻意没取 What we left out |
| --- | --- | --- |
| **Sansa Temple**（静心互动 / contemplative interaction） | 圣地氛围、仪式感动作（上香、敲钟、拜、打坐）、用重复小动作换心理节奏 | 重度养成、数值碾压、说教式宗教内容 |
| **Messenger（abeto.co）** | 纸质感 UI、粗描边、淡黄按钮、轻微歪斜排版、表情代替聊天、短文案语气 | 完整 IM、好友系统、消息历史 |
| **赛博盲盒 / Cyber blind-box culture** | 「抽到的角色 = 今晚的身份」、稀有度只改外观、收藏进衣柜 | 付费逼氪、战力绑定、交易市场 |
| **城市夜生活小品**（便利店、洗衣店、拉面摊、加班楼） | 分散群落的日常场景与跑腿任务 | 开放世界任务量、剧情主线 |

### 2.2 情绪与母题 Emotional thesis

- **两班之间**：产品叙事锚定「短暂停留」，不是征服世界。  
  *Between two shifts* — the fiction is a pause, not a campaign.
- **看得见人，听不见话**：降低社交压力，保留「有人在」的温度。  
  *Seen, not spoken to* — presence without performance anxiety.
- **宗教场所当休息区**：寺 / 堂 / 观提供节奏切换，而非信仰说教。  
  Sacred sites as rest rooms for the nervous system, not doctrine apps.
- **盲盒是自我玩笑，不是付费漏斗**：首夜赠送 + 日上限 + 券经济，把抽取变成仪式。  
  Gacha as self-joke and nightly ritual, not a monetization funnel (v0.1 has no IAP).

### 2.3 目标用户 Target audience

- 下班后想「挂着玩一会儿」的年轻人 / Young adults who want a soft hang after work  
- 喜欢 Messenger / Animal Crossing 式低冲突社交的玩家 / Fans of low-conflict social toys  
- 想在浏览器里立刻打开、不装客户端的人 / Browser-first, no-install preference  

**非目标 / Non-goals（当前版本）**：竞技、公会战、开放聊天、重度 MMO、强剧情 RPG。

---

## 3. 核心玩法 / Core Gameplay Loop

```
进入站台 → 盲盒抽「今晚的自己」→ 走路 / 坐下发呆 → 攒零钱券
                ↓
        跑腿 / 圣地仪式 / 看别人表情
                ↓
        （可选）再抽 → 衣柜换装 → 继续发呆
```

### 3.1 盲盒身份 Blind-box identity

- **首夜**：赠送 3 次抽取，全部进入衣柜。  
  First night: 3 free draws; all keep in wardrobe.
- **之后每天**：1 次免费 + 可用零钱券加抽；**当天最多 3 次**。  
  Afterwards: 1 free/day + ticket draws; **hard cap 3/day**.
- **再抽费用**：6 张零钱券（`RULES.drawCost`）。  
  Extra draw cost: 6 tickets.
- **内容**：职业（如电梯守夜人、雨夜调音师、记忆咖啡师…）+ 双字昵称 + 外观 + 一句台词；稀有度 `普通 / 少见 / 稀有`（70% / 25% / 5%），稀有只带霓虹等外观差异。  
  Content: job archetype + two-character name + look + one line; rarity is cosmetic only.
- **衣柜**：可随时换穿已抽到的卡。  
  Wardrobe: wear any previously drawn card.

### 3.2 站台与经济 Station & ticket economy

| 行为 Action | 奖励 Reward | 日上限 Daily cap |
| --- | --- | --- |
| 长椅发呆满时（默认 300s；`?dev` 为 15s）Sit idle | +1 券 | 3 |
| 完成跑腿任务 Finish errand | +2 券 | 2 |
| 首夜 / 每日免费抽 Free draws | — | 规则见上 |

零钱券**只用于外观抽取**，不解锁战斗或进度碾压。  
Tickets buy cosmetics only.

### 3.3 跑腿 Errands

把饭团、外套、辞职信等小物件送给分散在城市里的居民（便利店、变电所、洗衣店、拉面摊、加班楼等）。任务是短对话 + 送达，强调「帮邻居一下」而不是刷材料。

Deliver small items (onigiri, coats, resignation letters, …) to scattered residents. Short talk + deliver; neighborly, not grind.

### 3.4 三座圣地 Three sacred sites

| 地点 Site | 互动 Interactions |
| --- | --- |
| **余晖寺 Temple** | 上香 · 拜佛 · 抽签（每日一支）· 敲木鱼 · 敲钟 |
| **晚钟教堂 Church** | 点蜡烛 · 祈祷 · 坐长椅听管风琴氛围 |
| **云栖观 Taoist abbey** | 打坐修仙（境界从炼气→大乘）· 炼丹（轻身 / 疾行 / 缩骨等短时效果，也有炸炉） |

签文语气贴近都市夜班：劝早睡、少焦虑、准点下班——与站台母题一致。  
Fortune copy stays urban-night-shift soft, aligned with the station thesis.

### 3.5 社交 Social（刻意残缺）

- 同设备多标签页通过 `BroadcastChannel` 互见（世界人数上限约 10）。  
  Same-device multi-tab presence via `BroadcastChannel` (≈10 players).
- **只有表情**（快捷键 1–0），没有文字聊天。  
  Emotes only (keys 1–0); no text chat.
- 跨设备真实联机尚未接入（见技术报告）。  
  Cross-device multiplayer not shipped yet.

### 3.6 操作 Controls

| 输入 Input | 作用 Action |
| --- | --- |
| WASD / 方向键 | 走 Walk |
| Shift | 跑 Run |
| 空格 | 跳 Jump |
| E / Enter | 互动 Interact |
| 拖动 / 滚轮 | 转视角 / 缩放 Orbit / zoom |
| 1–0 | 表情 Emote |
| 触屏 | 虚拟摇杆 + 跳跃 Virtual stick + jump |

---

## 4. 产品特色 / Differentiating Features

1. **「安静社交」而不是「社交产品」**  
   Quiet social toy ≠ social network. Presence + emoji replaces feeds and DMs.
2. **球面微型世界**  
   Tiny planet with toon shading & outlines; city is scattered clusters, not a strip mall row.
3. **三教并置的休息空间**  
   Temple / church / abbey as parallel rest verbs with different audio scenes.
4. **Messenger 式纸面 UI**  
   Paper panels, ink borders, yellow CTAs, slightly rotated layout; Chinese display font (ZCOOL QingKe HuangYou).
5. **程序音频随场景换呼吸**  
   Town / temple / church / dao each have distinct procedural music beds and SFX.
6. **本地先行、零账号即可玩**  
   localStorage save + no login wall for v0.1.
7. **经济封顶防刷**  
   Daily caps on draws, idle, and tasks keep the loop soft and finite per night.

---

## 5. 体验旅程（首夜）/ First-night journey

1. 标题页进入 → 过客身份  
2. 站台盲盒机抽出第一个「自己」→ 衣柜自动穿上  
3. 与站长老周对话，得知三圣地方位  
4. 坐下发呆或接一单跑腿 → 拿到零钱券  
5. 去余晖寺上香 / 抽签，或教堂点蜡烛，或道观打坐  
6. 多开一个标签页，对「另一个自己」比个表情  
7. 当天抽满或收工离开——明天还有免费一次  

Success metric for v0.1 is not retention dashboards yet; it is: *Did the player feel allowed to do nothing useful for ten minutes?*

---

## 6. 产品边界与风险 / Boundaries & risks

| 项 Item | 说明 Note |
| --- | --- |
| 宗教与文化表达 | 以氛围与动作符号为主，签文偏生活安慰；上线需再做内容与合规审阅 |
| 盲盒观感 | 即使无 IAP，仍需文案强调「外观收藏」，避免被误解为赌博 |
| 联机缺失 | 当前「多人」依赖同机多标签；对外宣传需诚实标注 |
| 美术占位 | 程序几何可玩但不够「成品感」；正式上线前需资产升级计划 |
| 无障碍 / 移动端 | 已有触控摇杆，但仍需系统测真机性能与横竖屏 |

---

## 7. 路线图（产品侧）/ Product roadmap

| 阶段 Phase | 目标 Goal |
| --- | --- |
| **0.1（当前）** | 本地可玩闭环：盲盒 / 站台 / 跑腿 / 三圣地 / 同机在场 |
| **0.2** | 跨设备房间联机、简易房间码、表情同步稳定 |
| **0.3** | 更丰富的居民日程、季节天空、少量正式 3D 资产替换 |
| **1.0 公开** | 托管上线、隐私页、内容合规、基础遥测（可选）、性能档位 |

---

# 二、技术报告 / Technical Report

## 1. 现状总览 / Current stack overview

| 层 Layer | 选型 Choice | 职责 Role |
| --- | --- | --- |
| 语言 Language | TypeScript ~5.9 | 全前端强类型 |
| 构建 Bundler | Vite 7 | Dev server（`:5180`）+ production build |
| 渲染 Render | Three.js 0.183 | 场景、角色、碰撞辅助、后期感描边 |
| 字体 Font | `@fontsource/zcool-qingke-huangyou` | UI 展示字体 |
| 存档 Save | `localStorage`（`yuhui.save.v1`） | 单机进度 |
| 在场 Presence | `BroadcastChannel('yuhui-station')` | 同浏览器多标签同步 |
| 音频 Audio | Web Audio API（自研 `AudioEngine`） | 程序合成 BGM / SFX |
| 部署形态 Ship | 静态站点（`vite build` → 静态资源） | 尚无后端 |

**依赖面积极小**：运行时仅 `three` + 字体包；无 React/Vue、无状态库、无后端 SDK。  
Runtime surface is intentionally tiny.

---

## 2. 代码结构 / Code map

```
yuhui-station/
├── index.html
├── package.json
├── vite.config.ts          # port 5180
├── tsconfig.json
└── src/
    ├── main.ts             # boot Game
    ├── style.css           # paper UI tokens
    ├── audio.ts            # procedural music/SFX + scene beds
    ├── data/
    │   ├── gacha.ts        # jobs, rarity, card roll
    │   ├── npcs.ts         # residents + quests
    │   └── rituals.ts      # fortunes, realms, pills, wishes
    ├── state/
    │   └── save.ts         # Store + RULES + day rollover (Asia/Shanghai)
    ├── net/
    │   └── presence.ts     # BroadcastChannel peers (MAX_WORLD=10)
    ├── ui/
    │   ├── ui.ts           # HUD, dialogs, gacha/wardrobe panels
    │   └── tags.ts         # world-space name tags
    └── game/
        ├── game.ts         # main loop, interaction FSM
        ├── world.ts        # city layout assembly
        ├── sites.ts        # temple / church / dao
        ├── planet.ts       # spherical walk math
        ├── character.ts    # avatar / poses / gestures
        ├── colliders.ts    # box/circle + resolve
        ├── input.ts        # keyboard + touch
        ├── toon.ts         # toon materials + outlines
        ├── sky.ts / tram.ts / fx.ts / …
```

---

## 3. 关键技术说明 / Key technical notes

### 3.1 球面行走 Spherical locomotion

- 行星半径 `R`；角色位置用方向向量 + 高度表示，切向速度投影到球面。  
  Position = radial direction + height; motion projected onto the tangent plane.
- 建筑与圣地通过 `SiteFrame` 贴合曲面；碰撞体带 `bottom` 防止钻入屋顶。  
  Sites hug the shell; colliders include bottom planes to stop camera/body roof clips.

### 3.2 渲染与美术管线 Render / art

- Toon 材质 + 描边（outline）统一「厚线稿」观感。  
- 建筑 / 道具多为程序拼几何（`parts.ts`）+ canvas 文字贴图。  
- 特效：香火烟、炉火、简单粒子（`fx.ts`）。  
- **优点**：零外部模型依赖、迭代快。  
- **代价**：面数与 draw call 需在正式资产化前做合批 / LOD（已有 `batch.ts` 方向）。

### 3.3 游戏循环与互动 FSM

`game.ts` 统一驱动：输入 → 移动 / 跳跃重力 → 碰撞解析 → 最近可互动物（NPC / 盲盒 / 座位 / Spot）→ 活动状态机（坐、拜、敲、炼丹…）→ UI / 音频 / Presence 广播。

Interaction spots are typed (`SpotKind`: incense, bow, muyu, fortune, bell, candle, pray, meditate, alchemy, …) with pose / gesture / prop bindings.

### 3.4 存档与日界 Save & day boundary

- Schema version `v: 1`；合并默认值以兼容字段扩展。  
- 日键使用 `Asia/Shanghai` 的 `en-CA` 日期，保证「每天免费一次」与签文「每日一支」时区一致。  
- 计数器：功德 / 香 / 烛 / 祈祷 / 修为 / 丹药等，供圣地反馈与境界显示。

### 3.5 在场同步 Presence abstraction

`Presence` 已按「未来可替换传输层」设计：

- 消息类型：`state` / `emoji` / `bye`  
- 状态含位置方向、动画、姿势、手势、外形、光环  
- 超时剪枝（3s）与离开事件  
- 硬顶 `MAX_WORLD = 10`

当前实现 = `BroadcastChannel`；接口形状接近日后 WebSocket / WebRTC 房间频道。

### 3.6 音频 Audio

- 单 `AudioContext`；master / music / sfx 总线 + delay / convolver。  
- 四场景床：`town` / `temple` / `church` / `dao`（不同 BPM 与和弦 / 音阶）。  
- 交互音：木鱼、大钟、火柴、揭卡、稀有揭示等均程序合成，无外部 wav 依赖。

### 3.7 UI

- 原生 DOM + CSS 变量（`--paper` / `--ink` / `--yellow`…），非组件框架。  
- 面板、对话框、签文卡、触控摇杆与 Three canvas 叠层。  
- `?dev`：缩短发呆计时，并把 `game` 挂到 `window` 便于调试。

### 3.8 构建与质量门 Build

```bash
npm run build   # tsc --noEmit && vite build
npm run preview
```

无测试框架、无 CI、无 lint 配置（v0.1 可接受；上线前需补）。

---

## 4. 当前能力与缺口 / Capabilities vs gaps

| 能力 Capability | 状态 Status |
| --- | --- |
| 单机完整会话 | ✅ |
| 同机多标签在场 | ✅ |
| 跨设备 / 跨网络联机 | ❌ |
| 账号 / 云存档 | ❌ |
| 反作弊 / 权威服务器 | ❌（纯客户端可改 localStorage） |
| 正式 3D 资产管线 | ❌（程序几何占位） |
| 遥测 / 错误上报 | ❌ |
| PWA / 离线壳 | ❌（静态资源天然可加） |
| i18n 框架 | ⚠️ 文案以中文为主，英文化未系统化 |
| 无障碍（读屏等） | ⚠️ 基础可用，未审计 |

---

## 5. 上线技术准备 / Launch technical preparation

下列按「公开上线」优先级排列。  
Ordered for a public launch.

### 5.1 P0 — 必须 Must-have

1. **静态托管**  
   - Cloudflare Pages / GitHub Pages / Vercel / 国内对象存储 + CDN。  
   - 配置 `base`（若非域名根路径）、HTTPS、缓存策略（`index.html` 短缓存，hashed assets 长缓存）。
2. **跨设备实时层**  
   - 短期：房间码 + WebSocket 中继（Cloudflare Durable Objects / PartyKit / 自建 Node）。  
   - 保持 `Presence` 消息协议，替换传输即可。  
   - 房间人数沿用 ≤10；断线重连与插值平滑。
3. **内容与合规**  
   - 隐私政策、用户协议入口。  
   - 宗教符号 / 签文 / 盲盒表述法务与平台审核。  
   - 若面向中国大陆公众：域名备案、适龄提示等按渠道要求处理。
4. **安全基线**  
   - CSP、依赖审计（`npm audit`）、无密钥进仓。  
   - 明确：客户端存档可被篡改；若未来有排行榜再上权威服。
5. **错误与基础监控**  
   - 前端错误收集（Sentry 等）+ 简单可用性探活。

### 5.2 P1 — 强烈建议 Strongly recommended

1. **云存档（可选登录）**  
   - 匿名 `deviceId` 升级为账号绑定；冲突合并策略（以 server timestamp / 版本向量）。  
2. **性能档位**  
   - 低端机：降阴影 / 合批 / 限制同屏 peer / 降低像素比。  
   - 启动 Loading 与首屏可交互时间目标（例如 TTI < 5s 宽带）。  
3. **资产管线**  
   - glTF 角色与圣地替换程序块；保留 toon/outline 材质约定。  
   - 纹理压缩（Basis / KTX2）、draco/meshopt。  
4. **CI**  
   - `tsc` + build on PR；预览环境自动部署。  
5. **移动端真机矩阵**  
   - iOS Safari / Android Chrome；触控与音频手势解锁策略已有雏形，需回归。

### 5.3 P2 — 增长与体验 Growth / polish

1. PWA（manifest + service worker 缓存壳）  
2. 分享卡片（Open Graph）与「邀请进同一房间」深链  
3. 轻量遥测（会话时长、圣地访问、日抽次数）——默认匿名、可开关  
4. i18n 资源拆分（中/英）  
5. 回放或观战（非必须）

### 5.4 建议的目标架构（上线后）/ Target architecture

```
[Browser]
  Vite static app (Three.js + DOM UI)
       │
       ├─ localStorage (offline cache / guest)
       ├─ Web Audio
       └─ Presence client
              │  WebSocket / WebTransport
              ▼
        [Realtime room service]
              │  room code, fan-out state/emoji
              ▼
        [Optional API]
              auth, cloud save, moderation hooks
```

**原则 Principles**

- 继续 **local-first**：断网仍可单机发呆与圣地互动。  
- 联机只同步 **表现状态**（位姿、表情、外观），不把经济权威放在客户端互信上。  
- 若未来券 / 抽卡要防刷：日限与抽取改为 server authoritative。

### 5.5 工作量粗估（供排期）/ Rough effort

| 工作包 Workstream | 量级 Ballpark |
| --- | --- |
| 静态部署 + 域名 + 基础 CI | 0.5–2 天 |
| Presence → WebSocket 房间 | 3–7 天 |
| 云存档 + 匿名/OAuth | 3–5 天 |
| 性能档 + 真机打磨 | 3–7 天 |
| 首批 glTF 资产替换 | 并行美术 1–3 周 |
| 合规文案与审核材料 | 视地区 若干天 |

---

## 6. 技术债清单（已知）/ Known tech debt

1. 无自动化测试（互动 FSM、存档日切、抽卡概率最值得单测）。  
2. `game.ts` 体量大，后续应按系统拆分（movement / interact / quests）。  
3. 文案硬编码在 TS/UI 中，不利于翻译与审核导出。  
4. BroadcastChannel 与未来网络层的适配层可再抽一层 interface。  
5. 未做包体与帧时间预算文档化。

---

## 7. 本地开发速查 / Dev cheatsheet

```bash
npm install
npm run dev          # http://localhost:5180
# 加速发呆：http://localhost:5180/?dev
npm run build
npm run preview
```

---

## 8. 结论 / Conclusion

**产品**  
余晖站验证的是一种「下班后的安静多人空间」：盲盒给身份，站台给停留，圣地给节奏，表情给温度——用克制的社交完成陪伴感。

**技术**  
当前栈足够支撑本地 demo 与同机联机原型；公开上线的关键跃迁是 **实时房间服务 + 托管/合规 + 性能与资产升级**，而不是重写渲染引擎。`Presence` 与 `Store` 的边界已经为这一跃迁留好了接口形状。

---

*本文档描述的是仓库当前实现（v0.1.0），不构成对外运营承诺。*  
*This document reflects the codebase as of v0.1.0 and is not a public ops commitment.*
