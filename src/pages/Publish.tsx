// Publish: market fit, pitch materials, agents, submissions, self-publishing and human help.
import { useState } from 'react';
import type { Agent, AgentStatus, Publishing } from '../types';
import { toast, updateProject, useProject } from '../story/store';
import { uid } from '../story/factory';
import { openEditor } from '../ai/session';
import { ACTIONS, type ActionId, type JobInput } from '../ai/actions';
import { AutoTextarea, Field, Icon, confirmDialog } from '../components/ui';
import { downloadBlob, exportReaderPacket, exportSubmissionPackage, safeName, type SubmissionOptions } from '../services/exporter';
import { buildEpub } from '../services/epub';
import { countWords, manuscriptWords } from '../story/reference';

type Tab = 'market' | 'pitch' | 'agents' | 'submit' | 'self' | 'people';

export function Publish() {
  const [tab, setTab] = useState<Tab>('market');
  const tabs: [Tab, string][] = [
    ['market', 'Market fit'],
    ['pitch', 'Pitch materials'],
    ['agents', 'Agents'],
    ['submit', 'Submission package'],
    ['people', 'Human readers'],
    ['self', 'Self-publishing'],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Publish</div>
          <h1>From manuscript to published book</h1>
          <p className="lead">Everything for the business side: where your book fits, your pitch, finding agents, and a professional submission. Tools marked "web search" look up real, current information, with source links to check.</p>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'market' && <Market />}
      {tab === 'pitch' && <Pitch />}
      {tab === 'agents' && <Agents />}
      {tab === 'submit' && <Submit />}
      {tab === 'people' && <People />}
      {tab === 'self' && <SelfPub />}
    </div>
  );
}

const SEARCH_TOOLS = new Set<ActionId>(['trends', 'pitchComps', 'titleLab', 'agentMatch', 'contests']);

function Tools({ tools }: { tools: { id: ActionId; input?: Partial<JobInput>; label?: string }[] }) {
  return (
    <div className="grid-3">
      {tools.map((t) => (
        <div key={t.id + (t.input?.variant ?? '')} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="serif" style={{ fontSize: '1.15rem' }}>
            {t.label ?? ACTIONS[t.id].label}
            {SEARCH_TOOLS.has(t.id) && <span className="pill neutral" style={{ marginLeft: 6 }}>web search</span>}
          </div>
          <div className="small muted" style={{ flex: 1 }}>{ACTIONS[t.id].blurb}</div>
          <button className="btn brass" onClick={() => openEditor({ actionId: t.id, ...t.input }, !ACTIONS[t.id].needs || ACTIONS[t.id].needs === 'selection-or-chapter')}>
            <Icon name="spark" size={16} /> Run
          </button>
        </div>
      ))}
    </div>
  );
}

function Market() {
  return (
    <>
      <Tools tools={[{ id: 'trends' }, { id: 'pitchComps' }, { id: 'genrePromise' }, { id: 'readerProfile' }, { id: 'titleLab' }, { id: 'coverBrief' }, { id: 'premiseTest' }, { id: 'hookAmplifier' }, { id: 'seriesPotential' }]} />
      <p className="tiny muted" style={{ marginTop: 12 }}>Web search works with Google Gemini. With other AI choices, answers come from the AI's memory and must be checked.</p>
    </>
  );
}

const PITCH_FIELDS: { k: keyof Publishing; label: string; hint: string; gen?: { id: ActionId; variant?: string } }[] = [
  { k: 'logline', label: 'Logline', hint: 'One sentence: who, what they want, what stands in the way, what\'s at stake.', gen: { id: 'pitch', variant: 'logline' } },
  { k: 'blurb', label: 'Back-cover blurb', hint: '150–200 words, no spoilers.', gen: { id: 'pitch', variant: 'blurb' } },
  { k: 'comps', label: 'Comparable titles', hint: 'Two or three real books from the last ~5 years, e.g. "for readers of X and Y".', gen: { id: 'pitchComps' } },
  { k: 'bio', label: 'Your short bio', hint: 'A few warm sentences. Life experience that connects to the book is gold.' },
  { k: 'query', label: 'Query letter', hint: '250–350 words: hook, story and stakes, then title, genre, word count and comps, then bio.', gen: { id: 'queryBuilder' } },
  { k: 'synopsis', label: 'Synopsis', hint: 'About one page, present tense, INCLUDING the ending. Agents want to know it works.', gen: { id: 'pitch', variant: 'synopsis' } },
];

