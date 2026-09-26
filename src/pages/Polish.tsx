// Polish: professional readiness. Free local checks first, then AI passes.
import { useMemo, useState } from 'react';
import { updateProject, useProject } from '../story/store';
import { healthReport, motifCounts, nameIssues, styleIssues } from '../editor/analysis';
import { openEditor } from '../ai/session';
import { AutoTextarea, ChapterSelect, Field, Icon } from '../components/ui';
import { Bars, Heat } from '../components/Chart';

type Tab = 'health' | 'style' | 'names' | 'motifs' | 'passes';

export function Polish() {
  const [tab, setTab] = useState<Tab>('health');
  const tabs: [Tab, string][] = [
    ['health', 'Manuscript health'],
    ['style', 'Style sheet'],
    ['names', 'Names'],
    ['motifs', 'Motifs'],
    ['passes', 'Proofread and final checks'],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Polish</div>
          <h1>Professional finish</h1>
          <p className="lead">The details agents and editors notice: length, consistency, names, recurring images, clean copy, and anything that needs permission. The first four tabs are free, instant and private.</p>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'health' && <Health />}
      {tab === 'style' && <Style />}
      {tab === 'names' && <Names />}
      {tab === 'motifs' && <Motifs />}
      {tab === 'passes' && <Passes />}
    </div>
  );
}

