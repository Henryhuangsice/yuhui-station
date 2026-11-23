// Records a scripted demo of the AI mod (心事邮差 + AI 解签) with captions.
// Usage: node scripts/record-demo.mjs <out.mp4>   (dev server on :5180 with an AI key configured)
// Uses the installed Google Chrome + CDP screencast, then ffmpeg to assemble the frames.
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const OUT = resolve(process.argv[2] ?? 'logs/demo.mp4');
const FRAMES = resolve('logs/demo-frames');
const WORRY = process.env.DEMO_WORRY ?? '好久没给家里打电话了';
const QUESTION = process.env.DEMO_QUESTION ?? '下周的答辩能顺利吗？有点紧张';
const W = 1280;
const H = 720;

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.clear());

const sleep = (ms) => page.waitForTimeout(ms);
const game = (fn, arg) => page.evaluate(fn, arg);

// ---------------------------------------------------------------- captions
async function caption(title, sub = '') {
  await page.evaluate(
    ([t, s]) => {
      let el = document.getElementById('demo-cap');
      if (!el) {
        el = document.createElement('div');
        el.id = 'demo-cap';
        el.style.cssText =
          'position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:99999;max-width:80%;text-align:center;' +
          'background:rgba(30,36,40,.82);color:#fff;border-radius:14px;padding:12px 22px;font:600 22px/1.4 "PingFang SC",sans-serif;' +
          'box-shadow:0 6px 24px rgba(0,0,0,.25);transition:opacity .3s';
        document.body.append(el);
      }
      el.innerHTML = t ? `${t}${s ? `<div style="font-weight:400;font-size:15px;opacity:.8;margin-top:4px">${s}</div>` : ''}` : '';
      el.style.opacity = t ? '1' : '0';
    },
    [title, sub],
  );
}

async function endCard(lines) {
  await page.evaluate((ls) => {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'background:rgba(30,36,40,.92);color:#fff;font:400 22px/1.5 "PingFang SC",sans-serif;text-align:center';
    el.innerHTML = ls.map((l, i) => `<div style="${i === 0 ? 'font-size:34px;font-weight:700' : ''}">${l}</div>`).join('');
    document.body.append(el);
  }, lines);
}

/** Fade to black, run a scene change, let the camera settle, fade back in. */
async function cut(change, settle = 1600) {
  await page.evaluate(() => {
    let el = document.getElementById('demo-fade');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-fade';
      el.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#1e2428;opacity:0;transition:opacity .35s;pointer-events:none';
      document.body.append(el);
    }
    el.style.opacity = '1';
  });
  await sleep(400);
  await change();
  await sleep(settle);
  await page.evaluate(() => (document.getElementById('demo-fade').style.opacity = '0'));
  await sleep(400);
}

/** A three-quarter view so both the player and whoever they face stay visible. */
const FRAME_CAM = (g, side) => {
  g.cam.yaw = 0.75 * side;
  g.cam.pitch = 0.42;
  g.cam.dist = 9;
};

// ---------------------------------------------------------------- game helpers
/** Stand right in front of an NPC, facing them, and start talking. */
async function talkTo(id, side = 1) {
  await cut(() =>
    game(
      ([npcId, frameCam, side]) => {
        const g = window.game;
        const n = g.npcs.find((x) => x.def.id === npcId);
        g.endActivity();
        g.me.dir.copy(n.dir).addScaledVector(n.fwd, 0.035).normalize();
        g.me.fwd.copy(n.dir).sub(g.me.dir).normalize();
        g.cam.dir.copy(g.me.fwd);
        g.me.h = 0;
        new Function('g', 's', `(${frameCam})(g, s)`)(g, side);
      },
      [id, FRAME_CAM.toString(), side],
    ),
  );
  await sleep(400);
  await game((npcId) => {
    const g = window.game;
    void g.talk(g.npcs.find((x) => x.def.id === npcId));
  }, id);
}

/** Click through the dialog until it closes or shows options. Returns option texts if any. */
async function advanceDialog(maxLines = 8, pause = 1700) {
  for (let i = 0; i < maxLines; i++) {
    await sleep(pause);
    const opts = await page.$$eval('.dialog .opts button', (bs) => bs.map((b) => b.textContent));
    if (opts.length) return opts;
    if (!(await page.$('.dialog'))) return [];
    await page.click('.dialog');
  }
  return [];
}

// ---------------------------------------------------------------- recording
const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = join(FRAMES, `${String(frames.length).padStart(5, '0')}.jpg`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});