function Pitch() {
  const p = useProject();
  const set = (k: keyof Publishing, v: string) => updateProject({ publishing: { ...p.publishing, [k]: v } });
  return (
    <>
      <p className="muted">Your pitch materials, kept together. Ask your editor for a draft, rewrite it in your own words, and paste it here. Answers in the editor panel also have a "Save to…" button.</p>
      {PITCH_FIELDS.map((f) => (
        <div key={f.k} className="card">
          <div className="row">
            <h3>{f.label}</h3>
            <span className="small muted">{countWords(String(p.publishing[f.k] ?? ''))} words</span>
            <span className="spacer" />
            {f.gen && (
              <button className="btn brass small" onClick={() => openEditor({ actionId: f.gen!.id, variant: f.gen!.variant }, true)}>
                <Icon name="spark" size={15} /> Draft it
              </button>
            )}
            {f.k === 'query' && p.publishing.query.trim() && (
              <button className="btn small" onClick={() => openEditor({ actionId: 'queryPanel', request: p.publishing.query }, true)}>
                <Icon name="spark" size={15} /> Test on the agent panel
              </button>
            )}
          </div>
          <p className="small muted">{f.hint}</p>
          <AutoTextarea className="input serif" value={String(p.publishing[f.k] ?? '')} onChange={(v) => set(f.k, v)} minRows={f.k === 'query' || f.k === 'synopsis' ? 8 : 2} />
        </div>
      ))}
    </>
  );
}

const STATUSES: AgentStatus[] = ['researching', 'queried', 'requested', 'rejected', 'no response', 'offer'];

