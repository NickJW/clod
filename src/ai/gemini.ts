// Google Gemini provider (free tier available via a Google AI Studio key).
// Calls the Gemini API directly from this device. Models are listed live from
// the key's account so the choice stays current without app updates.
import type { AIProvider, AIRequest, AIResult, AISettings } from './provider';
import { AIError } from './errors';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function friendly(status: number, body: string): AIError {
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(body) || status === 401 || status === 403)
    return new AIError('The Gemini key wasn\'t accepted. Please check it in Settings → AI editor.', 'bad-key');
  if (status === 429)
    return new AIError('You\'ve reached Gemini\'s free limit for now. Wait a minute and try again. If it keeps happening, the daily free allowance is used up until tomorrow.', 'quota');
  if (status >= 500) return new AIError('Gemini is busy right now. Please try again in a minute.', 'busy');
  if (status === 404) return new AIError('That Gemini model isn\'t available. Choose another in Settings → AI editor.', 'other');
  if (status === 400 && /too long|token|exceeds/i.test(body)) return new AIError('That request was too long. Try selecting a shorter passage.', 'too-long');
  return new AIError(`Gemini returned an error (${status}). Your writing is safe. Please try again.`, 'other');
}

// Dark fiction trips over-cautious filters; only block content Google rates as high risk.
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({
  category,
  threshold: 'BLOCK_ONLY_HIGH',
}));

async function once(req: AIRequest, s: AISettings): Promise<AIResult> {
  const model = (req.fast ? s.fastModel || s.model : s.model).replace(/^models\//, '');
  const body = {
    systemInstruction: { parts: [{ text: req.context ? `${req.system}\n\n${req.context}` : req.system }] },
    contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: {
      temperature: Math.max(0, Math.min(1, req.creativity)) * 1.3,
      // Newer Gemini models "think" first and that counts toward this budget, so allow headroom.
      maxOutputTokens: Math.min(req.maxTokens + 4000, 16000),
    },
    safetySettings: SAFETY,
  };

  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal: req.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': s.apiKey.trim() },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AIError('Stopped.', 'cancelled');
    throw new AIError('Couldn\'t reach Gemini. Please check your internet connection. Your writing is saved.', 'network');
  }
  if (!res.ok || !res.body) throw friendly(res.status, await res.text().catch(() => ''));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finish = '';
  let blocked = '';
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
        let evt: Record<string, any>;
        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (evt.promptFeedback?.blockReason) blocked = evt.promptFeedback.blockReason;
        const cand = evt.candidates?.[0];
        for (const part of cand?.content?.parts ?? []) {
          if (part.text && !part.thought) {
            text += part.text;
            req.onText?.(text);
          }
        }
        if (cand?.finishReason) finish = cand.finishReason;
        if (evt.usageMetadata) {
          const cached = evt.usageMetadata.cachedContentTokenCount ?? 0;
          usage.inputTokens = (evt.usageMetadata.promptTokenCount ?? 0) - cached;
          usage.cachedTokens = cached;
          usage.outputTokens = (evt.usageMetadata.candidatesTokenCount ?? 0) + (evt.usageMetadata.thoughtsTokenCount ?? 0);
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AIError('Stopped.', 'cancelled');
    if (text) return { text, usage, stoppedEarly: true };
    throw new AIError('The connection dropped while Gemini was answering. Please try again.', 'network');
  }
  if (!text && (blocked || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish)))
    throw new AIError('Gemini declined to answer this one (its content filter can be over-cautious with dark fiction). Try rewording the request, or select a smaller passage.', 'other');
  if (!text) throw new AIError('Gemini returned an empty answer. Please try again.', 'other');
  return { text, usage, stoppedEarly: finish === 'MAX_TOKENS' };
}

const version = (id: string) => parseFloat(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');

/** Text models available on this key, best first. */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey.trim() } });
  if (!res.ok) throw friendly(res.status, await res.text().catch(() => ''));
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => /^gemini-/.test(id) && !/embedding|aqa|image|tts|live|audio|vision|robotics|computer|native|omni|transcribe|customtools|exp-\d{4}|-\d{3}$/.test(id))
    .sort((a, b) => Number(/latest/.test(b)) - Number(/latest/.test(a)) || version(b) - version(a) || a.localeCompare(b));
}

/**
 * Default to Google's "latest Flash" alias (always the current free-tier Flash model),
 * falling back to the newest stable numbered Flash. "Pro" models have no free allowance.
 */
export function defaultGeminiModels(ids: string[]): { model: string; fastModel: string } {
  const stable = ids.filter((id) => !/preview|exp/.test(id));
  const flash =
    ids.find((id) => id === 'gemini-flash-latest') ??
    stable.filter((id) => /^gemini-\d[\d.]*-flash$/.test(id)).sort((a, b) => version(b) - version(a))[0] ??
    stable.find((id) => /flash/.test(id) && !/lite/.test(id)) ??
    ids[0] ??
    '';
  const lite =
    ids.find((id) => id === 'gemini-flash-lite-latest') ??
    stable.filter((id) => /^gemini-\d[\d.]*-flash-lite$/.test(id)).sort((a, b) => version(b) - version(a))[0] ??
    flash;
  return { model: flash, fastModel: lite };
}

/** Is this model one that has no free allowance (or was picked by an older version of the app)? */
export function badGeminiDefault(id: string): boolean {
  return !id || /omni|pro|image|tts|preview/.test(id);
}

export const geminiProvider: AIProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  models: [],
  async complete(req, s) {
    if (!s.apiKey.trim()) throw new AIError('The AI editor isn\'t connected yet.', 'no-key');
    if (!s.model) throw new AIError('Choose a Gemini model in Settings → AI editor first.', 'other');
    // Try the chosen model; if it's overloaded, out of free allowance or unavailable,
    // fall back to the lighter Flash-Lite model so the author can keep working.
    const main = badGeminiDefault(s.model) && /omni/.test(s.model) ? 'gemini-flash-latest' : s.model;
    const lite = s.fastModel && s.fastModel !== main ? s.fastModel : 'gemini-flash-lite-latest';
    const models = [...new Set(req.fast ? [lite, main] : [main, lite])];
    let lastErr: unknown;
    for (const m of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await once(req, { ...s, model: m, fastModel: m });
        } catch (e) {
          lastErr = e;
          if (!(e instanceof AIError) || e.kind === 'cancelled' || e.kind === 'bad-key' || e.kind === 'too-long') throw e;
          // A brief overload is worth one retry on the same model; anything else moves on.
          if ((e.kind === 'busy' || e.kind === 'network') && attempt === 0) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          break;
        }
      }
    }
    throw lastErr;
  },
};
