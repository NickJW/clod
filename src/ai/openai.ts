// ChatGPT (OpenAI) provider, via the Chat Completions API directly from this device
// with the author's own OpenAI API key. Models are listed live from her account,
// so the list stays current without app updates.
import type { AIProvider, AIRequest, AIResult, AISettings } from './provider';
import { AIError } from './errors';

const BASE = 'https://api.openai.com/v1';

function friendly(status: number, body: string): AIError {
  if (status === 401 || status === 403) return new AIError('The OpenAI key wasn\'t accepted. Please check it in Settings → AI editor.', 'bad-key');
  if (status === 429 && /insufficient_quota|billing|quota/i.test(body))
    return new AIError('Your OpenAI account appears to be out of credit. Check billing at platform.openai.com. (A ChatGPT Plus subscription doesn\'t cover the API.)', 'other');
  if (status === 429 || status >= 500) return new AIError('ChatGPT is busy right now. Please try again in a minute.', 'busy');
  if (status === 404 && /model/i.test(body)) return new AIError('That ChatGPT model isn\'t available on your account. Choose another in Settings.', 'other');
  if (status === 400 && /context|too long|maximum/i.test(body)) return new AIError('That request was too long. Try selecting a shorter passage.', 'too-long');
  return new AIError(`ChatGPT returned an error (${status}). Your writing is safe. Please try again.`, 'other');
}

async function once(req: AIRequest, s: AISettings, withTemperature: boolean): Promise<AIResult> {
  const body: Record<string, unknown> = {
    model: req.fast ? s.fastModel || s.model : s.model,
    messages: [{ role: 'system', content: req.context ? `${req.system}\n\n${req.context}` : req.system }, ...req.messages],
    stream: true,
    stream_options: { include_usage: true },
    // Some OpenAI models spend part of this budget on hidden reasoning, so allow headroom.
    max_completion_tokens: Math.min(req.maxTokens + 4000, 16000),
  };
  if (withTemperature) body.temperature = Math.max(0, Math.min(1, req.creativity)) * 1.2;

  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      signal: req.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.apiKey.trim()}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AIError('Stopped.', 'cancelled');
    throw new AIError('Couldn\'t reach ChatGPT. Please check your internet connection. Your writing is saved.', 'network');
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    if (res.status === 400 && withTemperature && /temperature/i.test(text)) return once(req, s, false);
    throw friendly(res.status, text);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finish = '';
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let evt: Record<string, any>;
        try {
          evt = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = evt.choices?.[0];
        if (choice?.delta?.content) {
          text += choice.delta.content;
          req.onText?.(text);
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
        if (evt.usage) {
          const cached = evt.usage.prompt_tokens_details?.cached_tokens ?? 0;
          usage.inputTokens = (evt.usage.prompt_tokens ?? 0) - cached;
          usage.cachedTokens = cached;
          usage.outputTokens = evt.usage.completion_tokens ?? 0;
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AIError('Stopped.', 'cancelled');
    if (text) return { text, usage, stoppedEarly: true };
    throw new AIError('The connection dropped while ChatGPT was answering. Please try again.', 'network');
  }
  return { text, usage, stoppedEarly: finish === 'length' };
}

/** Chat models available on this key, most useful first. */
export async function listOpenAIModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${apiKey.trim()}` } });
  if (!res.ok) throw friendly(res.status, await res.text().catch(() => ''));
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? [])
    .map((m) => m.id)
    .filter((id) => /^(gpt-|chatgpt-|o\d)/.test(id) && !/audio|realtime|tts|transcribe|image|search|embedding|instruct|codex|\d{4}-\d{2}-\d{2}/.test(id))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

/** Pick a sensible default: the newest full-size GPT model, and its "mini" sibling for small jobs. */
export function defaultOpenAIModels(ids: string[]): { model: string; fastModel: string } {
  const gpt = ids.filter((id) => /^gpt-\d/.test(id));
  const full = gpt.find((id) => !/mini|nano/.test(id)) ?? ids[0] ?? '';
  const base = full.replace(/-(pro|turbo)$/, '');
  const fast = gpt.find((id) => id.startsWith(base) && /mini/.test(id)) ?? gpt.find((id) => /mini/.test(id)) ?? full;
  return { model: full, fastModel: fast };
}

export const openaiProvider: AIProvider = {
  id: 'openai',
  name: 'ChatGPT (OpenAI)',
  models: [],
  async complete(req, s) {
    if (!s.apiKey.trim()) throw new AIError('The AI editor isn\'t connected yet.', 'no-key');
    if (!s.model) throw new AIError('Choose a ChatGPT model in Settings → AI editor first.', 'other');
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await once(req, s, true);
      } catch (e) {
        lastErr = e;
        if (!(e instanceof AIError) || (e.kind !== 'busy' && e.kind !== 'network')) throw e;
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
      }
    }
    throw lastErr;
  },
};
