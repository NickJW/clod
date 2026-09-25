// Claude (Anthropic) provider. Calls the Messages API directly from this device
// with the author's own key; there is no middle-man server.
import type { AIProvider, AIRequest, AIResult, AISettings } from './provider';
import { AIError } from './errors';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

function friendlyHttpError(status: number, body: string): AIError {
  if (status === 401 || status === 403)
    return new AIError('The AI key wasn\'t accepted. Please check it in Settings → AI editor.', 'bad-key');
  if (status === 429 || status === 529 || status === 503)
    return new AIError('The AI service is busy right now. Please try again in a minute.', 'busy');
  if (status === 400 && /too long|context|max_tokens|prompt is too long/i.test(body))
    return new AIError('That request was too long. Try selecting a shorter passage.', 'too-long');
  if (status === 400 && /credit|billing|balance/i.test(body))
    return new AIError('Your AI account appears to be out of credit. Check your billing at console.anthropic.com.', 'other');
  return new AIError(`The AI service returned an error (${status}). Your writing is safe. Please try again.`, 'other');
}

async function once(req: AIRequest, s: AISettings, withTemperature: boolean): Promise<AIResult> {
  const body: Record<string, unknown> = {
    model: req.fast ? s.fastModel : s.model,
    max_tokens: req.maxTokens,
    stream: true,
    system: [
      { type: 'text', text: req.system },
      // The story context is marked cacheable: repeated requests about the same book cost less.
      ...(req.context ? [{ type: 'text', text: req.context, cache_control: { type: 'ephemeral' } }] : []),
    ],
    messages: req.messages,
  };
  if (withTemperature) body.temperature = Math.max(0, Math.min(1, req.creativity));

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: req.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AIError('Stopped.', 'cancelled');
    throw new AIError('Couldn\'t reach the AI. Please check your internet connection. Your writing is saved.', 'network');
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    // Some models don't accept a temperature setting: retry once without it.
    if (res.status === 400 && withTemperature && /temperature/i.test(text)) return once(req, s, false);
    throw friendlyHttpError(res.status, text);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  let stopReason = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        let evt: Record<string, any>;
        try {
          evt = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }
        switch (evt.type) {
          case 'message_start': {
            const u = evt.message?.usage ?? {};
            usage.inputTokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
            usage.cachedTokens = u.cache_read_input_tokens ?? 0;
            break;
          }
          case 'content_block_delta':
            if (evt.delta?.type === 'text_delta') {
              text += evt.delta.text;
              req.onText?.(text);
            }
            break;
          case 'message_delta':
            if (evt.usage?.output_tokens) usage.outputTokens = evt.usage.output_tokens;
            if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
            break;
          case 'error':
            throw friendlyHttpError(evt.error?.type === 'overloaded_error' ? 529 : 500, JSON.stringify(evt.error));
        }
      }
    }
  } catch (e) {
    if (e instanceof AIError) throw e;
    if ((e as Error).name === 'AbortError') throw new AIError('Stopped.', 'cancelled');
    if (text) return { text, usage, stoppedEarly: true }; // keep what arrived
    throw new AIError('The connection dropped while the AI was answering. Please try again.', 'network');
  }
  return { text, usage, stoppedEarly: stopReason === 'max_tokens' };
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  name: 'Claude (Anthropic)',
  models: [
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Recommended: excellent writing, moderate cost' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'The most capable, and the most expensive' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', note: 'Fast and inexpensive, less nuanced' },
  ],
  async complete(req, s) {
    if (!s.apiKey.trim()) throw new AIError('The AI editor isn\'t connected yet.', 'no-key');
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await once(req, s, true);
      } catch (e) {
        lastErr = e;
        // Retry only when the service is busy/unreachable, and only if nothing was streamed yet.
        if (!(e instanceof AIError) || (e.kind !== 'busy' && e.kind !== 'network')) throw e;
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      }
    }
    throw lastErr;
  },
};
