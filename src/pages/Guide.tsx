// "Your writing journey": a step-by-step guide through the studio's tools, in order.
import { useState } from 'react';
import { GUIDE, guideDone, nextStep, setGuideDone, type GuideStep } from '../story/guide';
import { setState, useApp, useProject } from '../story/store';
import { openEditor } from '../ai/session';
import { Icon, Modal } from '../components/ui';
import { LESSONS } from '../story/lessons';

export function startStep(i: number) {
  setState({ guideStep: i, page: GUIDE[i].page, focusMode: false });
  window.scrollTo(0, 0);
}

export function Guide() {
  const p = useProject();
  const [, force] = useState(0);
  const next = nextStep(p);
  const done = GUIDE.filter((s) => guideDone(p, s)).length;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Guide</div>
          <h1>Your writing journey</h1>
          <p className="lead">
            The tools in this studio, in the order that works best. Go at your own pace. Skip around, and come back any time using <b>Guide</b> in the menu.
          </p>
        </div>
        <div className="card" style={{ padding: '14px 20px', textAlign: 'center' }}>
          <div className="serif" style={{ fontSize: '2rem' }}>
            {done}/{GUIDE.length}
          </div>
          <div className="small muted">steps done</div>
        </div>
      </div>
      <div className="tl">
        {GUIDE.map((s, i) => (
          <StepCard key={s.id} s={s} i={i} current={i === next} onChange={() => force((n) => n + 1)} />
        ))}
      </div>
      <CraftCorner />
    </div>
  );
}

function CraftCorner() {
  const [open, setOpen] = useState<string | null>(null);
  const p = useProject();
  return (
    <>
      <div className="section-title">
        <h2>Craft corner</h2>
        <span className="small muted">Short lessons, a minute or two each</span>
      </div>
      <div className="grid-3">
        {LESSONS.map((l) => (
          <div key={l.id} className="card click" style={{ padding: '14px 18px' }} onClick={() => setOpen(open === l.id ? null : l.id)}>
            <div className="tiny muted">{l.minutes} min read</div>
            <div className="serif" style={{ fontSize: '1.15rem', lineHeight: 1.25 }}>{l.title}</div>
          </div>
        ))}
      </div>
      {open &&
        (() => {
          const l = LESSONS.find((x) => x.id === open)!;
          return (
            <Modal onClose={() => setOpen(null)}>
              <div className="eyebrow">Craft corner</div>
              <h2>{l.title}</h2>
              {l.body.map((b, i) => (
                <p key={i} style={{ lineHeight: 1.65 }}>{b}</p>
              ))}
              <div className="row" style={{ marginTop: 16 }}>
                <span className="spacer" />
                {l.tryIt && (
                  <button
                    className="btn primary"
                    onClick={() => {
                      setOpen(null);
                      const t = l.tryIt!;
                      if (t.page) setState({ page: t.page, guideStep: null });
                      if (t.action) {
                        setState({ page: ['write', 'improve', 'proseReview', 'tension', 'betaReader', 'scene'].includes(t.action) ? 'write' : 'home' });
                        openEditor({ actionId: t.action, variant: t.variant, chapterId: p.currentChapterId }, ['proseReview', 'fairness', 'betaReader', 'backwards', 'missing'].includes(t.action));
                      }
                    }}
                  >
                    Try it: {l.tryIt.label}
                  </button>
                )}
              </div>
            </Modal>
          );
        })()}
    </>
  );
}

function StepCard({ s, i, current, onChange }: { s: GuideStep; i: number; current: boolean; onChange: () => void }) {
  const p = useProject();
  const done = guideDone(p, s);
  const [open, setOpen] = useState(current);
  return (
    <div className={`tl-item${done ? '' : ' off'}`}>
      <div className="card" style={{ padding: '14px 20px', borderColor: current ? 'var(--accent)' : undefined, opacity: done && !open ? 0.75 : 1 }}>
        <div className="row" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
          <span className="tl-when">STEP {i + 1}</span>
          {done && <span className="pill canon">✓ Done</span>}
          {current && !done && <span className="pill accent">You are here</span>}
          <span className="spacer" />
          <span className="small muted">{open ? 'Hide' : 'Show'}</span>
        </div>
        <div className="serif" style={{ fontSize: '1.35rem', marginTop: 2 }}>{s.title}</div>
        {open && (
          <>
            <p className="muted" style={{ margin: '6px 0 10px' }}>{s.why}</p>
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.7 }}>
              {s.todo.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="row">
              <button className="btn primary" onClick={() => startStep(i)}>
                Take me there <Icon name="chevron" size={16} />
              </button>
              {s.ask && (
                <button
                  className="btn brass"
                  onClick={() => {
                    startStep(i);
                    openEditor({ actionId: s.ask!.action, request: s.ask!.request, chapterId: p.currentChapterId });
                  }}
                >
                  <Icon name="spark" size={16} /> {s.ask.label}
                </button>
              )}
              <span className="spacer" />
              <label className="row small" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={done}
                  disabled={s.check(p)}
                  onChange={(e) => {
                    setGuideDone(p, s.id, e.target.checked);
                    onChange();
                  }}
                />
                {s.check(p) ? 'Done (detected automatically)' : 'Mark as done'}
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Shown at the top of a page while following the guide: always a way back. */
export function GuideBanner() {
  const step = useApp((s) => s.guideStep);
  const page = useApp((s) => s.page);
  const p = useProject();
  if (step === null || page === 'guide' || GUIDE[step]?.page !== page) return null;
  const s = GUIDE[step];
  return (
    <div className="guide-banner">
      <span className="pill accent">Guide · Step {step + 1} of {GUIDE.length}</span>
      <b className="serif" style={{ fontSize: '1.1rem' }}>{s.title}</b>
      <span className="small muted guide-todo">{s.todo[0]}</span>
      <span className="spacer" />
      <button className="btn small" onClick={() => setState({ page: 'guide' })}>
        ← Back to guide
      </button>
      {step < GUIDE.length - 1 && (
        <button
          className="btn primary small"
          onClick={() => {
            if (!s.check(p)) setGuideDone(p, s.id, true);
            startStep(step + 1);
          }}
        >
          Next step →
        </button>
      )}
      <button className="btn ghost small" title="Hide the guide bar" onClick={() => setState({ guideStep: null })}>
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
