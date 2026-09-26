// What Pip (the little helper bird) knows about Nightjar: every page, the everyday
// how-tos, and every editor action (read from the app itself so it stays current).
import type { Page } from '../story/store';
import { ACTIONS } from '../ai/actions';
import { GUIDE } from '../story/guide';

export interface HelpTopic {
  q: string; // how she might ask
  a: string; // the plain answer
  go?: Page;
  show?: string; // a button, tab or label to point at
  keys: string; // extra words for the offline search
}

export const PAGES: Record<Page, string> = {
  home: 'Home: your book at a glance: title, progress, today\'s word goal, "Continue writing", today\'s scene, your pace, and backup reminders.',
  guide: 'Guide: the step-by-step writing journey (15 steps in the best order), with the video tour. "Next step" takes you to the right place.',
  write: 'Write: the writing room. Chapters on the left, the page in the middle. Saves by itself. Toolbar: status, point of view, undo/redo, Find, Listen (reads aloud), Talk (dictate), Focus, More (history, notes, chapter check, export). Select words to get Improve, Make darker, More suspense, Subtler, Sound like me, Editor\'s review, Ask about this, Italic, Add note.',
  story: 'Story Bible: premise, genre, setting, themes; the "Tone & feel" tab (sliders, style words, things you never want, books and authors you love, your style guide); and "Decisions & ideas" (every idea marked Decided, Maybe, Draft, or Set aside).',
  characters: 'Characters: a card for each person (wants, fears, secrets, public face and private self), relationships, "Interview" a character, develop or check consistency.',
  mystery: 'Mystery: clues and red herrings, suspects (motive, means, opportunity), "Connect the dots", the truth of what really happened, secrets, and who knows what.',
  timeline: 'Timeline: when things really happened, including backstory before page one, and what each character knew when.',
  scenes: 'Scenes & Outline: plan each chapter by answering simple questions, turn answers into a plan, corkboard view, scenes, and chapter summaries for your editor.',
  ending: 'Ending: how it all resolves, where each character ends up, loose threads, and "Plan backwards from my ending".',
  research: 'Research & Notes: notes (type or talk), research questions with sources, and places.',
  lab: 'Story Lab: page-turner chart, solvability test (can readers guess too early?), stress tests, opening pages (the agent\'s desk, first line, reader panel), Publisher screening, and the editorial letter.',
  polish: 'Polish: manuscript health (lengths, dialogue, point of view), "Sounds like you" (AI-sounding check and rewrite), style sheet, names, motifs, proofreading and final checks.',
  publish: 'Publish: market fit, pitch materials (logline, blurb, synopsis, query letter), finding agents and a tracker, the submission package, human readers, self-publishing.',
  series: 'Series: series potential, sequel seeds, a new mystery from this world, the series arc, and "Start Book 2".',
  settings: 'Settings & Backup: connect the AI editor, appearance (text size, dark mode, fonts, motion), export (Word, PDF, ebook), import, backups (file, folder, Google Drive), safety copies, your novels, privacy.',
};

