// The writing room: chapter list, a quiet manuscript page, and gentle tools.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, ChapterStatus, Project } from '../types';
import { addItem, getState, moveItem, patchItem, removeItem, setState, updateProject, useApp, useProject } from '../story/store';
import { newChapter, uid } from '../story/factory';
import { chapterNumber, characterName, countWords, manuscriptWords, readingTime, saveChapterVersion, timeAgo, escapeRe, todayWords } from '../story/reference';
import { registerEditor, setPendingJump, takePendingJump } from '../editor/bridge';
import { maybeSummarize, openEditor, runQuiet } from '../ai/session';
import { useSpeech } from '../editor/speech';
import { checkProse } from '../editor/proseCheck';
import { diffWords } from '../editor/diff';
import { AIError, getAISettings } from '../ai/provider';
import { Icon, Menu, Modal, confirmDialog, promptDialog, Term } from '../components/ui';
import { toast } from '../story/store';

const STATUSES: ChapterStatus[] = ['Idea', 'Outlined', 'Drafting', 'Revising', 'Done'];

export function Write() {
  const p = useProject();
  const focus = useApp((s) => s.focusMode);
  const [reading, setReading] = useState(false);
  const ch = p.chapters.find((c) => c.id === p.currentChapterId) ?? p.chapters[0];

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && getState().focusMode) setState({ focusMode: false });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  if (reading) return <Reader p={p} onClose={() => setReading(false)} />;

  return (
    <div className={`write${focus ? ' nochapters focus' : ''}`}>
      {!focus && <ChapterList p={p} current={ch.id} />}
      <ChapterEditor key={ch.id} p={p} ch={ch} onRead={() => setReading(true)} />
      {focus && (
        <button className="btn small" style={{ position: 'fixed', top: 14, right: 14, zIndex: 20 }} onClick={() => setState({ focusMode: false })}>
          Exit focus (Esc)
        </button>
      )}
    </div>
  );
}

