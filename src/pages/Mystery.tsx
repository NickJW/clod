// The mystery board: the hidden truth, clues and red herrings, secrets,
// who-knows-what, what the reader knows by each chapter, and the twist workshop.
import { useState } from 'react';
import type { Belief, Clue, ClueKind, MysteryTruth, Project, Secret } from '../types';
import { addItem, patchItem, removeItem, updateProject, useProject } from '../story/store';
import { newBelief, newClue, newFact, newSecret } from '../story/factory';
import { chapterLabel, characterName, chapterNumber } from '../story/reference';
import { openEditor } from '../ai/session';
import { TWIST_KINDS } from '../ai/actions';
import { AskButton, AutoTextarea, ChapterSelect, CharacterChips, CharacterSelect, Empty, Field, Icon, Modal, StatusPicker, Term } from '../components/ui';

type Tab = 'truth' | 'clues' | 'secrets' | 'knows' | 'reader' | 'twists';

export function Mystery() {
  const p = useProject();
  const [tab, setTab] = useState<Tab>('clues');
  const warnings = localWarnings(p);
  const tabs: [Tab, string][] = [
    ['clues', `Clues & red herrings (${p.clues.length})`],
    ['truth', 'The truth'],
    ['secrets', `Secrets (${p.secrets.length})`],
    ['knows', 'Who knows what'],
    ['reader', 'What the reader knows'],
    ['twists', 'Twists'],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Mystery board</div>
          <h1>{p.mystery.centralQuestion || 'Your mystery'}</h1>
          <p className="lead">Keep track of what really happened, what everyone believes, and what the reader knows, so every reveal is earned.</p>
        </div>
        <div className="row">
          <AskButton action="mysteryCheck" label="Check my mystery" run />
          <AskButton action="fairness" label="Is it fair?" run />
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="card" style={{ background: 'var(--warn-soft)', marginBottom: 20 }}>
          <b>Things you might want to look at</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {warnings.map((w, i) => (
              <li key={i} className="small">{w}</li>
            ))}
          </ul>
          <div className="tiny muted" style={{ marginTop: 6 }}>Quick checks on your board. They're free and don't use AI. They're not rules. Leave anything that's intentional.</div>
        </div>
      )}
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'truth' && <Truth />}
      {tab === 'clues' && <Clues />}
      {tab === 'secrets' && <Secrets />}
      {tab === 'knows' && <Knows />}
      {tab === 'reader' && <ReaderKnows />}
      {tab === 'twists' && <Twists />}
    </div>
  );
}

function localWarnings(p: Project): string[] {
  const w: string[] = [];
  const m = p.mystery;
  if (!m.culprit.trim() && p.clues.length) w.push('You haven\'t written down who did it (in "The truth"). It\'s fine not to know yet, but your editor can check clue fairness better once you do.');
  for (const c of p.clues) {
    if (c.status === 'discarded') continue;
    if (c.kind !== 'genuine' && !c.trueExplanation.trim()) w.push(`The ${c.kind === 'red-herring' ? 'red herring' : 'misleading clue'} "${c.title}" has no innocent explanation yet. Readers will want one.`);
    if (!c.appearsChapterId) w.push(`"${c.title}" isn't placed in a chapter yet.`);
  }
  const culprit = m.culprit.trim().split(/\s+/)[0]?.toLowerCase();
  if (culprit && culprit.length > 2) {
    const pointing = p.clues.filter((c) => c.kind === 'genuine' && c.status !== 'discarded' && c.pointsTo.toLowerCase().includes(culprit));
    if (pointing.length === 0) w.push(`No genuine clue points toward ${m.culprit}. The reveal may feel unearned.`);
    const early = pointing.filter((c) => c.appearsChapterId && chapterNumber(p, c.appearsChapterId) <= 3);
    if (pointing.length >= 3 && early.length === pointing.length) w.push(`Every clue pointing at ${m.culprit} appears in the first three chapters. Attentive readers may solve it early.`);
  }
  const reveal = p.secrets.filter((s) => s.status !== 'discarded' && s.hiddenFromReader && !s.revealChapterId);
  if (reveal.length) w.push(`${reveal.length} secret${reveal.length > 1 ? 's are' : ' is'} hidden from the reader with no reveal chapter yet. That's fine if it stays hidden on purpose.`);
  return w;
}

