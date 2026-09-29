// Craft corner: short, plain-English lessons for a first-time novelist,
// each linked to the tool that helps her practise it.
import type { ActionId } from '../ai/actions';
import type { Page } from './store';

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  body: string[];
  tryIt?: { label: string; action?: ActionId; page?: Page; variant?: string };
}

export const LESSONS: Lesson[] = [
  {
    id: 'draft',
    title: 'Your first draft is allowed to be bad',
    minutes: 1,
    body: [
      'Every published novel started as a messy draft. The job of a first draft is to exist.',
      'Don\'t polish as you go. Get the scene down, even in note form ("she finds the photo, feels sick, hides it"), and move on.',
      'Polishing comes later, one passage at a time. Nightjar keeps every version, so nothing is ever lost.',
    ],
    tryIt: { label: 'Turn my rough notes into a scene', action: 'write' },
  },
  {
    id: 'pov',
    title: 'Point of view: whose eyes are we in?',
    minutes: 2,
    body: [
      'Point of view (POV) is the character whose experience the reader follows in a scene.',
      'Stay inside that one person: we only know what they see, hear, think and remember. If Nora can\'t see Owen\'s face, we can\'t describe his expression.',
      'Close POV is a thriller writer\'s best friend. Being trapped in one head, not knowing what others are thinking, creates suspense by itself.',
      'Set the POV for each chapter in the Write screen, and your editor will watch for slips.',
    ],
    tryIt: { label: 'Check this chapter for POV slips', action: 'proseReview' },
  },
  {
    id: 'scene',
    title: 'Every scene should turn',
    minutes: 2,
    body: [
      'A scene works when something is different at the end: a discovery, a decision, a relationship shifting, a new danger.',
      'Ask of every scene: what does my character want here? What gets in the way? What changes?',
      'Enter late (skip the arrival and small talk) and leave early (end just after the turn, not when everyone says goodbye).',
    ],
    tryIt: { label: 'Help me build a scene', action: 'scene' },
  },
  {
    id: 'show',
    title: 'Showing and telling (and when telling is right)',
    minutes: 2,
    body: [
      '"She was terrified" tells. "She couldn\'t get the key into the lock" shows. Showing lets the reader feel it themselves.',
      'But telling is fine for moving quickly: "Three days passed without a word from him."',
      'A good rule: show the moments that matter emotionally, and tell the connecting bits.',
    ],
    tryIt: { label: 'Make a passage subtler', action: 'improve', variant: 'subtler' },
  },
  {
    id: 'subtext',
    title: 'Dialogue: people don\'t say what they mean',
    minutes: 2,
    body: [
      'In real life, people dodge, deflect, change the subject, and answer questions they weren\'t asked. That gap is called subtext, and it\'s where tension lives.',
      'A mother saying "You look tired" might mean "You should have come home sooner".',
      'Give each character their own way of talking. Try interviewing them to find it.',
    ],
    tryIt: { label: 'Interview one of my characters', page: 'characters' },
  },
  {
    id: 'clues',
    title: 'Planting clues fairly',
    minutes: 3,
    body: [
      'A fair mystery shows the reader the real clues before the reveal, so the ending feels surprising yet inevitable.',
      'Hide clues in plain sight: mention them in passing, surround them with other details, or have a character misread them.',
      'Each real clue should point to the truth, but make sense another way too. Red herrings point elsewhere, and each one needs an innocent explanation by the end.',
      'Track them all on the Mystery board, then ask "Is it fair?"',
    ],
    tryIt: { label: 'Is my mystery fair?', action: 'fairness' },
  },
  {
    id: 'suspects',
    title: 'Suspects: motive, means, opportunity',
    minutes: 2,
    body: [
      'Readers play detective by weighing who had a reason (motive), the ability (means) and the chance (opportunity).',
      'Give three or four people all three at some point, then clear them one by one, each clearing revealing something new.',
      'The real culprit should be on the list early, but not the most obvious one.',
    ],
    tryIt: { label: 'Open the Suspects board', page: 'mystery' },
  },
  {
    id: 'suspense',
    title: 'Suspense comes from what you hold back',
    minutes: 2,
    body: [
      'Announcing danger ("little did she know…") releases tension. Withholding builds it.',
      'Let the reader know something the character doesn\'t, or make the character want something the reader fears.',
      'Delay answers. Every time you answer a question, raise a new one.',
    ],
    tryIt: { label: 'Make this more suspenseful', action: 'tension' },
  },
  {
    id: 'endings',
    title: 'Chapter endings without cheap cliffhangers',
    minutes: 1,
    body: [
      'Not every chapter needs a shocking last line. That quickly feels mechanical.',
      'Instead, end on a question the reader is now carrying: a decision made, a small wrongness noticed, a door left open.',
      'Ask your "beta reader" what questions they\'re carrying after each chapter. If they have none, the ending may need work.',
    ],
    tryIt: { label: 'Read my chapter like a reader', action: 'betaReader' },
  },
  {
    id: 'backwards',
    title: 'Plotting a mystery backwards',
    minutes: 2,
    body: [
      'Many mystery writers decide the solution first, then work backwards: what must the reader see, and when, for the ending to land?',
      'You don\'t need the whole plan. Knowing who did it and why is enough to start planting.',
      'Your editor can lay out that path chapter by chapter from your ending.',
    ],
    tryIt: { label: 'Plan backwards from my ending', action: 'backwards' },
  },
  {
    id: 'revise',
    title: 'Revising in passes',
    minutes: 2,
    body: [
      'Don\'t fix everything at once. Revise in passes: first the story (does it make sense, is it fair?), then the scenes (does each one turn?), then the sentences.',
      'Big-picture checks come first: Check my mystery, Check my pacing, What\'s missing?',
      'Save line-editing (Improve, Check my prose) for last, so you don\'t polish scenes you later cut.',
    ],
    tryIt: { label: 'What\'s missing from my story?', action: 'missing' },
  },
];
