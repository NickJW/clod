// Settings: connect the AI editor, appearance, export/import, backups, privacy.
import { useEffect, useState } from 'react';
import { PROVIDERS, getAISettings, getProvider, getUsage, resetUsage, saveAISettings } from '../ai/provider';
import { AIError } from '../ai/errors';
import { getPref, listSnapshots, setPref, type Snapshot } from '../storage/db';
import { addItem, closeProject, createProject, toast, updateProject, useApp, useProject } from '../story/store';
import { newChapter, normalizeProject, uid } from '../story/factory';
import { demoProject } from '../story/seed';
import { timeAgo } from '../story/reference';
import {
  backupProject,
  exportManuscriptDocx,
  exportManuscriptText,
  exportMarkdown,
  fileNames,
  markdownToDocx,
  notesMarkdown,
  printManuscript,
  readBackup,
  readManuscriptFile,
  splitChapters,
  storyBibleMarkdown,
} from '../services/exporter';
import { Icon, confirmDialog } from '../components/ui';

export function applyAppearance() {
  const root = document.documentElement;
  root.dataset.theme = getPref('theme', 'light');
  root.dataset.textsize = getPref('textSize', 'normal');
  root.style.setProperty('--ms-size', `${getPref('msSize', 21)}px`);
  const fonts: Record<string, string> = {
    garamond: "'EB Garamond', Georgia, serif",
    georgia: "Georgia, 'Times New Roman', serif",
    sans: "'Inter', system-ui, sans-serif",
  };
  root.style.setProperty('--ms-font', fonts[getPref('msFont', 'garamond')] ?? fonts.garamond);
}

export function Settings() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Settings & Backup</div>
          <h1>Settings</h1>
        </div>
      </div>
      <AISection />
      <Appearance />
      <ExportSection />
      <ImportSection />
      <SafetySection />
      <ProjectsSection />
      <Privacy />
    </div>
  );
}

function AISection() {
  const [s, setS] = useState(getAISettings());
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<'' | 'testing' | 'ok' | string>('');
  const usage = getUsage();
  const provider = getProvider(s.providerId);
  const save = (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveAISettings(next);
  };

  const runTest = async () => {
    setTest('testing');
    try {
      await provider.complete({ system: 'Reply with the single word: ready', context: '', messages: [{ role: 'user', content: 'Are you there?' }], maxTokens: 10, creativity: 0 }, s);
      setTest('ok');
    } catch (e) {
      setTest(e instanceof AIError ? e.message : 'Something went wrong.');
    }
  };

  return (
    <div className="card" id="ai">
      <h2>Your AI editor</h2>
      <p className="muted">
        Nightjar uses Claude as your editor. It connects directly from this computer to Anthropic with your own key. There's no middleman, and you pay Anthropic only for what you use.
      </p>
      {!s.apiKey && (
        <div className="note-box" style={{ margin: '12px 0 18px' }}>
          <b>How to connect (about 2 minutes, one time only):</b>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              Go to{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>{' '}
              and sign up or sign in.
            </li>
            <li>Add some credit under Billing. A small amount lasts a long time for writing help.</li>
            <li>Under "API keys", click "Create key", give it a name like "Nightjar", and copy it.</li>
            <li>Paste it in the box below. That's it.</li>
          </ol>
        </div>
      )}
      <label className="field">
        <span className="lab">Your key</span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" type={showKey ? 'text' : 'password'} value={s.apiKey} onChange={(e) => save({ apiKey: e.target.value.trim() })} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} />
          <button className="btn small" onClick={() => setShowKey(!showKey)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button className="btn primary" disabled={!s.apiKey || test === 'testing'} onClick={runTest}>
            {test === 'testing' ? 'Checking…' : 'Test connection'}
          </button>
        </div>
        <span className="hint" style={{ marginTop: 6 }}>Stored only in this browser on this computer. Never included in backups or exports.</span>
      </label>
      {test === 'ok' && <div className="ok-box">✓ Connected. Your editor is ready.</div>}
      {test && test !== 'ok' && test !== 'testing' && <div className="err-box">{test}</div>}

      <div className="grid-2" style={{ marginTop: 18 }}>
        <label className="field">
          <span className="lab">Model</span>
          <select className="input" value={s.model} onChange={(e) => save({ model: e.target.value })}>
            {PROVIDERS.flatMap((pr) => pr.models).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}: {m.note}
              </option>
            ))}
          </select>
          <span className="hint" style={{ marginTop: 6 }}>Chapter summaries always use the faster, cheaper model.</span>
        </label>
        <label className="field">
          <span className="lab">Creativity: {s.creativity < 0.4 ? 'careful' : s.creativity > 0.8 ? 'adventurous' : 'balanced'}</span>
          <input type="range" min={0} max={1} step={0.05} value={s.creativity} onChange={(e) => save({ creativity: +e.target.value })} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          <span className="hint">Affects brainstorming and prose. Checks and analysis always stay careful.</span>
        </label>
      </div>
      <div className="small muted">
        Used on this computer since {new Date(usage.since).toLocaleDateString()}: {usage.requests} requests, about {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens.{' '}
        For exact costs, see your usage at console.anthropic.com.{' '}
        <button className="btn ghost small" onClick={() => (resetUsage(), toast('Counter reset.'))}>
          Reset counter
        </button>
      </div>
    </div>
  );
}