function Truth() {
  const p = useProject();
  const m = p.mystery;
  const set = (k: keyof MysteryTruth) => (v: string) => updateProject({ mystery: { ...p.mystery, [k]: v } });
  return (
    <div className="card">
      <p className="muted small">
        Your private notes on what <i>really</i> happened. The reader won't see this. Your editor uses it to keep clues and reveals consistent. Leave blank anything you haven't decided.
      </p>
      <Field label="The central question" hint='What the reader most wants to know. e.g. "How did Tess really die?"' value={m.centralQuestion} onChange={set('centralQuestion')} serif />
      <h3 style={{ margin: '18px 0 10px' }}>Who</h3>
      <div className="grid-2">
        <Field label="Who did it" value={m.culprit} onChange={set('culprit')} />
        <Field label="Who is lying" value={m.whoIsLying} onChange={set('whoIsLying')} long />
      </div>
      <Field label="Who is being manipulated" value={m.whoIsManipulated} onChange={set('whoIsManipulated')} long />
      <h3 style={{ margin: '18px 0 10px' }}>What</h3>
      <Field label="What actually happened" value={m.whatHappened} onChange={set('whatHappened')} long serif />
      <Field label="What appears to have happened" value={m.whatAppears} onChange={set('whatAppears')} long />
      <Field label="What the characters believe happened" value={m.whatCharactersBelieve} onChange={set('whatCharactersBelieve')} long />
      <h3 style={{ margin: '18px 0 10px' }}>When, why and how</h3>
      <Field label="When it really happened" value={m.when} onChange={set('when')} long />
      <div className="grid-2">
        <Field label="Motive" value={m.motive} onChange={set('motive')} long />
        <Field label="Other people with motives" value={m.competingMotives} onChange={set('competingMotives')} long />
        <Field label="Method" value={m.method} onChange={set('method')} long />
        <Field label="Opportunity" value={m.opportunity} onChange={set('opportunity')} long />
        <Field label="Evidence" value={m.evidence} onChange={set('evidence')} long />
        <Field label="The cover-up" value={m.coverUp} onChange={set('coverUp')} long />
      </div>
    </div>
  );
}

const KIND_LABEL: Record<ClueKind, string> = { genuine: 'Genuine clue', misleading: 'Misleading', 'red-herring': 'Red herring' };

