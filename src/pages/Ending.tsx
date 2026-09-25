// The ending workspace: how everything resolves, and what's still dangling.
import type { Ending as EndingT, Project } from '../types';
import { updateProject, useProject } from '../story/store';
import { AskButton, Field } from '../components/ui';
import { chapterLabel } from '../story/reference';

function openThreads(p: Project): string[] {
  const out: string[] = [];
  for (const c of p.clues) if (c.status !== 'discarded' && !c.resolvedChapterId) out.push(`${c.kind === 'red-herring' ? 'Red herring' : 'Clue'}: "${c.title}" is never explained`);
  for (const s of p.secrets) if (s.status !== 'discarded' && s.hiddenFromReader && !s.revealChapterId) out.push(`Secret: "${s.title}" is never revealed`);
  for (const i of p.ideas) if (i.status === 'possibility' && i.category === 'mystery') out.push(`Undecided: ${i.text}`);
  return out;
}

export function Ending() {
  const p = useProject();
  const e = p.ending;
  const set = (k: keyof EndingT) => (v: string) => updateProject({ ending: { ...p.ending, [k]: v } });
  const threads = openThreads(p);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Ending</div>
          <h1>How it all resolves</h1>
          <p className="lead">It's fine not to know yet. Many writers discover their ending by writing toward it. Fill in what you know.</p>
        </div>
        <div className="row">
          <AskButton action="backwards" label="Plan backwards from my ending" run className="btn primary" />
          <AskButton action="endingCheck" label="Check my ending" run />
        </div>
      </div>
      <div className="char-layout">
        <div className="card">
          <Field label="How the central mystery is resolved" hint={p.mystery.centralQuestion ? `Your central question: "${p.mystery.centralQuestion}"` : undefined} value={e.resolution} onChange={set('resolution')} long serif />
          <Field label="Where each main character ends up" value={e.characterArcs} onChange={set('characterArcs')} long />
          <Field label="The romance" value={e.romance} onChange={set('romance')} long />
          <Field label="Which secrets come out, and how" value={e.secrets} onChange={set('secrets')} long />
          <Field label="What stays ambiguous on purpose" hint="Some questions are stronger left open. Your editor won't treat these as mistakes." value={e.intentionallyAmbiguous} onChange={set('intentionallyAmbiguous')} long />
          <Field label="Threads you know are still open" value={e.unresolved} onChange={set('unresolved')} long />
          <Field label="What the ending says about your theme" value={e.theme} onChange={set('theme')} long />
          <Field label="The final image" hint="The last thing the reader sees." value={e.finalImage} onChange={set('finalImage')} long serif />
          <Field label="The emotional aftermath" hint="How should the reader feel when they close the book?" value={e.aftermath} onChange={set('aftermath')} long />
        </div>
        <div className="sticky-side">
          <div className="card">
            <h3 style={{ fontSize: '1.1rem' }}>Loose threads on your board</h3>
            <p className="tiny muted">From your clues and secrets. A free quick check that doesn't use AI.</p>
            {threads.length === 0 ? (
              <p className="small">Nothing obviously dangling.</p>
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0 }} className="small">
                {threads.map((t, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{t}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem' }}>Working backwards</h3>
            <p className="small muted">Many mystery writers plan from the ending: decide the solution, then plant what the reader needs to see along the way. Your editor can lay out that path, chapter by chapter.</p>
          </div>
          <div className="card stack" style={{ gap: 8 }}>
            <h3 style={{ fontSize: '1.1rem' }}>When you're ready to share</h3>
            <AskButton action="pitch" label="A one-line logline" input={{ variant: 'logline' }} run />
            <AskButton action="pitch" label="A back-cover blurb" input={{ variant: 'blurb' }} run />
            <AskButton action="pitch" label="A one-page synopsis" input={{ variant: 'synopsis' }} run />
          </div>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem' }}>Where reveals land</h3>
            {p.secrets.filter((s) => s.revealChapterId).length === 0 ? (
              <p className="small muted">No reveals placed yet.</p>
            ) : (
              p.secrets
                .filter((s) => s.revealChapterId)
                .map((s) => (
                  <div key={s.id} className="small" style={{ padding: '3px 0' }}>
                    <b>{chapterLabel(p, s.revealChapterId)}</b>: {s.title}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