function Health() {
  const p = useProject();
  const r = useMemo(() => healthReport(p), [p]);
  return (
    <>
      <div className="card">
        <h3>Length</h3>
        <p>{r.verdict}</p>
        <div className="progress" style={{ margin: '8px 0' }}>
          <div style={{ width: `${Math.min(100, (r.total / 100000) * 100)}%` }} />
        </div>
        <div className="tiny muted">0 → 100,000 words</div>
      </div>
      <div className="card">
        <h3>Chapter lengths</h3>
        <p className="small muted">Average {r.mean.toLocaleString()} words. Thrillers often keep chapters short, around 1,500–4,000 words, to keep pages turning. Very long or very short chapters stand out.</p>
        <Bars values={r.stats.map((s) => s.words)} labels={r.stats.map((s) => `${s.n}. ${s.title}`)} />
        {r.outliers.length > 0 && <p className="small" style={{ marginTop: 8 }}>Unusually long or short: {r.outliers.map((o) => `Ch. ${o.n} (${o.words.toLocaleString()})`).join(', ')}.</p>}
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Dialogue and rhythm</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Ch.</th>
                <th>Dialogue</th>
                <th>Avg sentence</th>
                <th>POV</th>
              </tr>
            </thead>
            <tbody>
              {r.stats
                .filter((s) => s.words > 200)
                .map((s) => (
                  <tr key={s.n}>
                    <td>{s.n}</td>
                    <td>{s.dialoguePct}%</td>
                    <td>{s.avgSentence} words</td>
                    <td className="small">{s.pov || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="tiny muted">Thrillers often run 25–45% dialogue. Long stretches with very little dialogue can feel slow.</p>
        </div>
        <div className="card">
          <h3>Point of view balance</h3>
          <Bars values={r.povCounts.map(([, n]) => n)} labels={r.povCounts.map(([k]) => k)} color="var(--accent)" />
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Habit words across the book</h3>
          {r.crutch.length === 0 ? (
            <p className="small">Nothing overused. Well done.</p>
          ) : (
            <>
              <Bars values={r.crutch.map((c) => c.per10k)} labels={r.crutch.map((c) => `"${c.word}" (${c.count}×)`)} format={(v) => `${v} / 10k`} />
              <p className="tiny muted">How often per 10,000 words. Use Write → Find → "Whole book" to review them.</p>
            </>
          )}
        </div>
        <div className="card">
          <h3>Repeated phrases</h3>
          {r.repeated.length === 0 ? (
            <p className="small">No repeated phrases found.</p>
          ) : (
            <ul className="small" style={{ paddingLeft: 18 }}>
              {r.repeated.map(([g, n]) => (
                <li key={g}>
                  "{g}" ({n}×)
                </li>
              ))}
            </ul>
          )}
          <p className="tiny muted">Phrases of four or more words used three or more times. Readers notice these tics.</p>
        </div>
      </div>
    </>
  );
}

function Style() {
  const p = useProject();
  const issues = useMemo(() => styleIssues(p), [p]);
  return (
    <>
      <div className="card">
        <h3>Your style sheet</h3>
        <p className="small muted">Copyeditors keep a list of decisions so the whole book is consistent: spellings, how numbers are written, capitalisation, invented place names. Your editor follows it in every suggestion.</p>
        <AutoTextarea
          className="input"
          value={p.bible.styleSheet}
          onChange={(styleSheet) => updateProject({ bible: { ...p.bible, styleSheet } })}
          minRows={5}
          placeholder={'e.g.\nAmerican spelling (color, gray)\nNumbers spelled out (twenty-two years)\n"Mum" not "Mom"\nCarrick Bay, the Salt House (capital S, capital H)'}
        />
      </div>
      <div className="card">
        <h3>Inconsistencies found</h3>
        {issues.length === 0 ? (
          <div className="ok-box">No inconsistencies found.</div>
        ) : (
          issues.map((i) => (
            <div key={i.title} className="finding worth">
              <div className="ft">{i.title}</div>
              <div className="fd">{i.detail}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Names() {
  const p = useProject();
  const issues = useMemo(() => nameIssues(p), [p]);
  return (
    <div className="card">
      <h3>Could readers mix up any names?</h3>
      <p className="small muted">A classic editor's rule: give characters names that start with different letters and sound different, especially minor characters.</p>
      {issues.length === 0 ? (
        <div className="ok-box">Your character names are nicely distinct.</div>
      ) : (
        issues.map((i) => (
          <div key={i.title} className="finding worth">
            <div className="ft">{i.title}</div>
            <div className="fd">{i.detail}</div>
          </div>
        ))
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn brass" onClick={() => openEditor({ actionId: 'ask', request: 'Check my character names: are they right for their age, the era and the setting? Do any feel generic or anachronistic, or clash with each other? Suggest alternatives only where it would really help.' }, true)}>
          <Icon name="spark" size={16} /> Are the names right for the setting?
        </button>
      </div>
    </div>
  );
}

function Motifs() {
  const p = useProject();
  const rows = useMemo(() => motifCounts(p), [p]);
  const labels = p.chapters.map((_, i) => `${i + 1}`);
  return (
    <>
      <div className="card">
        <h3>Recurring images and objects</h3>
        <p className="small muted">Motifs (an object, an image or a phrase that returns, like the oilskin, the watch or the tide) give a book depth and make the ending resonate. List yours to see where they appear, and where they go quiet.</p>
        <Field label="Your motifs (separate with commas)" value={p.bible.motifs} onChange={(motifs) => updateProject({ bible: { ...p.bible, motifs } })} placeholder="oilskin, watch, tide, lighthouse, salt" />
      </div>
      {rows.length > 0 && (
        <div className="card">
          <h3>Where they appear (by chapter)</h3>
          <Heat labels={labels} rows={rows.map((r) => ({ label: r.motif, values: r.perChapter }))} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn brass" onClick={() => openEditor({ actionId: 'ask', request: `My motifs are: ${p.bible.motifs}. How could I use them more deliberately, especially planting them early, transforming their meaning in the middle, and paying them off in the final image? Be specific to my story.` }, true)}>
              <Icon name="spark" size={16} /> How can I use my motifs better?
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Passes() {
  const p = useProject();
  const [ch, setCh] = useState(p.currentChapterId);
  const chapter = p.chapters.find((c) => c.id === ch);
  return (
    <>
      <div className="card">
        <h3>Chapter-by-chapter passes</h3>
        <div className="row" style={{ margin: '10px 0' }}>
          <div style={{ width: 340 }}>
            <ChapterSelect p={p} value={ch} onChange={setCh} none="Choose a chapter…" />
          </div>
        </div>
        <div className="grid-3">
          <PassCard title="Proofread" blurb="Typos, grammar and punctuation only. Nothing else changes, and you accept each change." disabled={!chapter?.text.trim()} onClick={() => chapter && openEditor({ actionId: 'proofread', chapterId: chapter.id, selection: { chapterId: chapter.id, start: 0, end: chapter.text.length, text: chapter.text } }, true)} />
          <PassCard title="Voice drift check" blurb="Flags passages that don't sound like you, compared with your own earlier chapters." disabled={!chapter?.text.trim()} onClick={() => openEditor({ actionId: 'voiceDrift', chapterId: ch }, true)} />
          <PassCard title="Sensitivity read" blurb="How different backgrounds, disabilities and survivors are portrayed. Keeps it dark, not harmful." disabled={!chapter?.text.trim()} onClick={() => openEditor({ actionId: 'sensitivity', chapterId: ch }, true)} />
        </div>
      </div>
      <div className="card">
        <h3>Whole-book checks</h3>
        <div className="grid-3">
          <PassCard title="Permissions and legal flags" blurb="Song lyrics, poems, epigraphs, and real people or businesses. General information, not legal advice." onClick={() => openEditor({ actionId: 'permissions' }, true)} />
          <PassCard title="Content notes" blurb="A draft list of sensitive content, which publishers often ask for." onClick={() => openEditor({ actionId: 'contentNotes' }, true)} />
          <PassCard title="Continuity check" blurb="Who knows what, and who is where, against your story bible, for the chapter above." onClick={() => openEditor({ actionId: 'continuity', chapterId: ch }, true)} />
        </div>
      </div>
    </>
  );
}

function PassCard({ title, blurb, onClick, disabled }: { title: string; blurb: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'none' }}>
      <div className="serif" style={{ fontSize: '1.15rem' }}>{title}</div>
      <div className="small muted" style={{ flex: 1 }}>{blurb}</div>
      <button className="btn brass" disabled={disabled} onClick={onClick}>
        <Icon name="spark" size={16} /> Run
      </button>
    </div>
  );
}