function Clues() {
  const p = useProject();
  const [edit, setEdit] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClueKind | 'all'>('all');
  const list = p.clues.filter((c) => filter === 'all' || c.kind === filter);
  const clue = p.clues.find((c) => c.id === edit);
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        {(['all', 'genuine', 'misleading', 'red-herring'] as const).map((k) => (
          <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>
            {k === 'all' ? 'All' : k === 'red-herring' ? <Term k="red herring">Red herrings</Term> : KIND_LABEL[k]}
          </button>
        ))}
        <span className="spacer" />
        <button
          className="btn primary"
          onClick={() => {
            const c = newClue({ kind: filter === 'all' ? 'genuine' : filter });
            addItem('clues', c);
            setEdit(c.id);
          }}
        >
          <Icon name="plus" size={16} /> Add a clue
        </button>
      </div>
      {list.length === 0 ? (
        <Empty title="No clues yet">
          <p>Clues are anything the reader (or a character) notices that points toward the truth, or away from it.</p>
        </Empty>
      ) : (
        <div className="board">
          {list.map((c) => (
            <div key={c.id} className={`clue ${c.kind}`} onClick={() => setEdit(c.id)} style={{ opacity: c.status === 'discarded' ? 0.5 : 1 }}>
              <div className="row" style={{ gap: 6 }}>
                <span className="tiny muted" style={{ fontWeight: 600, letterSpacing: '.05em' }}>{KIND_LABEL[c.kind].toUpperCase()}</span>
                <span className="spacer" />
                {c.status !== 'canon' && <span className={`pill ${c.status}`}>{c.status}</span>}
              </div>
              <div className="ct">{c.title}</div>
              <div className="cd">{c.description.slice(0, 160)}</div>
              {c.pointsTo && <div className="small">→ Points to <b>{c.pointsTo}</b></div>}
              <div className="tiny muted" style={{ marginTop: 6 }}>
                {c.appearsChapterId ? `Appears ${chapterLabel(p, c.appearsChapterId)}` : 'Not placed yet'}
                {c.resolvedChapterId ? ` · explained ${chapterLabel(p, c.resolvedChapterId)}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
      {clue && <ClueEditor c={clue} onClose={() => setEdit(null)} />}
    </>
  );
}

function ClueEditor({ c, onClose }: { c: Clue; onClose: () => void }) {
  const p = useProject();
  const set = (patch: Partial<Clue>) => patchItem('clues', c.id, patch);
  return (
    <Modal onClose={onClose} wide>
      <div className="row">
        <input className="title-input" value={c.title} onChange={(e) => set({ title: e.target.value })} aria-label="Clue name" />
        <StatusPicker value={c.status} onChange={(status) => set({ status })} />
      </div>
      <div className="chips" style={{ margin: '14px 0' }}>
        {(['genuine', 'misleading', 'red-herring'] as ClueKind[]).map((k) => (
          <button key={k} className={`chip${c.kind === k ? ' on' : ''}`} onClick={() => set({ kind: k })}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: -6 }}>
        Genuine: points toward the truth. Misleading: true, but easy to misread. Red herring: points toward the wrong answer.
      </p>
      <Field label="What is it?" value={c.description} onChange={(description) => set({ description })} long serif />
      <div className="grid-2">
        <Field label="What it points toward" hint="A person, place, or idea" value={c.pointsTo} onChange={(pointsTo) => set({ pointsTo })} />
        <Field label="Why it matters" value={c.significance} onChange={(significance) => set({ significance })} long />
      </div>
      {c.kind !== 'genuine' && <Field label="The innocent (true) explanation" hint="Every red herring needs one, or readers feel cheated." value={c.trueExplanation} onChange={(trueExplanation) => set({ trueExplanation })} long />}
      <div className="grid-2">
        <label className="field">
          <span className="lab">When the reader first sees it</span>
          <ChapterSelect p={p} value={c.appearsChapterId} onChange={(appearsChapterId) => set({ appearsChapterId })} />
        </label>
        <label className="field">
          <span className="lab">When it's explained</span>
          <ChapterSelect p={p} value={c.resolvedChapterId} onChange={(resolvedChapterId) => set({ resolvedChapterId })} none="Not yet" />
        </label>
      </div>
      <label className="field">
        <span className="lab">Which characters know about it</span>
        <CharacterChips p={p} value={c.whoKnowsIds} onChange={(whoKnowsIds) => set({ whoKnowsIds })} />
      </label>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn ghost danger" onClick={() => (removeItem('clues', c.id, 'Clue deleted.'), onClose())}>
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

function Secrets() {
  const p = useProject();
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="muted small">Who is hiding what, from whom, and when it comes out.</span>
        <span className="spacer" />
        <button className="btn primary" onClick={() => addItem('secrets', newSecret())}>
          <Icon name="plus" size={16} /> Add a secret
        </button>
      </div>
      {p.secrets.length === 0 && <Empty title="No secrets yet" />}
      {p.secrets.map((s) => (
        <SecretCard key={s.id} s={s} />
      ))}
    </>
  );
}

function SecretCard({ s }: { s: Secret }) {
  const p = useProject();
  const set = (patch: Partial<Secret>) => patchItem('secrets', s.id, patch);
  return (
    <details className="group">
      <summary>
        <div>
          <h3>{s.title}</h3>
          <div className="small muted">
            Held by {s.holderIds.map((id) => characterName(p, id)).join(', ') || 'nobody yet'} · {s.hiddenFromReader ? 'hidden from the reader' : 'the reader knows'}
            {s.revealChapterId ? ` · revealed ${chapterLabel(p, s.revealChapterId)}` : ''}
          </div>
        </div>
        <StatusPicker value={s.status} onChange={(status) => set({ status })} />
      </summary>
      <div className="inner">
        <Field label="Name" value={s.title} onChange={(title) => set({ title })} />
        <Field label="The secret" value={s.description} onChange={(description) => set({ description })} long serif />
        <label className="field">
          <span className="lab">Who knows it</span>
          <CharacterChips p={p} value={s.holderIds} onChange={(holderIds) => set({ holderIds })} />
        </label>
        <label className="field">
          <span className="lab">Who it's hidden from</span>
          <CharacterChips p={p} value={s.hiddenFromIds} onChange={(hiddenFromIds) => set({ hiddenFromIds })} />
        </label>
        <label className="row small" style={{ marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.hiddenFromReader} onChange={(e) => set({ hiddenFromReader: e.target.checked })} /> Hidden from the reader too
        </label>
        <div className="grid-2">
          <label className="field">
            <span className="lab">When it comes out</span>
            <ChapterSelect p={p} value={s.revealChapterId} onChange={(revealChapterId) => set({ revealChapterId })} none="Not decided" />
          </label>
          <Field label="What happens if it comes out too early?" value={s.ifRevealed} onChange={(ifRevealed) => set({ ifRevealed })} long />
        </div>
        <button className="btn ghost small danger" onClick={() => removeItem('secrets', s.id, 'Secret deleted.')}>
          Delete secret
        </button>
      </div>
    </details>
  );
}

function Knows() {
  const p = useProject();
  const [who, setWho] = useState('');
  return (
    <>
      <h3>Who knows about each clue</h3>
      <p className="muted small">Tick who knows. This helps your editor stop a character from "discovering" something they already know.</p>
      {p.clues.length && p.characters.length ? (
        <div className="matrix card" style={{ padding: 12 }}>
          <table>
            <thead>
              <tr>
                <th />
                {p.characters.map((c) => (
                  <th key={c.id}>{c.name.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.clues.map((cl) => (
                <tr key={cl.id}>
                  <th className="rowh">{cl.title}</th>
                  {p.characters.map((c) => {
                    const yes = cl.whoKnowsIds.includes(c.id);
                    return (
                      <td
                        key={c.id}
                        className={yes ? 'yes' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => patchItem('clues', cl.id, { whoKnowsIds: yes ? cl.whoKnowsIds.filter((x) => x !== c.id) : [...cl.whoKnowsIds, c.id] })}
                        title={`${c.name} ${yes ? 'knows' : 'doesn\'t know'}. Click to change.`}
                      >
                        {yes ? '✓' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Add clues and characters to see this grid" />
      )}

      <div className="section-title">
        <h2>What each character believes</h2>
        <div className="row">
          <div style={{ width: 220 }}>
            <CharacterSelect p={p} value={who} onChange={setWho} none="Choose a character…" />
          </div>
          <button className="btn primary" disabled={!who} onClick={() => addItem('beliefs', newBelief(who))}>
            <Icon name="plus" size={16} /> Add a belief
          </button>
        </div>
      </div>
      <p className="muted small">Beliefs can be wrong, and that's where tension comes from.</p>
      {p.beliefs.length === 0 && <Empty title="No beliefs recorded yet" />}
      {p.beliefs.length > 0 && (
        <div className="card" style={{ padding: '4px 20px' }}>
          {p.beliefs.map((b) => (
            <BeliefRow key={b.id} b={b} />
          ))}
        </div>
      )}
    </>
  );
}

function BeliefRow({ b }: { b: Belief }) {
  const p = useProject();
  const set = (patch: Partial<Belief>) => patchItem('beliefs', b.id, patch);
  return (
    <div className="list-row">
      <b style={{ width: 130, flex: 'none' }}>{characterName(p, b.characterId)}</b>
      <div style={{ flex: 1 }}>
        <AutoTextarea className="input" value={b.belief} onChange={(belief) => set({ belief })} placeholder="believes that…" minRows={1} />
        <div className="row" style={{ marginTop: 6 }}>
          <select className="status-select" value={b.truth} onChange={(e) => set({ truth: e.target.value as Belief['truth'] })}>
            <option value="unknown">True or false? Undecided</option>
            <option value="true">It's true</option>
            <option value="false">It's false</option>
            <option value="partly">Partly true</option>
          </select>
          <div style={{ width: 220 }}>
            <ChapterSelect p={p} value={b.sinceChapterId} onChange={(sinceChapterId) => set({ sinceChapterId })} none="Since: from the start" />
          </div>
        </div>
      </div>
      <button className="btn ghost small" onClick={() => removeItem('beliefs', b.id, 'Belief removed.')}>
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

function ReaderKnows() {
  const p = useProject();
  const [draft, setDraft] = useState('');
  // Gather everything the reader learns, chapter by chapter.
  const byChapter = p.chapters.map((ch) => ({
    ch,
    facts: p.facts.filter((f) => f.readerLearnsChapterId === ch.id),
    clues: p.clues.filter((c) => c.appearsChapterId === ch.id && c.status !== 'discarded'),
    secrets: p.secrets.filter((s) => s.revealChapterId === ch.id && s.status !== 'discarded'),
  }));
  const unplaced = p.facts.filter((f) => !f.readerLearnsChapterId);
  return (
    <>
      <div className="card">
        <h3>Facts of the story</h3>
        <p className="muted small">Things that are objectively true, and the chapter where the reader finds out.</p>
        <div className="row">
          <input className="input" style={{ flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Tess died on land, not in the water." />
          <button className="btn primary" disabled={!draft.trim()} onClick={() => (addItem('facts', newFact(draft.trim())), setDraft(''))}>
            Add
          </button>
        </div>
        {p.facts.map((f) => (
          <div key={f.id} className="list-row">
            <AutoTextarea className="input" value={f.text} onChange={(text) => patchItem('facts', f.id, { text })} minRows={1} />
            <div style={{ width: 240, flex: 'none' }}>
              <ChapterSelect p={p} value={f.readerLearnsChapterId} onChange={(readerLearnsChapterId) => patchItem('facts', f.id, { readerLearnsChapterId })} none="Reader not told yet" />
            </div>
            <StatusPicker value={f.status} onChange={(status) => patchItem('facts', f.id, { status })} />
            <button className="btn ghost small" onClick={() => removeItem('facts', f.id, 'Fact removed.')}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="section-title">
        <h2>The reader's journey</h2>
      </div>
      <div className="tl">
        {byChapter.map(({ ch, facts, clues, secrets }, i) => (
          <div key={ch.id} className={`tl-item${facts.length + clues.length + secrets.length ? '' : ' off'}`}>
            <div className="card" style={{ padding: '12px 16px' }}>
              <div className="tl-when">CHAPTER {i + 1}</div>
              <div className="serif" style={{ fontSize: '1.15rem' }}>{ch.title}</div>
              {facts.length + clues.length + secrets.length === 0 ? (
                <div className="small muted">Nothing new about the mystery is revealed here (yet).</div>
              ) : (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }} className="small">
                  {clues.map((c) => (
                    <li key={c.id}>
                      Sees {c.kind === 'genuine' ? 'clue' : c.kind === 'red-herring' ? 'red herring' : 'misleading clue'}: <b>{c.title}</b>
                    </li>
                  ))}
                  {facts.map((f) => (
                    <li key={f.id}>Learns: {f.text}</li>
                  ))}
                  {secrets.map((s) => (
                    <li key={s.id}>
                      Secret revealed: <b>{s.title}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
      {unplaced.length > 0 && <p className="small muted">{unplaced.length} fact(s) the reader hasn't been told yet.</p>}
    </>
  );
}

function Twists() {
  const p = useProject();
  const [kind, setKind] = useState('Any kind');
  const [note, setNote] = useState('');
  const twists = p.ideas.filter((i) => i.category === 'twist');
  return (
    <>
      <div className="card">
        <h3>Twist workshop</h3>
        <p className="muted small">
          Twists built from <i>your</i> story. Each comes with what the reader believes, what's actually true, the clues to plant, and the risks. Save the ones you like as possibilities.
        </p>
        <div className="chips" style={{ margin: '12px 0' }}>
          {TWIST_KINDS.map((k) => (
            <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: anything the twist should involve, or avoid" />
        <div className="row" style={{ marginTop: 12 }}>
          <span className="spacer" />
          <button className="btn primary" onClick={() => openEditor({ actionId: 'twist', variant: kind, request: note }, true)}>
            <Icon name="spark" size={16} /> Suggest twists
          </button>
        </div>
      </div>
      <div className="section-title">
        <h2>Your twist ideas</h2>
      </div>
      {twists.length === 0 ? (
        <Empty title="No twists saved yet" />
      ) : (
        <div className="card" style={{ padding: '4px 20px' }}>
          {twists.map((i) => (
            <div key={i.id} className="list-row">
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: '1.1rem' }}>{i.text}</div>
                {i.detail && (
                  <details>
                    <summary className="small muted" style={{ cursor: 'pointer' }}>Details</summary>
                    <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{i.detail}</div>
                  </details>
                )}
              </div>
              <StatusPicker value={i.status} onChange={(status) => patchItem('ideas', i.id, { status })} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
