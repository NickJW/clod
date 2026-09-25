// Places, research (clearly marked known / needs checking / invented), and notes.
import { useState } from 'react';
import type { FactStatus } from '../types';
import { addItem, patchItem, removeItem, useProject } from '../story/store';
import { newNote, newPlace, newResearch } from '../story/factory';
import { AskButton, AutoTextarea, Empty, Field, Icon } from '../components/ui';
import { timeAgo } from '../story/reference';
import { useSpeech } from '../editor/speech';
import { openEditor } from '../ai/session';

const FACT: Record<FactStatus, { label: string; cls: string; help: string }> = {
  known: { label: 'Known fact', cls: 'canon', help: 'Checked against a reliable source.' },
  needed: { label: 'Needs checking', cls: 'warn', help: 'Not verified yet. Check before you rely on it.' },
  fictional: { label: 'Invented for the book', cls: 'possibility', help: 'Deliberately made up or changed.' },
};

export function Research() {
  const [tab, setTab] = useState<'notes' | 'research' | 'places'>('notes');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Research & Notes</div>
          <h1>Everything else</h1>
          <p className="lead">Loose thoughts, places, and the real-world facts your story depends on.</p>
        </div>
      </div>
      <div className="tabs">
        <button className={`tab${tab === 'notes' ? ' active' : ''}`} onClick={() => setTab('notes')}>
          Notes
        </button>
        <button className={`tab${tab === 'research' ? ' active' : ''}`} onClick={() => setTab('research')}>
          Research
        </button>
        <button className={`tab${tab === 'places' ? ' active' : ''}`} onClick={() => setTab('places')}>
          Places
        </button>
      </div>
      {tab === 'notes' && <Notes />}
      {tab === 'research' && <ResearchTab />}
      {tab === 'places' && <Places />}
    </div>
  );
}

function Notes() {
  const p = useProject();
  const [talk, setTalk] = useState('');
  const speech = useSpeech((t) => setTalk((x) => (x ? x + ' ' : '') + t));
  const notes = [...p.notes].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <>
      <div className="card">
        <h3>Think out loud</h3>
        <p className="small muted">Talk or type freely about your story. Save it as a note, or let your editor organise it.</p>
        <AutoTextarea className="input serif" value={talk} onChange={setTalk} minRows={3} placeholder="Whatever's on your mind…" />
        {speech.interim && <div className="small muted">{speech.interim}…</div>}
        {speech.error && <div className="small" style={{ color: 'var(--danger)' }}>{speech.error}</div>}
        <div className="row" style={{ marginTop: 10 }}>
          <button className={`btn${speech.listening ? ' on' : ''}`} onClick={speech.toggle}>
            <Icon name="mic" size={16} /> {speech.listening ? 'Stop' : 'Talk'}
          </button>
          <span className="spacer" />
          <button className="btn" disabled={!talk.trim()} onClick={() => (addItem('notes', newNote({ title: talk.trim().split(/[.!?\n]/)[0].slice(0, 60), body: talk.trim() })), setTalk(''))}>
            Save as note
          </button>
          <select
            className="btn brass"
            value=""
            disabled={!talk.trim()}
            onChange={(e) => {
              if (!e.target.value) return;
              openEditor({ actionId: 'shape', request: talk, variant: e.target.value }, true);
              setTalk('');
            }}
          >
            <option value="">✦ Turn this into…</option>
            <option value="notes">Organised notes</option>
            <option value="scene">Scene ideas</option>
            <option value="character">Character notes</option>
            <option value="outline">An outline</option>
            <option value="prose">Draft prose</option>
          </select>
        </div>
      </div>
      <div className="row" style={{ margin: '20px 0 10px' }}>
        <span className="spacer" />
        <button className="btn primary" onClick={() => addItem('notes', newNote())}>
          <Icon name="plus" size={16} /> New note
        </button>
      </div>
      {notes.length === 0 && <Empty title="No notes yet" />}
      {notes.map((n) => (
        <div key={n.id} className="card">
          <div className="row">
            <input className="title-input" style={{ fontSize: '1.3rem' }} value={n.title} onChange={(e) => patchItem('notes', n.id, { title: e.target.value })} />
            <span className="tiny muted">{timeAgo(n.updatedAt)}</span>
            <button className="btn ghost small" onClick={() => removeItem('notes', n.id, 'Note deleted.')}>
              <Icon name="trash" size={15} />
            </button>
          </div>
          <AutoTextarea className="input" value={n.body} onChange={(body) => patchItem('notes', n.id, { body })} minRows={2} />
        </div>
      ))}
    </>
  );
}

