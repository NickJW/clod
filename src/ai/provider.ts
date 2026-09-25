// Model-agnostic AI interface. The rest of the app only talks to `AIProvider`,
// so a different model or company can be added later without touching the UI.
import { getPref, setPref } from '../storage/db';
import { anthropicProvider } from './anthropic';
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

export const PROVIDERS: AIProvider[] = [anthropicProvider];

export function getProvider(id: string): AIProvider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

const DEFAULTS: AISettings = {
  providerId: 'anthropic',
  apiKey: '',
  model: anthropicProvider.models[0].id,
  fastModel: 'claude-haiku-4-5-20251001',
  creativity: 0.7,
};

export function getAISettings(): AISettings {
  return { ...DEFAULTS, ...getPref<Partial<AISettings>>('ai', {}) };
}

export function saveAISettings(s: Partial<AISettings>): void {
  setPref('ai', { ...getAISettings(), ...s });
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
