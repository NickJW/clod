// Static reference data: character profile fields, the plain-English glossary,
// and small text helpers shared across the app.
import type { CanonStatus, Chapter, Project } from '../types';
import { getState, patchItem } from './store';
import { uid } from './factory';
import { getPref, setPref } from '../storage/db';

export interface FieldDef {
  key: string;
  label: string;
  hint?: string;
  long?: boolean;
}

export interface FieldGroup {
  title: string;
  intro: string;
  fields: FieldDef[];
}

export const CHARACTER_GROUPS: FieldGroup[] = [
  {
    title: 'The basics',
    intro: 'Who they are on the surface.',
    fields: [
      { key: 'age', label: 'Age' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'appearance', label: 'Appearance', hint: 'One or two specific details beat a full description.', long: true },
      { key: 'personality', label: 'Personality', long: true },
      { key: 'history', label: 'History', hint: 'What happened to them before page one?', long: true },
    ],
  },
  {
    title: 'Public face and private self',
    intro: 'In a thriller, the gap between these two is where the tension lives.',
    fields: [
      { key: 'publicPersona', label: 'How others see them', long: true },
      { key: 'privateSelf', label: 'Who they are when alone', long: true },
      { key: 'wantsOthersToBelieve', label: 'What they want people to believe', long: true },
    ],
  },
  {
    title: 'Wants and fears',
    intro: 'What drives them, and what stops them.',
    fields: [
      { key: 'goals', label: 'Goals', hint: 'What are they trying to do in this story?', long: true },
      { key: 'desires', label: 'Deeper desires', hint: 'What do they want but might never admit?', long: true },
      { key: 'fears', label: 'Fears', long: true },
      { key: 'moralBoundaries', label: 'Lines they won\'t cross', long: true },
      { key: 'breakingPoint', label: 'Breaking point', hint: 'What would make them cross those lines?', long: true },
      { key: 'arc', label: 'How they change', hint: 'Who are they at the end?', long: true },
    ],
  },
  {
    title: 'Secrets and knowledge',
    intro: 'What they know, what they believe, and what they hide. The AI uses this to keep them consistent.',
    fields: [
      { key: 'secrets', label: 'Secrets', long: true },
      { key: 'lies', label: 'Lies they tell', long: true },
      { key: 'knows', label: 'What they know', long: true },
      { key: 'believes', label: 'What they believe (which may be wrong)', long: true },
      { key: 'doesNotKnow', label: 'What they don\'t know', long: true },
    ],
  },
  {
    title: 'Connections',
    intro: 'Relationships are also tracked on their own. These are quick notes.',
    fields: [
      { key: 'attachments', label: 'Who they love or depend on', long: true },
      { key: 'conflicts', label: 'Who they clash with', long: true },
      { key: 'romance', label: 'Possible romance', long: true },
      { key: 'betrayals', label: 'Possible betrayals', long: true },
    ],
  },
  {
    title: 'As a suspect',
    intro: 'Only if they could be suspected. Readers love weighing motive, means and opportunity.',
    fields: [
      { key: 'susMotive', label: 'Motive (why they might have done it)', long: true },
      { key: 'susMeans', label: 'Means (could they physically have done it?)', long: true },
      { key: 'susOpportunity', label: 'Opportunity (where were they?)', long: true },
      { key: 'susAlibi', label: 'Their alibi, and whether it\'s true', long: true },
      { key: 'susPointers', label: 'What makes the reader suspect them', long: true },
      { key: 'susCleared', label: 'When and how they\'re cleared (or not)', long: true },
    ],
  },
  {
    title: 'Voice',
    intro: 'How they sound, so every character doesn\'t talk the same way.',
    fields: [
      { key: 'voice', label: 'How they speak', hint: 'Short and clipped? Formal? Rambling? Deflects with jokes?', long: true },
      { key: 'phrases', label: 'Words or phrases they use', long: true },
      { key: 'neverSay', label: 'Things they would never say', long: true },
      { key: 'mannerisms', label: 'Physical habits', hint: 'What do their hands do when they lie?', long: true },
    ],
  },
];

export const STATUS_LABEL: Record<CanonStatus, string> = {
  canon: 'Decided',
  possibility: 'Maybe',
  draft: 'Working on it',
  discarded: 'Set aside',
};

export const STATUS_HELP: Record<CanonStatus, string> = {
  canon: 'Canon: this is true in your story. The AI will treat it as fact.',
  possibility: 'A possibility you\'re considering. The AI will never treat it as fact.',
  draft: 'Something you\'re still shaping.',
  discarded: 'Set aside. The AI will remember not to suggest it again.',
};

