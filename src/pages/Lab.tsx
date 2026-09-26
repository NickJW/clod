// Story Lab: make the book gripping, fair and unforgettable.
// Whole-book analyses are run on request and saved, so the charts stay until she re-runs them.
import { useState } from 'react';
import type { Project } from '../types';
import { updateProject, useProject } from '../story/store';
import { extractJson, openEditor, runQuiet } from '../ai/session';
import { ACTIONS, type ActionId, type JobInput } from '../ai/actions';
import { AIError, getAISettings } from '../ai/provider';
import { AutoTextarea, ChapterSelect, Empty, Icon } from '../components/ui';
import { Heat, LineChart } from '../components/Chart';
import { timeAgo } from '../story/reference';

type Tab = 'turner' | 'solve' | 'tests' | 'opening' | 'letter';

export function Lab() {
  const [tab, setTab] = useState<Tab>('turner');
  const tabs: [Tab, string][] = [
    ['turner', 'Page-turner'],
    ['solve', 'Solvability test'],
    ['tests', 'Stress tests'],
    ['opening', 'Opening pages'],
    ['letter', 'Editorial letter'],
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Story Lab</div>
          <h1>Make it unputdownable</h1>
          <p className="lead">Tools that read your whole book the way readers and agents will: where it grips, where it sags, whether the mystery is fair, and what makes it memorable.</p>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'turner' && <PageTurner />}
      {tab === 'solve' && <Solvability />}
      {tab === 'tests' && <StressTests />}
      {tab === 'opening' && <Opening />}
      {tab === 'letter' && <Letter />}
    </div>
  );
}

/** Run a whole-book analysis and keep the parsed result in the project. */
function useAnalysis(key: 'bookAnalysis' | 'solvability') {
  const p = useProject();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const saved = p.lab[key];
  const run = async () => {
    if (!getAISettings().apiKey) return setErr('Connect your AI editor in Settings first.');
    setBusy(true);
    setErr('');
    try {
      const text = await runQuiet({ actionId: key });
      const data = extractJson(text);
      if (!data || typeof data !== 'object') throw new AIError('The answer came back in an unexpected shape. Please try again.', 'other');
      updateProject((cur) => ({ lab: { ...cur.lab, [key]: { at: Date.now(), data } } }));
    } catch (e) {
      setErr(e instanceof AIError ? e.message : 'Something went wrong. Please try again.');
    }
    setBusy(false);
  };
  return { saved, busy, err, run };
}

