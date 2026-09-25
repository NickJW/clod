// Model-agnostic AI interface. The rest of the app only talks to `AIProvider`,
// so a different model or company can be added later without touching the UI.
import { getPref, setPref } from '../storage/db';
import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { manualProvider } from './manual';
export { AIError } from './errors';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  /** Role-specific instructions (Story Architect, Prose Editor, ...). */
  system: string;
  /** The relevant slice of the story bible. Sent separately so providers can cache it. */
  context: string;
  messages: AIMessage[];
  maxTokens: number;
  /** 0 = precise, 1 = adventurous. */
  creativity: number;
  /** Use the faster, cheaper model (summaries and small jobs). */
  fast?: boolean;
  signal?: AbortSignal;
  onText?: (fullTextSoFar: string) => void;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface AIResult {
  text: string;
  usage: AIUsage;
  stoppedEarly: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  models: { id: string; label: string; note: string }[];
  complete(req: AIRequest, settings: AISettings): Promise<AIResult>;
}

export interface AISettings {
  providerId: string;
  apiKey: string;
  model: string;
  fastModel: string;
  creativity: number;
}

export const PROVIDERS: AIProvider[] = [anthropicProvider, openaiProvider, manualProvider];

export function getProvider(id: string): AIProvider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

interface ProviderPrefs {
  apiKey: string;
  model: string;
  fastModel: string;
}

interface StoredAI {
  providerId: string;
  creativity: number;
  providers: Record<string, ProviderPrefs>;
}

const PROVIDER_DEFAULTS: Record<string, ProviderPrefs> = {
  anthropic: { apiKey: '', model: anthropicProvider.models[0].id, fastModel: 'claude-haiku-4-5-20251001' },
  openai: { apiKey: '', model: '', fastModel: '' },
  // Copy & paste needs no key; a placeholder marks it as "connected".
  manual: { apiKey: 'copy-and-paste', model: 'chatgpt.com', fastModel: 'chatgpt.com' },
};

function stored(): StoredAI {
  const raw = getPref<Record<string, unknown>>('ai', {});
  // Older versions stored one flat Claude setting: move it into the Claude slot.
  const providers = (raw.providers as Record<string, ProviderPrefs>) ?? {
    anthropic: { ...PROVIDER_DEFAULTS.anthropic, ...(raw.apiKey ? { apiKey: raw.apiKey as string } : {}), ...(raw.model ? { model: raw.model as string } : {}) },
  };
  return { providerId: (raw.providerId as string) || (raw.apiKey ? 'anthropic' : 'manual'), creativity: typeof raw.creativity === 'number' ? raw.creativity : 0.7, providers };
}

/** The active provider's settings, flattened. */
export function getAISettings(): AISettings {
  const st = stored();
  const pp = st.providerId === 'manual' ? PROVIDER_DEFAULTS.manual : { ...PROVIDER_DEFAULTS[st.providerId], ...st.providers[st.providerId] };
  return { providerId: st.providerId, creativity: st.creativity, apiKey: pp.apiKey ?? '', model: pp.model ?? '', fastModel: pp.fastModel ?? '' };
}

/** Save settings; key/model changes apply to the active provider (or the one named in the patch). */
export function saveAISettings(patch: Partial<AISettings>): void {
  const st = stored();
  const providerId = patch.providerId ?? st.providerId;
  const cur = { ...PROVIDER_DEFAULTS[providerId], ...st.providers[providerId] };
  const next: StoredAI = {
    providerId,
    creativity: patch.creativity ?? st.creativity,
    providers: {
      ...st.providers,
      [providerId]: {
        apiKey: patch.apiKey ?? cur.apiKey,
        model: patch.model ?? cur.model,
        fastModel: patch.fastModel ?? cur.fastModel,
      },
    },
  };
  setPref('ai', next);
}

export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  since: number;
}

export function getUsage(): UsageTotals {
  return getPref<UsageTotals>('usage', { requests: 0, inputTokens: 0, outputTokens: 0, since: Date.now() });
}

export function recordUsage(u: AIUsage): void {
  const t = getUsage();
  setPref('usage', {
    ...t,
    requests: t.requests + 1,
    inputTokens: t.inputTokens + u.inputTokens + u.cachedTokens,
    outputTokens: t.outputTokens + u.outputTokens,
  });
}

export function resetUsage(): void {
  setPref('usage', { requests: 0, inputTokens: 0, outputTokens: 0, since: Date.now() });
}

/** Rough token estimate (about 4 characters per token for English prose). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
