// The story bible: premise, tone controls, and the canon board of decisions & ideas.
import { useState } from 'react';
import type { CanonStatus, IdeaCategory, StoryBible, Tone } from '../types';
import { addItem, patchItem, removeItem, updateProject, useProject } from '../story/store';
import { newIdea } from '../story/factory';
import { STATUS_HELP, STATUS_LABEL } from '../story/reference';
import { AskButton, AutoTextarea, Field, Icon, StatusPicker, Term } from '../components/ui';

const CATS: IdeaCategory[] = ['plot', 'character', 'mystery', 'romance', 'twist', 'scene', 'world', 'theme', 'ending', 'other'];

export function Story() {
  const [tab, setTab] = useState<'bible' | 'tone' | 'ideas'>('bible');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Story Bible</div>
          <h1>The truth of your book</h1>
          <p className="lead">
            Everything here is what your editor treats as the facts of your story. <Term k="canon">Decided</Term> things are fact. Possibilities are just ideas.
          </p>
        </div>
        <div className="row">
          <AskButton action="missing" label="What's missing?" run />
          <AskButton action="pacing" label="Check my pacing" run />
        </div>
      </div>
      <div className="tabs">
        <button className={`tab${tab === 'bible' ? ' active' : ''}`} onClick={() => setTab('bible')}>
          The story
        </button>
        <button className={`tab${tab === 'tone' ? ' active' : ''}`} onClick={() => setTab('tone')}>
          Tone & feel
        </button>
        <button className={`tab${tab === 'ideas' ? ' active' : ''}`} onClick={() => setTab('ideas')}>
          Decisions & ideas
        </button>
      </div>
      {tab === 'bible' && <BibleTab />}
      {tab === 'tone' && <ToneTab />}
      {tab === 'ideas' && <IdeasTab />}
    </div>
  );
}

function BibleTab() {
  const p = useProject();
  const b = p.bible;
  const set = (k: keyof StoryBible) => (v: string) => updateProject({ bible: { ...p.bible, [k]: v } });
  return (
    <div className="card">
      <div className="grid-2">
        <Field label="Title" value={p.title} onChange={(title) => updateProject({ title })} serif />
        <Field label="Author name (for the manuscript)" value={p.author} onChange={(author) => updateProject({ author })} />
      </div>
      <Field label="Genre" value={b.genre} onChange={set('genre')} />
      <Field label="Premise" hint="In a few sentences: who, what happens, what's at stake." value={b.premise} onChange={set('premise')} long serif />
      <Field label="Themes" hint="What is the book really about, underneath the plot?" value={b.themes} onChange={set('themes')} long />
      <Field label="Setting" hint="Where and when. Specific details beat general ones." value={b.setting} onChange={set('setting')} long />
      <div className="grid-2">
        <Field label={<><Term k="pov">Point of view</Term> plan</>} hint='e.g. "Close third person, Nora only"' value={b.povPlan} onChange={set('povPlan')} />
        <Field label="Tense" hint='e.g. "Past tense"' value={b.tense} onChange={set('tense')} />
      </div>
      <Field label="Rules of this world" hint="What's realistic, what isn't, how the police work here…" value={b.rules} onChange={set('rules')} long />
      <Field label="Important objects" value={b.objects} onChange={set('objects')} long />
      <Field label="Major reveals" hint="The big turns, and roughly where they happen." value={b.majorReveals} onChange={set('majorReveals')} long />
      <Field label="Structure" hint="Optional. Any shape you have in mind. You don't need formal terms." value={b.structure} onChange={set('structure')} long />
      <div className="grid-2">
        <label className="field">
          <span className="lab">Planned number of chapters</span>
          <input className="input" type="number" min={1} value={p.targetChapters} onChange={(e) => updateProject({ targetChapters: Math.max(1, +e.target.value || 1) })} />
        </label>
        <label className="field">
          <span className="lab">Word goal</span>
          <input className="input" type="number" min={1000} step={1000} value={p.targetWords} onChange={(e) => updateProject({ targetWords: Math.max(1000, +e.target.value || 1000) })} />
        </label>
      </div>
    </div>
  );
}

const SLIDERS: { k: keyof Tone; label: string; low: string; high: string }[] = [
  { k: 'darkness', label: 'Darkness', low: 'Light', high: 'Very dark' },
  { k: 'psychological', label: 'Psychological intensity', low: 'Gentle', high: 'Intense' },
  { k: 'atmosphere', label: 'Atmosphere', low: 'Spare', high: 'Rich' },
  { k: 'complexity', label: 'Mystery complexity', low: 'Simple', high: 'Intricate' },
  { k: 'pace', label: 'Pace', low: 'Slow burn', high: 'Fast' },
  { k: 'romance', label: 'Romance', low: 'None', high: 'Central' },
  { k: 'violence', label: 'Violence', low: 'Off the page', high: 'Graphic' },
  { k: 'explicitness', label: 'Sexual explicitness', low: 'Fade to black', high: 'Explicit' },
];