export const TOPICS: HelpTopic[] = [
  { q: 'How do I start writing a chapter?', a: 'Open Write, click a chapter on the left (or "New chapter"), and type on the page. It saves by itself. If the page is empty, you can also click "Draft this chapter for me" for a first version to rework.', go: 'write', keys: 'begin start chapter type page new' },
  { q: 'How does the AI editor work?', a: 'Your editor is the panel on the right. Pick a mode at the top (Think, Develop, Scene, Write, Improve, Tension, Mystery, Ask), type or talk, and press the button. Nothing it suggests goes into your book until you accept it.', go: 'write', show: 'Your editor', keys: 'ai editor assistant panel help suggestions right' },
  { q: 'How do I connect the AI?', a: 'Go to Settings, "Your AI editor". Choose Google Gemini (free) and paste the key, or open the setup link someone sent you.', go: 'settings', show: 'Your AI editor', keys: 'connect key gemini setup link api ai not connected' },
  { q: 'Where is my book saved? How do I back it up?', a: 'It saves on this computer automatically. For a safety copy, go to Settings and use "Save my novel to Google Drive", choose a backup folder, or "Save a backup file".', go: 'settings', show: 'Complete backup', keys: 'save saved backup lost crash safe copy drive folder' },
  { q: 'How do I use it on another computer?', a: 'On the new computer, open the Nightjar link and choose "Continue from Google Drive" (after saving to Drive on this one), or use "Restore a backup file".', go: 'settings', keys: 'another computer laptop switch move device sync drive restore' },
  { q: 'How do I improve a paragraph?', a: 'In Write, select the words with your mouse. A small bar appears: choose Improve, Make darker, More suspense, Subtler or Sound like me. You see the changes before accepting.', go: 'write', keys: 'improve better edit rewrite paragraph select passage polish' },
  { q: 'How do I undo a change?', a: 'Use the undo arrow at the top of the Write page, or More, then History, to bring back any earlier version of the chapter.', go: 'write', show: 'More', keys: 'undo mistake back history restore version deleted' },
  { q: 'How do I dictate instead of typing?', a: 'Press the Talk button (the microphone) and speak. Say "new paragraph" or "full stop" for punctuation.', go: 'write', show: 'Talk', keys: 'talk speak dictate voice microphone typing' },
  { q: 'How do I hear my chapter read aloud?', a: 'In Write, press Listen at the top. You can change the speed or stop it.', go: 'write', show: 'Listen', keys: 'listen read aloud hear voice' },
  { q: 'How do I make the text bigger?', a: 'Go to Settings, Appearance, and choose a larger text size. You can also switch on dark mode there.', go: 'settings', show: 'Appearance', keys: 'bigger text size font large small read eyes dark mode' },
  { q: 'How do I print or send my book as a Word file?', a: 'Go to Settings, Export: choose Word document (the standard manuscript format), PDF, or ebook.', go: 'settings', show: 'Word document', keys: 'print word docx pdf export send email ebook file' },
  { q: 'What should I do next?', a: 'Open the Guide: it shows the next step in the recommended order, and "Next step" takes you there.', go: 'guide', keys: 'next what now stuck lost order steps' },
  { q: 'How do I leave the example book?', a: 'Use "Start my own novel" or "Back to my novels" in the banner at the top while the example is open.', keys: 'example demo salt house leave exit my own' },
  { q: 'How do I plan a chapter?', a: 'Open Scenes & Outline, pick the chapter, and answer the questions (What happens? What does she want?). Then "Turn my answers into a plan".', go: 'scenes', keys: 'plan outline chapter questions scenes' },
  { q: 'How do I add a character?', a: 'Open Characters and click "Add a character". Fill in what you know; skip the rest.', go: 'characters', show: 'Add a character', keys: 'character person add new people' },
  { q: 'How do I add a clue?', a: 'Open Mystery, the Clues tab, and click "Add a clue". Say which chapter it appears in and what it really points to.', go: 'mystery', show: 'Add a clue', keys: 'clue red herring mystery evidence' },
  { q: 'How do I make sure it doesn\'t sound like AI?', a: 'Open Polish, "Sounds like you". It checks every chapter and can rewrite drafted passages in your voice. In Write, select a passage and choose "Sound like me".', go: 'polish', show: 'Sounds like you', keys: 'ai sound human voice robotic detect sounds like me' },
  { q: 'Would a publisher like my book?', a: 'Open Story Lab, "Publisher screening". It scores the book the way agencies screen submissions and says what would change the answer.', go: 'lab', show: 'Publisher screening', keys: 'publisher agent submit screening score good enough' },
  { q: 'How do I write a query letter?', a: 'Open Publish, Pitch materials. Your editor can draft the logline, blurb, synopsis and query letter from your book for you to rework.', go: 'publish', show: 'Pitch materials', keys: 'query letter pitch synopsis blurb logline agent' },
  { q: 'How do I watch the video tour?', a: 'Open the Guide and press "Watch the video tour".', go: 'guide', show: 'Watch the video tour', keys: 'video tour tutorial watch how to learn' },
  { q: 'How do I set a daily goal?', a: 'On Home, next to "Today", click "Change goal".', go: 'home', show: 'Change goal', keys: 'goal daily words target today' },
  { q: 'How do I find a word in my book?', a: 'In Write, press Find (or Ctrl+F). It can search the whole book and replace words too.', go: 'write', show: 'Find', keys: 'find search word replace' },
];

/** The full manual, for the AI helper's instructions. */
export function manualText(): string {
  const pages = Object.entries(PAGES).map(([k, v]) => `- [${k}] ${v}`).join('\n');
  const topics = TOPICS.map((t) => `- ${t.q} ${t.a}${t.go ? ` (page: ${t.go}${t.show ? `, button: "${t.show}"` : ''})` : ''}`).join('\n');
  const actions = Object.values(ACTIONS).map((a) => `- "${a.label}": ${a.blurb}`).join('\n');
  const guide = GUIDE.map((g, i) => `${i + 1}. ${g.title} (page: ${g.page}): ${g.why}`).join('\n');
  return `PAGES (id in brackets):\n${pages}\n\nHOW-TOS:\n${topics}\n\nTHE GUIDE'S STEPS:\n${guide}\n\nEVERYTHING THE AI EDITOR CAN DO (button labels):\n${actions}`;
}

/** Offline answer: the best-matching how-to, if any. */
export function localAnswer(question: string): HelpTopic | null {
  const words = question.toLowerCase().match(/[a-z']+/g) ?? [];
  const stop = new Set(['how', 'do', 'i', 'the', 'a', 'to', 'my', 'is', 'it', 'what', 'where', 'can', 'you', 'me', 'of', 'and', 'in', 'on', 'for', 'this', 'does', 'an', 'with']);
  const useful = words.filter((w) => !stop.has(w) && w.length > 2);
  let best: HelpTopic | null = null;
  let bestScore = 0;
  for (const t of TOPICS) {
    const hay = `${t.q} ${t.keys}`.toLowerCase();
    const score = useful.reduce((s, w) => s + (hay.includes(w) ? 2 : hay.includes(w.slice(0, 4)) ? 1 : 0), 0);
    if (score > bestScore) (best = t), (bestScore = score);
  }
  return bestScore >= 2 ? best : null;
}
