// A visual timeline of what really happened, including backstory. Flags
// impossible sequences, like the same person in two places at once.
import { useMemo, useState } from 'react';
import type { Project, TimelineEvent } from '../types';
import { addItem, patchItem, removeItem, updateProject, useProject } from '../story/store';
import { newEvent } from '../story/factory';
import { chapterLabel, characterName } from '../story/reference';
import { eventWhen, sortEvents } from '../ai/context';
import { AskButton, ChapterSelect, CharacterChips, Empty, Field, Icon, Modal, StatusPicker } from '../components/ui';

function conflicts(p: Project): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, msg: string) => out.set(id, [...(out.get(id) ?? []), msg]);
  const exact = p.timeline.filter((e) => e.status !== 'discarded' && e.dateKind === 'exact' && e.date);
  for (let i = 0; i < exact.length; i++)
    for (let j = i + 1; j < exact.length; j++) {
      const a = exact[i];
      const b = exact[j];
      if (a.date !== b.date || !a.location || !b.location || a.location.trim().toLowerCase() === b.location.trim().toLowerCase()) continue;
      const both = a.characterIds.filter((id) => b.characterIds.includes(id));
      if (!both.length) continue;
      const mins = (t: string) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : NaN);
      const gap = Math.abs(mins(a.time) - mins(b.time));
      if (Number.isNaN(gap) || gap < 60) {
        const names = both.map((id) => characterName(p, id)).join(' and ');
        const msg = `${names} ${both.length > 1 ? 'are' : 'is'} at "${a.location}" and "${b.location}" on ${a.date}${Number.isNaN(gap) ? '' : ` within ${gap} minutes`}. Is that possible?`;
        add(a.id, msg);
        add(b.id, msg);
      }
    }
  // Exact dates contradicting the chosen order
  const sorted = sortEvents(p.timeline.filter((e) => e.status !== 'discarded'));
  let last: TimelineEvent | null = null;
  for (const e of sorted) {
    if (e.dateKind !== 'exact' || !e.date) continue;
    if (last && `${e.date} ${e.time}` < `${last.date} ${last.time}`) add(e.id, `This is placed after "${last.title}" but its date (${e.date}) is earlier.`);
    last = e;
  }
  return out;
}