function ResearchTab() {
  const p = useProject();
  const [f, setF] = useState<FactStatus | 'all'>('all');
  const list = p.research.filter((r) => f === 'all' || r.factStatus === f);
  return (
    <>
      <div className="card row">
        <div style={{ flex: 1 }}>
          <b>Ask a research question</b>
          <div className="small muted">Police procedure, medicine, law, places. Your editor tells you what's well established and what you should verify.</div>
        </div>
        <AskButton action="research" label="Research question" />
      </div>
      <div className="row" style={{ margin: '18px 0 12px' }}>
        {(['all', 'known', 'needed', 'fictional'] as const).map((k) => (
          <button key={k} className={`chip${f === k ? ' on' : ''}`} onClick={() => setF(k)}>
            {k === 'all' ? 'All' : FACT[k].label}
          </button>
        ))}
        <span className="spacer" />
        <button className="btn primary" onClick={() => addItem('research', newResearch())}>
          <Icon name="plus" size={16} /> Add research
        </button>
      </div>
      {list.length === 0 && <Empty title="Nothing here yet" />}
      {list.map((r) => (
        <div key={r.id} className="card">
          <div className="row">
            <input className="title-input" style={{ fontSize: '1.3rem' }} value={r.title} onChange={(e) => patchItem('research', r.id, { title: e.target.value })} />
            <select className={`status-select pill ${FACT[r.factStatus].cls}`} value={r.factStatus} onChange={(e) => patchItem('research', r.id, { factStatus: e.target.value as FactStatus })} title={FACT[r.factStatus].help}>
              {(Object.keys(FACT) as FactStatus[]).map((k) => (
                <option key={k} value={k}>
                  {FACT[k].label}
                </option>
              ))}
            </select>
            <button className="btn ghost small" onClick={() => removeItem('research', r.id, 'Research deleted.')}>
              <Icon name="trash" size={15} />
            </button>
          </div>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <Field label="Topic" value={r.category} onChange={(category) => patchItem('research', r.id, { category })} />
            <label className="field">
              <span className="lab">Source link</span>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" value={r.url} onChange={(e) => patchItem('research', r.id, { url: e.target.value })} placeholder="https://…" />
                {/^https?:\/\//.test(r.url) && (
                  <a className="btn small" href={r.url} target="_blank" rel="noreferrer noopener">
                    Open
                  </a>
                )}
              </div>
            </label>
          </div>
          <AutoTextarea className="input" value={r.content} onChange={(content) => patchItem('research', r.id, { content })} minRows={2} />
        </div>
      ))}
    </>
  );
}

function Places() {
  const p = useProject();
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="small muted">One or two specific details make a place real. You don't need a full description.</span>
        <span className="spacer" />
        <button className="btn primary" onClick={() => addItem('places', newPlace())}>
          <Icon name="plus" size={16} /> Add a place
        </button>
      </div>
      {p.places.length === 0 && <Empty title="No places yet" />}
      {p.places.map((pl) => (
        <details key={pl.id} className="group">
          <summary>
            <div>
              <h3>{pl.name}</h3>
              <div className="small muted">{pl.description.slice(0, 120)}</div>
            </div>
          </summary>
          <div className="inner">
            <Field label="Name" value={pl.name} onChange={(name) => patchItem('places', pl.id, { name })} />
            <Field label="Description" value={pl.description} onChange={(description) => patchItem('places', pl.id, { description })} long />
            <Field label="Specific details" hint="Smells, sounds, textures, one odd object." value={pl.details} onChange={(details) => patchItem('places', pl.id, { details })} long />
            <Field label="Why it matters to the story" value={pl.significance} onChange={(significance) => patchItem('places', pl.id, { significance })} long />
            <button className="btn ghost small danger" onClick={() => removeItem('places', pl.id, 'Place deleted.')}>
              Delete place
            </button>
          </div>
        </details>
      ))}
    </>
  );
}
