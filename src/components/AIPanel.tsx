// "Your editor": the AI side panel. It's organised by what the author wants
// to do, not as a chat window, and every result has clear, human buttons.
import { useEffect, useMemo, useState } from 'react';
import { ACTIONS, PANEL_MODES, REVISION_LEVELS, STUCK_KINDS, TWIST_KINDS, type ActionId, type JobInput } from '../ai/actions';
import {
  cancel,
  clearThreads,
  estimate,
  followUp,
  markApplied,
  markHandled,
  removeThread,
  retry,
  run,
  setPanel,
  usePanel,
  type ExtractItem,
  type Option,
  type Thread,
} from '../ai/session';
import { getAISettings } from '../ai/provider';
import { addItem, getState, go, patchItem, toast, useApp } from '../story/store';
import { newBelief, newCharacter, newClue, newEvent, newFact, newIdea, newNote, newPlace } from '../story/factory';
import { checkProse } from '../editor/proseCheck';
import { applyReplacement, currentSelection, cursorSelection, insertText } from '../editor/bridge';
import { diffWords } from '../editor/diff';
import { useSpeech } from '../editor/speech';
import { setPref } from '../storage/db';
import { Icon, Markdown } from './ui';
import type { CanonStatus } from '../types';
import { chapterLabel } from '../story/reference';

export function AIPanel() {
  const open = usePanel((s) => s.open);
  const threads = usePanel((s) => s.threads);
  const page = useApp((s) => s.page);

  if (!open)
    return (
      <aside className="ai closed">
        <button className="ai-closed-btn" onClick={() => toggle(true)} title="Open your editor">
          <Icon name="spark" size={18} /> Your editor
        </button>
      </aside>
    );

  const connected = !!getAISettings().apiKey;
  return (
    <aside className="ai" aria-label="Your editor">
      <div className="ai-head">
        <div className="row">
          <Icon name="spark" />
          <span className="t">Your editor</span>
          <span className="spacer" />
          {threads.length > 0 && (
            <button className="btn ghost small" onClick={clearThreads} title="Clear all answers">
              Clear
            </button>
          )}
          <button className="btn ghost small" onClick={() => toggle(false)} title="Hide the editor panel">
            Hide
          </button>
        </div>
        <Modes />
      </div>
      {!connected && (
        <div className="ai-compose">
          <div className="note-box">
            <b>Your AI editor isn't connected yet.</b> It takes about two minutes.
            <div style={{ marginTop: 8 }}>
              <button className="btn primary small" onClick={() => go('settings')}>
                Connect it
              </button>
            </div>
          </div>
        </div>
      )}
      <Compose page={page} />
      <div className="ai-body">
        {threads.length === 0 ? <QuickStart /> : threads.map((t) => <ThreadView key={t.id} t={t} />)}
      </div>
    </aside>
  );
}

function toggle(open: boolean) {
  setPanel({ open });
  setPref('panelOpen', open);
}

function Modes() {
  const mode = usePanel((s) => s.mode);
  return (
    <div className="ai-modes" role="tablist">
      {PANEL_MODES.map((m) => (
        <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setPanel({ mode: m.id, prefill: null })} title={ACTIONS[m.id].blurb}>
          {m.short}
        </button>
      ))}
    </div>
  );
}