function ToneTab() {
  const p = useProject();
  const t = p.tone;
  const set = (patch: Partial<Tone>) => updateProject({ tone: { ...p.tone, ...patch } });
  return (
    <>
      <div className="card">
        <h3>Creative controls</h3>
        <p className="muted small">These aren't quality scores. They tell your editor what kind of book you're writing, and it follows them in every suggestion.</p>
        <div style={{ marginTop: 18 }}>
          {SLIDERS.map((s) => (
            <div key={s.k}>
              <div className="slider-row">
                <span>{s.label}</span>
                <input type="range" min={0} max={10} value={t[s.k] as number} onChange={(e) => set({ [s.k]: +e.target.value })} aria-label={s.label} />
                <span className="val">{t[s.k]}</span>
              </div>
              <div className="slider-row" style={{ marginTop: -14 }}>
                <span />
                <div className="ends">
                  <span>{s.low}</span>
                  <span>{s.high}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>In your own words</h3>
        <Field label="How should it feel?" hint='e.g. "Disturbing but not gratuitous." Your editor remembers this.' value={t.description} onChange={(description) => set({ description })} long serif />
        <Field label="Style words" hint='e.g. "restrained, claustrophobic, literary but accessible". Describe a feel, not an author to copy.' value={t.styleWords} onChange={(styleWords) => set({ styleWords })} long />
        <Field label="Things you never want" hint="Your editor will steer clear of these." value={t.avoid} onChange={(avoid) => set({ avoid })} long />
      </div>
    </>
  );
}

function IdeasTab() {
  const p = useProject();
  const [filter, setFilter] = useState<CanonStatus | 'all'>('all');
  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState<IdeaCategory>('plot');
  const list = p.ideas.filter((i) => filter === 'all' || i.status === filter).slice().reverse();
  const counts = (s: CanonStatus) => p.ideas.filter((i) => i.status === s).length;

  return (
    <>
      <div className="card">
        <h3>Add an idea or decision</h3>
        <p className="muted small">
          Anything you've decided, or are considering. Ideas you save from your editor land here too. {STATUS_HELP.discarded}
        </p>
        <AutoTextarea className="input serif" value={draft} onChange={setDraft} placeholder='e.g. "The killer is someone Nora trusts."' />
        <div className="row" style={{ marginTop: 10 }}>
          <select className="input" style={{ width: 170 }} value={cat} onChange={(e) => setCat(e.target.value as IdeaCategory)}>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <button className="btn" disabled={!draft.trim()} onClick={() => (addItem('ideas', newIdea(draft.trim(), { category: cat, status: 'possibility' })), setDraft(''))}>
            Save as a possibility
          </button>
          <button className="btn primary" disabled={!draft.trim()} onClick={() => (addItem('ideas', newIdea(draft.trim(), { category: cat, status: 'canon' })), setDraft(''))}>
            <Icon name="check" size={16} /> It's decided
          </button>
        </div>
      </div>
      <div className="row" style={{ margin: '22px 0 12px' }}>
        {(['all', 'canon', 'possibility', 'draft', 'discarded'] as const).map((s) => (
          <button key={s} className={`chip${filter === s ? ' on' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? `All (${p.ideas.length})` : `${STATUS_LABEL[s]} (${counts(s)})`}
          </button>
        ))}
        <span className="spacer" />
        <AskButton action="think" label="Help me think" />
      </div>
      {list.length === 0 ? (
        <div className="empty">Nothing here yet.</div>
      ) : (
        <div className="card" style={{ padding: '4px 22px' }}>
          {list.map((i) => (
            <div key={i.id} className="list-row" style={{ opacity: i.status === 'discarded' ? 0.6 : 1 }}>
              <div style={{ flex: 1 }}>
                <AutoTextarea className="input serif" value={i.text} onChange={(text) => patchItem('ideas', i.id, { text })} minRows={1} />
                {(i.detail || i.source === 'ai') && (
                  <details style={{ marginTop: 4 }}>
                    <summary className="small muted" style={{ cursor: 'pointer' }}>
                      {i.source === 'ai' ? 'Suggested by your editor · details' : 'Details'}
                    </summary>
                    <AutoTextarea className="input small" value={i.detail} onChange={(detail) => patchItem('ideas', i.id, { detail })} />
                  </details>
                )}
              </div>
              <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                <StatusPicker value={i.status} onChange={(status) => patchItem('ideas', i.id, { status })} />
                <span className="tiny muted">{i.category}</span>
                <button className="btn ghost small" onClick={() => removeItem('ideas', i.id, 'Idea deleted.')} title="Delete">
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
