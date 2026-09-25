// Shared building blocks: fields that save as you type, the canon status picker,
// glossary terms, confirmations, and a tiny, safe markdown renderer for AI answers.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CanonStatus, Project } from '../types';
import { GLOSSARY, STATUS_HELP, STATUS_LABEL } from '../story/reference';
import { dismissToast, useApp } from '../story/store';
import { getPref } from '../storage/db';
import { openEditor } from '../ai/session';
import type { ActionId, JobInput } from '../ai/actions';

// ---------- Icons (inline, no external dependency) ----------
const paths: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  write: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  story: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  characters: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  mystery: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  timeline: 'M12 3v18M6 7h6M12 12h6M6 17h6',
  scenes: 'M4 5h16v14H4zM4 10h16M9 5v14',
  ending: 'M5 21V4h11l-2 4 2 4H5',
  research: 'M4 19V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h12M8 7h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  focus: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  book: 'M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14',
  note: 'M5 4h14v12l-4 4H5zM15 20v-4h4',
  chevron: 'M9 6l6 6-6 6',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  upload: 'M12 20V8M6 14l6-6 6 6M4 4h16',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  panel: 'M4 4h16v16H4zM15 4v16',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name] ?? ''} />
    </svg>
  );
}

// ---------- Fields ----------

export function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = 'input',
  minRows = 2,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ overflow: 'hidden', minHeight: 0 }}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  value,
  onChange,
  long,
  placeholder,
  serif,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  long?: boolean;
  placeholder?: string;
  serif?: boolean;
}) {
  return (
    <label className="field">
      <span className="lab">{label}</span>
      {hint && <span className="hint">{hint}</span>}
      {long ? (
        <AutoTextarea className={`input${serif ? ' serif' : ''}`} value={value} onChange={onChange} placeholder={placeholder} />
      ) : (
        <input className={`input${serif ? ' serif' : ''}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function StatusPill({ status }: { status: CanonStatus }) {
  return (
    <span className={`pill ${status}`} title={STATUS_HELP[status]}>
      {status === 'canon' && <Icon name="check" size={12} />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StatusPicker({ value, onChange }: { value: CanonStatus; onChange: (s: CanonStatus) => void }) {
  return (
    <select
      className={`status-select pill ${value}`}
      value={value}
      onChange={(e) => onChange(e.target.value as CanonStatus)}
      title={STATUS_HELP[value]}
      aria-label="Status"
    >
      {(['canon', 'possibility', 'draft', 'discarded'] as CanonStatus[]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

/** A craft term with a plain-English explanation on hover (shown when first-time mode is on). */
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const on = getPref('firstTime', true);
  const def = GLOSSARY[k.toLowerCase()];
  if (!on || !def) return <>{children ?? k}</>;
  return (
    <span className="term" title={def} tabIndex={0}>
      {children ?? k}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function CharacterChips({ p, value, onChange }: { p: Project; value: string[]; onChange: (ids: string[]) => void }) {
  if (!p.characters.length) return <span className="muted small">Add characters first.</span>;
  return (
    <div className="chips">
      {p.characters.map((c) => {
        const on = value.includes(c.id);
        return (
          <button key={c.id} type="button" className={`chip${on ? ' on' : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function ChapterSelect({ p, value, onChange, none = 'Not placed yet' }: { p: Project; value: string; onChange: (id: string) => void; none?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{none}</option>
      {p.chapters.map((c, i) => (
        <option key={c.id} value={c.id}>
          Chapter {i + 1}: {c.title}
        </option>
      ))}
    </select>
  );
}

export function CharacterSelect({ p, value, onChange, none = 'Choose…' }: { p: Project; value: string; onChange: (id: string) => void; none?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{none}</option>
      {p.characters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/** A button that opens the editor panel with an action ready (and optionally runs it). */
export function AskButton({
  action,
  label,
  input,
  run,
  className = 'btn brass',
}: {
  action: ActionId;
  label: string;
  input?: Partial<JobInput>;
  run?: boolean;
  className?: string;
}) {
  return (
    <button className={className} onClick={() => openEditor({ actionId: action, ...input }, run)}>
      <Icon name="spark" size={17} />
      {label}
    </button>
  );
}

// ---------- Modal & confirm ----------

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal>
        {children}
      </div>
    </div>
  );
}

type ConfirmReq = {
  title: string;
  body: string;
  ok: string;
  danger?: boolean;
  /** When set, the dialog asks for text. */
  input?: { value: string; placeholder: string; long?: boolean };
  resolve: (v: boolean | string | null) => void;
};
let confirmSetter: ((r: ConfirmReq | null) => void) | null = null;

export function confirmDialog(title: string, body: string, ok = 'Yes', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmSetter) return resolve(window.confirm(`${title}\n\n${body}`));
    confirmSetter({ title, body, ok, danger, resolve: (v) => resolve(v === true) });
  });
}

/** Ask for a line (or paragraph) of text. Resolves null if cancelled. */
export function promptDialog(title: string, body = '', opts: { value?: string; placeholder?: string; ok?: string; long?: boolean } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!confirmSetter) return resolve(window.prompt(title, opts.value ?? ''));
    confirmSetter({
      title,
      body,
      ok: opts.ok ?? 'Save',
      input: { value: opts.value ?? '', placeholder: opts.placeholder ?? '', long: opts.long },
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const [text, setText] = useState('');
  useEffect(() => {
    confirmSetter = (r) => {
      setText(r?.input?.value ?? '');
      setReq(r);
    };
    return () => {
      confirmSetter = null;
    };
  }, []);
  if (!req) return null;
  const done = (v: boolean) => {
    req.resolve(req.input ? (v ? text : null) : v);
    setReq(null);
  };
  return (
    <Modal onClose={() => done(false)}>
      <h2>{req.title}</h2>
      {req.body && <p className="muted">{req.body}</p>}
      {req.input &&
        (req.input.long ? (
          <textarea className="input" autoFocus rows={4} value={text} placeholder={req.input.placeholder} onChange={(e) => setText(e.target.value)} style={{ marginTop: 10 }} />
        ) : (
          <input className="input" autoFocus value={text} placeholder={req.input.placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && done(true)} style={{ marginTop: 10 }} />
        ))}
      <div className="row end" style={{ marginTop: 20 }}>
        <button className="btn" onClick={() => done(false)} autoFocus={!req.input}>
          Cancel
        </button>
        <button className={`btn ${req.danger ? 'danger' : 'primary'}`} onClick={() => done(true)} disabled={!!req.input && !text.trim()}>
          {req.ok}
        </button>
      </div>
    </Modal>
  );
}

/** A small dropdown menu for less-used actions. */
export function Menu({ label, items }: { label: ReactNode; items: { label: string; onClick: () => void; hint?: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`btn ghost small${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {label}
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              title={it.hint}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
              {it.hint && <span className="tiny muted">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === 'error' ? 'error' : ''}`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action?.();
                dismissToast(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Minimal markdown (headings, bullets, bold, italics). Renders as React nodes, never raw HTML. ----------

function inline(s: string): ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : /^[*_].+[*_]$/.test(p) ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>,
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`}>{list}</ul>);
    list = [];
  };
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t) return flush();
    const h = t.match(/^#{1,4}\s+(.*)/);
    const b = t.match(/^(?:[-*•]|\d+[.)])\s+(.*)/);
    if (h) {
      flush();
      out.push(<h4 key={i}>{inline(h[1].replace(/\*\*/g, ''))}</h4>);
    } else if (b) list.push(<li key={i}>{inline(b[1])}</li>);
    else if (/^\*\*[^*]+\*\*:?$/.test(t)) {
      flush();
      out.push(<h4 key={i}>{t.replace(/\*\*|:$/g, '')}</h4>);
    } else {
      flush();
      out.push(<p key={i}>{inline(t)}</p>);
    }
  });
  flush();
  return <div className="md">{out}</div>;
}

/** "Watch the video tour": a narrated walkthrough of the whole studio. */
export function TourButton({ className = 'btn', label = 'Watch the video tour (7 min)' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        ▶ {label}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} wide>
          <div className="row" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>A tour of your studio</h2>
            <span className="spacer" />
            <button className="btn ghost small" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <video poster="./tour/poster.jpg" controls autoPlay preload="metadata" style={{ width: '100%', borderRadius: 10, background: '#000' }}>
            <source src="./tour/nightjar-tour.webm" type="video/webm" />
            <source src="./tour/nightjar-tour.mp4" type="video/mp4" />
            <track kind="captions" src="./tour/nightjar-tour.vtt" srcLang="en" label="English" default />
          </video>
          <p className="small muted" style={{ marginTop: 8 }}>
            Tip: click the square in the bottom-right corner of the video for full screen. You can pause at any time and try each step yourself.
          </p>
        </Modal>
      )}
    </>
  );
}
