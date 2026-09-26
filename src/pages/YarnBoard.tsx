// The yarn board: a cork board of characters, clues, secrets, events and places,
// tied together with red string. She can pin and tie things herself, or let
// "Pin it all up for me" lay it out from her story bible.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Board, Pin, PinKind, Yarn } from '../types';
import { go, updateProject, useProject, type Page } from '../story/store';
import { uid } from '../story/factory';
import { BOARD_H, BOARD_W, autoLayout, boardItems, impliedStrings, type BoardItem } from '../story/board';
import { AskButton, Icon, confirmDialog, promptDialog } from '../components/ui';

const CARD_W: Record<PinKind, number> = { character: 150, clue: 190, secret: 180, event: 180, place: 160, note: 170 };
const KIND_PAGE: Record<PinKind, Page> = { character: 'characters', clue: 'mystery', secret: 'mystery', event: 'timeline', place: 'research', note: 'mystery' };
const KIND_LABEL: Record<PinKind, string> = { character: 'Characters', clue: 'Clues', secret: 'Secrets', event: 'Events', place: 'Places', note: 'Notes' };

const pinPoint = (p: Pin) => ({ x: p.x + CARD_W[p.kind] / 2, y: p.y + 8 });
/** Automatic labels too generic to show all the time (they appear when the string is clicked). */
const QUIET = new Set(['was there', 'here', 'knows about it', 'hidden from']);

