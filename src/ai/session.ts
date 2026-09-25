// The editor panel's state and the code that runs AI actions. AI results are
// never written into the book automatically: the author accepts each one.
import { useSyncExternalStore } from 'react';
import { ACTIONS, type ActionId, type Built, type JobInput, type OutputKind } from './actions';
import { buildContext } from './context';
import { systemPrompt } from './prompts';
import { AIError, estimateTokens, getAISettings, getProvider, recordUsage, type AIMessage, type AIUsage } from './provider';
import { getState, patchItem } from '../story/store';
import { countWords } from '../story/reference';
import { getPref } from '../storage/db';
import { flushEditor } from '../editor/bridge';

export interface Option {
  title: string;
  idea: string;
  [k: string]: string;
}

export interface Finding {
  title: string;
  detail: string;
  level?: string;
  suggestion?: string;
}

export interface ExtractItem {
  kind: 'fact' | 'clue' | 'event' | 'belief' | 'character' | 'place';
  title: string;
  detail: string;
  characters: string[];
  when: string;
}

export interface Parsed {
  items?: ExtractItem[];
  options?: Option[];
  questions?: string[];
  note?: string;
  summary?: string;
  findings?: Finding[];
  revision?: string;
  notes?: string;
  prose?: string;
  editorNote?: string;
}

export interface Thread {
  id: string;
  input: JobInput;
  label: string;
  output: OutputKind;
  system: string;
  context: string;
  messages: AIMessage[];
  status: 'running' | 'done' | 'error';
  streaming: string;
  parsed: Parsed | null;
  raw: string;
  error: string;
  errorKind?: string;
  usage?: AIUsage;
  /** Handled options/findings, so buttons can show what was done. */
  handled: Record<number, string>;
  followUps: { q: string; a: string; status: 'running' | 'done' | 'error' }[];
  applied?: string;
}

interface PanelState {
  open: boolean;
  mode: ActionId;
  threads: Thread[];
  prefill: JobInput | null;
}

let state: PanelState = {
  open: getPref('panelOpen', true),
  mode: 'think',
  threads: [],
  prefill: null,
};
const listeners = new Set<() => void>();
const controllers = new Map<string, AbortController>();

export function usePanel<T>(sel: (s: PanelState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(state),
  );
}

export function setPanel(patch: Partial<PanelState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function patchThread(id: string, patch: Partial<Thread> | ((t: Thread) => Partial<Thread>)) {
  setPanel({
    threads: state.threads.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)),
  });
}

export function markHandled(threadId: string, index: number, what: string) {
  patchThread(threadId, (t) => ({ handled: { ...t.handled, [index]: what } }));
}

export function markApplied(threadId: string, what: string) {
  patchThread(threadId, { applied: what });
}

export function removeThread(id: string) {
  controllers.get(id)?.abort();
  setPanel({ threads: state.threads.filter((t) => t.id !== id) });
}

export function clearThreads() {
  controllers.forEach((c) => c.abort());
  setPanel({ threads: [] });
}

/** Open the panel with an action preselected (used by buttons all over the app). */
export function openEditor(input: JobInput, autoRun = false) {
  setPanel({ open: true, mode: input.actionId, prefill: input });
  if (autoRun) void run(input);
}

function prepare(input: JobInput): { built: Built; system: string; context: string } {
  const p = getState().project;
  if (!p) throw new AIError('Open a novel first.', 'other');
  const def = ACTIONS[input.actionId];
  const built = def.build(p, input);
  const system = systemPrompt(built.role, { craft: built.craft, firstTime: getPref('firstTime', true) });
  const context = buildContext(p, {
    scope: built.scope,
    chapterId: input.selection?.chapterId ?? input.chapterId ?? p.currentChapterId,
    text: built.focusText ?? input.selection?.text ?? input.request,
    characterIds: built.characterIds ?? (input.characterId ? [input.characterId] : []),
    voice: built.role === 'prose' && (built.output === 'prose' || built.output === 'revision'),
  });
  if (input.avoid) built.user += `\n\nIMPORTANT: a previous draft of this used these weak patterns. Avoid them completely this time:\n${input.avoid}`;
  return { built, system, context };
}

