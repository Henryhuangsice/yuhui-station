# 余晖站 / Yuhui Station

一颗很小的星球。两班之间，总得有人在站台上坐一会儿。

A tiny planet. Between two shifts, someone always ends up sitting on the platform for a while.

浏览器里就能玩的轻量多人大厅：抽盲盒角色、在站台发呆、给邻居跑腿，也可以去寺庙、教堂、道观做一点安静的互动。

A lightweight multiplayer hangout in the browser: draw a blind-box self, sit at the station, run small errands, or visit a temple, church, and Taoist abbey for quiet interactions.

---

## 中文

### 玩法

- **盲盒**：首夜送 3 次抽取；之后每天 1 次免费，再用零钱券可抽，当天最多 3 次。抽到的都进衣柜，稀有只改外观。
- **站台**：坐下发呆攒零钱券；盲盒机在站台边上。
- **跑腿**：把饭团、外套、辞职信之类的东西送给居民。
- **余晖寺**：上香、拜佛、抽签、敲木鱼、敲钟。
- **晚钟教堂**：点蜡烛、祈祷、坐长椅听管风琴。
- **云栖观**：打坐修仙、炼丹。
- **社交**：看得见别人，只能用表情打招呼，没有聊天。本机多开几个标签页即可看见彼此。

### 操作

| 键位 | 作用 |
| --- | --- |
| WASD / 方向键 | 走路 |
| Shift | 跑步 |
| 空格 | 跳跃 |
| E / Enter | 互动 |
| 拖动画面 | 转视角 |
| 滚轮 | 拉远 / 拉近 |
| 1–0 | 表情 |

触屏设备有虚拟摇杆和跳跃按钮。

### 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端里提示的地址（默认 `http://localhost:5180`）。

```bash
npm run build    # 生产构建
npm run preview  # 预览构建结果
```

开发时在地址后加 `?dev`，发呆攒券会更快，便于测试。

### 技术栈

- Vite + TypeScript
- Three.js（卡通描边、球面行走）
- 程序合成音效与背景音乐
- 本地存档（`localStorage`）
- 同设备标签页同步（`BroadcastChannel`）

### 目录结构

```
yuhui-station/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.ts
    ├── style.css
    ├── audio.ts
    ├── data/        # 盲盒、居民、任务、签文等
    ├── game/        # 星球、角色、圣地、碰撞、输入
    ├── net/         # 本地在场同步
    ├── state/       # 存档与规则
    └── ui/          # HUD、对话框、卡片
```

### 说明

- 当前跨设备联机尚未接入；同电脑多标签页可以互见。
- 美术为程序拼搭的基础几何，后续可替换为正式模型与贴图。
- 面向公众上线前需自行处理域名、备案与内容合规。
- 更完整的产品与技术说明见 [REPORT.md](./REPORT.md)。

---

## English

### Gameplay

- **Blind box**: 3 free draws on the first night; then 1 free draw per day, plus ticket draws, capped at 3/day. Everything stays in the wardrobe; rarity is cosmetic only.
- **Station**: Sit and idle for tickets; the gacha machine is next to the platform.
- **Errands**: Deliver onigiri, coats, resignation letters, and similar items.
- **Temple**: incense, bows, fortune sticks, wooden fish, temple bell.
- **Church**: candles, prayer, organ music from the pews.
- **Taoist abbey**: meditation and alchemy.
- **Social**: presence without chat — emoji only. Open multiple tabs on the same machine to see each other.

### Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk |
| Shift | Run |
| Space | Jump |
| E / Enter | Interact |
| Drag | Orbit camera |
| Scroll | Zoom |
| 1–0 | Emotes |

Touch devices get a virtual stick and jump button.

### Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:5180`).

```bash
npm run build
npm run preview
```

Append `?dev` to shorten idle timers while testing.

### Stack

- Vite + TypeScript
- Three.js (toon outlines, spherical walking)
- Procedural audio
- `localStorage` saves
- Same-device presence via `BroadcastChannel`

### Notes

- Cross-device multiplayer is not wired yet; multi-tab presence works locally.
- Art is procedural geometry for a fast first ship; assets can be swapped later.
- Handle hosting, compliance, and content rules before a public launch.
- Full product & technical write-up: [REPORT.md](./REPORT.md).

---

## License

Private project unless otherwise stated by the repository owner.
