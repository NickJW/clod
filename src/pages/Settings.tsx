// Settings: connect the AI editor, appearance, export/import, backups, privacy.
import { useEffect, useState } from 'react';
import { getAISettings, getProvider, getUsage, makeSetupLink, resetUsage, saveAISettings } from '../ai/provider';
import { defaultOpenAIModels, listOpenAIModels } from '../ai/openai';
import { defaultGeminiModels, listGeminiModels } from '../ai/gemini';
import { CHAT_APPS, type ChatApp, type ChatWhere } from '../components/ManualHost';
import { AIError } from '../ai/errors';
import { getPref, listSnapshots, setPref, type Snapshot } from '../storage/db';
import { addItem, closeProject, createProject, setState, toast, updateProject, useApp, useProject } from '../story/store';
import { backupToFolder, chooseFolder, folderSupported, getFolder } from '../services/backupFolder';
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

function FolderBackup() {
  const p = useProject();
  const [folder, setFolder] = useState<string | null>(null);
  useEffect(() => {
    getFolder().then((h) => setFolder(h?.name ?? ''));
  }, []);
  if (!folderSupported)
    return <p className="small muted" style={{ marginTop: 16 }}>Automatic folder backups work in Chrome and Edge. In this browser, save backup files regularly.</p>;
  const now = async () => {
    const r = await backupToFolder(p, true);
    if (r === 'saved') {
      updateProject({ lastBackupAt: Date.now() });
      setState({ folderNeedsPermission: false });
      toast('Backup saved to your folder.');
    } else toast('Couldn\'t save there. Try choosing the folder again.', 'error');
  };
  return (
    <>
      <h3 style={{ margin: '16px 0 8px' }}>Automatic backup folder (recommended)</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Pick a folder once, like Documents, or a Dropbox, OneDrive or Google Drive folder for an off-computer copy. While you write, Nightjar saves a dated backup there about once an hour.
      </p>
      <div className="row">
        {folder ? <span className="pill canon">Backing up to “{folder}”</span> : <span className="pill warn">Not set up</span>}
        <button
          className="btn"
          onClick={async () => {
            const h = await chooseFolder();
            if (h) {
              setFolder(h.name);
              await now();
            }
          }}
        >
          {folder ? 'Change folder' : 'Choose a folder'}
        </button>
        {folder && (
          <button className="btn" onClick={now}>
            Back up now
          </button>
        )}
      </div>
    </>
  );
}

export function applyAppearance() {
  const root = document.documentElement;
  root.dataset.theme = getPref('theme', 'light');
  root.dataset.textsize = getPref('textSize', 'normal');
  root.dataset.motion = getPref('motion', true) ? 'on' : 'off';
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
      <div className="card">
        <AISection />
      </div>
      <Appearance />
      <ExportSection />
      <ImportSection />
      <SafetySection />
      <ProjectsSection />
      <Privacy />
    </div>
  );
}

const SETUP: Record<string, { site: string; url: string; steps: string[]; placeholder: string; note?: string }> = {
  gemini: {
    site: 'aistudio.google.com/apikey',
    url: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza…',
    steps: ['Sign in with any Google account (Gmail).', 'Click "Create API key" (accept the terms if asked), then copy the key.', 'Paste it in the box below. Free, with no credit card needed.'],
    note: 'Privacy: on Gemini\'s free tier, Google may use what you send to improve its products, and people may review it. If that matters for your unpublished novel, turn on billing for the key in Google AI Studio. Then it becomes private and pay-per-use (usually pennies).',
  },
  anthropic: {
    site: 'console.anthropic.com',
    url: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-…',
    steps: ['Add some credit under Billing. A small amount lasts a long time for writing help.', 'Under "API keys", click "Create key", name it "Nightjar", and copy it.', 'Paste it in the box below. That\'s it.'],
  },
  openai: {
    site: 'platform.openai.com',
    url: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-…',
    steps: ['Add some credit under Settings → Billing.', 'Under "API keys", click "Create new secret key", name it "Nightjar", and copy it.', 'Paste it in the box below, then choose a model.'],
    note: 'Important: a ChatGPT Plus or Pro subscription does not include this. OpenAI bills API use separately, from platform.openai.com.',
  },
};

function ChatHelper() {
  const [, force] = useState(0);
  const app = getPref<ChatApp>('chatApp', 'chatgpt');
  const where = getPref<ChatWhere>('chatWhere', 'app');
  const set = (k: string, v: string) => {
    setPref(k, v);
    setPref('chatAppChosen', true);
    force((n) => n + 1);
  };
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="small">I use</span>
      {(['chatgpt', 'claude'] as ChatApp[]).map((a) => (
        <button key={a} className={`chip${app === a ? ' on' : ''}`} onClick={() => set('chatApp', a)}>
          {CHAT_APPS[a].name}
        </button>
      ))}
      <span className="small">in the</span>
      <button className={`chip${where === 'app' ? ' on' : ''}`} onClick={() => set('chatWhere', 'app')}>
        desktop app
      </button>
      <button className={`chip${where === 'web' ? ' on' : ''}`} onClick={() => set('chatWhere', 'web')}>
        website
      </button>
    </div>
  );
}