/** Rough size of a request before sending, so the author can see when something is large. */
export function estimate(input: JobInput): { tokens: number; label: string } {
  try {
    const { built, system, context } = prepare(input);
    const tokens = estimateTokens(system + context + built.user) + built.maxTokens / 2;
    const label = tokens < 6000 ? 'Small request' : tokens < 16000 ? 'Medium request' : 'Larger request (costs more)';
    return { tokens, label };
  } catch {
    return { tokens: 0, label: '' };
  }
}

export async function run(input: JobInput): Promise<void> {
  flushEditor();
  const id = Math.random().toString(36).slice(2);
  const def = ACTIONS[input.actionId];
  let prepared: ReturnType<typeof prepare>;
  try {
    prepared = prepare(input);
  } catch (e) {
    return void setPanel({
      threads: [errorThread(id, input, def.label, e), ...state.threads],
    });
  }
  const { built, system, context } = prepared;
  const thread: Thread = {
    id,
    input,
    label: def.label,
    output: built.output,
    system,
    context,
    messages: [{ role: 'user', content: built.user }],
    status: 'running',
    streaming: '',
    parsed: null,
    raw: '',
    error: '',
    handled: {},
    followUps: [],
  };
  setPanel({ open: true, threads: [thread, ...state.threads].slice(0, 25), prefill: null });

  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  const settings = getAISettings();
  try {
    const res = await getProvider(settings.providerId).complete(
      {
        system,
        context,
        messages: thread.messages,
        maxTokens: built.maxTokens,
        creativity: built.output === 'prose' || built.output === 'options' ? settings.creativity : Math.min(settings.creativity, 0.5),
        fast: built.fast,
        signal: ctrl.signal,
        onText: (t) => patchThread(id, { streaming: t }),
      },
      settings,
    );
    recordUsage(res.usage);
    const parsed = parse(built.output, res.text);
    patchThread(id, {
      status: 'done',
      raw: res.text,
      parsed,
      usage: res.usage,
      streaming: '',
      messages: [...thread.messages, { role: 'assistant', content: res.text }],
      error: res.stoppedEarly ? 'The answer was cut short because it was very long.' : '',
    });
  } catch (e) {
    patchThread(id, {
      status: 'error',
      error: e instanceof AIError ? e.message : 'Something went wrong. Your writing is safe. Please try again.',
      errorKind: e instanceof AIError ? e.kind : 'other',
    });
  } finally {
    controllers.delete(id);
  }
}

/** Run an action and return just the text (used for summaries and plans that go straight into a field for review). */
export async function runQuiet(input: JobInput): Promise<string> {
  flushEditor();
  const { built, system, context } = prepare(input);
  const settings = getAISettings();
  const res = await getProvider(settings.providerId).complete(
    { system, context, messages: [{ role: 'user', content: built.user }], maxTokens: built.maxTokens, creativity: 0.3, fast: built.fast },
    settings,
  );
  recordUsage(res.usage);
  return res.text.trim();
}

/**
 * Keep chapter summaries fresh in the background (cheap model), so the editor
 * remembers earlier chapters without re-reading them. Only runs if enabled,
 * connected, and the chapter changed substantially since its last summary.
 */
const summarizing = new Set<string>();
export async function maybeSummarize(chapterId: string, force = false): Promise<boolean> {
  const p = getState().project;
  const ch = p?.chapters.find((c) => c.id === chapterId);
  if (!p || !ch || summarizing.has(chapterId) || !getAISettings().apiKey) return false;
  if (!force && (!getPref('autoSummary', true) || getAISettings().providerId === 'manual')) return false;
  const words = countWords(ch.text);
  if (words < 250 || (!force && ch.summary && Math.abs(words - ch.summaryWordCount) < 300)) return false;
  summarizing.add(chapterId);
  try {
    const summary = await runQuiet({ actionId: 'summarize', chapterId });
    patchItem('chapters', chapterId, { summary, summaryWordCount: words });
    return true;
  } catch {
    return false;
  } finally {
    summarizing.delete(chapterId);
  }
}

