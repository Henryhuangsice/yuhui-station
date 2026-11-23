// Local dev-server middleware: POST /api/ai
// The API key stays on this machine (read from .env.local) and never reaches the browser bundle.
// Every call is appended to logs/ai-trace.log so runs can be replayed and compared.

import { appendFileSync, mkdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Plugin } from 'vite';
import {
  MAX_INPUT,
  RECIPIENTS,
  fortuneProblems,
  isCrisis,
  letterProblems,
  type AiRequest,
  type AiResponse,
} from '../src/ai/shared';

const CLAUDE_MODEL = 'claude-opus-5-5';
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export interface AiEnv {
  /** 'zhipu' | 'anthropic'. Defaults to whichever key is present (Zhipu first). */
  AI_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ZHIPU_API_KEY?: string;
  ZHIPU_MODEL?: string;
}

/** What a provider returns before the shared validation step. */
interface RawResult {
  output: unknown;
  refused: boolean;
  usage: { input: number; output: number };
  model: string;
}

type Provider = (task: AiRequest['task'], system: string, user: string) => Promise<RawResult>;

const WORLD = `你在为一个叫「余晖站」的网页小游戏写台词。
余晖站是一颗很小的星球，给下了班的打工人放松用：没有分数、没有失败、没有排行榜。
语气：安静、温和、带一点冷幽默，像深夜便利店里的对话。
硬规则：
- 不说教，不给建议清单，不当心理咨询师，不用"加油""你要相信自己"这类鸡汤。
- 不要原样复述玩家写的话，把它化成具体的小物件、小场景或比喻。
- 不出现真实人名、公司名、品牌名。
- 全部用简体中文。`;

const FORTUNE_PROMPT = `${WORLD}

任务：玩家在余晖寺摇签前，心里默念了一件想问的事（见下）。为这件事写一支专属的签。
- level 只能是 上上 / 上 / 中 / 下。偏向温和，"下"签也要落在"早点休息""先放一放"这类善意上。
- poem 恰好 4 行，每行恰好 7 个汉字（数一数），不带任何标点；意象来自余晖站：站台、班车、便利店、晚钟、薄荷、信号塔、洗衣房、月亮。
- read 是解签，一到两句白话，30 字以内，具体、轻松，回应玩家问的事。`;

const LETTER_PROMPT = `${WORLD}

任务：玩家把一句烦心事投进了站长老周的「心事邮差」信箱（见下）。把它变成一次跑腿：
- item：这件烦心事变成的一件具体的小物件，16 字以内，例如"一支没电的荧光笔""一把晾不干的伞"。物件和烦心事只能是比喻关系，不能出现烦心事里的词（烦心事是"房租涨了"，就不能写"房租单"）。
- to：按烦心事的主题，从下面的居民里挑最适合收下它的人，只能填 id。看每个人"擅长接住"的事来挑，不要只要沾到工作就交给林工。
- offer：老周交代任务的两句话，每句 30 字以内，说明东西是什么、为什么交给这个人。
- thanks：收件人收到时说的两句话，每句 30 字以内，符合他的性格。
- reply：收件人写给玩家的回信，40～80 字，结尾署名"——名字"。回信要轻，可以只是一个小邀请或一句陪伴。

居民：
${RECIPIENTS.map((r) => `- ${r.id}：${r.name}（${r.title}），${r.voice}；擅长接住：${r.good}`).join('\n')}`;

const FORTUNE_JSON = `只输出一个 JSON 对象，不要任何其他文字，格式：
{"level": "上上|上|中|下", "poem": ["七字一句", "七字一句", "七字一句", "七字一句"], "read": "解签"}`;

const LETTER_JSON = `只输出一个 JSON 对象，不要任何其他文字，格式：
{"item": "小物件", "to": "居民 id", "offer": ["老周第一句", "老周第二句"], "thanks": ["收件人第一句", "收件人第二句"], "reply": "回信……——名字"}`;

const FortuneSchema = z.object({
  level: z.enum(['上上', '上', '中', '下']),
  poem: z.array(z.string()),
  read: z.string(),
});

const LetterSchema = z.object({
  item: z.string(),
  to: z.enum(RECIPIENTS.map((r) => r.id) as [string, ...string[]]),
  offer: z.array(z.string()),
  thanks: z.array(z.string()),
  reply: z.string(),
});

function trace(entry: Record<string, unknown>) {
  try {
    mkdirSync('logs', { recursive: true });
    appendFileSync('logs/ai-trace.log', JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    /* tracing must never break the game */
  }
}

async function readBody(req: IncomingMessage): Promise<AiRequest | null> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4000) return null;
  }
  try {
    const b = JSON.parse(raw) as AiRequest;
    if ((b.task !== 'fortune' && b.task !== 'letter') || typeof b.text !== 'string') return null;
    const avoid = Array.isArray(b.avoid) ? b.avoid.filter((id) => RECIPIENTS.some((r) => r.id === id)).slice(0, 3) : [];
    return { task: b.task, text: [...b.text.trim()].slice(0, MAX_INPUT).join(''), avoid };
  } catch {
    return null;
  }
}

function claudeProvider(apiKey: string): Provider {
  const client = new Anthropic({ apiKey });
  return async (task, system, user) => {
    const response = await client.messages.parse(
      {
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        output_config: {
          effort: 'low',
          format: task === 'fortune' ? zodOutputFormat(FortuneSchema) : zodOutputFormat(LetterSchema),
        },
        system,
        messages: [{ role: 'user', content: user }],
      },
      { timeout: 30_000, maxRetries: 1 },
    );
    return {
      output: response.parsed_output,
      refused: response.stop_reason === 'refusal',
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      model: CLAUDE_MODEL,
    };
  };
}