function Compose({ page }: { page: string }) {
  const mode = usePanel((s) => s.mode);
  const prefill = usePanel((s) => s.prefill);
  const def = ACTIONS[mode];
  const [request, setRequest] = useState('');
  const [variant, setVariant] = useState('');
  const speech = useSpeech((t) => setRequest((r) => (r ? r.replace(/\s*$/, ' ') : '') + t));

  useEffect(() => {
    setRequest(prefill?.request ?? '');
    setVariant(prefill?.variant ?? (mode === 'improve' ? 'polish' : mode === 'stuck' ? '' : mode === 'twist' ? 'Any kind' : ''));
  }, [mode, prefill]);

  const input = (): JobInput => {
    const p = getState().project!;
    const sel = mode === 'write' || mode === 'continue' ? cursorSelection() : currentSelection();
    return {
      ...(prefill ?? {}),
      actionId: mode,
      request,
      variant: variant || undefined,
      selection: prefill?.selection ?? sel,
      chapterId: prefill?.chapterId ?? sel?.chapterId ?? p.currentChapterId,
    };
  };

  const needsSel = def.needs === 'selection';
  const [, force] = useState(0);
  // refresh selection hint when the author clicks into the panel
  const sel = needsSel || def.needs === 'selection-or-chapter' ? prefill?.selection ?? currentSelection() : undefined;
  const est = useMemo(() => (getAISettings().apiKey && getAISettings().providerId !== 'manual' ? estimate(input()) : { tokens: 0, label: '' }), [mode, request, variant, prefill, sel?.text]); // eslint-disable-line

  const canRun = !(def.needs === 'request' && !request.trim()) && !(needsSel && !sel) && !(mode === 'stuck' && !variant);

  const submit = () => {
    if (!canRun) return;
    speech.stop();
    void run(input());
    setRequest('');
  };

  return (
    <div className="ai-compose" onMouseEnter={() => force((n) => n + 1)}>
      <div className="blurb">{def.blurb}</div>
      {mode === 'improve' && (
        <div className="chips" style={{ marginBottom: 10 }}>
          {REVISION_LEVELS.map((l) => (
            <button key={l.id} className={`chip${variant === l.id ? ' on' : ''}`} onClick={() => setVariant(l.id)} style={{ fontSize: '0.82rem', minHeight: 30, padding: '3px 10px' }}>
              {l.label}
            </button>
          ))}
        </div>
      )}
      {mode === 'stuck' && (
        <div className="chips" style={{ marginBottom: 10 }}>
          {STUCK_KINDS.map((k) => (
            <button key={k} className={`chip${variant === k ? ' on' : ''}`} onClick={() => setVariant(k)}>
              {k}
            </button>
          ))}
        </div>
      )}
      {mode === 'twist' && (
        <select className="input" value={variant} onChange={(e) => setVariant(e.target.value)} style={{ marginBottom: 10 }}>
          {TWIST_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      )}
      {(needsSel || def.needs === 'selection-or-chapter') && (
        <div className="tiny muted" style={{ marginBottom: 8 }}>
          {sel ? (
            <>Working on your selected text: “{sel.text.slice(0, 80).trim()}{sel.text.length > 80 ? '…' : ''}”</>
          ) : needsSel ? (
            page === 'write' ? (
              <b>First, select some text in your chapter.</b>
            ) : (
              <b>Open a chapter in Write and select some text first.</b>
            )
          ) : (
            <>Working on the whole current chapter. Select text to focus on part of it.</>
          )}
        </div>
      )}
      <textarea
        className="input"
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder={def.placeholder ?? (def.needs === 'request' ? 'Type here…' : 'Optional: add a note for your editor')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
        aria-label="Your request"
      />
      {speech.interim && <div className="tiny muted" style={{ marginTop: 4 }}>{speech.interim}…</div>}
      {speech.error && <div className="tiny" style={{ color: 'var(--danger)', marginTop: 4 }}>{speech.error}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className={`btn small${speech.listening ? ' on' : ''}`} onClick={speech.toggle} title="Speak instead of typing">
          <Icon name="mic" size={16} /> {speech.listening ? 'Stop' : 'Talk'}
        </button>
        <span className="cost" title={est.tokens ? `About ${est.tokens.toLocaleString()} tokens` : ''}>
          {est.label}
        </span>
        <span className="spacer" />
        <button className="btn primary" disabled={!canRun} onClick={submit}>
          {def.label}
        </button>
      </div>
    </div>
  );
}

function QuickStart() {
  const quick: { id: ActionId; variant?: string }[] = [
    { id: 'stuck' },
    { id: 'workOn' },
    { id: 'continue' },
    { id: 'proseReview' },
    { id: 'whyNotWorking' },
    { id: 'continuity' },
    { id: 'missing' },
    { id: 'extract' },
  ];
  return (
    <div>
      <p className="small muted">
        Pick a mode above, or try one of these. Your editor reads your story bible, so it knows your characters, clues and plans. Nothing it suggests goes into your book unless you choose it.
      </p>
      <div className="ai-quick">
        {quick.map((q) => (
          <button
            key={q.id}
            className="btn"
            onClick={() => {
              if (q.id === 'stuck' || q.id === 'continue') setPanel({ mode: q.id, prefill: null });
              else void run({ actionId: q.id, selection: currentSelection(), chapterId: getState().project?.currentChapterId });
            }}
          >
            {ACTIONS[q.id].label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Results ----------

function ThreadView({ t }: { t: Thread }) {
  const [reply, setReply] = useState('');
  const speech = useSpeech((x) => setReply((r) => (r ? r + ' ' : '') + x));
  const p = useApp((s) => s.project)!;
  const chapterId = t.input.selection?.chapterId ?? t.input.chapterId ?? p.currentChapterId;

  return (
    <div className="thread">
      <div className="thread-head">
        <span className="l">{t.label}</span>
        {t.input.variant && <span className="pill neutral">{REVISION_LEVELS.find((l) => l.id === t.input.variant)?.label ?? t.input.variant}</span>}
        <span className="spacer" />
        {t.status === 'running' ? (
          <button className="btn ghost small" onClick={() => cancel(t.id)}>
            Stop
          </button>
        ) : (
          <button className="btn ghost small" onClick={() => removeThread(t.id)} title="Remove">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
      {t.input.request && <div className="thread-q">“{t.input.request}”</div>}

      {t.status === 'running' && (
        <div className="small muted typing">
          {t.streaming ? (t.output === 'prose' || t.output === 'text' ? <Markdown text={t.streaming} /> : 'Thinking it through…') : 'Reading your story…'}
        </div>
      )}
      {t.status === 'error' && (
        <div className="err-box">
          {t.error}
          <div className="row" style={{ marginTop: 8 }}>
            {t.errorKind === 'no-key' || t.errorKind === 'bad-key' ? (
              <button className="btn small" onClick={() => go('settings')}>
                Open settings
              </button>
            ) : t.errorKind !== 'cancelled' ? (
              <button className="btn small" onClick={() => retry(t.id)}>
                Try again
              </button>
            ) : null}
          </div>
        </div>
      )}
      {t.status === 'done' && (
        <>
          {t.output === 'prose' && <ProseResult t={t} chapterId={chapterId} />}
          {t.output === 'revision' && <RevisionResult t={t} />}
          {t.output === 'options' && <OptionsResult t={t} />}
          {t.output === 'findings' && <FindingsResult t={t} />}
          {t.output === 'text' && <TextResult t={t} chapterId={chapterId} />}
          {t.output === 'extract' && <ExtractResult t={t} chapterId={chapterId} />}
          {t.error && <div className="tiny muted" style={{ marginTop: 6 }}>{t.error}</div>}

          {t.followUps.map((f, i) => (
            <div key={i} style={{ marginTop: 12, borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
              <div className="thread-q">You: {f.q}</div>
              <div className={f.status === 'running' ? 'typing' : ''}>
                {f.status === 'error' ? <div className="err-box">{f.a}</div> : <Markdown text={f.a} />}
              </div>
              {f.status === 'done' && (
                <div className="row" style={{ marginTop: 6 }}>
                  <SaveNote title={`${t.label}: follow-up`} body={`Q: ${f.q}\n\n${f.a}`} />
                </div>
              )}
            </div>
          ))}
          <div className="row" style={{ marginTop: 12, alignItems: 'stretch' }}>
            <input
              className="input"
              style={{ flex: 1, minHeight: 38 }}
              placeholder="Reply, or ask a follow-up…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && reply.trim()) {
                  void followUp(t.id, reply);
                  setReply('');
                }
              }}
            />
            <button className={`btn small${speech.listening ? ' on' : ''}`} onClick={speech.toggle} title="Talk">
              <Icon name="mic" size={16} />
            </button>
            <button
              className="btn small"
              disabled={!reply.trim()}
              onClick={() => {
                void followUp(t.id, reply);
                setReply('');
              }}
            >
              Send
            </button>
          </div>
          {t.usage && t.usage.inputTokens + t.usage.outputTokens > 0 && (
            <div className="cost" style={{ marginTop: 6 }}>
              {(t.usage.inputTokens + t.usage.cachedTokens + t.usage.outputTokens).toLocaleString()} tokens
              {t.usage.cachedTokens > 0 && ` (${t.usage.cachedTokens.toLocaleString()} reused at a discount)`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Runs the free local prose check on the AI's own draft, and offers a cleaner retry. */
const DRAFT_KINDS = ['cliche', 'dash', 'notbut', 'filter', 'emotion', 'ominous', 'asif', 'semi', 'rq'];
function DraftCheck({ t, text }: { t: Thread; text: string }) {
  const flags = useMemo(() => checkProse(text).flags.filter((f) => DRAFT_KINDS.includes(f.kind)), [text]);
  if (!flags.length || t.applied) return null;
  const avoid = flags.map((f) => `- ${f.title}${f.examples.length ? `, e.g. ${f.examples.slice(0, 3).map((e) => `"${e.text}"`).join('; ')}` : ''}`).join('\n');
  return (
    <div className="note-box" style={{ marginTop: 8 }}>
      <b>Quality check:</b> this draft has some habits of generic prose: {flags.map((f) => f.title.replace(/ \(\d+\)$/, '').toLowerCase()).join(', ')}.
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" onClick={() => void run({ ...t.input, avoid })}>
          Ask for a cleaner version
        </button>
      </div>
    </div>
  );
}

const EXTRACT_LABEL: Record<ExtractItem['kind'], string> = {
  fact: 'Fact',
  clue: 'Clue',
  event: 'Timeline event',
  belief: 'Belief',
  character: 'New character',
  place: 'New place',
};

function ExtractResult({ t, chapterId }: { t: Thread; chapterId: string }) {
  const items = t.parsed?.items;
  if (!items) return <Markdown text={t.raw} />;
  if (!items.length) return <div className="ok-box">Your story bible already covers everything this chapter establishes.</div>;
  const add = (it: ExtractItem, i: number, status: CanonStatus) => {
    const p = getState().project!;
    const ids = it.characters.map((n) => p.characters.find((c) => c.name.toLowerCase().includes(n.toLowerCase().split(' ')[0]))?.id).filter((x): x is string => !!x);
    const text = it.detail || it.title;
    if (it.kind === 'fact') addItem('facts', newFact(text, { readerLearnsChapterId: chapterId, status }));
    if (it.kind === 'clue') addItem('clues', newClue({ title: it.title, description: it.detail, appearsChapterId: chapterId, whoKnowsIds: ids, status }));
    if (it.kind === 'event') addItem('timeline', newEvent({ title: it.title, description: it.detail, chapterId, characterIds: ids, dateKind: 'approx', approxLabel: it.when, order: Date.now(), status }));
    if (it.kind === 'belief') addItem('beliefs', newBelief(ids[0] ?? '', { belief: text, sinceChapterId: chapterId, status }));
    if (it.kind === 'character') addItem('characters', newCharacter(it.title, { fields: { personality: it.detail }, status }));
    if (it.kind === 'place') addItem('places', newPlace({ name: it.title, description: it.detail }));
    markHandled(t.id, i, status === 'canon' ? 'Added as decided' : 'Added as a possibility');
  };
  return (
    <>
      <p className="small muted">Found in {chapterLabel(getState().project!, chapterId)}. Add what's right. Skip anything that isn't.</p>
      {items.map((it, i) => (
        <div key={i} className={`opt${t.handled[i] ? ' done' : ''}`}>
          <div className="row" style={{ gap: 6 }}>
            <span className="pill neutral">{EXTRACT_LABEL[it.kind]}</span>
            <b>{it.title}</b>
          </div>
          <div className="small" style={{ margin: '4px 0' }}>{it.detail}</div>
          {t.handled[i] ? (
            <div className="tiny" style={{ color: 'var(--ok)' }}>✓ {t.handled[i]}</div>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <button className="btn primary small" onClick={() => add(it, i, 'canon')}>
                Add to story bible
              </button>
              {it.kind !== 'place' && (
                <button className="btn small" onClick={() => add(it, i, 'possibility')}>
                  Add as "maybe"
                </button>
              )}
              <button className="btn ghost small" onClick={() => markHandled(t.id, i, 'Skipped')}>
                Skip
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function SaveNote({ title, body }: { title: string; body: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn small"
      disabled={done}
      onClick={() => {
        addItem('notes', newNote({ title, body }));
        setDone(true);
        toast('Saved to your Notes.');
      }}
    >
      {done ? 'Saved to Notes' : 'Save to Notes'}
    </button>
  );
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast('Copied.'),
    () => toast('Couldn\'t copy. Select the text and copy it by hand.', 'error'),
  );
}

function ProseResult({ t, chapterId }: { t: Thread; chapterId: string }) {
  const p = useApp((s) => s.project)!;
  const page = useApp((s) => s.page);
  const prose = t.parsed?.prose ?? t.raw;
  return (
    <>
      <div className="prose-out">{prose}</div>
      <DraftCheck t={t} text={prose} />
      {t.parsed?.editorNote && <div className="note-box" style={{ marginTop: 8 }}>{t.parsed.editorNote}</div>}
      {t.applied ? (
        <div className="ok-box" style={{ marginTop: 8 }}>{t.applied}</div>
      ) : (
        <div className="row" style={{ marginTop: 10 }}>
          {page === 'write' && (
            <button
              className="btn primary small"
              onClick={() => {
                insertText(chapterId, prose, 'cursor', `Before adding "${t.label}"`);
                markApplied(t.id, 'Added to your chapter at the cursor.');
              }}
            >
              Insert at cursor
            </button>
          )}
          <button
            className="btn small"
            onClick={() => {
              insertText(chapterId, prose, 'end', `Before adding "${t.label}"`);
              markApplied(t.id, `Added to the end of ${chapterLabel(p, chapterId)}.`);
            }}
          >
            Add to end of chapter
          </button>
          <button className="btn small" onClick={() => retry(t.id)}>
            Show me another version
          </button>
          <button className="btn ghost small" onClick={() => copy(prose)}>
            Copy
          </button>
        </div>
      )}
    </>
  );
}

function RevisionResult({ t }: { t: Thread }) {
  const [view, setView] = useState<'changes' | 'clean' | 'original'>('changes');
  const original = t.input.selection?.text ?? '';
  const revised = t.parsed?.revision ?? t.raw;
  const parts = useMemo(() => diffWords(original, revised), [original, revised]);
  const sel = t.input.selection;

  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        {(['changes', 'clean', 'original'] as const).map((v) => (
          <button key={v} className={`chip${view === v ? ' on' : ''}`} style={{ minHeight: 30, padding: '2px 12px', fontSize: '0.84rem' }} onClick={() => setView(v)}>
            {v === 'changes' ? 'Show changes' : v === 'clean' ? 'Suggested version' : 'Your original'}
          </button>
        ))}
      </div>
      <div className="diff">
        {view === 'original'
          ? original
          : view === 'clean'
            ? revised
            : parts.map((x, i) => (x.type === 'same' ? <span key={i}>{x.text}</span> : x.type === 'add' ? <ins key={i}>{x.text}</ins> : <del key={i}>{x.text}</del>))}
      </div>
      <DraftCheck t={t} text={revised} />
      {t.parsed?.notes && (
        <div style={{ marginTop: 10 }}>
          <div className="small" style={{ fontWeight: 600 }}>What changed and why</div>
          <Markdown text={t.parsed.notes} />
        </div>
      )}
      {t.applied ? (
        <div className="ok-box" style={{ marginTop: 8 }}>
          {t.applied}
          {sel && t.applied.startsWith('Accepted') && (
            <button
              className="btn small"
              style={{ marginLeft: 10 }}
              onClick={() => {
                if (applyReplacement(sel.chapterId, sel.start, revised, original, 'Before undoing an edit')) markApplied(t.id, 'Undone. Your original is back.');
                else toast('Couldn\'t find the passage. You can restore it from History.', 'error');
              }}
            >
              Undo
            </button>
          )}
        </div>
      ) : (
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn primary small"
            disabled={!sel}
            onClick={() => {
              if (!sel) return;
              if (applyReplacement(sel.chapterId, sel.start, original, revised, `Before "${t.label}"`)) markApplied(t.id, 'Accepted. Your original was kept in History.');
              else toast('That passage has changed since you asked, so it wasn\'t replaced. Copy the suggestion instead.', 'error');
            }}
          >
            Accept
          </button>
          <button className="btn small" onClick={() => markApplied(t.id, 'Kept your original.')}>
            Keep mine
          </button>
          <button className="btn small" onClick={() => retry(t.id)}>
            Try again
          </button>
          <button className="btn ghost small" onClick={() => copy(revised)}>
            Copy
          </button>
        </div>
      )}
    </>
  );
}

const OPTION_LABELS: [string, string][] = [
  ['believes', 'What the reader currently believes'],
  ['why', 'Why it works'],
  ['hidden', 'Why the truth was hidden'],
  ['changes', 'What it changes'],
  ['clues', 'Clues it creates'],
  ['falseClues', 'False clues for the alternative'],
  ['when', 'When the reader learns it'],
  ['complications', 'Complications it opens up'],
  ['weaknesses', 'Possible weaknesses'],
];

function OptionsResult({ t }: { t: Thread }) {
  const parsed = t.parsed ?? {};
  const [answers, setAnswers] = useState<string[]>([]);
  const category = ACTIONS[t.input.actionId].category ?? 'plot';

  const save = (o: Option, i: number, status: CanonStatus) => {
    const detail = OPTION_LABELS.filter(([k]) => o[k]).map(([k, l]) => `${l}: ${o[k]}`).join('\n');
    addItem('ideas', newIdea(`${o.title ? `${o.title}: ` : ''}${o.idea}`, { status, category, source: 'ai', detail, linkId: t.input.characterId ?? '' }));
    const msg = status === 'canon' ? 'Added to your story as decided' : status === 'possibility' ? 'Saved as a possibility' : 'Set aside. It won\'t be suggested again';
    markHandled(t.id, i, msg);
    toast(`${msg}.`);
  };

  if (!parsed.options?.length && !parsed.questions?.length) return <Markdown text={t.raw} />;

  return (
    <>
      {parsed.questions && parsed.questions.length > 0 && (
        <div>
          <div className="small" style={{ marginBottom: 6 }}>
            A few questions first, so the ideas fit your story:
          </div>
          {parsed.questions.map((q, i) => (
            <label key={i} className="field" style={{ marginBottom: 10 }}>
              <span className="lab small">{q}</span>
              <input className="input" value={answers[i] ?? ''} onChange={(e) => setAnswers((a) => Object.assign([...a], { [i]: e.target.value }))} placeholder="Your answer (or leave blank)" />
            </label>
          ))}
          <button
            className="btn primary small"
            onClick={() =>
              void run({
                ...t.input,
                request: `${t.input.request ?? ''}\n\nMy answers to your questions:\n${parsed.questions!.map((q, i) => `- ${q} ${answers[i]?.trim() || '(not sure yet)'}`).join('\n')}\n\nNow give me the options.`,
              })
            }
          >
            Now show me ideas
          </button>
        </div>
      )}
      {parsed.options?.map((o, i) => (
        <div key={i} className={`opt${t.handled[i] ? ' done' : ''}`}>
          <div className="ot">{o.title || `Option ${i + 1}`}</div>
          <div style={{ margin: '4px 0' }}>{o.idea}</div>
          <details>
            <summary className="small" style={{ cursor: 'pointer', color: 'var(--brass)' }}>
              Why, what it changes, and weaknesses
            </summary>
            <dl>
              {OPTION_LABELS.filter(([k]) => o[k]).map(([k, l]) => (
                <div key={k}>
                  <dt>{l}</dt>
                  <dd>{o[k]}</dd>
                </div>
              ))}
            </dl>
          </details>
          {t.handled[i] ? (
            <div className="tiny" style={{ color: 'var(--ok)', marginTop: 6 }}>✓ {t.handled[i]}</div>
          ) : (
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <button className="btn primary small" onClick={() => save(o, i, 'canon')} title="This is now true in your story">
                Use this
              </button>
              <button className="btn small" onClick={() => save(o, i, 'possibility')}>
                Save as possibility
              </button>
              <button className="btn small" onClick={() => save(o, i, 'discarded')} title="Your editor will remember not to suggest this again">
                Not for me
              </button>
              <button className="btn ghost small" onClick={() => void followUp(t.id, `Tell me more about "${o.title || o.idea}". How would it play out in my story, and what would I need to set up?`)}>
                Ask me more
              </button>
            </div>
          )}
        </div>
      ))}
      {parsed.note && <div className="tiny muted">{parsed.note}</div>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={() => retry(t.id)}>
          Show me different ideas
        </button>
      </div>
    </>
  );
}

function FindingsResult({ t }: { t: Thread }) {
  const parsed = t.parsed ?? {};
  if (!parsed.findings && !parsed.summary) return <Markdown text={t.raw} />;
  const all = [parsed.summary, ...(parsed.findings ?? []).map((f) => `${f.title}\n${f.detail}${f.suggestion ? `\nOne option: ${f.suggestion}` : ''}`)].filter(Boolean).join('\n\n');
  return (
    <>
      {parsed.summary && <p style={{ fontSize: '0.95rem' }}>{parsed.summary}</p>}
      {parsed.findings?.map((f, i) => (
        <div key={i} className={`finding ${f.level?.startsWith('likely') ? 'likely' : f.level?.startsWith('worth') ? 'worth' : 'note'}`}>
          <div className="row" style={{ gap: 6 }}>
            <span className="ft">{f.title}</span>
            {f.level && f.level !== 'note' && <span className={`pill ${f.level.startsWith('likely') ? 'accent' : 'warn'}`}>{f.level}</span>}
          </div>
          <div className="fd">{f.detail}</div>
          {f.suggestion && <div className="fs">One option: {f.suggestion}</div>}
          <div className="row" style={{ marginTop: 4, gap: 4 }}>
            <button className="btn ghost small" onClick={() => void followUp(t.id, `About "${f.title}": can you say more, and give me a couple of different ways I could handle it?`)}>
              Ask me more
            </button>
            {!t.handled[i] ? (
              <button
                className="btn ghost small"
                onClick={() => {
                  addItem('notes', newNote({ title: f.title, body: `${f.detail}${f.suggestion ? `\n\nOne option: ${f.suggestion}` : ''}` }));
                  markHandled(t.id, i, 'saved');
                  toast('Saved to your Notes.');
                }}
              >
                Save to Notes
              </button>
            ) : (
              <span className="tiny" style={{ color: 'var(--ok)' }}>✓ Saved</span>
            )}
          </div>
        </div>
      ))}
      {parsed.questions && parsed.questions.length > 0 && (
        <div className="note-box" style={{ marginTop: 10 }}>
          <b>Questions for you</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {parsed.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <div className="tiny muted" style={{ marginTop: 6 }}>Answer below if you like.</div>
        </div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <SaveNote title={t.label} body={all} />
      </div>
    </>
  );
}

function TextResult({ t, chapterId }: { t: Thread; chapterId: string }) {
  const id = t.input.actionId;
  const [saved, setSaved] = useState('');
  return (
    <>
      <Markdown text={t.raw} />
      <div className="row" style={{ marginTop: 8 }}>
        {(id === 'scene' || id === 'chapterPlan') && (
          <button
            className="btn small primary"
            disabled={!!saved}
            onClick={() => {
              const ch = getState().project?.chapters.find((c) => c.id === chapterId);
              if (!ch) return;
              patchItem('chapters', chapterId, { outline: { ...ch.outline, plan: (ch.outline.plan ? ch.outline.plan + '\n\n' : '') + t.raw } });
              setSaved('Saved to this chapter\'s plan (Scenes & Outline).');
            }}
          >
            Save as chapter plan
          </button>
        )}
        {(id === 'develop' || id === 'developCharacter') && (
          <button
            className="btn small"
            disabled={!!saved}
            onClick={() => {
              addItem('ideas', newIdea(t.input.request?.trim() || t.label, { detail: t.raw, status: 'possibility', category: ACTIONS[id].category ?? 'plot', source: 'ai', linkId: t.input.characterId ?? '' }));
              setSaved('Saved as a possibility.');
            }}
          >
            Save as possibility
          </button>
        )}
        {!saved && <SaveNote title={t.input.request?.slice(0, 60) || t.label} body={t.raw} />}
        <button className="btn ghost small" onClick={() => copy(t.raw)}>
          Copy
        </button>
      </div>
      {saved && <div className="ok-box" style={{ marginTop: 8 }}>{saved}</div>}
    </>
  );
}
