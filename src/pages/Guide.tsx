// "Your writing journey": a step-by-step guide through the studio's tools, in order.
import { useState } from 'react';
import { GUIDE, guideDone, nextStep, setGuideDone, type GuideStep } from '../story/guide';
import { setState, useApp, useProject } from '../story/store';
import { openEditor } from '../ai/session';
import { Icon } from '../components/ui';

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
    </div>
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
