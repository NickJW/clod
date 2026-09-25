// Chapter planning in plain questions, and a record for every scene.
import { useState } from 'react';
import type { Chapter, ChapterOutline, Scene } from '../types';
import { addItem, patchItem, removeItem, setState, toast, updateProject, useProject } from '../story/store';
import { maybeSummarize } from '../ai/session';
import { getAISettings } from '../ai/provider';
import { newScene } from '../story/factory';
import { characterName, countWords } from '../story/reference';
import { AskButton, AutoTextarea, CharacterChips, CharacterSelect, Field, Icon, Modal, Term } from '../components/ui';

const QUESTIONS: { k: keyof ChapterOutline; q: string }[] = [
  { k: 'happens', q: 'What happens in this chapter?' },
  { k: 'who', q: 'Who is there?' },
  { k: 'wants', q: 'What does your main character want here?' },
  { k: 'obstacle', q: 'What gets in the way?' },
  { k: 'learns', q: 'What does she learn?' },
  { k: 'changes', q: 'What\'s different by the end?' },
  { k: 'question', q: 'What question should the reader have afterwards?' },
  { k: 'feel', q: 'What should the reader feel?' },
  { k: 'unanswered', q: 'What should stay unanswered?' },
];

function UpdateSummaries() {
  const p = useProject();
  const [busy, setBusy] = useState('');
  const stale = p.chapters.filter((c) => countWords(c.text) >= 250 && (!c.summary || Math.abs(countWords(c.text) - c.summaryWordCount) >= 300));
  if (!stale.length) return null;
  return (
    <button
      className="btn"
      disabled={!!busy}
      title="Short summaries help your editor remember each chapter cheaply"
      onClick={async () => {
        if (!getAISettings().apiKey) return toast('Connect your AI editor in Settings first.', 'error');
        let n = 0;
        for (const c of stale) {
          setBusy(`Summarising ${++n} of ${stale.length}…`);
          await maybeSummarize(c.id, true);
        }
        setBusy('');
        toast('Chapter summaries updated.');
      }}
    >
      {busy || `Update ${stale.length} chapter summar${stale.length > 1 ? 'ies' : 'y'}`}
    </button>
  );
}

