// Batch test for the local AI proxy: same inputs every run, so prompt/harness changes can be compared.
// Usage: node scripts/eval-mail.mjs [out.json]   (dev server must be running on :5180)
import { writeFileSync } from 'node:fs';

const LETTERS = [
  '方案又被退回了，第三次',
  '房租又涨了',
  '和最好的朋友吵架了',
  '周末又被叫去加班，计划好的旅行又没了',
  '最近每天凌晨三点醒',
  '同事都升职了只有我没有',
  '好久没给家里打电话了',
  '体检报告出来了，有点不敢看',
  '工资发了，还完信用卡就没了',
  '想辞职又不敢',
];
const FORTUNES = ['下周的答辩能顺利吗', '这次面试能过吗', '今年能存下钱吗'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ask(body) {
  const t0 = Date.now();
  const r = await fetch('http://localhost:5180/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ...(await r.json()), wall: Date.now() - t0 };
}

const results = [];
let recent = [];
for (const text of LETTERS) {
  const r = await ask({ task: 'letter', text, avoid: recent.slice(0, 2) });
  if (r.data) recent = [r.data.to, ...recent.filter((x) => x !== r.data.to)].slice(0, 3);
  results.push({ task: 'letter', text, ...r });
  console.log(r.source, r.reason ?? '', r.data ? `${r.data.item} → ${r.data.to}` : '', `${r.wall}ms`);
  await sleep(4000);
}
for (const text of FORTUNES) {
  const r = await ask({ task: 'fortune', text });
  results.push({ task: 'fortune', text, ...r });
  console.log(r.source, r.reason ?? '', r.data ? r.data.poem.join(' / ') : '', `${r.wall}ms`);
  await sleep(4000);
}
const out = process.argv[2] ?? `logs/eval-${Date.now()}.json`;
writeFileSync(out, JSON.stringify(results, null, 2));
console.log('saved', out);