function ChapterList({ p, current }: { p: Project; current: string }) {
  const add = () => {
    const c = newChapter(`Chapter ${p.chapters.length + 1}`);
    addItem('chapters', c);
    updateProject({ currentChapterId: c.id });
  };
  return (
    <div className="chapters">
      <h4>Chapters</h4>
      {p.chapters.map((c, i) => {
        const scenes = p.scenes.filter((s) => s.chapterId === c.id).sort((a, b) => a.order - b.order);
        const active = c.id === current;
        return (
          <div key={c.id}>
            <button className={`ch-item${active ? ' active' : ''}`} onClick={() => updateProject({ currentChapterId: c.id })}>
              <div className="n">CHAPTER {i + 1}</div>
              <div className="tt">{c.title || 'Untitled'}</div>
              <div className="st">
                {c.status} · {countWords(c.text).toLocaleString()} words
              </div>
            </button>
            {active && scenes.length > 0 && (
              <div className="ch-scenes">
                {scenes.map((s) => (
                  <div key={s.id} title={s.purpose}>
                    {s.title}
                  </div>
                ))}
              </div>
            )}
            {active && (
              <div className="row" style={{ gap: 2, margin: '0 0 8px 8px' }}>
                <button className="btn ghost small" title="Move chapter up" disabled={i === 0} onClick={() => moveItem('chapters', c.id, -1)}>
                  <Icon name="up" size={15} />
                </button>
                <button className="btn ghost small" title="Move chapter down" disabled={i === p.chapters.length - 1} onClick={() => moveItem('chapters', c.id, 1)}>
                  <Icon name="down" size={15} />
                </button>
                <button
                  className="btn ghost small"
                  title="Delete chapter"
                  disabled={p.chapters.length === 1}
                  onClick={async () => {
                    const words = countWords(c.text);
                    if (words > 0 && !(await confirmDialog(`Delete “${c.title}”?`, `It has ${words.toLocaleString()} words. You'll be able to undo this for a few seconds.`, 'Delete chapter', true))) return;
                    const next = p.chapters[i + 1] ?? p.chapters[i - 1];
                    updateProject({ currentChapterId: next.id });
                    removeItem('chapters', c.id, 'Chapter deleted.');
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button className="btn small" style={{ margin: '10px 8px', width: 'calc(100% - 16px)' }} onClick={add}>
        <Icon name="plus" size={16} /> New chapter
      </button>
    </div>
  );
}

/** Pixel offset of a character index inside a textarea (via an invisible mirror), for scrolling to search results. */
function caretTop(el: HTMLTextAreaElement, index: number): number {
  const m = document.createElement('div');
  const cs = getComputedStyle(el);
  for (const k of ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'padding', 'border', 'width', 'boxSizing'] as const) m.style[k] = cs[k];
  m.style.whiteSpace = 'pre-wrap';
  m.style.wordWrap = 'break-word';
  m.style.position = 'absolute';
  m.style.visibility = 'hidden';
  m.textContent = el.value.slice(0, index);
  document.body.appendChild(m);
  const h = m.offsetHeight;
  m.remove();
  return h;
}

function ChapterEditor({ p, ch, onRead }: { p: Project; ch: Chapter; onRead: () => void }) {
  const [text, setText] = useState(ch.text);
  const committed = useRef(ch.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const [selBar, setSelBar] = useState<{ x: number; y: number } | null>(null);
  const [modal, setModal] = useState<'' | 'history' | 'notes' | 'check'>('');
  const [find, setFind] = useState(false);
  const saveState = useApp((s) => s.saveState);
  const lastSavedAt = useApp((s) => s.lastSavedAt);
  const saveError = useApp((s) => s.saveError);
  const focus = useApp((s) => s.focusMode);
  const [, tick] = useState(0);

  const commit = useCallback(
    (value: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (value === committed.current) return;
      committed.current = value;
      patchItem('chapters', ch.id, { text: value });
    },
    [ch.id],
  );

  // Pick up changes made elsewhere (restoring a version, AI text added to the end, find & replace).
  useEffect(() => {
    if (ch.text !== committed.current) {
      committed.current = ch.text;
      setText(ch.text);
    }
  }, [ch.text]);

  useEffect(
    () => () => {
      commit(ta.current?.value ?? committed.current);
      // Quietly refresh this chapter's summary for the editor's memory (cheap model; only if it changed a lot).
      void maybeSummarize(ch.id);
    },
    [commit, ch.id],
  );

  // Arriving from a whole-book search result: jump to it.
  useEffect(() => {
    const j = takePendingJump(ch.id);
    if (j) setTimeout(() => select(j.start, j.end), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch.id]);

  // Keep an automatic version when a chapter is opened, so any session can be rolled back.
  useEffect(() => {
    const last = ch.versions[0];
    if (!last || Date.now() - last.at > 2 * 3600e3) saveChapterVersion(ch.id, 'Automatic copy when opened');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch.id]);

  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 20000);
    return () => clearInterval(i);
  }, []);

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    const y = window.scrollY;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 40}px`;
    window.scrollTo(0, y);
  }, [text, focus]);

  const onChange = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), 400);
  };

  const insertAt = (start: number, end: number, value: string) => {
    const el = ta.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    // execCommand keeps the browser's own Undo (Ctrl+Z) working after AI edits.
    const ok = document.execCommand?.('insertText', false, value);
    if (!ok || el.value === text) {
      const next = el.value.slice(0, start) + value + el.value.slice(end);
      setText(next);
      commit(next);
    } else commit(el.value);
  };

  const select = (start: number, end: number) => {
    const el = ta.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    const top = el.getBoundingClientRect().top + window.scrollY + caretTop(el, start);
    window.scrollTo({ top: top - window.innerHeight / 3, behavior: 'smooth' });
  };

  useEffect(() => {
    registerEditor({
      chapterId: ch.id,
      getSelection: () => {
        const el = ta.current;
        const s = el?.selectionStart ?? 0;
        const e = el?.selectionEnd ?? 0;
        return { chapterId: ch.id, start: s, end: e, text: (el?.value ?? '').slice(s, e) };
      },
      replaceRange: insertAt,
      focus: () => ta.current?.focus(),
      select,
      flush: () => ta.current && commit(ta.current.value),
    });
    return () => registerEditor(null);
  });

  const speech = useSpeech((phrase) => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionEnd;
    const before = el.value.slice(0, s);
    const pad = before && !/\s$/.test(before) && !/^[.,!?]/.test(phrase) ? ' ' : '';
    insertAt(s, s, pad + phrase);
  });

  const toggleItalic = () => {
    const el = ta.current;
    if (!el || el.selectionEnd === el.selectionStart) return toast('Select the words you want in italics first.');
    const a = el.selectionStart;
    const b = el.selectionEnd;
    const sel = el.value.slice(a, b);
    if (/^\*[^*]+\*$/.test(sel)) insertAt(a, b, sel.slice(1, -1));
    else insertAt(a, b, `*${sel.replace(/\*/g, '')}*`);
  };
  const sceneBreak = () => {
    const el = ta.current;
    if (!el) return;
    const at = el.selectionEnd;
    insertAt(at, at, `${at > 0 && !el.value.slice(0, at).endsWith('\n\n') ? '\n\n' : ''}*\n\n`);
  };
  const saveVersionNow = async () => {
    const label = await promptDialog('Save a version', 'A copy of this chapter as it is right now. You can compare or restore it from History.', { value: 'Saved by hand' });
    if (label === null) return;
    commit(text);
    const cur = getState().project?.chapters.find((c) => c.id === ch.id);
    if (!cur) return;
    patchItem('chapters', ch.id, { versions: [{ id: uid(), at: Date.now(), label: label.trim() || 'Saved by hand', text }, ...cur.versions].slice(0, 40) });
    toast('Version saved.');
  };
  const today = todayWords(p);

  const chWords = countWords(text);
  const allWords = manuscriptWords(p) - countWords(ch.text) + chWords;
  const no = chapterNumber(p, ch.id);
  const selection = () => {
    const el = ta.current!;
    return { chapterId: ch.id, start: el.selectionStart, end: el.selectionEnd, text: el.value.slice(el.selectionStart, el.selectionEnd) };
  };

  const onMouseUp = (e: React.MouseEvent) => {
    const el = ta.current;
    if (!el) return;
    setTimeout(() => {
      if (el.selectionEnd - el.selectionStart > 3) setSelBar({ x: Math.min(e.clientX, window.innerWidth - 520), y: Math.max(70, e.clientY - 56) });
      else setSelBar(null);
    }, 0);
  };

  const summaryStale = ch.summary && Math.abs(countWords(ch.text) - ch.summaryWordCount) > 150;
  const [summarizing, setSummarizing] = useState(false);
  const summarize = async () => {
    if (!getAISettings().apiKey) return toast('Connect your AI editor in Settings first.', 'error');
    setSummarizing(true);
    try {
      commit(text);
      const summary = await runQuiet({ actionId: 'summarize', chapterId: ch.id });
      patchItem('chapters', ch.id, { summary, summaryWordCount: countWords(text) });
      toast('Chapter summary updated. You can read and edit it in Scenes & Outline.');
    } catch (e) {
      toast(e instanceof AIError ? e.message : 'Couldn\'t update the summary.', 'error');
    }
    setSummarizing(false);
  };

  return (
    <div className="editor-wrap">
      {!focus && (
        <div className="editor-bar">
          <select className="status-select" value={ch.status} onChange={(e) => patchItem('chapters', ch.id, { status: e.target.value as ChapterStatus })} title="Chapter status">
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className="status-select" value={ch.povCharacterId} onChange={(e) => patchItem('chapters', ch.id, { povCharacterId: e.target.value })} title="Point of view: whose eyes the reader looks through">
            <option value="">POV: not set</option>
            {p.characters.map((c) => (
              <option key={c.id} value={c.id}>
                POV: {c.name}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <button className="btn ghost small" title="Undo (Ctrl+Z)" aria-label="Undo" onClick={() => (ta.current?.focus(), document.execCommand('undo'))}>
            <Icon name="undo" size={17} />
          </button>
          <button className="btn ghost small" title="Redo (Ctrl+Y)" aria-label="Redo" onClick={() => (ta.current?.focus(), document.execCommand('redo'))}>
            <Icon name="redo" size={17} />
          </button>
          <button className={`btn ghost small${find ? ' on' : ''}`} onClick={() => setFind(!find)} title="Find and replace">
            <Icon name="search" size={16} /> Find
          </button>
          <button className={`btn ghost small${speech.listening ? ' on' : ''}`} onClick={speech.toggle} title='Dictate. Say "full stop", "comma" or "new paragraph" for punctuation.'>
            <Icon name="mic" size={16} /> {speech.listening ? 'Stop' : 'Talk'}
          </button>
          <button className="btn ghost small" onClick={() => setModal('history')} title="Earlier versions of this chapter">
            <Icon name="history" size={16} /> History
          </button>
          <button className="btn ghost small" onClick={() => setState({ focusMode: true })} title="Hide everything except your page">
            <Icon name="focus" size={16} /> Focus
          </button>
          <Menu
            label={<>More ▾</>}
            items={[
              { label: 'Check my prose', hint: 'Free, instant, private', onClick: () => setModal('check') },
              { label: `Notes on this chapter${ch.comments.length ? ` (${ch.comments.length})` : ''}`, onClick: () => setModal('notes') },
              { label: 'Read the whole book', onClick: onRead },
              { label: 'Italic', hint: 'Select words first · Ctrl+I', onClick: toggleItalic },
              { label: 'Insert a scene break', hint: 'A centred * between scenes', onClick: sceneBreak },
              { label: 'Update my story bible from this chapter', hint: 'Your editor lists new facts, clues and events', onClick: () => openEditor({ actionId: 'extract', chapterId: ch.id }, true) },
              { label: 'Save a version now', onClick: saveVersionNow },
            ]}
          />
        </div>
      )}
      {find && <FindBar p={p} chapterId={ch.id} text={text} onSelect={select} onReplaceAll={(v) => (saveChapterVersion(ch.id, 'Before replace all'), setText(v), commit(v))} onReplaceOne={insertAt} onClose={() => setFind(false)} />}
      {speech.listening && (
        <div className="findbar">
          <span className="pill accent">Listening…</span>
          <span className="small muted">{speech.interim || 'Speak naturally. Say "full stop", "comma" or "new paragraph".'}</span>
        </div>
      )}
      {speech.error && <div className="findbar" style={{ color: 'var(--danger)' }}>{speech.error}</div>}

      <div className="editor-scroll" onClick={() => setSelBar(null)}>
        <div className={`sheet${focus ? ' plain' : ''}`}>
          <div className="ch-no">Chapter {no}</div>
          <input className="ch-title" value={ch.title} onChange={(e) => patchItem('chapters', ch.id, { title: e.target.value })} placeholder="Chapter title" aria-label="Chapter title" />
          <textarea
            ref={ta}
            className="manuscript"
            value={text}
            spellCheck
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onMouseUp={onMouseUp}
            onClick={(e) => e.stopPropagation()}
            onKeyUp={(e) => {
              const el = ta.current;
              if (!el) return;
              if (el.selectionEnd === el.selectionStart) setSelBar(null);
              else if (e.shiftKey && el.selectionEnd - el.selectionStart > 3) {
                const r = el.getBoundingClientRect();
                setSelBar({ x: Math.max(r.left, 80), y: 64 });
              }
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                toggleItalic();
              }
            }}
            placeholder={'Begin here. Write it rough. You can polish it later.\n\nIf you\'re not sure how to start, open your editor on the right and choose "Scene" or "Write".'}
            aria-label="Chapter text"
          />
        </div>
      </div>

      {selBar && (
        <div className="selbar" style={{ left: selBar.x, top: selBar.y }} onMouseDown={(e) => e.preventDefault()}>
          {[
            ['Improve', () => openEditor({ actionId: 'improve', selection: selection(), variant: 'polish' })],
            ['Make darker', () => openEditor({ actionId: 'improve', selection: selection(), variant: 'darker' }, true)],
            ['More suspense', () => openEditor({ actionId: 'improve', selection: selection(), variant: 'suspense' }, true)],
            ['Subtler', () => openEditor({ actionId: 'improve', selection: selection(), variant: 'subtler' }, true)],
            ['Editor\'s review', () => openEditor({ actionId: 'proseReview', selection: selection() }, true)],
            ['Ask about this', () => openEditor({ actionId: 'ask', selection: selection() })],
            ['Italic', toggleItalic],
            [
              'Add note',
              async () => {
                const s = selection();
                const note = await promptDialog('Add a note', `About: “${s.text.slice(0, 120)}${s.text.length > 120 ? '…' : ''}”`, { placeholder: 'Your note…', long: true, ok: 'Add note' });
                const cur = getState().project?.chapters.find((c) => c.id === ch.id);
                if (note?.trim() && cur) patchItem('chapters', ch.id, { comments: [...cur.comments, { id: uid(), at: Date.now(), quote: s.text.slice(0, 300), note: note.trim() }] });
              },
            ],
          ].map(([label, fn]) => (
            <button
              key={label as string}
              onClick={() => {
                (fn as () => void)();
                setSelBar(null);
              }}
            >
              {label as string}
            </button>
          ))}
        </div>
      )}

      <div className="editor-foot">
        <span>
          <b style={{ color: 'var(--ink)' }}>{chWords.toLocaleString()}</b> words in this chapter
        </span>
        <span>{allWords.toLocaleString()} in the book</span>
        <span>{readingTime(chWords)}</span>
        {today > 0 && <span className="today" title="Words added to your book today">Today: +{today.toLocaleString()}</span>}
        {ch.povCharacterId && (
          <span>
            <Term k="pov">POV</Term>: {characterName(p, ch.povCharacterId)}
          </span>
        )}
        <span>
          {summarizing ? (
            'Updating summary…'
          ) : (
            <button className="btn ghost small" onClick={summarize} title="A short summary your editor uses to remember this chapter without rereading all of it">
              {!ch.summary ? 'Add summary for your editor' : summaryStale ? 'Summary out of date: update' : 'Summary up to date'}
            </button>
          )}
        </span>
        <span className="spacer" />
        {saveState === 'error' ? (
          <span className="save-err" title={saveError}>
            Couldn't save to this computer. Retrying… (your text is still here)
          </span>
        ) : saveState === 'saving' || text !== committed.current ? (
          <span>Saving…</span>
        ) : (
          <span className="save-ok">✓ Saved {lastSavedAt ? timeAgo(lastSavedAt) : ''}</span>
        )}
      </div>

      {modal === 'history' && <HistoryModal ch={ch} current={text} onClose={() => setModal('')} />}
      {modal === 'notes' && <NotesModal ch={ch} text={text} onJump={select} onClose={() => setModal('')} />}
      {modal === 'check' && (
        <CheckModal
          text={ta.current && ta.current.selectionEnd - ta.current.selectionStart > 200 ? ta.current.value.slice(ta.current.selectionStart, ta.current.selectionEnd) : text}
          offset={ta.current && ta.current.selectionEnd - ta.current.selectionStart > 200 ? ta.current.selectionStart : 0}
          onJump={(s, e) => {
            setModal('');
            setTimeout(() => select(s, e), 50);
          }}
          onClose={() => setModal('')}
        />
      )}
    </div>
  );
}

function FindBar({
  p,
  chapterId,
  text,
  onSelect,
  onReplaceAll,
  onReplaceOne,
  onClose,
}: {
  p: Project;
  chapterId: string;
  text: string;
  onSelect: (s: number, e: number) => void;
  onReplaceAll: (v: string) => void;
  onReplaceOne: (s: number, e: number, v: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [r, setR] = useState('');
  const [idx, setIdx] = useState(-1);
  const [all, setAll] = useState(false);
  const everywhere = useMemo(() => {
    if (!all || q.length < 2) return [];
    const re = new RegExp(escapeRe(q), 'gi');
    const out: { chId: string; label: string; index: number; snip: string }[] = [];
    p.chapters.forEach((c, i) => {
      const src = c.id === chapterId ? text : c.text;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) && out.length < 200)
        out.push({ chId: c.id, label: `Ch. ${i + 1}`, index: m.index, snip: src.slice(Math.max(0, m.index - 50), m.index + q.length + 50).replace(/\s+/g, ' ') });
    });
    return out;
  }, [all, q, p.chapters, chapterId, text]);
  const matches = useMemo(() => {
    if (!q) return [] as number[];
    const re = new RegExp(escapeRe(q), 'gi');
    const out: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && out.length < 5000) out.push(m.index);
    return out;
  }, [q, text]);
  const next = () => {
    if (!matches.length) return;
    const i = (idx + 1) % matches.length;
    setIdx(i);
    onSelect(matches[i], matches[i] + q.length);
  };
  return (
    <div className="findbar">
      <input className="input" autoFocus placeholder="Find…" value={q} onChange={(e) => (setQ(e.target.value), setIdx(-1))} onKeyDown={(e) => e.key === 'Enter' && next()} />
      <span className="small muted" style={{ minWidth: 70 }}>
        {q ? `${matches.length} found` : ''}
      </span>
      <button className="btn small" onClick={next} disabled={!matches.length}>
        Next
      </button>
      <input className="input" placeholder="Replace with…" value={r} onChange={(e) => setR(e.target.value)} />
      <button
        className="btn small"
        disabled={idx < 0 || !matches.length}
        onClick={() => {
          onReplaceOne(matches[idx], matches[idx] + q.length, r);
          setIdx(idx - 1);
        }}
      >
        Replace
      </button>
      <button
        className="btn small"
        disabled={!matches.length}
        onClick={async () => {
          if (await confirmDialog(`Replace all ${matches.length}?`, `Every “${q}” in this chapter becomes “${r}”. An earlier version is kept in History.`, 'Replace all'))
            onReplaceAll(text.replace(new RegExp(escapeRe(q), 'gi'), r));
        }}
      >
        Replace all
      </button>
      <label className="row small" style={{ cursor: 'pointer', gap: 6 }}>
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Whole book
      </label>
      <span className="spacer" />
      <button className="btn ghost small" onClick={onClose}>
        Close
      </button>
      {all && q.length >= 2 && (
        <div style={{ flexBasis: '100%', maxHeight: 240, overflowY: 'auto', background: 'var(--paper)', borderRadius: 8, padding: 6 }}>
          {everywhere.length === 0 && <div className="small muted" style={{ padding: 6 }}>Not found anywhere in the book.</div>}
          {everywhere.map((r, i) => (
            <button
              key={i}
              className="ch-item"
              onClick={() => {
                if (r.chId === chapterId) onSelect(r.index, r.index + q.length);
                else {
                  setPendingJump({ chapterId: r.chId, start: r.index, end: r.index + q.length });
                  updateProject({ currentChapterId: r.chId });
                }
              }}
            >
              <span className="pill neutral" style={{ marginRight: 8 }}>{r.label}</span>
              <span className="small">…{r.snip}…</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryModal({ ch, current, onClose }: { ch: Chapter; current: string; onClose: () => void }) {
  const [sel, setSel] = useState(ch.versions[0]?.id ?? '');
  const [compare, setCompare] = useState(true);
  const v = ch.versions.find((x) => x.id === sel);
  const parts = useMemo(() => (v && compare ? diffWords(v.text, current) : []), [v, compare, current]);
  return (
    <Modal onClose={onClose} wide>
      <div className="row">
        <h2>History: {ch.title}</h2>
        <span className="spacer" />
        <button
          className="btn small"
          onClick={async () => {
            const label = await promptDialog('Save a version', 'Give it a name if you like.', { value: 'Saved by hand' });
            if (label === null) return;
            patchItem('chapters', ch.id, { text: current });
            const versions = [{ id: uid(), at: Date.now(), label: label.trim() || 'Saved by hand', text: current }, ...ch.versions].slice(0, 40);
            patchItem('chapters', ch.id, { versions });
            toast('Version saved.');
          }}
        >
          Save a version now
        </button>
        <button className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted small">Earlier versions are kept automatically: when you open a chapter, and before any AI change or big replacement.</p>
      {!ch.versions.length ? (
        <p>No earlier versions yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 18 }}>
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            {ch.versions.map((x) => (
              <button key={x.id} className={`ch-item${x.id === sel ? ' active' : ''}`} onClick={() => setSel(x.id)}>
                <div className="small">{x.label}</div>
                <div className="tiny muted">
                  {new Date(x.at).toLocaleString()} · {countWords(x.text).toLocaleString()} words
                </div>
              </button>
            ))}
          </div>
          <div>
            <div className="row" style={{ marginBottom: 8 }}>
              <button className={`chip${compare ? ' on' : ''}`} onClick={() => setCompare(true)}>
                Compare with now
              </button>
              <button className={`chip${!compare ? ' on' : ''}`} onClick={() => setCompare(false)}>
                Show this version
              </button>
              <span className="spacer" />
              <button
                className="btn primary small"
                disabled={!v}
                onClick={async () => {
                  if (!v) return;
                  if (!(await confirmDialog('Restore this version?', 'Your current text will be kept in History too, so you can switch back.', 'Restore'))) return;
                  saveChapterVersion(ch.id, 'Before restoring an older version');
                  patchItem('chapters', ch.id, { text: v.text });
                  toast('Restored.');
                  onClose();
                }}
              >
                Restore this version
              </button>
            </div>
            <div className="diff" style={{ maxHeight: '55vh' }}>
              {compare ? parts.map((x, i) => (x.type === 'same' ? <span key={i}>{x.text}</span> : x.type === 'add' ? <ins key={i}>{x.text}</ins> : <del key={i}>{x.text}</del>)) : v?.text}
            </div>
            {compare && <div className="tiny muted" style={{ marginTop: 6 }}>Green: added since this version. Red: removed since.</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function NotesModal({ ch, text, onJump, onClose }: { ch: Chapter; text: string; onJump: (s: number, e: number) => void; onClose: () => void }) {
  const [draft, setDraft] = useState('');
  return (
    <Modal onClose={onClose}>
      <h2>Notes on this chapter</h2>
      <p className="muted small">Tip: select words in your chapter and choose "Add note" to pin a note to them.</p>
      {ch.comments.map((c) => {
        const at = c.quote ? text.indexOf(c.quote) : -1;
        return (
          <div key={c.id} className="list-row">
            <div style={{ flex: 1 }}>
              {c.quote && (
                <button className="checklist ex" style={{ all: 'unset', cursor: at >= 0 ? 'pointer' : 'default', fontFamily: 'var(--serif)', color: 'var(--muted)', display: 'block' }} onClick={() => at >= 0 && (onClose(), setTimeout(() => onJump(at, at + c.quote.length), 50))}>
                  “{c.quote.slice(0, 140)}{c.quote.length > 140 ? '…' : ''}” {at < 0 && <span className="tiny">(text has changed)</span>}
                </button>
              )}
              <div>{c.note}</div>
              <div className="tiny muted">{timeAgo(c.at)}</div>
            </div>
            <button className="btn ghost small" onClick={() => patchItem('chapters', ch.id, { comments: ch.comments.filter((x) => x.id !== c.id) })}>
              Remove
            </button>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 12 }}>
        <input className="input" style={{ flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="A general note about this chapter…" />
        <button
          className="btn primary"
          disabled={!draft.trim()}
          onClick={() => {
            patchItem('chapters', ch.id, { comments: [...ch.comments, { id: uid(), at: Date.now(), quote: '', note: draft.trim() }] });
            setDraft('');
          }}
        >
          Add
        </button>
      </div>
    </Modal>
  );
}

function CheckModal({ text, offset, onJump, onClose }: { text: string; offset: number; onJump: (s: number, e: number) => void; onClose: () => void }) {
  const r = useMemo(() => checkProse(text), [text]);
  return (
    <Modal onClose={onClose} wide>
      <div className="row">
        <h2>Prose check</h2>
        <span className="pill ok-box" style={{ padding: '2px 10px' }}>Free · instant · private</span>
        <span className="spacer" />
        <button className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted small">
        {offset ? 'Checking your selected passage. ' : 'Checking the whole chapter. '}
        These are habits that make prose feel generic or machine-made. They're hints for your judgement, not rules or a score. Every good writer breaks some of them on purpose. Click an example to jump to it.
      </p>
      <p className="small">
        {r.stats.words.toLocaleString()} words · {r.stats.sentences} sentences · average sentence {r.stats.avgSentence} words · rhythm: <b>{r.stats.variety}</b>
      </p>
      {r.flags.length === 0 ? (
        <div className="ok-box">Nothing stood out. For a deeper read, try "Editor's review" in your editor panel.</div>
      ) : (
        <div className="checklist">
          {r.flags.map((f, i) => (
            <div key={i} className="flag">
              <b>{f.title}</b>
              <div className="small muted">{f.explain}</div>
              {f.examples.map((e, j) => (
                <button key={j} className="ex" onClick={() => onJump(offset + e.index, offset + e.index + 1)}>
                  {e.text}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <span className="spacer" />
        <button
          className="btn brass"
          onClick={() => {
            onClose();
            openEditor({ actionId: 'proseReview', chapterId: getState().project?.currentChapterId }, true);
          }}
        >
          <Icon name="spark" size={16} /> Get a full editor's review (uses AI)
        </button>
      </div>
    </Modal>
  );
}

function Reader({ p, onClose }: { p: Project; onClose: () => void }) {
  return (
    <div>
      <div className="editor-bar">
        <b className="serif" style={{ fontSize: '1.2rem' }}>{p.title}</b>
        <span className="muted small">{manuscriptWords(p).toLocaleString()} words · {readingTime(manuscriptWords(p))}</span>
        <span className="spacer" />
        <button className="btn ghost small" onClick={() => window.print()}>
          Print
        </button>
        <button className="btn primary small" onClick={onClose}>
          Back to writing
        </button>
      </div>
      <div className="editor-scroll">
        <div className="sheet reader">
          <h3 style={{ marginTop: 40 }}>{p.title}</h3>
          {p.author && <p className="first" style={{ textAlign: 'center' }}>{p.author}</p>}
          {p.chapters.map((c, i) => (
            <section key={c.id}>
              <h2>Chapter {i + 1}</h2>
              <h3>
                <button
                  style={{ all: 'unset', cursor: 'pointer' }}
                  title="Edit this chapter"
                  onClick={() => {
                    updateProject({ currentChapterId: c.id });
                    onClose();
                  }}
                >
                  {c.title}
                </button>
              </h3>
              {c.text
                .split(/\n\s*\n|\n/)
                .map((x) => x.trim())
                .filter(Boolean)
                .map((para, k) =>
                  /^(\*|#|\*\s?\*\s?\*)$/.test(para) ? (
                    <p key={k} className="sep">*</p>
                  ) : (
                    <p key={k} className={k === 0 ? 'first' : ''}>
                      {italicize(para)}
                    </p>
                  ),
                )}
              {!c.text.trim() && <p className="first muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Not written yet.</p>}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Render *asterisk* italics as real italics. */
function italicize(t: string) {
  return t.split(/(\*[^*\n]+\*)/g).map((part, i) => (/^\*[^*]+\*$/.test(part) ? <em key={i}>{part.slice(1, -1)}</em> : part));
}
