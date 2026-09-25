// Characters, relationships and the romance tracker.
import { useState } from 'react';
import type { Character, Relationship, RomanceMeters } from '../types';
import { addItem, patchItem, removeItem, useProject } from '../story/store';
import { newCharacter, newRelationship, uid } from '../story/factory';
import { CHARACTER_GROUPS, STATUS_LABEL, characterName, chapterLabel } from '../story/reference';
import { AskButton, AutoTextarea, ChapterSelect, Empty, Field, Icon, StatusPicker, StatusPill, confirmDialog } from '../components/ui';

export function Characters() {
  const p = useProject();
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'people' | 'rel'>('people');
  const c = p.characters.find((x) => x.id === open);
  if (c) return <CharacterDetail c={c} onBack={() => setOpen(null)} />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Characters</div>
          <h1>The people in your book</h1>
          <p className="lead">What they want, what they fear, what they hide. Your editor uses this to keep everyone consistent.</p>
        </div>
        <div className="row">
          {p.relationships.some((r) => r.isRomance) && <AskButton action="romanceCheck" label="Check the romance" run />}
          <button
            className="btn primary"
            onClick={() => {
              const n = newCharacter('New character');
              addItem('characters', n);
              setOpen(n.id);
            }}
          >
            <Icon name="plus" size={17} /> Add a character
          </button>
        </div>
      </div>
      <div className="tabs">
        <button className={`tab${tab === 'people' ? ' active' : ''}`} onClick={() => setTab('people')}>
          Characters ({p.characters.length})
        </button>
        <button className={`tab${tab === 'rel' ? ' active' : ''}`} onClick={() => setTab('rel')}>
          Relationships ({p.relationships.length})
        </button>
      </div>
      {tab === 'people' &&
        (p.characters.length === 0 ? (
          <Empty title="No characters yet">
            <p>Start with your main character. Even a name and one sentence is enough.</p>
          </Empty>
        ) : (
          <div className="grid-3">
            {p.characters.map((x) => (
              <div key={x.id} className="card click char-card" onClick={() => setOpen(x.id)} style={{ opacity: x.status === 'discarded' ? 0.55 : 1 }}>
                <div className="row">
                  <div className="avatar">{x.name.slice(0, 1)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="serif" style={{ fontSize: '1.3rem', lineHeight: 1.2 }}>{x.name}</div>
                    <div className="small muted">{x.role || 'No role yet'}</div>
                  </div>
                </div>
                <div className="small" style={{ marginTop: 8, color: 'var(--ink-2)' }}>
                  {(x.fields.personality || x.fields.goals || x.fields.history || '').slice(0, 140)}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  {x.status !== 'canon' && <StatusPill status={x.status} />}
                  {x.fields.secrets && <span className="pill accent">Has secrets</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      {tab === 'rel' && <Relationships />}
    </div>
  );
}

function CharacterDetail({ c, onBack }: { c: Character; onBack: () => void }) {
  const p = useProject();
  const setF = (k: string) => (v: string) => patchItem('characters', c.id, { fields: { ...c.fields, [k]: v } });
  const filled = (keys: string[]) => keys.filter((k) => c.fields[k]?.trim()).length;
  const ideas = p.ideas.filter((i) => i.linkId === c.id);
  const rels = p.relationships.filter((r) => r.aId === c.id || r.bId === c.id);

  return (
    <div className="page">
      <button className="btn ghost small" onClick={onBack}>
        ← All characters
      </button>
      <div className="char-layout" style={{ marginTop: 16 }}>
        <div>
          <div className="row" style={{ marginBottom: 18 }}>
            <div className="avatar" style={{ width: 70, height: 70, fontSize: '2rem' }}>{c.name.slice(0, 1)}</div>
            <div style={{ flex: 1 }}>
              <input className="title-input" style={{ fontSize: '2.2rem' }} value={c.name} onChange={(e) => patchItem('characters', c.id, { name: e.target.value })} aria-label="Name" />
              <input className="input" style={{ border: 0, background: 'transparent', padding: 0, minHeight: 0, color: 'var(--muted)' }} value={c.role} placeholder="Role in the story (e.g. protagonist, suspect, victim)" onChange={(e) => patchItem('characters', c.id, { role: e.target.value })} />
            </div>
          </div>
          {CHARACTER_GROUPS.map((g, gi) => (
            <details key={g.title} className="group" open={gi === 0 || filled(g.fields.map((f) => f.key)) > 0}>
              <summary>
                <div>
                  <h3>{g.title}</h3>
                  <div className="muted">{g.intro}</div>
                </div>
                <span className="small muted">
                  {filled(g.fields.map((f) => f.key))}/{g.fields.length}
                </span>
              </summary>
              <div className="inner">
                {g.fields.map((f) => (
                  <Field key={f.key} label={f.label} hint={f.hint} value={c.fields[f.key] ?? ''} onChange={setF(f.key)} long={f.long} />
                ))}
              </div>
            </details>
          ))}
        </div>
        <div className="sticky-side stack">
          <div className="card">
            <div className="small muted" style={{ marginBottom: 6 }}>Is this character decided?</div>
            <StatusPicker value={c.status} onChange={(status) => patchItem('characters', c.id, { status })} />
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Everything you type here counts as fact. Your editor's suggestions stay separate until you choose them.
            </p>
          </div>
          <div className="card stack" style={{ gap: 8 }}>
            <AskButton action="developCharacter" label="Develop this character" input={{ characterId: c.id }} />
            <AskButton action="characterCheck" label="Check consistency" input={{ characterId: c.id }} run />
            <AskButton action="ask" label="Ask about them" input={{ characterId: c.id, request: `About ${c.name}: ` }} />
          </div>
          {ideas.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '1.05rem' }}>Ideas about {c.name.split(' ')[0]}</h3>
              {ideas.map((i) => (
                <div key={i.id} className="list-row" style={{ padding: '8px 0' }}>
                  <div className="small" style={{ flex: 1 }}>{i.text}</div>
                  <StatusPicker value={i.status} onChange={(status) => patchItem('ideas', i.id, { status })} />
                </div>
              ))}
            </div>
          )}
          {rels.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '1.05rem' }}>Relationships</h3>
              {rels.map((r) => (
                <div key={r.id} className="small" style={{ padding: '6px 0' }}>
                  <b>{characterName(p, r.aId === c.id ? r.bId : r.aId)}</b>: {r.kind}
                </div>
              ))}
            </div>
          )}
          <button
            className="btn ghost small danger"
            onClick={async () => {
              if (await confirmDialog(`Delete ${c.name}?`, 'You can undo this for a few seconds afterwards.', 'Delete', true)) {
                removeItem('characters', c.id, `${c.name} deleted.`);
                onBack();
              }
            }}
          >
            Delete character
          </button>
        </div>
      </div>
    </div>
  );
}

const METERS: { k: keyof RomanceMeters; label: string }[] = [
  { k: 'attraction', label: 'Attraction' },
  { k: 'trust', label: 'Trust' },
  { k: 'vulnerability', label: 'Vulnerability' },
  { k: 'conflict', label: 'Conflict' },
  { k: 'dependence', label: 'Emotional dependence' },
];

function Relationships() {
  const p = useProject();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  return (
    <>
      <div className="card row">
        <span>New relationship between</span>
        <select className="input" style={{ width: 200 }} value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">choose…</option>
          {p.characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span>and</span>
        <select className="input" style={{ width: 200 }} value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">choose…</option>
          {p.characters.filter((c) => c.id !== a).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn primary" disabled={!a || !b} onClick={() => (addItem('relationships', newRelationship(a, b)), setA(''), setB(''))}>
          Add
        </button>
      </div>
      {p.relationships.map((r) => (
        <RelCard key={r.id} r={r} />
      ))}
    </>
  );
}

function RelCard({ r }: { r: Relationship }) {
  const p = useProject();
  const set = (patch: Partial<Relationship>) => patchItem('relationships', r.id, patch);
  const [beatCh, setBeatCh] = useState('');
  const [beat, setBeat] = useState('');
  return (
    <div className="card">
      <div className="row">
        <h3>
          {characterName(p, r.aId)} <span className="muted">&amp;</span> {characterName(p, r.bId)}
        </h3>
        <span className="spacer" />
        <StatusPicker value={r.status} onChange={(status) => set({ status })} />
        <button className="btn ghost small" onClick={() => removeItem('relationships', r.id, 'Relationship removed.')}>
          <Icon name="trash" size={15} />
        </button>
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <Field label="What they are to each other" value={r.kind} onChange={(kind) => set({ kind })} />
        <Field label="What's unresolved between them" value={r.tension} onChange={(tension) => set({ tension })} />
      </div>
      <Field label="Their story" value={r.description} onChange={(description) => set({ description })} long />
      <label className="row small" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={r.isRomance} onChange={(e) => set({ isRomance: e.target.checked })} /> Track this as a romance
      </label>
      {r.isRomance && (
        <div style={{ marginTop: 14 }}>
          <p className="small muted">Where the relationship stands right now. Update these as the story moves. Your editor uses them to spot a romance that's stalled or moving too fast.</p>
          {METERS.map((m) => (
            <div key={m.k} className="slider-row">
              <span className="small">{m.label}</span>
              <input type="range" min={0} max={10} value={r.romance[m.k]} onChange={(e) => set({ romance: { ...r.romance, [m.k]: +e.target.value } })} />
              <span className="val">{r.romance[m.k]}</span>
            </div>
          ))}
          <div className="slider-row">
            <span className="small">Who holds the power</span>
            <input type="range" min={0} max={10} value={r.romance.power} onChange={(e) => set({ romance: { ...r.romance, power: +e.target.value } })} />
            <span className="val tiny">{r.romance.power === 5 ? 'Even' : r.romance.power < 5 ? characterName(p, r.aId).split(' ')[0] : characterName(p, r.bId).split(' ')[0]}</span>
          </div>
          <h4 style={{ margin: '14px 0 6px' }}>How it has changed, chapter by chapter</h4>
          {r.beats.map((x) => (
            <div key={x.id} className="row small" style={{ padding: '4px 0' }}>
              <span className="pill neutral">{chapterLabel(p, x.chapterId) || 'Unplaced'}</span>
              <span style={{ flex: 1 }}>{x.note}</span>
              <button className="btn ghost small" onClick={() => set({ beats: r.beats.filter((y) => y.id !== x.id) })}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <div className="row" style={{ marginTop: 6 }}>
            <div style={{ width: 220 }}>
              <ChapterSelect p={p} value={beatCh} onChange={setBeatCh} none="Chapter…" />
            </div>
            <AutoTextarea className="input" value={beat} onChange={setBeat} placeholder="What changed between them?" minRows={1} />
            <button className="btn" disabled={!beat.trim()} onClick={() => (set({ beats: [...r.beats, { id: uid(), chapterId: beatCh, note: beat.trim() }] }), setBeat(''))}>
              Add
            </button>
          </div>
        </div>
      )}
      <div className="tiny muted" style={{ marginTop: 8 }}>Status: {STATUS_LABEL[r.status]}</div>
    </div>
  );
}