await page.goto('http://localhost:5180/?dev');
await page.waitForSelector('text=进站');
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

// 0. Title
await caption('余晖站 · AI 原生 Mod', '给下了班的打工人放松用的小星球 —— 新增「心事邮差」和「AI 解签」');
await sleep(3500);
await page.click('text=进站');
await sleep(800);
await game(() => {
  const g = window.game;
  g.store.draw(); // a blind-box self, so the station master skips the newcomer intro
});
await sleep(1500);

// 1. 心事邮差
await caption('① 找站长老周，投一封心事', '一天一封，只写一句今天的烦心事');
await talkTo('zhou', -1.3);
const opts = await advanceDialog();
if (opts.length) await page.click('.dialog .opts button >> nth=0');
await page.waitForSelector('.ask-modal textarea');
await sleep(600);
await page.type('.ask-modal textarea', WORRY, { delay: 140 });
await sleep(1200);
await page.keyboard.press('Enter');
await advanceDialog(3);

await caption('② AI 在分信', '把心事化成一件小物件，并挑一位最合适的居民收下 —— 延迟藏在「等班车」里');
await game(async () => {
  const g = window.game;
  for (let i = 0; i < 120 && !g.store.data.mail.quest; i++) await new Promise((r) => setTimeout(r, 500));
});
const quest = await game(() => window.game.store.data.mail.quest);
if (!quest) throw new Error('mail was not sorted');
await caption(`心事变成了「${quest.item}」`, quest.source === 'ai' ? '由 AI 生成，并通过了服务端校验' : 'AI 未接通，使用手写兜底');
await sleep(4500);

// 2. Deliver
await caption('③ 送到收件人手上', '收件人的台词和回信也由 AI 按角色性格写成');
await talkTo(quest.to);
await advanceDialog(4);
await page.waitForSelector('.letter', { timeout: 15000 });
await caption('④ 一封回信', '');
await sleep(6500);
await page.click('.letter .btn');
await sleep(800);

// 3. AI 解签
await caption('⑤ 去余晖寺求一支签', '摇签前可以先写下想问的事');
await cut(() =>
  game(() => {
    const g = window.game;
    const s = g.world.spots.find((x) => x.kind === 'fortune');
    g.endActivity();
    g.me.dir.copy(s.dir);
    g.me.fwd.copy(s.fwd).negate();
    g.cam.dir.copy(g.me.fwd);
    g.cam.yaw = 0.5;
    g.cam.pitch = 0.4;
    g.cam.dist = 8;
  }),
  3200,
);
await sleep(400);
await game(() => {
  const g = window.game;
  void g.startSpot(g.world.spots.find((x) => x.kind === 'fortune'));
});
await page.waitForSelector('.ask-modal textarea');
await sleep(600);
await page.type('.ask-modal textarea', QUESTION, { delay: 140 });
await sleep(1000);
await page.keyboard.press('Enter');
await caption('⑥ 摇签', 'AI 在摇签的同时写一支专属签：七言四句 + 白话解签');
await page.waitForSelector('.fortune', { timeout: 60000 });
await caption('', '');
await sleep(7000);
await page.click('.fortune .btn');
await sleep(600);

// 4. End
await endCard([
  '去掉 AI，这两个玩法就不成立',
  '任意一句心事 → 一件物件 + 一位居民 + 一封回信',
  '<span style="font-size:17px;opacity:.75">Harness：本地代理藏 key · 输出校验 + 具体反馈重写 · 模型备用链 · 手写兜底 · 危机内容不进游戏 · 全程日志</span>',
  '<span style="font-size:16px;opacity:.6">github.com/Henryhuangsice/game-x-harness-research</span>',
]);
await sleep(5000);

await cdp.send('Page.stopScreencast');
await browser.close();

// ---------------------------------------------------------------- assemble
const lines = [];
for (let i = 0; i < frames.length; i++) {
  const dur = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].t - frames[i].t) : 1;
  lines.push(`file '${frames[i].file}'`, `duration ${dur.toFixed(4)}`);
}
lines.push(`file '${frames[frames.length - 1].file}'`);
const list = join(FRAMES, 'list.txt');
writeFileSync(list, lines.join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', OUT]);
console.log(`frames: ${frames.length}, length: ${(frames.at(-1).t - frames[0].t).toFixed(1)}s, saved ${OUT}`);
console.log(JSON.stringify(quest));