export const GLOSSARY: Record<string, string> = {
  pov: 'Point of view: whose eyes the reader is looking through in this scene.',
  canon: 'Canon: things that are definitely true in your story. The AI treats these as fact.',
  possibility: 'An idea you haven\'t committed to. The AI will never treat it as fact.',
  'red herring': 'A clue that points the reader toward the wrong answer, but has an innocent explanation.',
  subtext: 'What a character means but doesn\'t say. Often more powerful than what they do say.',
  stakes: 'What the character stands to lose if things go wrong.',
  arc: 'How a character changes from the beginning of the book to the end.',
  foreshadowing: 'Small early hints that make a later event feel earned.',
  exposition: 'Background information given to the reader. Too much at once slows the story.',
  pacing: 'How fast the story feels. Tension and short scenes speed it up; reflection slows it down.',
  twist: 'A reveal that changes how the reader understands what came before.',
  'story bible': 'Your book\'s reference guide: the facts, characters and rules the AI must respect.',
  beat: 'A single moment of change within a scene: a look, a line, a decision.',
  'fair play': 'A fair mystery gives the reader the clues to solve it, even if they don\'t.',
  'unreliable narrator': 'A narrator whose account can\'t be fully trusted, on purpose.',
};

export function countWords(text: string): number {
  const m = text.match(/[A-Za-z0-9À-ɏ'’-]+/g);
  return m ? m.length : 0;
}

export function readingTime(words: number): string {
  const mins = Math.max(1, Math.round(words / 250));
  if (mins < 60) return `${mins} min read`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} hr${h > 1 ? 's' : ''}${m ? ` ${m} min` : ''} read`;
}

export function manuscriptWords(p: Project): number {
  return p.chapters.reduce((n, c) => n + countWords(c.text), 0);
}

export function chapterLabel(p: Project, chapterId: string): string {
  const i = p.chapters.findIndex((c) => c.id === chapterId);
  if (i < 0) return '';
  const c = p.chapters[i];
  return `Ch. ${i + 1}${c.title ? ` · ${c.title}` : ''}`;
}

export function chapterNumber(p: Project, chapterId: string): number {
  return p.chapters.findIndex((c) => c.id === chapterId) + 1;
}

export function characterName(p: Project, id: string): string {
  return p.characters.find((c) => c.id === id)?.name ?? '';
}

export function timeAgo(ts: number): string {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

/** Characters whose name (or first name) appears in a piece of text. */
export function charactersMentioned(p: Project, text: string): string[] {
  const lower = text.toLowerCase();
  return p.characters
    .filter((c) => {
      const parts = c.name.split(/\s+/).filter((w) => w.length > 2);
      return parts.some((w) => new RegExp(`\\b${escapeRe(w.toLowerCase())}\\b`).test(lower));
    })
    .map((c) => c.id);
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Keep an earlier version of a chapter so any change can be undone later. */
export function saveChapterVersion(chapterId: string, label: string): void {
  const p = getState().project;
  const ch = p?.chapters.find((c) => c.id === chapterId);
  if (!ch || !ch.text.trim()) return;
  if (ch.versions[0]?.text === ch.text) return;
  const versions = [{ id: uid(), at: Date.now(), label, text: ch.text }, ...ch.versions].slice(0, 40);
  patchItem('chapters', chapterId, { versions } as Partial<Chapter>);
}

/** Words added to the book today (baseline taken the first time the book is seen each day). */
export function todayWords(p: Project): number {
  const key = `today:${p.id}`;
  const date = new Date().toDateString();
  const total = manuscriptWords(p);
  let b = getPref<{ date: string; start: number } | null>(key, null);
  if (!b || b.date !== date) {
    b = { date, start: total };
    setPref(key, b);
  }
  const today = Math.max(0, total - b.start);
  // Keep a small per-day log for the writing streak.
  const logKey = `wordlog:${p.id}`;
  const log = getPref<Record<string, number>>(logKey, {});
  if ((log[date] ?? 0) !== today) setPref(logKey, { ...log, [date]: today });
  return today;
}

/** Consecutive days (ending today, or yesterday if nothing yet today) with words written. */
export function writingStreak(p: Project): number {
  const log = getPref<Record<string, number>>(`wordlog:${p.id}`, {});
  let n = 0;
  const d = new Date();
  if (!(log[d.toDateString()] > 0)) d.setDate(d.getDate() - 1);
  while (log[d.toDateString()] > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function dailyGoal(p: Project): number {
  return getPref<number>(`goal:${p.id}`, 500);
}