function Agents() {
  const p = useProject();
  const agents = p.publishing.agents;
  const save = (list: Agent[]) => updateProject({ publishing: { ...p.publishing, agents: list } });
  const patch = (id: string, x: Partial<Agent>) => save(agents.map((a) => (a.id === id ? { ...a, ...x } : a)));
  const count = (s: AgentStatus) => agents.filter((a) => a.status === s).length;
  return (
    <>
      <div className="card row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <b>Find agents who represent books like yours</b>
          <div className="small muted">Uses web search for real agents and their wishlists, with links. Always check each agency's current submission guidelines before querying.</div>
        </div>
        <button className="btn brass" onClick={() => openEditor({ actionId: 'agentMatch' }, true)}>
          <Icon name="spark" size={16} /> Find agents
        </button>
        <button className="btn" onClick={() => openEditor({ actionId: 'contests' }, true)}>
          Contests and pitch events
        </button>
      </div>
      <div className="row" style={{ margin: '18px 0 10px' }}>
        <h3>Your submission tracker</h3>
        <span className="small muted">
          {agents.length} agents · {count('queried')} queried · {count('requested')} requests · {count('offer')} offers
        </span>
        <span className="spacer" />
        <button className="btn primary small" onClick={() => save([...agents, { id: uid(), name: '', agency: '', link: '', status: 'researching', queriedOn: '', notes: '' }])}>
          <Icon name="plus" size={15} /> Add an agent
        </button>
      </div>
      <p className="small muted">Most published authors queried dozens of agents. Rejections are normal. Send in small batches of 8–10, and revise if a batch gets no requests.</p>
      {agents.map((a) => (
        <div key={a.id} className="card">
          <div className="grid-2">
            <Field label="Agent" value={a.name} onChange={(name) => patch(a.id, { name })} />
            <Field label="Agency" value={a.agency} onChange={(agency) => patch(a.id, { agency })} />
            <Field label="Link (wishlist or submission page)" value={a.link} onChange={(link) => patch(a.id, { link })} />
            <label className="field">
              <span className="lab">Status</span>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <select className="input" value={a.status} onChange={(e) => patch(a.id, { status: e.target.value as AgentStatus, queriedOn: e.target.value === 'queried' && !a.queriedOn ? new Date().toISOString().slice(0, 10) : a.queriedOn })}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <input className="input" type="date" value={a.queriedOn} onChange={(e) => patch(a.id, { queriedOn: e.target.value })} title="Date queried" />
              </div>
            </label>
          </div>
          <Field label="Notes (what they want, personal line for the query)" value={a.notes} onChange={(notes) => patch(a.id, { notes })} long />
          <div className="row">
            {/^https?:\/\//.test(a.link) && (
              <a className="btn small" href={a.link} target="_blank" rel="noreferrer">
                Open link
              </a>
            )}
            <span className="spacer" />
            <button
              className="btn ghost small danger"
              onClick={async () => (await confirmDialog('Remove this agent?', a.name || 'This entry will be removed.', 'Remove', true)) && save(agents.filter((x) => x.id !== a.id))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function Submit() {
  const p = useProject();
  const [o, setO] = useState<SubmissionOptions>({ chapters: 3, spacing: 'double', font: 'Times New Roman', includeQuery: true, includeSynopsis: true });
  const words = p.chapters.slice(0, o.chapters).reduce((n, c) => n + countWords(c.text), 0);
  return (
    <div className="card">
      <h3>Submission package</h3>
      <p className="small muted">One Word document with your query letter, synopsis and opening chapters, formatted the way agents expect. Every agent's guidelines differ (for example "first 10 pages" or "first three chapters"), so adjust below.</p>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <label className="field">
          <span className="lab">Opening chapters to include</span>
          <input className="input" type="number" min={1} max={p.chapters.length} value={o.chapters} onChange={(e) => setO({ ...o, chapters: Math.max(1, +e.target.value || 1) })} />
          <span className="hint">≈ {words.toLocaleString()} words, about {Math.round(words / 250)} manuscript pages</span>
        </label>
        <label className="field">
          <span className="lab">Line spacing and font</span>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <select className="input" value={o.spacing} onChange={(e) => setO({ ...o, spacing: e.target.value as SubmissionOptions['spacing'] })}>
              <option value="double">Double-spaced (standard)</option>
              <option value="1.5">1.5 spacing</option>
            </select>
            <select className="input" value={o.font} onChange={(e) => setO({ ...o, font: e.target.value as SubmissionOptions['font'] })}>
              <option>Times New Roman</option>
              <option>Courier New</option>
              <option>Arial</option>
            </select>
          </div>
        </label>
      </div>
      <label className="row small" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={o.includeQuery} onChange={(e) => setO({ ...o, includeQuery: e.target.checked })} /> Include query letter {!p.publishing.query.trim() && <span className="muted">(not written yet: see Pitch materials)</span>}
      </label>
      <label className="row small" style={{ cursor: 'pointer', marginTop: 6 }}>
        <input type="checkbox" checked={o.includeSynopsis} onChange={(e) => setO({ ...o, includeSynopsis: e.target.checked })} /> Include synopsis {!p.publishing.synopsis.trim() && <span className="muted">(not written yet)</span>}
      </label>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={() => exportSubmissionPackage(p, o)}>
          <Icon name="download" size={16} /> Download submission package (.docx)
        </button>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>Before sending: run Polish → Proofread on these chapters, and check the Opening pages tab in Story Lab.</p>
    </div>
  );
}

function People() {
  const p = useProject();
  const [picked, setPicked] = useState<string[]>(p.chapters.filter((c) => c.text.trim()).slice(0, 3).map((c) => c.id));
  const [questions, setQuestions] = useState(
    'Where did you feel like putting the book down?\nWas anything confusing?\nWho did you suspect, and when?\nWhich character did you care about most, and least?\nWhat do you think happens next?',
  );
  return (
    <>
      <div className="card">
        <h3>Why human readers matter most</h3>
        <p className="small">
          Nothing improves a manuscript like honest human readers. Most published authors used several before querying:
        </p>
        <ul className="small" style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li><b>Beta readers</b> (free): 3–6 people who read thrillers, ideally not close family, since family is too kind. Try local library groups, online crime-fiction reading groups, and writing communities.</li>
          <li><b>A critique group</b> (free): writers who swap chapters regularly. Local writers' centres and crime-writing associations often run them.</li>
          <li><b>A freelance developmental editor</b> (paid, often several hundred to a few thousand dollars for a full manuscript): worth considering once the draft is complete and self-revised. Check their published credits and testimonials, ask for a sample edit, and be wary of anyone promising publication.</li>
        </ul>
      </div>
      <div className="card">
        <h3>Send chapters to a reader</h3>
        <p className="small muted">Creates a clean Word document with the chapters you choose and your questions at the end.</p>
        <div className="chips" style={{ margin: '10px 0' }}>
          {p.chapters.map((c, i) => {
            const on = picked.includes(c.id);
            return (
              <button key={c.id} className={`chip${on ? ' on' : ''}`} onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}>
                {i + 1}. {c.title}
              </button>
            );
          })}
        </div>
        <label className="field">
          <span className="lab">Questions for your reader (one per line)</span>
          <AutoTextarea className="input" value={questions} onChange={setQuestions} minRows={4} />
        </label>
        <button className="btn primary" disabled={!picked.length} onClick={() => exportReaderPacket(p, picked, questions)}>
          <Icon name="download" size={16} /> Download reader packet (.docx)
        </button>
      </div>
      <div className="card row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <b>Got feedback back?</b>
          <div className="small muted">Paste your readers' comments. Your editor groups them into themes, and separates what to act on from matters of taste.</div>
        </div>
        <button className="btn brass" onClick={() => openEditor({ actionId: 'humanFeedback' })}>
          <Icon name="spark" size={16} /> Make sense of feedback
        </button>
      </div>
    </>
  );
}

function SelfPub() {
  const p = useProject();
  return (
    <>
      <div className="card">
        <h3>If you choose to publish it yourself</h3>
        <p className="small muted">Many successful thriller writers self-publish, or do so after querying. You'll need an e-book file, a cover, and a store listing.</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn primary"
            onClick={() => {
              if (manuscriptWords(p) < 1000) return toast('Write a little more first. Your book is nearly empty.', 'error');
              downloadBlob(`${safeName(p.title)}.epub`, buildEpub(p));
            }}
          >
            <Icon name="download" size={16} /> Download e-book (.epub)
          </button>
          <span className="small muted">Opens in Apple Books and Google Play Books, and can be uploaded to most e-book stores. Check it in a free EPUB viewer first.</span>
        </div>
      </div>
      <Tools tools={[{ id: 'storeListing' }, { id: 'coverBrief' }, { id: 'titleLab' }]} />
    </>
  );
}