export function YarnBoard() {
  const p = useProject();
  const board: Board = p.board ?? { pins: [], strings: [] };
  const items = useMemo(() => boardItems(p), [p]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // The camera: the board is drawn at scale z, shifted by (ox, oy) inside a frame that fills the page.
  const [view, setView] = useState({ z: 0.5, ox: 0, oy: 0 });
  const zoom = view.z;
  const auto = useRef(true); // keep refitting on resize until she zooms or pans herself
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number; moved: boolean } | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selString, setSelString] = useState<string | null>(null);
  const [arranged, setArranged] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const motion = typeof document === 'undefined' || document.documentElement.dataset.motion !== 'off';
  // Yarn physics: strings wobble when tied or when a card is dropped, and draw themselves in.
  const [wob, setWob] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const [fresh, setFresh] = useState<{ ids: Set<string>; stagger: boolean }>({ ids: new Set(), stagger: false });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const shake = (ids: string[]) => motion && ids.length && setWob((w) => ({ ...w, ...Object.fromEntries(ids.map((id) => [id, performance.now()])) }));
  const drawIn = (ids: string[], stagger = false) => {
    if (!motion || !ids.length) return;
    setFresh({ ids: new Set(ids), stagger });
    setTimeout(() => setFresh({ ids: new Set(), stagger: false }), stagger ? 3200 : 1200);
  };
  useEffect(() => {
    const live = Object.values(wob).some((t) => performance.now() - t < 1500);
    if (!live) return;
    const r = requestAnimationFrame(() => setTick((n) => n + 1));
    return () => cancelAnimationFrame(r);
  });
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  // Pins for items that no longer exist are hidden (and cleaned up on the next save).
  const pins = board.pins.filter((pin) => pin.kind === 'note' || byId.has(pin.id));
  const pinOf = (id: string) => {
    const pin = pins.find((x) => x.id === id);
    if (!pin) return undefined;
    return drag?.id === id ? { ...pin, x: drag.x, y: drag.y } : pin;
  };
  const strings = board.strings.filter((s) => pinOf(s.a) && pinOf(s.b));

  const geo = (s: { id: string; a: string; b: string }) => {
    const a = pinPoint(pinOf(s.a)!), b = pinPoint(pinOf(s.b)!);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let sag = 18 + d * 0.07;
    if (drag && (s.a === drag.id || s.b === drag.id)) sag *= 0.45; // pulled taut while a card is carried
    const w = wob[s.id];
    if (w) {
      const t = (performance.now() - w) / 1000;
      if (t < 1.5) sag *= 1 + 0.5 * Math.exp(-3.2 * t) * Math.sin(t * 13);
    }
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag };
    return { a, b, d, c, path: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`, mid: { x: (a.x + b.x) / 2, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y } };
  };

  // Zoom and centre so every card is in view.
  const fit = (list: Pin[] = pins) => {
    const w = wrap.current;
    if (!w) return;
    auto.current = true;
    const W = w.clientWidth, H = w.clientHeight;
    if (!list.length) return setView({ z: Math.min(1, W / BOARD_W, H / BOARD_H), ox: 0, oy: 0 });
    const minX = Math.min(...list.map((x) => x.x)) - 30, minY = Math.min(...list.map((x) => x.y)) - 30;
    const maxX = Math.max(...list.map((x) => x.x + CARD_W[x.kind])) + 30, maxY = Math.max(...list.map((x) => x.y + (x.kind === 'character' ? 200 : 120))) + 30;
    const z = Math.max(0.2, Math.min(1.1, W / (maxX - minX), H / (maxY - minY)));
    setView({ z, ox: (W - (maxX - minX) * z) / 2 - minX * z, oy: (H - (maxY - minY) * z) / 2 - minY * z });
  };
  const zoomBy = (factor: number, at?: { x: number; y: number }) => {
    const w = wrap.current;
    if (!w) return;
    auto.current = false;
    setView((v) => {
      const z = Math.max(0.2, Math.min(1.6, v.z * factor));
      const px = at?.x ?? w.clientWidth / 2, py = at?.y ?? w.clientHeight / 2;
      const bx = (px - v.ox) / v.z, by = (py - v.oy) / v.z;
      return { z, ox: px - bx * z, oy: py - by * z };
    });
  };
  // Pinch on a trackpad (or Ctrl + scroll) zooms around the pointer; plain scrolling still moves the page.
  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;
  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = w.getBoundingClientRect();
      zoomRef.current(e.deltaY < 0 ? 1.1 : 1 / 1.1, { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    w.addEventListener('wheel', onWheel, { passive: false });
    return () => w.removeEventListener('wheel', onWheel);
  }, []);
  // Refit whenever the frame changes size (window resized, panel opened or closed).
  useEffect(() => {
    const w = wrap.current;
    if (!w || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => auto.current && fit());
    ro.observe(w);
    return () => ro.disconnect();
  });
  const fitNext = useRef(true);
  useEffect(() => {
    if (fitNext.current && pins.length) {
      fitNext.current = false;
      fit();
    }
  });
  const unpinned = items.filter((i) => !pins.some((x) => x.id === i.id));

  const save = (next: Partial<Board>) => updateProject({ board: { pins, strings: board.strings.filter((s) => pins.some((x) => x.id === s.a) && pins.some((x) => x.id === s.b)), ...next } });
  const toBoard = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.ox) / view.z, y: (e.clientY - r.top - view.oy) / view.z };
  };
  const visibleCentre = () => {
    const w = wrap.current!;
    return { x: (w.clientWidth / 2 - view.ox) / view.z, y: (w.clientHeight / 2 - view.oy) / view.z };
  };

  const tie = async (a: string, b: string) => {
    setLinking(null);
    if (a === b || board.strings.some((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a))) return;
    const na = byId.get(a)?.title ?? 'this', nb = byId.get(b)?.title ?? 'that';
    const label = await promptDialog('What connects them?', `${na} and ${nb}. A few words is plenty, or leave it blank.`, { placeholder: 'e.g. "lied about the ferry"', ok: 'Tie the string', optional: true });
    if (label === null) return;
    const id = uid();
    save({ strings: [...board.strings, { id, a, b, label: label.trim(), auto: false }] });
    drawIn([id]);
    setTimeout(() => shake([id]), 650);
  };

  const arrange = async () => {
    const mine = board.strings.filter((s) => !s.auto);
    if (pins.length && !(await confirmDialog('Pin it all up again?', 'Everything gets re-arranged and the automatic strings are redrawn from your story bible. Strings you tied yourself stay.', 'Re-arrange'))) return;
    const implied = impliedStrings(p).filter((y) => !mine.some((m) => (m.a === y.a && m.b === y.b) || (m.a === y.b && m.b === y.a)));
    const all = [...mine, ...implied];
    const w = wrap.current;
    const laid = autoLayout(p, all, [], w ? w.clientWidth / Math.max(1, w.clientHeight) : undefined);
    const notes = pins.filter((x) => x.kind === 'note');
    const newStrings = [...mine, ...implied.map((y) => ({ ...y, id: uid() }))];
    updateProject({ board: { pins: [...laid, ...notes], strings: newStrings } });
    setArranged(Date.now());
    drawIn(newStrings.map((s) => s.id), true);
    setSelected(null);
    fitNext.current = true;
  };

  const pinItem = (it: BoardItem) => {
    const c = visibleCentre();
    const pin: Pin = { id: it.id, kind: it.kind, x: Math.round(c.x - 80 + (Math.random() * 160 - 80)), y: Math.round(c.y - 60 + (Math.random() * 120 - 60)), tilt: Math.round((Math.random() * 8 - 4) * 10) / 10 };
    save({ pins: [...pins, pin] });
  };

  const addNote = async () => {
    const text = await promptDialog('Add a note to the board', 'A hunch, a question, a "what if…".', { placeholder: 'e.g. "Who moved the body at 2 a.m.?"', ok: 'Pin it up', long: true });
    if (!text?.trim()) return;
    const c = visibleCentre();
    save({ pins: [...pins, { id: uid(), kind: 'note', x: Math.round(c.x - 85), y: Math.round(c.y - 50), tilt: -2, text: text.trim() }] });
  };

  const onCardDown = (e: React.PointerEvent, pin: Pin) => {
    if ((e.target as HTMLElement).closest('.yarn-pin')) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const b = toBoard(e);
    setDrag({ id: pin.id, dx: b.x - pin.x, dy: b.y - pin.y, x: pin.x, y: pin.y, moved: false });
  };
  const onCardMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const b = toBoard(e);
    const x = Math.round(Math.min(BOARD_W - 120, Math.max(0, b.x - drag.dx)));
    const y = Math.round(Math.min(BOARD_H - 90, Math.max(0, b.y - drag.dy)));
    setDrag({ ...drag, x, y, moved: drag.moved || Math.abs(x - (pinOf(drag.id)?.x ?? x)) + Math.abs(y - (pinOf(drag.id)?.y ?? y)) > 0 });
  };
  const onCardUp = (pin: Pin) => {
    if (!drag) return;
    const moved = drag.x !== pin.x || drag.y !== pin.y;
    if (moved && Math.hypot(drag.x - (board.pins.find((x) => x.id === pin.id)?.x ?? 0), drag.y - (board.pins.find((x) => x.id === pin.id)?.y ?? 0)) > 3)
      save({ pins: pins.map((x) => (x.id === pin.id ? { ...x, x: drag.x, y: drag.y } : x)) }), shake(board.strings.filter((s) => s.a === pin.id || s.b === pin.id).map((s) => s.id));
    else if (linking) void tie(linking, pin.id);
    else setSelected(selected === pin.id ? null : pin.id), setSelString(null);
    setDrag(null);
  };

  const sel = selected ? pins.find((x) => x.id === selected) : undefined;
  const selItem = sel && sel.kind !== 'note' ? byId.get(sel.id) : undefined;
  const selStr = selString ? strings.find((s) => s.id === selString) : undefined;

  return (
    <>
      <div className="card row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <b>Your yarn board</b>
          <div className="small muted">
            Drag cards anywhere. To tie a string, click a card's red pin, then click the card it connects to. Click a string to label or cut it. Or let the board pin everything up from what you've written.
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" onClick={() => void arrange()} disabled={!items.length}>
            <Icon name="spark" size={16} /> Pin it all up for me
          </button>
          <button className="btn" onClick={() => void addNote()}>
            Add a note
          </button>
          <AskButton action="hiddenConnections" label="Find hidden connections" run />
        </div>
      </div>

      {linking && (
        <div className="yarn-hint">
          Now click the card that <b>{byId.get(linking)?.title ?? 'this note'}</b> connects to.{' '}
          <button className="btn small ghost" onClick={() => setLinking(null)}>
            Cancel
          </button>
        </div>
      )}

      <div className="yarn-tools">
        <button className="btn small" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <span className="small muted">{Math.round(zoom * 100)}%</span>
        <button className="btn small ghost" onClick={() => fit()}>
          Fit to screen
        </button>
        <button className="btn small" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
          +
        </button>
        <span className="spacer" />
        {pins.length > 0 && (
          <button
            className="btn small ghost"
            onClick={async () => {
              if (await confirmDialog('Take everything down?', 'The board is cleared. Nothing in your story bible changes.', 'Clear the board', true)) updateProject({ board: { pins: [], strings: [] } });
            }}
          >
            Clear the board
          </button>
        )}
      </div>

      <div
        className={`yarn-wrap${linking ? ' linking' : ''}`}
        ref={wrap}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('.yarn-card, .yarn-hit, .yarn-tag')) return;
          pan.current = { x: e.clientX, y: e.clientY, sl: view.ox, st: view.oy };
          setSelected(null);
          setSelString(null);
        }}
        onPointerMove={(e) => {
          if (linking) setCursor(toBoard(e));
          if (!pan.current || drag) return;
          auto.current = false;
          const { sl, st, x, y } = pan.current;
          setView((v) => ({ ...v, ox: sl + (e.clientX - x), oy: st + (e.clientY - y) }));
        }}
        onPointerUp={() => (pan.current = null)}
        onPointerLeave={() => (pan.current = null)}
      >
        <div>
          <div className="yarn-canvas" style={{ width: BOARD_W, height: BOARD_H, transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.z})` }}>
            {pins.length === 0 && (
              <div className="yarn-empty">
                <div className="yarn-empty-title">Nothing pinned yet</div>
                <div>Press “Pin it all up for me”, or pin cards one at a time from the list below.</div>
              </div>
            )}
            {pins.map((pin) => {
              const at = pinOf(pin.id)!;
              const entering = Date.now() - arranged < 3000;
              const it = byId.get(pin.id);
              return (
                <div
                  key={pin.id}
                  className={`yarn-card k-${pin.kind}${entering ? ' drop-in' : ''}${selected === pin.id ? ' sel' : ''}${linking === pin.id ? ' from' : ''}${drag?.id === pin.id ? ' dragging' : ''}`}
                  style={{
                    left: at.x,
                    top: at.y,
                    width: CARD_W[pin.kind],
                    transform: drag?.id === pin.id ? 'rotate(0deg) scale(1.05)' : `rotate(${pin.tilt}deg)`,
                    animationDelay: Date.now() - arranged < 3000 ? `${pins.indexOf(pin) * 18}ms` : undefined,
                  }}
                  onPointerDown={(e) => onCardDown(e, pin)}
                  onPointerMove={onCardMove}
                  onPointerUp={() => onCardUp(pin)}
                  title={it?.detail || pin.text}
                >
                  <button
                    className="yarn-pin"
                    aria-label="Tie a string from here"
                    title="Tie a string from here"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (linking && linking !== pin.id) void tie(linking, pin.id);
                      else setLinking(linking === pin.id ? null : pin.id);
                    }}
                  />
                  {pin.kind === 'character' && it && <div className="yarn-photo">{it.title.slice(0, 1)}</div>}
                  {pin.kind === 'secret' && <div className="yarn-stamp">Secret</div>}
                  <div className="yarn-sub">{pin.kind === 'note' ? 'Note' : it?.sub}</div>
                  <div className="yarn-title">{pin.kind === 'note' ? pin.text : it?.title}</div>
                </div>
              );
            })}
            <svg className="yarn-svg" width={BOARD_W} height={BOARD_H}>
              <defs>
                <filter id="yarn-shadow" x="-5%" y="-5%" width="110%" height="120%">
                  <feDropShadow dx="1" dy="2" stdDeviation="1.4" floodOpacity="0.35" />
                </filter>
              </defs>
              {strings.map((s, i) => {
                const g = geo(s);
                const drawing = fresh.ids.has(s.id);
                const style = drawing ? ({ '--len': Math.round(g.d * 1.15 + 40), animationDelay: fresh.stagger ? `${0.55 + i * 0.03}s` : '0s' } as React.CSSProperties) : undefined;
                return (
                  <g key={s.id}>
                    <path d={g.path} className={`yarn-line${s.auto ? ' auto' : ''}${selString === s.id ? ' sel' : ''}${drawing ? ' drawing' : ''}`} style={style} filter="url(#yarn-shadow)" />
                    {!drawing && <path d={g.path} className="yarn-fiber" />}
                    <path
                      d={g.path}
                      className="yarn-hit"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => (setSelString(selString === s.id ? null : s.id), setSelected(null), shake([s.id]))}
                    />
                  </g>
                );
              })}
              {linking && cursor && pinOf(linking) && (() => {
                const a = pinPoint(pinOf(linking)!);
                const d = Math.hypot(cursor.x - a.x, cursor.y - a.y);
                return <path className="yarn-preview" d={`M${a.x},${a.y} Q${(a.x + cursor.x) / 2},${(a.y + cursor.y) / 2 + 14 + d * 0.06} ${cursor.x},${cursor.y}`} />;
              })()}
            </svg>
            {strings
              .filter((s) => s.label && (!s.auto || !QUIET.has(s.label) || selString === s.id))
              .map((s) => {
                const { mid } = geo(s);
                const mx = mid.x, my = mid.y;
                return (
                  <div key={s.id} className={`yarn-tag${fresh.ids.has(s.id) ? ' late' : ''}`} style={{ left: mx, top: my, animationDelay: fresh.stagger ? '1.6s' : '0.5s' }} onClick={() => (setSelString(s.id), setSelected(null))}>
                    {s.label}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {selStr && (
        <div className="card row yarn-detail">
          <div style={{ flex: 1 }}>
            <div className="small muted">String</div>
            <b>{byId.get(selStr.a)?.title ?? 'Note'}</b> ↔ <b>{byId.get(selStr.b)?.title ?? 'Note'}</b>
            {selStr.label && <span className="muted"> · {selStr.label}</span>}
          </div>
          <button
            className="btn small"
            onClick={async () => {
              const label = await promptDialog('What connects them?', '', { value: selStr.label, ok: 'Save', optional: true });
              if (label !== null) save({ strings: board.strings.map((s) => (s.id === selStr.id ? { ...s, label: label.trim(), auto: false } : s)) });
            }}
          >
            Label it
          </button>
          <button className="btn small ghost" onClick={() => (save({ strings: board.strings.filter((s) => s.id !== selStr.id) }), setSelString(null))}>
            Cut the string
          </button>
        </div>
      )}

      {sel && (
        <div className="card row yarn-detail">
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="small muted">{sel.kind === 'note' ? 'Note' : selItem?.sub}</div>
            <b className="serif" style={{ fontSize: '1.2rem' }}>{sel.kind === 'note' ? sel.text : selItem?.title}</b>
            {selItem?.detail && <div className="small" style={{ marginTop: 4 }}>{selItem.detail}</div>}
            <div className="tiny muted" style={{ marginTop: 4 }}>{strings.filter((s) => s.a === sel.id || s.b === sel.id).length} strings</div>
          </div>
          <button className="btn small" onClick={() => setLinking(sel.id)}>
            Tie a string
          </button>
          {sel.kind === 'note' ? (
            <button
              className="btn small"
              onClick={async () => {
                const text = await promptDialog('Edit the note', '', { value: sel.text, ok: 'Save', long: true });
                if (text?.trim()) save({ pins: pins.map((x) => (x.id === sel.id ? { ...x, text: text.trim() } : x)) });
              }}
            >
              Edit
            </button>
          ) : (
            <button className="btn small" onClick={() => go(KIND_PAGE[sel.kind])}>
              Open its page
            </button>
          )}
          <button className="btn small ghost" onClick={() => (save({ pins: pins.filter((x) => x.id !== sel.id), strings: board.strings.filter((s) => s.a !== sel.id && s.b !== sel.id) }), setSelected(null))}>
            Take it down
          </button>
        </div>
      )}

      {unpinned.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '1.05rem' }}>Not on the board yet</h3>
          {(['character', 'clue', 'secret', 'event', 'place'] as PinKind[]).map((k) => {
            const list = unpinned.filter((i) => i.kind === k);
            if (!list.length) return null;
            return (
              <div key={k} style={{ marginTop: 8 }}>
                <div className="tiny muted" style={{ marginBottom: 4 }}>{KIND_LABEL[k]}</div>
                <div className="chips">
                  {list.map((it) => (
                    <button key={it.id} className="chip" onClick={() => pinItem(it)} title="Pin it to the board">
                      + {it.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export type { Yarn };
