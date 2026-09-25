import { useEffect } from 'react';
import { go, useApp, type Page } from './story/store';
import { AIPanel } from './components/AIPanel';
import { ConfirmHost, Icon, Toasts } from './components/ui';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Write } from './pages/Write';
import { Story } from './pages/Story';
import { Characters } from './pages/Characters';
import { Mystery } from './pages/Mystery';
import { Timeline } from './pages/Timeline';
import { Scenes } from './pages/Scenes';
import { Ending } from './pages/Ending';
import { Research } from './pages/Research';
import { Settings, applyAppearance } from './pages/Settings';
import { manuscriptWords } from './story/reference';

const NAV: { page: Page; label: string; icon: string; hint: string }[] = [
  { page: 'home', label: 'Home', icon: 'home', hint: 'Your novel at a glance' },
  { page: 'write', label: 'Write', icon: 'write', hint: 'Your chapters' },
  { page: 'story', label: 'Story Bible', icon: 'story', hint: 'Premise, tone and decisions' },
  { page: 'characters', label: 'Characters', icon: 'characters', hint: 'People and relationships' },
  { page: 'mystery', label: 'Mystery', icon: 'mystery', hint: 'Clues, secrets, twists' },
  { page: 'timeline', label: 'Timeline', icon: 'timeline', hint: 'When things happened' },
  { page: 'scenes', label: 'Scenes & Outline', icon: 'scenes', hint: 'Plan chapters and scenes' },
  { page: 'ending', label: 'Ending', icon: 'ending', hint: 'How it all resolves' },
  { page: 'research', label: 'Research & Notes', icon: 'research', hint: 'Places, facts, notes' },
];

export default function App() {
  const ready = useApp((s) => s.ready);
  const project = useApp((s) => s.project);
  const page = useApp((s) => s.page);
  const focus = useApp((s) => s.focusMode);

  useEffect(() => applyAppearance(), []);

  if (!ready) return <div className="onboard"><div className="muted">Opening your studio…</div></div>;
  if (!project)
    return (
      <>
        <Onboarding />
        <Toasts />
        <ConfirmHost />
      </>
    );

  const words = manuscriptWords(project);
  return (
    <div className={`app${focus ? ' focus' : page === 'write' ? ' compact' : ''}`}>
      {!focus && (
        <nav className="nav" aria-label="Main">
          <div className="brand">
            <img className="brand-mark" src="./icon.svg" alt="" />
            <div>
              <div className="brand-name">Nightjar</div>
              <div className="brand-sub">Novel studio</div>
            </div>
          </div>
          <div className="nav-book">
            <div className="t">{project.title}</div>
            <div className="s">
              {words.toLocaleString()} words{project.isDemo ? ' · demo' : ''}
            </div>
          </div>
          {NAV.map((n) => (
            <button key={n.page} className={`nav-item${page === n.page ? ' active' : ''}`} onClick={() => go(n.page)} title={n.hint}>
              <Icon name={n.icon} />
              <span className="lbl">{n.label}</span>
            </button>
          ))}
          <div className="nav-sep" />
          <button className={`nav-item${page === 'settings' ? ' active' : ''}`} onClick={() => go('settings')} title="AI, appearance, backups, export">
            <Icon name="settings" />
            <span className="lbl">Settings & Backup</span>
          </button>
          <div className="nav-foot">Your novel is saved on this computer automatically.</div>
        </nav>
      )}
      <main className="main">
        {page === 'home' && <Home />}
        {page === 'write' && <Write />}
        {page === 'story' && <Story />}
        {page === 'characters' && <Characters />}
        {page === 'mystery' && <Mystery />}
        {page === 'timeline' && <Timeline />}
        {page === 'scenes' && <Scenes />}
        {page === 'ending' && <Ending />}
        {page === 'research' && <Research />}
        {page === 'settings' && <Settings />}
      </main>
      {!focus && <AIPanel />}
      <Toasts />
      <ConfirmHost />
    </div>
  );
}