function Appearance() {
  const [, force] = useState(0);
  const set = <T,>(k: string, v: T) => {
    setPref(k, v);
    applyAppearance();
    force((n) => n + 1);
  };
  const theme = getPref<string>('theme', 'light');
  const size = getPref<string>('textSize', 'normal');
  const font = getPref<string>('msFont', 'garamond');
  const ms = getPref('msSize', 21);
  const first = getPref('firstTime', true);
  return (
    <div className="card">
      <h2>Appearance</h2>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="field">
          <span className="lab">Colours</span>
          <div className="chips">
            <button className={`chip${theme === 'light' ? ' on' : ''}`} onClick={() => set('theme', 'light')}>
              Warm ivory
            </button>
            <button className={`chip${theme === 'dark' ? ' on' : ''}`} onClick={() => set('theme', 'dark')}>
              Evening (dark)
            </button>
          </div>
        </div>
        <div className="field">
          <span className="lab">Size of buttons and labels</span>
          <div className="chips">
            {(['normal', 'large', 'larger'] as const).map((x) => (
              <button key={x} className={`chip${size === x ? ' on' : ''}`} onClick={() => set('textSize', x)}>
                {x[0].toUpperCase() + x.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="lab">Manuscript font</span>
          <div className="chips">
            {[
              ['garamond', 'Garamond'],
              ['georgia', 'Georgia'],
              ['sans', 'Plain'],
            ].map(([k, l]) => (
              <button key={k} className={`chip${font === k ? ' on' : ''}`} onClick={() => set('msFont', k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="lab">Manuscript text size: {ms}px</span>
          <input type="range" min={16} max={30} value={ms} onChange={(e) => set('msSize', +e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>
      </div>
      <label className="row" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={first} onChange={(e) => set('firstTime', e.target.checked)} />
        <span>
          <b>First-time novelist help</b>
          <span className="muted small"> · explain writing terms (like POV) when you hover over them, and let your editor teach when it's useful</span>
        </span>
      </label>
    </div>
  );
}

function ExportSection() {
  const p = useProject();
  const mark = () => updateProject({ lastBackupAt: Date.now() });
  return (
    <div className="card">
      <h2>Take your work with you</h2>
      <p className="muted">Everything you write is yours. You can export it at any time, in standard formats that open anywhere.</p>
      <h3 style={{ margin: '16px 0 8px' }}>Manuscript</h3>
      <div className="row">
        <button className="btn primary" onClick={() => exportManuscriptDocx(p)}>
          <Icon name="download" size={16} /> Word document (.docx)
        </button>
        <button className="btn" onClick={() => printManuscript(p) || toast('Your browser blocked the print window. Allow pop-ups for this page.', 'error')}>
          PDF (print → Save as PDF)
        </button>
        <button className="btn" onClick={() => exportManuscriptText(p, 'md')}>
          Markdown
        </button>
        <button className="btn" onClick={() => exportManuscriptText(p, 'txt')}>
          Plain text
        </button>
      </div>
      <p className="tiny muted">The Word file uses standard manuscript format (Times New Roman 12pt, double-spaced, chapter breaks, page numbers), which is what agents and editors expect.</p>
      <h3 style={{ margin: '16px 0 8px' }}>Story bible and notes</h3>
      <div className="row">
        <button className="btn" onClick={() => markdownToDocx(storyBibleMarkdown(p), fileNames.bible(p, 'docx'))}>
          Story bible (.docx)
        </button>
        <button className="btn" onClick={() => exportMarkdown(storyBibleMarkdown(p), fileNames.bible(p, 'md'))}>
          Story bible (Markdown)
        </button>
        <button className="btn" onClick={() => exportMarkdown(notesMarkdown(p), fileNames.notes(p, 'md'))}>
          Notes & research (Markdown)
        </button>
      </div>
      <h3 style={{ margin: '16px 0 8px' }}>Complete backup</h3>
      <div className="row">
        <button className="btn primary" onClick={() => (backupProject(p), mark())}>
          <Icon name="download" size={16} /> Save a backup file
        </button>
        <span className="small muted">Last backup: {timeAgo(p.lastBackupAt)}. Keep backups somewhere safe, like an email to yourself or a USB stick.</span>
      </div>
    </div>
  );
}

function ImportSection() {
  const p = useProject();
  const [busy, setBusy] = useState(false);
  return (
    <div className="card">
      <h2>Bring writing in</h2>
      <p className="muted">
        Add chapters from a Word, text or Markdown file. If the file has headings like "Chapter 3", it's split into chapters automatically. Nothing already in your book is changed.
      </p>
      <label className="btn">
        <Icon name="upload" size={16} /> {busy ? 'Reading…' : 'Choose a file…'}
        <input
          type="file"
          hidden
          accept=".docx,.txt,.md,.markdown,text/plain"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              const text = await readManuscriptFile(f);
              const parts = splitChapters(text, f.name.replace(/\.[^.]+$/, ''));
              if (!parts.length) throw new Error('That file seems to be empty.');
              if (!(await confirmDialog(`Add ${parts.length} chapter${parts.length > 1 ? 's' : ''}?`, `From "${f.name}". They'll be added after your existing chapters.`, 'Add chapters'))) return;
              for (const part of parts) addItem('chapters', newChapter(part.title, { text: part.text, status: 'Drafting' }));
              toast(`Added ${parts.length} chapter${parts.length > 1 ? 's' : ''}.`);
            } catch (err) {
              toast((err as Error).message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <span className="small muted" style={{ marginLeft: 12 }}>{p.chapters.length} chapters now</span>
    </div>
  );
}

function SafetySection() {
  const p = useProject();
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  useEffect(() => {
    listSnapshots(p.id).then(setSnaps, () => setSnaps([]));
  }, [p.id]);
  return (
    <div className="card">
      <h2>Automatic safety copies</h2>
      <p className="muted">While you work, Nightjar quietly keeps copies of your whole novel on this computer, at most every 20 minutes. If anything ever goes wrong, you can open one as a separate novel.</p>
      {snaps.length === 0 ? (
        <p className="small muted">None yet. They start after your first few minutes of writing.</p>
      ) : (
        snaps.map((s) => (
          <div key={s.key} className="list-row">
            <span style={{ flex: 1 }}>{new Date(s.at).toLocaleString()}</span>
            <button
              className="btn small"
              onClick={async () => {
                const copy = normalizeProject(JSON.parse(s.data));
                copy.id = uid();
                copy.title = `${copy.title} (copy from ${new Date(s.at).toLocaleDateString()})`;
                await createProject(copy);
                toast('Opened the safety copy as a separate novel. Your current novel is unchanged.');
              }}
            >
              Open this copy
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function ProjectsSection() {
  const projects = useApp((s) => s.projects);
  const p = useProject();
  return (
    <div className="card">
      <h2>Your novels</h2>
      <p className="muted small">You have {projects.length || 1} novel{projects.length === 1 ? '' : 's'} on this computer.</p>
      <div className="row">
        <button className="btn" onClick={() => closeProject()}>
          Switch novel or start a new one
        </button>
        {!projects.some((x) => x.isDemo) && (
          <button className="btn" onClick={() => createProject(demoProject())}>
            Open the demo novel
          </button>
        )}
        <label className="btn">
          Restore a backup file
          <input
            type="file"
            hidden
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const restored = await readBackup(f);
                const exists = projects.some((x) => x.id === restored.id);
                if (exists) {
                  const replace = await confirmDialog(
                    `Replace “${restored.title}”?`,
                    'A novel with this name is already on this computer. Replace it with the backup? Choose Cancel to keep both instead.',
                    'Replace it',
                    true,
                  );
                  if (!replace) {
                    restored.id = uid();
                    restored.title += ' (restored)';
                  }
                }
                await createProject(restored);
                toast('Backup restored.');
              } catch (err) {
                toast((err as Error).message, 'error');
              }
            }}
          />
        </label>
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>Currently open: {p.title}</p>
    </div>
  );
}

function Privacy() {
  return (
    <div className="card">
      <h2>Privacy</h2>
      <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
        <li>Your novel is stored only in this browser, on this computer. There is no Nightjar account or server, and no analytics or tracking.</li>
        <li>
          When you ask your editor for help, the relevant parts of your story (not the whole manuscript) are sent securely to Anthropic to get a response. Anthropic's commercial terms say API data isn't used to train their models by default.
        </li>
        <li>Nothing else leaves your computer unless you export or back up a file yourself.</li>
        <li>Because your work lives in this browser, clearing your browsing data would erase it. Keep regular backup files.</li>
      </ul>
    </div>
  );
}
