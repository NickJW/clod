// First launch: a friendly, skippable conversation that seeds the story bible.
import { useState } from 'react';
import { createProject, useApp, openProject, deleteProject, setState } from '../story/store';
import { newCharacter, newIdea, newProject } from '../story/factory';
import { demoProject } from '../story/seed';
import { AutoTextarea, Icon, confirmDialog, TourButton } from '../components/ui';
import { DriveOpenButton } from '../components/DrivePanel';
import { driveAvailable } from '../services/drive';
import { timeAgo } from '../story/reference';
import { readBackup } from '../services/exporter';
import { useSpeech } from '../editor/speech';
import { setPref } from '../storage/db';

const KINDS = ['Psychological thriller', 'Dark mystery', 'Crime / detective', 'Gothic mystery', 'Romantic suspense', 'Domestic suspense', 'Not sure yet'];

interface Answers {
  title: string;
  kinds: string[];
  know: string;
  heroName: string;
  hero: string;
  mystery: string;
  ending: string;
  feel: string;
  chatApp: 'chatgpt' | 'claude';
  chatWhere: 'app' | 'web';
}

export function Onboarding() {
  const projects = useApp((s) => s.projects);
  const startNew = useApp((s) => s.startNew);
  const [step, setStep] = useState(projects.length && !startNew ? -1 : 0);
  const [a, setA] = useState<Answers>({ title: '', kinds: [], know: '', heroName: '', hero: '', mystery: '', ending: '', feel: '', chatApp: 'chatgpt', chatWhere: 'app' });
  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }));

  if (step === -1)
    return (
      <div className="onboard">
        <div className="onboard-card">
          <div className="eyebrow">Nightjar · Novel studio</div>
          <h1>Welcome back</h1>
          <p className="muted">Choose a novel to open.</p>
          <div className="stack" style={{ margin: '20px 0' }}>
            {projects.map((pr) => (
              <div key={pr.id} className="card click row" onClick={() => openProject(pr.id)}>
                <Icon name="book" size={26} />
                <div>
                  <div className="serif" style={{ fontSize: '1.4rem' }}>{pr.title}</div>
                  <div className="small muted">
                    {pr.words.toLocaleString()} words · last edited {timeAgo(pr.updatedAt)}
                    {pr.isDemo ? ' · demo' : ''}
                  </div>
                </div>
                <span className="spacer" />
                <button
                  className="btn ghost small danger"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (await confirmDialog(`Delete “${pr.title}”?`, 'This removes it from this computer. If you have a backup file, you can restore it later. This can\'t be undone.', 'Delete forever', true))
                      await deleteProject(pr.id);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn primary big" onClick={() => setStep(0)}>
              Start a new novel
            </button>
            {!projects.some((x) => x.isDemo) && (
              <button className="btn big" onClick={() => createProject(demoProject())}>
                Open the demo novel
              </button>
            )}
            <DriveOpenButton />
            <RestoreButton />
          </div>
        </div>
      </div>
    );

  const steps = [
    {
      q: 'Let\'s build your novel.',
      body: (
        <>
          <p className="muted" style={{ fontSize: '1.1rem' }}>
            You bring the story. Nightjar keeps everything organised, and your AI editor helps you think, plan and polish, one piece at a time. You stay in charge of every decision.
          </p>
          <p className="muted">A few quick questions will get you started. You can skip any of them and change everything later.</p>
          <p>
            <TourButton className="btn" label="First, watch the 7-minute video tour" />
          </p>
          <label className="field">
            <span className="lab">Does your book have a working title?</span>
            <input className="input serif" value={a.title} onChange={(e) => set({ title: e.target.value })} placeholder="It's fine to leave this blank" autoFocus />
          </label>
        </>
      ),
    },
    {
      q: 'What kind of story are you writing?',
      body: (
        <div className="chips">
          {KINDS.map((k) => (
            <button key={k} className={`chip${a.kinds.includes(k) ? ' on' : ''}`} onClick={() => set({ kinds: a.kinds.includes(k) ? a.kinds.filter((x) => x !== k) : [...a.kinds, k] })}>
              {k}
            </button>
          ))}
        </div>
      ),
    },
    {
      q: 'What do you already know about your story?',
      body: <Voice value={a.know} onChange={(know) => set({ know })} placeholder="Anything at all: a setting, an image, a crime, a feeling, a scene you can already picture…" />,
    },
    {
      q: 'Do you have a main character?',
      body: (
        <>
          <label className="field">
            <span className="lab">Their name (if you know it)</span>
            <input className="input serif" value={a.heroName} onChange={(e) => set({ heroName: e.target.value })} />
          </label>
          <Voice value={a.hero} onChange={(hero) => set({ hero })} placeholder="Who are they? What do they want? What are they hiding?" />
        </>
      ),
    },
    { q: 'Do you have a mystery?', body: <Voice value={a.mystery} onChange={(mystery) => set({ mystery })} placeholder="What happened? Who might have done it? What's the secret at the centre?" /> },
    { q: 'Do you know how it ends?', body: <Voice value={a.ending} onChange={(ending) => set({ ending })} placeholder="It's completely fine not to know yet." /> },
    { q: 'How should it feel to read?', body: <Voice value={a.feel} onChange={(feel) => set({ feel })} placeholder='e.g. "Disturbing but not gratuitous. Slow-burn. Claustrophobic small town."' /> },
  ];

  const finish = async () => {
    setPref('chatApp', a.chatApp);
    setPref('chatWhere', a.chatWhere);
    setPref('chatAppChosen', true);
    const p = newProject(a.title.trim() || 'My Novel');
    if (a.kinds.length) p.bible.genre = a.kinds.filter((k) => k !== 'Not sure yet').join(' / ') || p.bible.genre;
    p.bible.premise = a.know.trim();
    if (a.mystery.trim()) p.mystery.centralQuestion = a.mystery.trim();
    if (a.ending.trim()) p.ending.resolution = a.ending.trim();
    if (a.feel.trim()) p.tone.description = a.feel.trim();
    if (a.heroName.trim() || a.hero.trim()) {
      const c = newCharacter(a.heroName.trim() || 'My main character', { role: 'Protagonist', fields: { personality: a.hero.trim() } });
      p.characters.push(c);
      p.chapters[0].povCharacterId = c.id;
    }
    if (a.mystery.trim()) p.ideas.push(newIdea(a.mystery.trim(), { status: 'draft', category: 'mystery' }));
    await createProject(p);
    setState({ page: 'guide' });
  };

  const cur = steps[step];
  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="steps">
          {steps.map((_, i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        {step === 0 ? <h1>{cur.q}</h1> : <div className="q">{cur.q}</div>}
        <div style={{ margin: '18px 0 26px' }}>{cur.body}</div>
        <div className="row">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <span className="spacer" />
          {step === 0 && (
            <button className="btn" onClick={() => { const demo = projects.find((x) => x.isDemo); void (demo ? openProject(demo.id) : createProject(demoProject())); }} title="A finished example novel to explore">
              Explore a demo novel first
            </button>
          )}
          {step > 0 && step < steps.length - 1 && (
            <button className="btn ghost" onClick={() => setStep(step + 1)}>
              Skip
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className="btn primary big" onClick={() => setStep(step + 1)}>
              Continue
            </button>
          ) : (
            <button className="btn primary big" onClick={finish}>
              Open my novel
            </button>
          )}
        </div>
        {step === 0 && projects.length > 0 && (
          <p style={{ marginTop: 24 }}>
            <button className="btn ghost small" onClick={() => setStep(-1)}>
              ← Back to my novels
            </button>
          </p>
        )}
        {step === 0 && !projects.length && (
          <p className="small muted" style={{ marginTop: 26 }}>
            Moving from another computer? <RestoreButton link />
          </p>
        )}
        {step === 0 && !projects.length && driveAvailable() && (
          <div style={{ marginTop: 10 }}>
            <DriveOpenButton className="btn" />
          </div>
        )}
      </div>
    </div>
  );
}

function Voice({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const s = useSpeech((t) => onChange((value ? value.replace(/\s*$/, ' ') : '') + t));
  return (
    <div>
      <AutoTextarea className="input serif" value={value} onChange={onChange} placeholder={placeholder} minRows={4} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className={`btn small${s.listening ? ' on' : ''}`} onClick={s.toggle}>
          <Icon name="mic" size={16} /> {s.listening ? 'Stop talking' : 'Talk instead of typing'}
        </button>
        {s.interim && <span className="small muted">{s.interim}…</span>}
        {s.error && <span className="small" style={{ color: 'var(--danger)' }}>{s.error}</span>}
      </div>
    </div>
  );
}

export function RestoreButton({ link }: { link?: boolean }) {
  return (
    <label className={link ? '' : 'btn big'} style={link ? { color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' } : {}}>
      {link ? 'Restore from a backup file' : 'Restore a backup'}
      <input
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const p = await readBackup(f);
            await createProject(p);
          } catch (err) {
            alert((err as Error).message);
          }
          e.target.value = '';
        }}
      />
    </label>
  );
}
