// The dashboard: where am I, what am I writing, what do I do next?
import { go, setState, updateProject, useProject } from '../story/store';
import { openEditor } from '../ai/session';
import { chapterNumber, countWords, manuscriptWords, readingTime, timeAgo } from '../story/reference';
import { Icon } from '../components/ui';
import { backupProject } from '../services/exporter';
import type { ProjectStatus } from '../types';

export function Home() {
  const p = useProject();
  const words = manuscriptWords(p);
  const cur = p.chapters.find((c) => c.id === p.currentChapterId) ?? p.chapters[0];
  const curNo = chapterNumber(p, cur.id);
  const pct = Math.min(100, Math.round((words / Math.max(1, p.targetWords)) * 100));
  const lastWords = cur.text.trim().split(/\s+/).slice(-40).join(' ');
  const needsBackup = !p.lastBackupAt || Date.now() - p.lastBackupAt > 7 * 864e5;

  const counts = [
    { page: 'characters' as const, n: p.characters.length, name: 'Characters', d: 'Who they are, what they want, what they hide.' },
    { page: 'mystery' as const, n: p.clues.length, name: 'Mystery', d: 'Clues, red herrings, secrets and the truth.' },
    { page: 'timeline' as const, n: p.timeline.length, name: 'Timeline', d: 'When things really happened, and where.' },
    { page: 'scenes' as const, n: p.scenes.length, name: 'Scenes & Outline', d: 'Plan chapters with simple questions.' },
    { page: 'story' as const, n: p.ideas.filter((i) => i.status !== 'discarded').length, name: 'Story Bible', d: 'Premise, tone, and your decisions.' },
    { page: 'research' as const, n: p.research.length + p.notes.length, name: 'Research & Notes', d: 'Places, facts to check, loose thoughts.' },
  ];

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-book">
          <div className="eyebrow">My novel</div>
          <input className="title-input" style={{ fontSize: '2.7rem' }} value={p.title} onChange={(e) => updateProject({ title: e.target.value })} aria-label="Title" />
          <div className="muted">{p.bible.genre}</div>
          <div className="meta-grid">
            <div>
              <div className="k">Status</div>
              <select className="status-select" style={{ fontSize: '1rem', marginTop: 4 }} value={p.status} onChange={(e) => updateProject({ status: e.target.value as ProjectStatus })}>
                {['Planning', 'Drafting', 'Revising', 'Finished'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="k">Progress</div>
              <div className="v">
                Chapter {curNo} <span className="muted" style={{ fontSize: '1rem' }}>of about {Math.max(p.targetChapters, p.chapters.length)}</span>
              </div>
            </div>
            <div>
              <div className="k">Words</div>
              <div className="v">{words.toLocaleString()}</div>
            </div>
          </div>
          <div className="progress" title={`${pct}% of your ${p.targetWords.toLocaleString()}-word goal`}>
            <div style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {pct}% of a {p.targetWords.toLocaleString()}-word novel · {readingTime(words)}
          </div>
          <div style={{ marginTop: 26 }}>
            <button className="btn primary big" onClick={() => go('write')}>
              <Icon name="write" /> Continue writing: Chapter {curNo}
              {cur.title ? `, ${cur.title}` : ''}
            </button>
          </div>
          {lastWords && (
            <p className="serif muted" style={{ marginTop: 16, fontSize: '1.05rem', fontStyle: 'italic' }}>
              You left off: “…{lastWords}”
            </p>
          )}
        </div>
        <div className="helper-card">
          <div className="eyebrow">Your editor</div>
          <div className="serif" style={{ fontSize: '1.4rem', lineHeight: 1.25 }}>Not sure what to do next?</div>
          <button className="btn big" onClick={() => openEditor({ actionId: 'stuck' })}>
            <Icon name="compass" /> I'm stuck
          </button>
          <button className="btn big" onClick={() => openEditor({ actionId: 'workOn' }, true)}>
            <Icon name="spark" /> What should I work on?
          </button>
          <button className="btn big" onClick={() => openEditor({ actionId: 'think' })}>
            <Icon name="spark" /> Help me think
          </button>
          <div className="small muted" style={{ marginTop: 'auto' }}>
            Your editor knows your characters, clues and plans. Nothing it suggests changes your book unless you say so.
          </div>
        </div>
      </div>

      {needsBackup && (
        <div className="card row" style={{ marginBottom: 24, background: 'var(--brass-soft)' }}>
          <Icon name="download" />
          <div>
            <b>Keep a safety copy.</b> <span className="muted">Last backup: {timeAgo(p.lastBackupAt)}. A backup file lets you restore your novel on any computer.</span>
          </div>
          <span className="spacer" />
          <button
            className="btn primary"
            onClick={() => {
              backupProject(p);
              updateProject({ lastBackupAt: Date.now() });
            }}
          >
            Save a backup file
          </button>
        </div>
      )}

      <div className="section-title">
        <h2>Your book</h2>
      </div>
      <div className="tiles">
        {counts.map((c) => (
          <button key={c.page} className="tile" onClick={() => go(c.page)}>
            <div className="tn">{c.name}</div>
            <div className="td">{c.d}</div>
            <div className="tc">{c.n ? `${c.n} ${c.n === 1 ? 'item' : 'items'}` : 'Start here'}</div>
          </button>
        ))}
      </div>

      <div className="section-title">
        <h2>Chapters</h2>
        <button className="btn ghost small" onClick={() => go('scenes')}>
          Plan chapters →
        </button>
      </div>
      <div className="card" style={{ padding: '6px 22px' }}>
        {p.chapters.map((c, i) => (
          <div
            key={c.id}
            className="list-row"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              updateProject({ currentChapterId: c.id });
              setState({ page: 'write' });
            }}
          >
            <span className="muted" style={{ width: 28 }}>
              {i + 1}
            </span>
            <span className="serif" style={{ fontSize: '1.15rem', flex: 1 }}>
              {c.title}
            </span>
            <span className="pill neutral">{c.status}</span>
            <span className="small muted" style={{ width: 90, textAlign: 'right' }}>
              {countWords(c.text).toLocaleString()} words
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
