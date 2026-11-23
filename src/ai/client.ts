import { isCrisis, type AiRequest, type AiResponse } from './shared';

/**
 * Ask the local proxy. Never throws: on any failure (static hosting, no key, timeout)
 * it returns source "fallback" and the caller uses handwritten content.
 */
export async function askAI<T>(req: AiRequest, timeoutMs = 35_000): Promise<AiResponse<T>> {
  if (isCrisis(req.text)) return { source: 'safety', data: null, reason: 'crisis' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch('./api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!r.ok) return { source: 'fallback', data: null, reason: `http-${r.status}` };
    return (await r.json()) as AiResponse<T>;
  } catch {
    return { source: 'fallback', data: null, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