export async function followUp(threadId: string, question: string): Promise<void> {
  const t = state.threads.find((x) => x.id === threadId);
  if (!t || !question.trim()) return;
  const idx = t.followUps.length;
  patchThread(threadId, { followUps: [...t.followUps, { q: question, a: '', status: 'running' }] });
  const messages: AIMessage[] = [
    ...t.messages,
    { role: 'user', content: `${question}\n\n(Reply conversationally in plain text, not JSON. Be concise.)` },
  ];
  const settings = getAISettings();
  const setF = (patch: Partial<Thread['followUps'][number]>) =>
    patchThread(threadId, (cur) => ({ followUps: cur.followUps.map((f, i) => (i === idx ? { ...f, ...patch } : f)) }));
  try {
    const res = await getProvider(settings.providerId).complete(
      { system: t.system, context: t.context, messages, maxTokens: 1500, creativity: settings.creativity, onText: (a) => setF({ a }) },
      settings,
    );
    recordUsage(res.usage);
    setF({ a: res.text, status: 'done' });
    patchThread(threadId, (cur) => ({ messages: [...messages, { role: 'assistant', content: res.text }], followUps: cur.followUps }));
  } catch (e) {
    setF({ a: e instanceof AIError ? e.message : 'Something went wrong. Please try again.', status: 'error' });
  }
}

export function cancel(threadId: string) {
  controllers.get(threadId)?.abort();
}

export function retry(threadId: string) {
  const t = state.threads.find((x) => x.id === threadId);
  if (!t) return;
  removeThread(threadId);
  void run(t.input);
}

function errorThread(id: string, input: JobInput, label: string, e: unknown): Thread {
  return {
    id,
    input,
    label,
    output: 'text',
    system: '',
    context: '',
    messages: [],
    status: 'error',
    streaming: '',
    parsed: null,
    raw: '',
    error: e instanceof Error ? e.message : String(e),
    errorKind: e instanceof AIError ? e.kind : 'other',
    handled: {},
    followUps: [],
  };
}

// ---------- Parsing (tolerant: a malformed answer still shows as text) ----------

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fence?.[1], text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v));

export function parse(kind: OutputKind, text: string): Parsed {
  if (kind === 'revision') {
    const rev = text.match(/<revision>\s*([\s\S]*?)\s*<\/revision>/);
    const notes = text.match(/<notes>\s*([\s\S]*?)\s*<\/notes>/);
    if (rev) return { revision: rev[1].trim(), notes: notes?.[1].trim() ?? '' };
    return { revision: text.replace(/<\/?\w+>/g, '').trim(), notes: '' };
  }
  if (kind === 'prose') {
    const [prose, note] = text.split(/\n?EDITOR'S NOTE:/);
    return { prose: prose.trim(), editorNote: note?.trim() };
  }
  if (kind === 'extract') {
    const j = extractJson(text) as { items?: unknown[] } | null;
    const kinds = ['fact', 'clue', 'event', 'belief', 'character', 'place'];
    return {
      items: (Array.isArray(j?.items) ? j!.items : [])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          kind: (kinds.includes(str(x.kind)) ? str(x.kind) : 'fact') as ExtractItem['kind'],
          title: str(x.title),
          detail: str(x.detail),
          characters: Array.isArray(x.characters) ? x.characters.map(str) : [],
          when: str(x.when),
        })),
    };
  }
  if (kind === 'options' || kind === 'findings') {
    const j = extractJson(text) as Record<string, unknown> | null;
    if (!j || typeof j !== 'object') return {};
    const out: Parsed = {
      questions: Array.isArray(j.questions) ? j.questions.map(str).filter(Boolean) : [],
      note: str(j.note),
      summary: str(j.summary),
    };
    if (Array.isArray(j.options))
      out.options = j.options
        .filter((o) => o && typeof o === 'object')
        .map((o) => Object.fromEntries(Object.entries(o as object).map(([k, v]) => [k, str(v)])) as Option);
    if (Array.isArray(j.findings))
      out.findings = j.findings
        .filter((f) => f && typeof f === 'object')
        .map((f) => {
          const r = f as Record<string, unknown>;
          return { title: str(r.title), detail: str(r.detail), level: str(r.level), suggestion: str(r.suggestion) };
        });
    return out;
  }
  return {};
}