function RunBar({ label, busy, err, at, run, note }: { label: string; busy: boolean; err: string; at?: number; run: () => void; note: string }) {
  return (
    <div className="card row" style={{ marginBottom: 18 }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div className="small muted">{note}</div>
        {at ? <div className="tiny muted" style={{ marginTop: 4 }}>Last run {timeAgo(at)}. Re-run after you've written or revised more.</div> : null}
        {err && <div className="err-box" style={{ marginTop: 8 }}>{err}</div>}
      </div>
      <button className="btn primary" disabled={busy} onClick={run}>
        <Icon name="spark" size={16} /> {busy ? 'Reading your whole book… (up to a minute)' : at ? `Run ${label} again` : `Run ${label}`}
      </button>
    </div>
  );
}

interface ChapterScore {
  chapter: number;
  keepReading: number;
  tension: number;
  endingHook: number;
  emotions: Record<string, number>;
  raised: string[];
  answered: string[];
  putDownRisk: string;
}

function PageTurner() {
  const p = useProject();
  const a = useAnalysis('bookAnalysis');
  const data = a.saved?.data as { chapters?: ChapterScore[]; overall?: string; sags?: string[]; strengths?: string[] } | undefined;
  const ch = (data?.chapters ?? []).filter((c) => typeof c.chapter === 'number');
  const labels = ch.map((c) => `Ch ${c.chapter}`);
  const emotions = ['dread', 'curiosity', 'grief', 'warmth', 'desire', 'relief', 'humour'];
  let open = 0;
  const openQ = ch.map((c) => (open = Math.max(0, open + (c.raised?.length ?? 0) - (c.answered?.length ?? 0))));
  return (
    <>
      <RunBar
        label="the page-turner analysis"
        {...a}
        at={a.saved?.at}
        note="A reader who knows only what's on the page reads every chapter and scores it: would they read one more chapter tonight? It also maps tension, emotions, and the questions that keep readers turning pages. Uses chapter summaries and each chapter's opening and closing pages."
      />
      {!data ? (
        <Empty title="No analysis yet">
          <p>Run it once you have a few chapters written. It works best when your chapters have summaries (Scenes & Outline → Update summaries).</p>
        </Empty>
      ) : (
        <>
          {data.overall && <p className="serif" style={{ fontSize: '1.15rem' }}>{data.overall}</p>}
          <div className="card">
            <h3>Put-down risk</h3>
            <p className="small muted">Red columns are where a reader might stop (score under 5). "Would read on" is the one that matters most.</p>
            <LineChart
              labels={labels}
              highlight={(i) => (ch[i]?.keepReading ?? 10) < 5}
              series={[
                { label: 'Would read on', color: 'var(--accent)', values: ch.map((c) => c.keepReading) },
                { label: 'Tension', color: 'var(--brass)', values: ch.map((c) => c.tension) },
                { label: 'Chapter ending', color: 'var(--ok)', values: ch.map((c) => c.endingHook), dashed: true },
              ]}
            />
            <div className="grid-2" style={{ marginTop: 12 }}>
              {!!data.sags?.length && (
                <div>
                  <b className="small">Where it sags</b>
                  <ul className="small" style={{ paddingLeft: 18 }}>
                    {data.sags.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!data.strengths?.length && (
                <div>
                  <b className="small">What grips</b>
                  <ul className="small" style={{ paddingLeft: 18 }}>
                    {data.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <table className="table" style={{ marginTop: 10 }}>
              <tbody>
                {ch.map((c) => (
                  <tr key={c.chapter}>
                    <td style={{ width: 60 }}>Ch {c.chapter}</td>
                    <td className="small">{c.putDownRisk && c.putDownRisk !== 'none' ? c.putDownRisk : <span className="muted">No put-down risk noted</span>}</td>
                    <td style={{ width: 120 }}>
                      <button className="btn ghost small" onClick={() => openEditor({ actionId: 'readerPanel', chapterId: p.chapters[c.chapter - 1]?.id }, true)}>
                        Reader panel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Emotional rollercoaster</h3>
            <p className="small muted">Dark books tire readers when every chapter carries the same note. Look for stretches that need relief, warmth or a spark of humour, or a sharper jolt.</p>
            <Heat labels={labels} rows={emotions.map((e) => ({ label: e[0].toUpperCase() + e.slice(1), values: ch.map((c) => Math.round(c.emotions?.[e] ?? 0)) }))} />
          </div>
          <div className="card">
            <h3>Reader question ledger</h3>
            <p className="small muted">Open questions are what make people turn pages. Keep a few open at all times, and answer some as you raise new ones.</p>
            <LineChart labels={labels} max={Math.max(5, ...openQ)} series={[{ label: 'Questions the reader is carrying', color: 'var(--accent)', values: openQ }]} highlight={(i) => openQ[i] === 0} />
            <table className="table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Chapter</th>
                  <th>Questions raised</th>
                  <th>Questions answered</th>
                </tr>
              </thead>
              <tbody>
                {ch.map((c) => (
                  <tr key={c.chapter}>
                    <td>{c.chapter}</td>
                    <td className="small">{(c.raised ?? []).map((q, i) => <div key={i}>• {q}</div>)}{!c.raised?.length && <span className="err-box" style={{ padding: '2px 6px' }}>None raised</span>}</td>
                    <td className="small">{(c.answered ?? []).map((q, i) => <div key={i}>✓ {q}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

interface Guess {
  reader: string;
  suspect: string;
  confidence: number;
  why: string;
}

function Solvability() {
  const p = useProject();
  const a = useAnalysis('solvability');
  const data = a.saved?.data as { chapters?: { chapter: number; guesses: Guess[] }[] } | undefined;
  const ch = data?.chapters ?? [];
  const culprit = p.mystery.culprit.trim().toLowerCase();
  const isRight = (g: Guess) => !!culprit && culprit.split(/\s+/).some((w) => w.length > 2 && g.suspect?.toLowerCase().includes(w));
  const readers = ['casual', 'fan', 'expert'];
  const solvedAt = ch.find((c) => c.guesses.filter((g) => isRight(g) && g.confidence >= 60).length >= 2)?.chapter;
  const total = p.chapters.length;
  return (
    <>
      <RunBar
        label="the solvability test"
        {...a}
        at={a.saved?.at}
        note="Three simulated readers (casual, genre fan, puzzle expert) guess the culprit after each chapter, knowing only what's been revealed. It shows when readers crack your mystery. Too early and the ending falls flat. Never, and it may feel unfair."
      />
      {!culprit && <div className="note-box" style={{ marginBottom: 12 }}>Write who did it in Mystery → The truth, so the test can tell which guesses are right.</div>}
      {!data ? (
        <Empty title="No test yet" />
      ) : (
        <>
          <div className="card">
            <h3>{solvedAt ? `Most readers crack it by Chapter ${solvedAt} of ${total}` : culprit ? 'Readers haven\'t confidently solved it yet' : 'Guesses by chapter'}</h3>
            <p className="small muted">
              {solvedAt
                ? solvedAt / Math.max(total, p.targetChapters) < 0.6
                  ? 'That\'s early for a thriller. Consider stronger misdirection or delaying a key clue.'
                  : 'That\'s a satisfying point: late enough to surprise, early enough to feel fair.'
                : 'If readers never get close, check that genuine clues are on the page before the reveal.'}
            </p>
            <LineChart
              labels={ch.map((c) => `Ch ${c.chapter}`)}
              max={100}
              series={readers.map((r, k) => ({
                label: `${r[0].toUpperCase() + r.slice(1)} reader's confidence`,
                color: ['var(--brass)', 'var(--accent)', 'var(--ok)'][k],
                values: ch.map((c) => c.guesses.find((g) => g.reader.toLowerCase().includes(r))?.confidence ?? null),
              }))}
              highlight={(i) => ch[i]?.guesses.some((g) => isRight(g) && g.confidence >= 60) ?? false}
            />
            <p className="tiny muted">Red columns: at least one reader correctly and confidently names the culprit.</p>
          </div>
          <div className="card" style={{ padding: '6px 18px' }}>
            {ch.map((c) => (
              <div key={c.chapter} className="list-row">
                <b style={{ width: 70 }}>Ch {c.chapter}</b>
                <div style={{ flex: 1 }}>
                  {c.guesses.map((g, i) => (
                    <div key={i} className="small">
                      <b>{g.reader}:</b> {g.suspect} ({g.confidence}%){isRight(g) && <span className="pill canon" style={{ marginLeft: 6 }}>correct</span>}
                      <span className="muted">: {g.why}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ToolGrid({ tools }: { tools: { id: ActionId; run?: boolean; input?: Partial<JobInput> }[] }) {
  return (
    <div className="grid-3">
      {tools.map((t) => (
        <div key={t.id + (t.input?.variant ?? '')} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="serif" style={{ fontSize: '1.2rem' }}>{ACTIONS[t.id].label}</div>
          <div className="small muted" style={{ flex: 1 }}>{ACTIONS[t.id].blurb}</div>
          <button className="btn brass" onClick={() => openEditor({ actionId: t.id, ...t.input }, t.run !== false)}>
            <Icon name="spark" size={16} /> {t.run === false ? 'Open' : 'Run'}
          </button>
        </div>
      ))}
    </div>
  );
}

function StressTests() {
  const p = useProject();
  return (
    <>
      <h3 style={{ margin: '4px 0 10px' }}>Is it gripping?</h3>
      <ToolGrid tools={[{ id: 'setPieces' }, { id: 'twistImpact' }, { id: 'rootForHer' }, { id: 'chemistry' }, { id: 'wordOfMouth' }, { id: 'altEndings' }]} />
      <h3 style={{ margin: '26px 0 10px' }}>Does it hold up?</h3>
      <ToolGrid tools={[{ id: 'killerCounter' }, { id: 'plotHoles' }, { id: 'detective' }, { id: 'characterArcs' }, { id: 'dialogueVoices', input: { chapterId: p.currentChapterId } }]} />
      <h3 style={{ margin: '26px 0 10px' }}>Is the concept strong?</h3>
      <ToolGrid tools={[{ id: 'premiseTest' }, { id: 'hookAmplifier' }, { id: 'genrePromise' }]} />
      <h3 style={{ margin: '26px 0 10px' }}>Learn from a book you love</h3>
      <LearnFrom />
    </>
  );
}

function LearnFrom() {
  const [text, setText] = useState('');
  return (
    <div className="card">
      <p className="small muted">Paste a short passage (a page or less) from a novel you admire. Your editor explains how it works and shows how to use the technique, not the author's style, in your current chapter.</p>
      <AutoTextarea className="input serif" value={text} onChange={setText} minRows={4} placeholder="Paste a passage…" />
      <div className="row" style={{ marginTop: 10 }}>
        <span className="spacer" />
        <button className="btn primary" disabled={text.trim().length < 80} onClick={() => openEditor({ actionId: 'learnFrom', request: text }, true)}>
          <Icon name="spark" size={16} /> Show me how it works
        </button>
      </div>
    </div>
  );
}

function Opening() {
  const p = useProject();
  const first = p.chapters.find((c) => c.text.trim());
  const firstLine = first?.text.trim().split(/(?<=[.!?])\s/)[0] ?? '';
  const [ch, setCh] = useState(first?.id ?? '');
  return (
    <>
      <div className="card">
        <div className="eyebrow">Your first line</div>
        <p className="serif" style={{ fontSize: '1.5rem', margin: '8px 0 4px' }}>{firstLine || <span className="muted">Not written yet.</span>}</p>
        <p className="small muted">Most agents decide on the first page, many on the first paragraph. Your opening has to promise the whole book: voice, genre, a question, and a person we want to follow.</p>
      </div>
      <ToolGrid tools={[{ id: 'firstPages' }, { id: 'firstLine' }, { id: 'readerPanel', input: { chapterId: first?.id } }, { id: 'genrePromise' }]} />
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Reader panel for any chapter</h3>
        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ width: 320 }}>
            <ChapterSelect p={p} value={ch} onChange={setCh} none="Choose a chapter…" />
          </div>
          <button className="btn brass" disabled={!ch} onClick={() => openEditor({ actionId: 'readerPanel', chapterId: ch }, true)}>
            <Icon name="spark" size={16} /> Ask the panel
          </button>
        </div>
      </div>
    </>
  );
}

function Letter() {
  const p = useProject() as Project;
  return (
    <div className="card">
      <h3>A professional editorial letter</h3>
      <p className="muted">
        Publishers' editors send authors a letter after reading a manuscript: what's working, the three biggest opportunities, and a plan for revising. Your editor writes one for your book, using every chapter summary and a sample of each chapter. It's best after you've finished a draft, or every third of the way through.
      </p>
      <p className="small muted">{p.chapters.filter((c) => c.text.trim()).length} of {p.chapters.length} chapters have text. Save the letter to your Notes when it arrives.</p>
      <button className="btn primary" onClick={() => openEditor({ actionId: 'editorialLetter' }, true)}>
        <Icon name="spark" size={16} /> Write my editorial letter
      </button>
    </div>
  );
}