function SetupLink() {
  const [link, setLink] = useState('');
  return (
    <div className="note-box" style={{ marginTop: 12 }}>
      <b>Setting this up for someone else?</b> Create a link that connects their AI editor with one click. They just open it on their computer.
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small primary" onClick={() => setLink(makeSetupLink())}>
          Create a setup link
        </button>
        {link && (
          <button className="btn small" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copied. Send it privately.'))}>
            Copy link
          </button>
        )}
      </div>
      {link && <input className="input small" readOnly value={link} onFocus={(e) => e.target.select()} style={{ marginTop: 8 }} />}
      <p className="tiny muted" style={{ margin: '6px 0 0' }}>
        The link contains the key, so anyone with it can use your allowance. Send it privately (a text or email to them only) and delete the message once they've opened it. It never passes through Nightjar or GitHub: the part after "#" stays in the browser.
      </p>
    </div>
  );
}

function AISection() {
  const [s, setS] = useState(getAISettings());
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<'' | 'testing' | 'ok' | string>('');
  const [models, setModels] = useState<string[]>([]);
  const [modelErr, setModelErr] = useState('');
  const usage = getUsage();
  const provider = getProvider(s.providerId);
  const setup = SETUP[s.providerId] ?? SETUP.anthropic;
  const save = (patch: Partial<typeof s>) => {
    saveAISettings(patch);
    setS(getAISettings());
    if (patch.apiKey !== undefined || patch.providerId) setTest('');
  };

  // Gemini / ChatGPT: list the models available on this key.
  const live = s.providerId === 'openai' || s.providerId === 'gemini';
  useEffect(() => {
    setModels([]);
    setModelErr('');
    if (!live || s.apiKey.length < 20) return;
    const key = s.apiKey;
    const gem = s.providerId === 'gemini';
    const t = setTimeout(() => {
      (gem ? listGeminiModels(key) : listOpenAIModels(key))
        .then((ids) => {
          setModels(ids);
          const cur = getAISettings();
          if (ids.length && (!cur.model || !ids.includes(cur.model))) {
            saveAISettings(gem ? defaultGeminiModels(ids) : defaultOpenAIModels(ids));
            setS(getAISettings());
          }
        })
        .catch((e) => setModelErr(e instanceof AIError ? e.message : 'Couldn\'t load the model list.'));
    }, 600);
    return () => clearTimeout(t);
  }, [s.providerId, s.apiKey]);

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
    <div id="ai">
      <h2>Your AI editor</h2>
      <p className="muted">
        Your editor connects directly from this computer to the AI you choose. Everything happens right here in Nightjar. Set this up once (it takes about 3 minutes), then use <b>Create a setup link</b> to connect another computer with one click.
      </p>
      <label className="field" style={{ maxWidth: 520 }}>
        <span className="lab">Which AI?</span>
        <select className="input" value={s.providerId} onChange={(e) => save({ providerId: e.target.value })}>
          <option value="gemini">Google Gemini: free (recommended)</option>
          <option value="anthropic">Claude (Anthropic): best writing quality, pay per use</option>
          <option value="openai">ChatGPT (OpenAI): pay per use</option>
          <option value="manual">Copy &amp; paste with a ChatGPT or Claude subscription</option>
        </select>
      </label>
      {s.providerId === 'manual' && (
        <div className="note-box" style={{ margin: '12px 0 18px' }}>
          <b>Using your ChatGPT or Claude subscription</b>
          <p style={{ margin: '6px 0' }}>
            Chat subscriptions (ChatGPT Plus, Claude Pro) can't be connected to other apps directly, so this works by copy &amp; paste. When you ask your editor for something, a small window opens: copy the prepared request, paste it into ChatGPT or Claude, then paste the answer back. You keep all the same buttons: Accept, Use this, and so on.
          </p>
          <p style={{ margin: 0 }} className="small">
            It costs nothing beyond your subscription, but it takes a few more clicks, and automatic chapter summaries are switched off. For everything to happen inside Nightjar, choose Google Gemini (free) above instead.
          </p>
          <div style={{ marginTop: 10 }}>
            <ChatHelper />
          </div>
        </div>
      )}
      {s.providerId !== 'manual' && !s.apiKey && (
        <div className="note-box" style={{ margin: '12px 0 18px' }}>
          <b>How to connect (about 2 minutes, one time only):</b>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              Go to{' '}
              <a href={setup.url} target="_blank" rel="noreferrer">
                {setup.site}
              </a>{' '}
              and sign up or sign in.
            </li>
            {setup.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          {setup.note && <p style={{ margin: '8px 0 0' }}><b>{setup.note}</b></p>}
        </div>
      )}
      {s.providerId !== 'manual' && (
      <>
      <label className="field">
        <span className="lab">Your {provider.name} key</span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" type={showKey ? 'text' : 'password'} value={s.apiKey} onChange={(e) => save({ apiKey: e.target.value.trim() })} placeholder={setup.placeholder} autoComplete="off" spellCheck={false} />
          <button className="btn small" onClick={() => setShowKey(!showKey)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button className="btn primary" disabled={!s.apiKey || test === 'testing'} onClick={runTest}>
            {test === 'testing' ? 'Checking…' : 'Test connection'}
          </button>
        </div>
        <span className="hint" style={{ marginTop: 6 }}>Stored only in this browser on this computer. Never included in backups or exports. Each AI keeps its own key, so you can switch back and forth.</span>
      </label>
      {test === 'ok' && <div className="ok-box">✓ Connected. Your editor is ready.</div>}
      {s.apiKey && <SetupLink />}
      {test && test !== 'ok' && test !== 'testing' && <div className="err-box">{test}</div>}

      <div className="grid-2" style={{ marginTop: 18 }}>
        <label className="field">
          <span className="lab">Model</span>
          {live ? (
            models.length ? (
              <select className="input" value={s.model} onChange={(e) => save({ model: e.target.value })}>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input" value={s.model} onChange={(e) => save({ model: e.target.value.trim() })} placeholder={s.apiKey ? 'Loading your models…' : 'Paste your key first'} />
            )
          ) : (
            <select className="input" value={s.model} onChange={(e) => save({ model: e.target.value })}>
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}: {m.note}
                </option>
              ))}
            </select>
          )}
          {modelErr && <span className="hint" style={{ color: 'var(--danger)' }}>{modelErr}</span>}
          <span className="hint" style={{ marginTop: 6 }}>
            {live ? `Small jobs like chapter summaries use ${s.fastModel || 'a smaller model'}.${s.providerId === 'gemini' ? ' "Flash" models have the most generous free limits.' : ''}` : 'Chapter summaries always use the faster, cheaper model.'}
          </span>
        </label>
        <label className="field">
          <span className="lab">Creativity: {s.creativity < 0.4 ? 'careful' : s.creativity > 0.8 ? 'adventurous' : 'balanced'}</span>
          <input type="range" min={0} max={1} step={0.05} value={s.creativity} onChange={(e) => save({ creativity: +e.target.value })} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          <span className="hint">Affects brainstorming and prose. Checks and analysis always stay careful.</span>
        </label>
      </div>
      </>
      )}
      <label className="row" style={{ cursor: 'pointer', marginBottom: 12 }}>
        <input type="checkbox" defaultChecked={getPref('autoSummary', true)} onChange={(e) => setPref('autoSummary', e.target.checked)} />
        <span>
          <b>Keep chapter summaries up to date automatically</b>
          <span className="muted small"> · when you leave a chapter that changed a lot, a short summary is refreshed with the inexpensive model, so your editor remembers earlier chapters without re-reading them (saves money)</span>
        </span>
      </label>
      <div className="small muted">
        Used on this computer since {new Date(usage.since).toLocaleDateString()}: {usage.requests} requests, about {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens.{' '}
        For exact costs, see your account's usage page (console.anthropic.com or platform.openai.com).{' '}
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
      <label className="row" style={{ cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={getPref('motion', true)} onChange={(e) => set('motion', e.target.checked)} />
        <span>
          <b>Gentle animations</b>
          <span className="muted small"> · soft fades, a small tick when saved, and a brief celebration at milestones</span>
        </span>
      </label>
      <label className="row" style={{ cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={getPref('celebrations', true)} onChange={(e) => set('celebrations', e.target.checked)} />
        <span>
          <b>Celebrate milestones</b>
          <span className="muted small"> · 1,000, 5,000, 10,000 words… your daily goal, and a finished first draft</span>
        </span>
      </label>
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
      <FolderBackup />
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
          When you ask your editor for help, the relevant parts of your story (not the whole manuscript) are sent securely to the AI company you chose (Anthropic or OpenAI) to get a response. Both companies' API terms say API data isn't used to train their models by default.
        </li>
        <li>Nothing else leaves your computer unless you export or back up a file yourself.</li>
        <li>Because your work lives in this browser, clearing your browsing data would erase it. Keep regular backup files.</li>
      </ul>
    </div>
  );
}
