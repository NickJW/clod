// Earned moments: word milestones, first draft complete, and the daily goal.
// Brief and calm; one small card with a little paper confetti, then it fades.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../story/store';
import { dailyGoal, manuscriptWords, todayWords } from '../story/reference';
import { getPref, setPref } from '../storage/db';
import { Ornament } from './ui';

const MILESTONES = [1000, 5000, 10000, 25000, 50000, 75000, 100000];
const COLORS = ['var(--brass)', 'var(--accent)', '#e8cf9a', 'var(--ok)'];

interface Moment {
  eyebrow: string;
  big: string;
  line: string;
}

export function Celebrate() {
  const project = useApp((s) => s.project);
  const [moment, setMoment] = useState<Moment | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!project || project.isDemo) return;
    const words = manuscriptWords(project);
    const key = `milestones:${project.id}`;
    const seen = getPref<number[]>(key, []);
    // Don't celebrate milestones that were already passed when the app first saw this novel.
    if (!getPref(`milestonesInit:${project.id}`, false)) {
      setPref(key, MILESTONES.filter((m) => words >= m));
      setPref(`milestonesInit:${project.id}`, true);
      return;
    }
    const hit = MILESTONES.filter((m) => words >= m && !seen.includes(m)).pop();
    const draftDone = words >= project.targetWords && !seen.includes(-1);
    let m: Moment | null = null;
    if (draftDone) {
      setPref(key, [...seen, -1, ...MILESTONES.filter((x) => words >= x)]);
      m = { eyebrow: 'First draft complete', big: `${words.toLocaleString()} words`, line: 'You wrote a novel. Most people who start one never get here. Take a moment before you revise.' };
    } else if (hit) {
      setPref(key, [...seen, ...MILESTONES.filter((x) => words >= x && !seen.includes(x))]);
      m = { eyebrow: 'A milestone', big: `${hit.toLocaleString()} words`, line: `That's about ${Math.round(hit / 250).toLocaleString()} pages of your novel. Keep going.` };
    } else {
      const today = new Date().toDateString();
      const goal = dailyGoal(project);
      if (todayWords(project) >= goal && getPref(`goalMet:${project.id}`, '') !== today) {
        setPref(`goalMet:${project.id}`, today);
        m = { eyebrow: "Today's goal", big: `${goal.toLocaleString()} words`, line: 'Goal reached for today. Anything more is a bonus.' };
      }
    }
    // One celebration at a time: a milestone today also counts as today's goal moment.
    if (m && m.eyebrow !== "Today's goal") setPref(`goalMet:${project.id}`, new Date().toDateString());
    if (m && getPref('celebrations', true)) {
      setMoment(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMoment(null), 5200);
    }
  }, [project]);

  if (!moment) return null;
  return (
    <div className="celebrate-back" onClick={() => setMoment(null)} role="status">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={
            {
              left: `${8 + ((i * 37) % 84)}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 7) * 60}ms`,
              '--dx': `${((i * 53) % 120) - 60}px`,
              '--rot': `${(i * 97) % 540}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="celebrate">
        <div className="eyebrow" style={{ justifyContent: 'center' }}>{moment.eyebrow}</div>
        <div className="big">{moment.big}</div>
        <Ornament />
        <p className="muted" style={{ margin: 0 }}>{moment.line}</p>
      </div>
    </div>
  );
}