class ProviderError extends Error {}

/** Try each model in order; move on when one is overloaded, rate-limited or times out. */
function zhipuChain(apiKey: string, models: string[]): Provider {
  const one = models.map((m) => zhipuProvider(apiKey, m));
  return async (task, system, user) => {
    let last: unknown = null;
    for (let i = 0; i < one.length; i++) {
      try {
        return await one[i](task, system, user);
      } catch (e) {
        last = e;
        const retryable = e instanceof ProviderError && /^(zhipu-(429|5\d\d)|timeout|network)/.test(e.message);
        trace({ provider: `zhipu/${models[i]}`, task, result: 'skip-model', error: String(e).slice(0, 200) });
        if (!retryable) break;
      }
    }
    throw last;
  };
}

function zhipuProvider(apiKey: string, model: string): Provider {
  return async (task, system, user) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const r = await fetch(ZHIPU_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `${system}\n\n${task === 'fortune' ? FORTUNE_JSON : LETTER_JSON}` },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
          thinking: { type: 'disabled' },
          temperature: 0.9,
          max_tokens: 1200,
        }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new ProviderError(`zhipu-${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j = (await r.json()) as {
        choices?: { message?: { content?: string | null }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = j.choices?.[0];
      const text = (choice?.message?.content ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '');
      let output: unknown = null;
      try {
        output = JSON.parse(text);
      } catch {
        output = { unparsed: text };
      }
      return {
        output,
        refused: choice?.finish_reason === 'sensitive',
        usage: { input: j.usage?.prompt_tokens ?? 0, output: j.usage?.completion_tokens ?? 0 },
        model,
      };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(ctrl.signal.aborted ? 'timeout' : `network: ${String(e)}`);
    } finally {
      clearTimeout(timer);
    }
  };
}

function pickProvider(env: AiEnv): { name: string; call: Provider } | null {
  const want = env.AI_PROVIDER?.trim().toLowerCase();
  if ((want === 'zhipu' || !want) && env.ZHIPU_API_KEY) {
    const models = (env.ZHIPU_MODEL?.trim() || 'glm-4.5-flash,glm-4-flash-250414').split(',').map((m) => m.trim()).filter(Boolean);
    return { name: `zhipu/${models.join('→')}`, call: zhipuChain(env.ZHIPU_API_KEY, models) };
  }
  if ((want === 'anthropic' || !want) && env.ANTHROPIC_API_KEY) {
    return { name: `anthropic/${CLAUDE_MODEL}`, call: claudeProvider(env.ANTHROPIC_API_KEY) };
  }
  return null;
}

const MAX_ATTEMPTS = 3;

async function run(provider: { name: string; call: Provider }, req: AiRequest): Promise<AiResponse<unknown>> {
  const t0 = Date.now();
  const fortune = req.task === 'fortune';
  const system = fortune ? FORTUNE_PROMPT : LETTER_PROMPT;
  const avoid = req.avoid ?? [];
  let user = `玩家写的是：「${req.text}」`;
  if (!fortune && avoid.length) {
    user += `\n最近收过这位玩家信的居民（这次请换别人）：${avoid.map((id) => RECIPIENTS.find((r) => r.id === id)!.name).join('、')}`;
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await provider.call(req.task, system, user);
    const ms = Date.now() - t0;
    const base = { provider: provider.name, model: raw.model, task: req.task, text: req.text, avoid, attempt, ms, usage: raw.usage };
    if (raw.refused) {
      trace({ ...base, result: 'refusal' });
      return { source: 'fallback', data: null, reason: 'refusal', ms };
    }
    const problems = fortune ? fortuneProblems(raw.output) : letterProblems(raw.output, req.text, avoid);
    trace({ ...base, result: problems.length ? 'invalid' : 'ok', problems, output: raw.output });
    if (!problems.length) return { source: 'ai', data: raw.output, ms };
    // Tell the model exactly what failed, then let it try again.
    user += `\n\n（第 ${attempt} 版不合格：${problems.join('；')}。请按要求重写完整的 JSON。）`;
  }
  return { source: 'fallback', data: null, reason: 'invalid-output', ms: Date.now() - t0 };
}

export function aiProxy(env: AiEnv): Plugin {
  const provider = pickProvider(env);
  return {
    name: 'yuhui-ai-proxy',
    configureServer(server) {
      server.config.logger.info(`  ➜  AI provider: ${provider?.name ?? 'none (handwritten fallback only)'}`);
      server.middlewares.use('/api/ai', async (req: IncomingMessage, res: ServerResponse) => {
        const send = (body: AiResponse<unknown>, status = 200) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send({ source: 'fallback', data: null, reason: 'method' }, 405);
        const body = await readBody(req);
        if (!body) return send({ source: 'fallback', data: null, reason: 'bad-request' }, 400);
        if (isCrisis(body.text)) return send({ source: 'safety', data: null, reason: 'crisis' });
        if (!provider) return send({ source: 'fallback', data: null, reason: 'no-key' });
        try {
          send(await run(provider, body));
        } catch (e) {
          const reason =
            e instanceof Anthropic.RateLimitError
              ? 'rate-limit'
              : e instanceof Anthropic.APIConnectionTimeoutError
                ? 'timeout'
                : e instanceof Anthropic.APIConnectionError
                  ? 'network'
                  : e instanceof Anthropic.APIError
                    ? `api-${e.status}`
                    : e instanceof ProviderError
                      ? e.message.split(':')[0]
                      : 'error';
          trace({ task: body.task, text: body.text, result: reason, error: String(e) });
          send({ source: 'fallback', data: null, reason });
        }
      });
    },
  };
}