export function Timeline() {
  const p = useProject();
  const [edit, setEdit] = useState<string | null>(null);
  const [who, setWho] = useState('');
  const [showBackstory, setShowBackstory] = useState(true);
  const flags = useMemo(() => conflicts(p), [p]);
  const events = sortEvents(p.timeline).filter((e) => (!who || e.characterIds.includes(who)) && (showBackstory || e.onPage));
  const ev = p.timeline.find((e) => e.id === edit);

  const move = (e: TimelineEvent, dir: -1 | 1) => {
    const all = sortEvents(p.timeline);
    const i = all.findIndex((x) => x.id === e.id);
    const j = i + dir;
    if (j < 0 || j >= all.length) return;
    const reordered = [...all];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    updateProject({ timeline: reordered.map((x, k) => ({ ...x, order: k + 1 })) });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Timeline</div>
          <h1>When things really happened</h1>
          <p className="lead">The true order of events, including what happened before the book begins. It doesn't have to match the order you reveal them in.</p>
        </div>
        <div className="row">
          <AskButton action="ask" label="Check my timeline" input={{ request: 'Check my timeline for impossible sequences, characters in two places at once, travel times that don\'t work, and contradictions with the chapters. Flag them, don\'t fix them.' }} run />
          <button
            className="btn primary"
            onClick={() => {
              const e = newEvent({ order: (sortEvents(p.timeline).at(-1)?.order ?? 0) + 1 });
              addItem('timeline', e);
              setEdit(e.id);
            }}
          >
            <Icon name="plus" size={16} /> Add an event
          </button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 18 }}>
        <span className="small muted">Show where</span>
        <select className="input" style={{ width: 220 }} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">everyone</option>
          {p.characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="small muted">was</span>
        <span className="spacer" />
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={showBackstory} onChange={(e) => setShowBackstory(e.target.checked)} /> Show backstory and off-page events
        </label>
      </div>

      {events.length === 0 ? (
        <Empty title="No events yet">
          <p>Start with the crime, or the moment everything changed.</p>
        </Empty>
      ) : (
        <div className="tl">
          {events.map((e) => {
            const f = flags.get(e.id);
            return (
              <div key={e.id} className={`tl-item${e.onPage ? '' : ' off'}${f ? ' conflict' : ''}`}>
                <div className="card click" style={{ padding: '12px 16px', opacity: e.status === 'discarded' ? 0.5 : 1 }} onClick={() => setEdit(e.id)}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="tl-when">{eventWhen(e)}</span>
                    {!e.onPage && <span className="pill neutral">Backstory / off the page</span>}
                    {e.status !== 'canon' && <span className={`pill ${e.status}`}>{e.status}</span>}
                    <span className="spacer" />
                    <button className="btn ghost small" onClick={(x) => (x.stopPropagation(), move(e, -1))} title="Earlier">
                      <Icon name="up" size={15} />
                    </button>
                    <button className="btn ghost small" onClick={(x) => (x.stopPropagation(), move(e, 1))} title="Later">
                      <Icon name="down" size={15} />
                    </button>
                  </div>
                  <div className="serif" style={{ fontSize: '1.2rem' }}>{e.title}</div>
                  <div className="small muted">
                    {e.location && <>📍 {e.location} · </>}
                    {e.characterIds.map((id) => characterName(p, id)).join(', ') || 'No characters'}
                    {e.chapterId && <> · {chapterLabel(p, e.chapterId)}</>}
                  </div>
                  {e.description && <div className="small" style={{ marginTop: 4 }}>{e.description}</div>}
                  {f?.map((m, i) => (
                    <div key={i} className="err-box" style={{ marginTop: 8 }}>
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {ev && <EventEditor e={ev} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EventEditor({ e, onClose }: { e: TimelineEvent; onClose: () => void }) {
  const p = useProject();
  const set = (patch: Partial<TimelineEvent>) => patchItem('timeline', e.id, patch);
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <input className="title-input" value={e.title} onChange={(x) => set({ title: x.target.value })} aria-label="Event" />
        <StatusPicker value={e.status} onChange={(status) => set({ status })} />
      </div>
      <div className="chips" style={{ margin: '14px 0' }}>
        {(
          [
            ['exact', 'Exact date'],
            ['approx', 'Roughly'],
            ['relative', 'Just its place in the order'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={`chip${e.dateKind === k ? ' on' : ''}`} onClick={() => set({ dateKind: k })}>
            {l}
          </button>
        ))}
      </div>
      {e.dateKind === 'exact' ? (
        <div className="grid-2">
          <label className="field">
            <span className="lab">Date</span>
            <input className="input" type="date" value={e.date} onChange={(x) => set({ date: x.target.value })} />
          </label>
          <label className="field">
            <span className="lab">Time (optional)</span>
            <input className="input" type="time" value={e.time} onChange={(x) => set({ time: x.target.value })} />
          </label>
        </div>
      ) : (
        <Field label="When, roughly" hint='e.g. "Twenty years ago", "The week before the murder", "Late summer"' value={e.approxLabel} onChange={(approxLabel) => set({ approxLabel })} />
      )}
      <Field label="Where" value={e.location} onChange={(location) => set({ location })} />
      <label className="field">
        <span className="lab">Who was there</span>
        <CharacterChips p={p} value={e.characterIds} onChange={(characterIds) => set({ characterIds })} />
      </label>
      <Field label="What happened" value={e.description} onChange={(description) => set({ description })} long />
      <label className="field">
        <span className="lab">Shown in chapter</span>
        <ChapterSelect p={p} value={e.chapterId} onChange={(chapterId) => set({ chapterId })} none="Not shown in a chapter" />
      </label>
      <label className="row small" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={!e.onPage} onChange={(x) => set({ onPage: !x.target.checked })} /> This is backstory, or happens off the page
      </label>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn ghost danger" onClick={() => (removeItem('timeline', e.id, 'Event deleted.'), onClose())}>
          Delete
        </button>
        <span className="spacer" />
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
