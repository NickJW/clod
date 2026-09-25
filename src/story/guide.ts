// The writing journey: the recommended order for using the studio's tools,
// in plain English. Progress is detected from the project where possible,
// and the author can also tick a step off herself.
import type { Project } from '../types';
import type { ActionId } from '../ai/actions';
import type { Page } from './store';
import { getPref, setPref } from '../storage/db';
import { countWords, manuscriptWords } from './reference';

export interface GuideStep {
  id: string;
  title: string;
  page: Page;
  why: string;
  todo: string[];
  check: (p: Project) => boolean;
  ask?: { action: ActionId; label: string; request?: string };
}

export const GUIDE: GuideStep[] = [
  {
    id: 'heart',
    title: 'The heart of your story',
    page: 'story',
    why: 'A few sentences about what your book is about give you (and your editor) a compass. It will change as you write, and that\'s normal.',
    todo: ['Write your premise: who, what happens, what\'s at stake', 'Open the "Tone & feel" tab and set the sliders', 'Describe how it should feel, in your own words'],
    check: (p) => p.bible.premise.trim().length > 40,
    ask: { action: 'develop', label: 'Help me shape my premise', request: 'Help me shape my premise into a few clear sentences.' },
  },
  {
    id: 'people',
    title: 'Your main characters',
    page: 'characters',
    why: 'Thrillers run on what people want, fear and hide. You don\'t need every detail. Start with the main character and the two or three people who matter most.',
    todo: ['Add your main character', 'For each one, fill in "Wants and fears" and "Secrets and knowledge"', 'Add the key relationships (Relationships tab)'],
    check: (p) => p.characters.length >= 2,
    ask: { action: 'think', label: 'Help me think about my characters', request: 'Who else does my story need? Suggest characters that would create pressure on my main character.' },
  },
  {
    id: 'mystery',
    title: 'Your mystery',
    page: 'mystery',
    why: 'Knowing the truth (even roughly) before you write lets you plant clues and red herrings fairly. You can change it later.',
    todo: ['In "The truth", write the central question and what really happened', 'Add your suspects on the Suspects tab: motive, means, opportunity', 'Add a few clues and at least one red herring', 'Try "Connect the dots" to link pieces together'],
    check: (p) => !!p.mystery.centralQuestion.trim() && p.clues.length >= 2,
    ask: { action: 'think', label: 'Help me work out my mystery', request: 'Help me work out what really happened in my mystery. Ask me what I already know first.' },
  },
  {
    id: 'timeline',
    title: 'When things happened',
    page: 'timeline',
    why: 'Mysteries often happen before the book begins. A simple timeline stops mistakes like someone being in two places at once.',
    todo: ['Add the key past events (the crime, the old secret)', 'Add the main events of the book', 'Mark who was where'],
    check: (p) => p.timeline.length >= 3,
  },
  {
    id: 'plan',
    title: 'Plan your first chapters',
    page: 'scenes',
    why: 'Answering a few simple questions per chapter makes the blank page much less scary. Plan two or three chapters ahead. Not the whole book.',
    todo: ['Pick a chapter and answer the questions (skip any you like)', 'Click "Turn my answers into a plan"', 'Add scenes if it helps'],
    check: (p) => p.chapters.some((c) => c.outline.happens.trim() || c.outline.plan.trim()),
    ask: { action: 'chapterPlan', label: 'Turn my answers into a plan' },
  },
  {
    id: 'write',
    title: 'Write a rough draft',
    page: 'write',
    why: 'First drafts are supposed to be rough. Get the story down, and polish later. Your editor can help you start, but the words are yours.',
    todo: ['Just write. It saves by itself', 'Stuck on a scene? In your editor, choose "Write" and type or speak your rough notes', 'Try the Talk button to speak instead of typing'],
    check: (p) => manuscriptWords(p) >= 1500,
    ask: { action: 'stuck', label: 'I\'m stuck' },
  },
  {
    id: 'polish',
    title: 'Polish with your editor',
    page: 'write',
    why: 'Once a chapter is drafted, improve it a passage at a time. You always see what changed, and you decide.',
    todo: ['Select a paragraph, then choose Improve, Make darker, More suspense or Subtler', 'Use More ▾ → "Check my prose" for a free, instant check', 'Use More ▾ → "Read it like a reader" to hear how a first reader reacts'],
    check: (p) => p.chapters.some((c) => c.versions.some((v) => /Make this better|Before "/.test(v.label))),
    ask: { action: 'proseReview', label: 'Review my current chapter' },
  },
  {
    id: 'bible',
    title: 'Keep your story bible up to date',
    page: 'write',
    why: 'As you write, new facts appear. Keeping them in the story bible keeps your editor accurate and your story consistent.',
    todo: ['After finishing a chapter: More ▾ → "Update my story bible from this chapter"', 'Add what\'s right with one click, and skip the rest', 'Try "Check continuity" now and then'],
    check: (p) => p.facts.length + p.clues.length + p.timeline.length >= 8 && p.chapters.filter((c) => countWords(c.text) > 500).length >= 2,
    ask: { action: 'extract', label: 'Update my story bible from this chapter' },
  },
  {
    id: 'bigpicture',
    title: 'Step back: the big picture',
    page: 'mystery',
    why: 'Every few chapters, check the whole book: is the mystery fair, is the tension rising, is anything missing?',
    todo: ['Mystery: "Check my mystery" and "Is it fair?"', 'Story Bible: "Check my pacing" and "What\'s missing?"', 'Characters: "Check the romance", if there is one'],
    check: () => false,
    ask: { action: 'mysteryCheck', label: 'Check my mystery' },
  },
  {
    id: 'ending',
    title: 'Your ending',
    page: 'ending',
    why: 'Endings pay off everything you set up. Note what you know. It\'s fine to discover it as you go.',
    todo: ['Write how the mystery resolves, and where each character ends up', 'Click "Plan backwards from my ending" to see what to plant, and where', 'Click "Check my ending" to find loose threads'],
    check: (p) => p.ending.resolution.trim().length > 20,
    ask: { action: 'backwards', label: 'Plan backwards from my ending' },
  },
  {
    id: 'finish',
    title: 'Finish and share',
    page: 'settings',
    why: 'When you\'re ready to share, export your manuscript in the standard format agents and editors expect. And keep backups all along the way.',
    todo: ['Set up a backup folder (Home or Settings)', 'Write your blurb and synopsis (Ending page)', 'Export a Word document (.docx) or PDF'],
    check: (p) => p.status === 'Finished',
    ask: { action: 'pitch', label: 'Write my back-cover blurb' },
  },
];

const key = (p: Project) => `guide-done:${p.id}`;

export function guideDone(p: Project, s: GuideStep): boolean {
  return s.check(p) || getPref<string[]>(key(p), []).includes(s.id);
}

export function setGuideDone(p: Project, id: string, done: boolean) {
  const cur = getPref<string[]>(key(p), []);
  setPref(key(p), done ? [...new Set([...cur, id])] : cur.filter((x) => x !== id));
}

export function nextStep(p: Project): number {
  const i = GUIDE.findIndex((s) => !guideDone(p, s));
  return i < 0 ? GUIDE.length - 1 : i;
}