export function Scenes() {
  const p = useProject();
  const [open, setOpen] = useState(p.currentChapterId);
  const [scene, setScene] = useState<string | null>(null);
  const ch = p.chapters.find((c) => c.id === open) ?? p.chapters[0];
  const sc = p.scenes.find((s) => s.id === scene);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Scenes & Outline</div>
          <h1>Plan your chapters</h1>
          <p className="lead">Answer a few simple questions for each chapter. You don't need any writing theory. Your editor can turn your answers into a plan.</p>
        </div>
        <div className="row">
          <UpdateSummaries />
          <AskButton action="pacing" label="Check my pacing" run />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="card" style={{ padding: 8, position: 'sticky', top: 20 }}>
          {p.chapters.map((c, i) => (
            <button key={c.id} className={`ch-item${c.id === ch.id ? ' active' : ''}`} onClick={() => setOpen(c.id)}>
              <div className="n">CHAPTER {i + 1}</div>
              <div className="tt">{c.title}</div>
              <div className="st">
                {c.status} · {p.scenes.filter((s) => s.chapterId === c.id).length} scenes
              </div>
            </button>
          ))}
        </div>
        <ChapterPlan ch={ch} onScene={setScene} />
      </div>

      <div className="section-title">
        <h2>All scenes</h2>
      </div>
      <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Ch.</th>
              <th>Scene</th>
              <th>
                <Term k="pov">POV</Term>
              </th>
              <th>Where / when</th>
              <th>Purpose</th>
              <th>Reveals</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {p.chapters.flatMap((c, i) =>
              p.scenes
                .filter((s) => s.chapterId === c.id)
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <tr key={s.id} className="click" onClick={() => setScene(s.id)}>
                    <td>{i + 1}</td>
                    <td className="serif" style={{ fontSize: '1.02rem' }}>{s.title}</td>
                    <td>{characterName(p, s.povCharacterId)}</td>
                    <td className="small">{[s.location, s.time].filter(Boolean).join(', ')}</td>
                    <td className="small">{s.purpose}</td>
                    <td className="small">{s.revealed}</td>
                    <td>
                      <span className="pill neutral">{s.status}</span>
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
        {p.scenes.length === 0 && <p className="muted small" style={{ padding: 12 }}>No scenes yet. Add them from a chapter above.</p>}
      </div>
      {sc && <SceneEditor s={sc} onClose={() => setScene(null)} />}
    </div>
  );
}

function ChapterPlan({ ch, onScene }: { ch: Chapter; onScene: (id: string) => void }) {
  const p = useProject();
  const set = (k: keyof ChapterOutline) => (v: string) => patchItem('chapters', ch.id, { outline: { ...ch.outline, [k]: v } });
  const scenes = p.scenes.filter((s) => s.chapterId === ch.id).sort((a, b) => a.order - b.order);
  const answered = QUESTIONS.filter((q) => ch.outline[q.k].trim()).length;
  return (
    <div>
      <div className="card">
        <div className="row">
          <input className="title-input" value={ch.title} onChange={(e) => patchItem('chapters', ch.id, { title: e.target.value })} aria-label="Chapter title" />
          <button
            className="btn small"
            onClick={() => {
              updateProject({ currentChapterId: ch.id });
              setState({ page: 'write' });
            }}
          >
            <Icon name="write" size={16} /> Write this chapter
          </button>
        </div>
        <div className="small muted">{countWords(ch.text).toLocaleString()} words written</div>
        <div style={{ marginTop: 18 }}>
          {QUESTIONS.map((q) => (
            <Field key={q.k} label={q.q} value={ch.outline[q.k]} onChange={set(q.k)} long />
          ))}
        </div>
        <div className="row">
          <span className="small muted">{answered} of {QUESTIONS.length} answered. Skip any you like.</span>
          <span className="spacer" />
          <AskButton action="chapterPlan" label="Turn my answers into a plan" input={{ chapterId: ch.id }} run />
          <AskButton action="scene" label="Help me build a scene" input={{ chapterId: ch.id }} />
        </div>
      </div>
      <div className="card">
        <h3>Chapter plan</h3>
        <p className="small muted">Your plan for this chapter, in your own words or accepted from your editor.</p>
        <AutoTextarea className="input" value={ch.outline.plan} onChange={set('plan')} minRows={4} placeholder="Optional" />
      </div>
      <div className="card">
        <h3>Summary for your editor</h3>
        <p className="small muted">A short record of what actually happens in the finished chapter. Your editor reads this instead of the whole chapter, which saves time and cost. You can write it yourself, or use "Add summary" in the Write view.</p>
        <AutoTextarea className="input" value={ch.summary} onChange={(summary) => patchItem('chapters', ch.id, { summary, summaryWordCount: countWords(ch.text) })} minRows={3} />
      </div>
      <div className="card">
        <div className="row">
          <h3>Scenes in this chapter</h3>
          <span className="spacer" />
          <button
            className="btn primary small"
            onClick={() => {
              const s = newScene(ch.id, { order: (scenes.at(-1)?.order ?? 0) + 1, povCharacterId: ch.povCharacterId });
              addItem('scenes', s);
              onScene(s.id);
            }}
          >
            <Icon name="plus" size={16} /> Add a scene
          </button>
        </div>
        {scenes.length === 0 && <p className="small muted">A scene is one continuous stretch of action in one place and time.</p>}
        {scenes.map((s) => (
          <div key={s.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => onScene(s.id)}>
            <div style={{ flex: 1 }}>
              <div className="serif" style={{ fontSize: '1.1rem' }}>{s.title}</div>
              <div className="small muted">{[characterName(p, s.povCharacterId) && `POV ${characterName(p, s.povCharacterId)}`, s.location, s.purpose].filter(Boolean).join(' · ')}</div>
            </div>
            <span className="pill neutral">{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENE_FIELDS: { k: keyof Scene; label: string; hint?: string }[] = [
  { k: 'purpose', label: 'Why this scene is in the book' },
  { k: 'conflict', label: 'The conflict' },
  { k: 'povWants', label: 'What the POV character wants' },
  { k: 'opposingWants', label: 'What the other person wants' },
  { k: 'revealed', label: 'What is revealed' },
  { k: 'concealed', label: 'What stays hidden' },
  { k: 'clueIntroduced', label: 'Clue introduced' },
  { k: 'clueResolved', label: 'Clue explained' },
  { k: 'characterChange', label: 'How a character changes' },
  { k: 'emotionalChange', label: 'Emotional shift', hint: 'e.g. hope → dread' },
  { k: 'relationshipChange', label: 'How a relationship changes' },
  { k: 'foreshadowing', label: 'Hints planted for later' },
  { k: 'endingBeat', label: 'The final moment' },
];

function SceneEditor({ s, onClose }: { s: Scene; onClose: () => void }) {
  const p = useProject();
  const set = (patch: Partial<Scene>) => patchItem('scenes', s.id, patch);
  return (
    <Modal onClose={onClose} wide>
      <input className="title-input" value={s.title} onChange={(e) => set({ title: e.target.value })} aria-label="Scene title" />
      <div className="grid-2" style={{ marginTop: 14 }}>
        <label className="field">
          <span className="lab">Chapter</span>
          <select className="input" value={s.chapterId} onChange={(e) => set({ chapterId: e.target.value })}>
            {p.chapters.map((c, i) => (
              <option key={c.id} value={c.id}>
                Chapter {i + 1}: {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="lab">
            <Term k="pov">Point of view</Term>
          </span>
          <CharacterSelect p={p} value={s.povCharacterId} onChange={(povCharacterId) => set({ povCharacterId })} none="Not set" />
        </label>
        <Field label="Where" value={s.location} onChange={(location) => set({ location })} />
        <Field label="When" value={s.time} onChange={(time) => set({ time })} />
      </div>
      <label className="field">
        <span className="lab">Who is there</span>
        <CharacterChips p={p} value={s.characterIds} onChange={(characterIds) => set({ characterIds })} />
      </label>
      <div className="grid-2">
        {SCENE_FIELDS.map((f) => (
          <Field key={f.k} label={f.label} hint={f.hint} value={s[f.k] as string} onChange={(v) => set({ [f.k]: v } as Partial<Scene>)} long />
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <select className="status-select" value={s.status} onChange={(e) => set({ status: e.target.value as Scene['status'] })}>
          {['Idea', 'Outlined', 'Drafting', 'Revising', 'Done'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button className="btn ghost danger" onClick={() => (removeItem('scenes', s.id, 'Scene deleted.'), onClose())}>
          Delete scene
        </button>
        <span className="spacer" />
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
