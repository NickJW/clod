// Every AI feature in the app is one of these actions. Each picks an editor
// role, decides how much of the story it needs (to keep cost down), and says
// what shape of answer it expects so the UI can offer the right buttons.
import type { IdeaCategory, Project } from '../types';
import { FORMAT, type RoleId } from './prompts';
import type { Scope } from './context';
import { characterName, chapterLabel } from '../story/reference';
import { nearbyText } from './context';

export type OutputKind = 'prose' | 'revision' | 'options' | 'findings' | 'text';

export interface Selection {
  chapterId: string;
  start: number;
  end: number;
  text: string;
}

export interface JobInput {
  actionId: ActionId;
  request?: string;
  selection?: Selection;
  chapterId?: string;
  characterId?: string;
  /** Revision level, twist category, stuck-type, etc. */
  variant?: string;
}

export interface Built {
  role: RoleId;
  scope: Scope;
  output: OutputKind;
  user: string;
  maxTokens: number;
  focusText?: string;
  characterIds?: string[];
  fast?: boolean;
  craft?: boolean;
}

export type ActionId =
  | 'think'
  | 'develop'
  | 'scene'
  | 'write'
  | 'continue'
  | 'improve'
  | 'tension'
  | 'proseReview'
  | 'whyNotWorking'
  | 'mysteryCheck'
  | 'fairness'
  | 'continuity'
  | 'pacing'
  | 'missing'
  | 'workOn'
  | 'stuck'
  | 'twist'
  | 'endingCheck'
  | 'developCharacter'
  | 'characterCheck'
  | 'romanceCheck'
  | 'chapterPlan'
  | 'summarize'
  | 'research'
  | 'shape'
  | 'ask';

export interface ActionDef {
  id: ActionId;
  label: string;
  blurb: string;
  needs?: 'selection' | 'request' | 'selection-or-chapter';
  placeholder?: string;
  /** Where "Use this" should file ideas. */
  category?: IdeaCategory;
  build(p: Project, i: JobInput): Built;
}

export const REVISION_LEVELS: { id: string; label: string; instruction: string }[] = [
  { id: 'light', label: 'Light edit', instruction: 'LIGHT EDIT: preserve almost everything. Fix only clear errors, clumsy phrasing, repetition and clichés. Keep her sentences wherever possible.' },
  { id: 'polish', label: 'Polish', instruction: 'POLISH: improve the prose while clearly preserving her voice, content and structure. Tighten, sharpen verbs, cut filler, fix rhythm.' },
  { id: 'professional', label: 'Professional edit', instruction: 'PROFESSIONAL EDIT: substantially improve the prose where needed, to publishable standard, while preserving meaning, events, voice and character.' },
  { id: 'rewrite', label: 'Rewrite', instruction: 'REWRITE: reconstruct the passage from scratch, preserving its events, meaning, character and story intent, but freely changing sentences, order and emphasis.' },
  { id: 'clearer', label: 'Make it clearer', instruction: 'MAKE IT CLEARER: make it easier to follow (who is where, who is speaking, what is happening) without flattening mystery that should stay mysterious.' },
  { id: 'darker', label: 'Make it darker', instruction: 'MAKE IT DARKER: deepen unease and psychological tension through specific detail, implication and what characters avoid, not through gore or ominous adjectives.' },
  { id: 'subtler', label: 'Make it subtler', instruction: 'MAKE IT SUBTLER: remove obvious exposition, stated emotions and melodrama. Let subtext, gesture and silence carry it. Trust the reader.' },
  { id: 'suspense', label: 'More suspenseful', instruction: 'MORE SUSPENSEFUL: increase uncertainty, information asymmetry, vulnerability and anticipation. Delay or withhold; don\'t announce danger.' },
  { id: 'intimate', label: 'More intimate', instruction: 'MORE INTIMATE: increase emotional closeness and interiority for the point-of-view character, through small physical detail and restraint, not declarations.' },
  { id: 'faster', label: 'Make it faster', instruction: 'FASTER: tighten pacing. Cut summary and reflection, shorten paragraphs, enter later and leave earlier.' },
  { id: 'literary', label: 'More literary', instruction: 'MORE LITERARY: increase specificity, subtext, imagery and thematic resonance, with occasional striking language. Do not become purple.' },
];

export const TWIST_KINDS = [
  'Any kind',
  'Identity',
  'Motive',
  'Relationship',
  'Timeline',
  'Evidence',
  'Betrayal',
  'Unreliable information',
  'Hidden connection',
  'False death',
  'Secret past',
  'Conspiracy',
  'Mistaken identity',
  'Moral reversal',
];

export const STUCK_KINDS = ['Plot', 'Character', 'Scene', 'Mystery', 'Romance', 'Pacing', 'Ending', 'Prose', 'Research', 'I don\'t know'];

function passage(i: JobInput, p: Project): { text: string; label: string } {
  if (i.selection?.text.trim()) return { text: i.selection.text, label: 'the selected passage' };
  const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
  return { text: ch?.text ?? '', label: ch ? `${chapterLabel(p, ch.id)} (whole chapter)` : 'the chapter' };
}

function surrounding(p: Project, i: JobInput): string {
  const sel = i.selection;
  if (!sel) return '';
  const ch = p.chapters.find((c) => c.id === sel.chapterId);
  if (!ch) return '';
  const { before, after } = nearbyText(ch.text, sel.start, sel.end, 2500, 800);
  return (before ? `\n\n(For continuity only. Text just BEFORE the passage:)\n"""${before}"""` : '') + (after ? `\n(Text just AFTER:)\n"""${after}"""` : '');
}

const req = (i: JobInput) => (i.request?.trim() ? `\n\nThe author says: "${i.request.trim()}"` : '');

export const ACTIONS: Record<ActionId, ActionDef> = {
  think: {
    id: 'think',
    label: 'Help me think',
    blurb: 'Describe a problem or an idea. Get a few strong possibilities, each with its pros and cons.',
    needs: 'request',
    placeholder: 'e.g. "I want the victim to have a secret, but I don\'t know what it should be."',
    category: 'plot',
    build: (_p, i) => ({
      role: 'brainstorm',
      scope: 'whole',
      output: 'options',
      maxTokens: 3000,
      user: `Help the author brainstorm.${req(i)}\n\nGround every option in her existing story. Don't repeat anything SET ASIDE. Don't contradict CANON.\n\n${FORMAT.options}`,
      craft: false,
    }),
  },
  develop: {
    id: 'develop',
    label: 'Help me develop this',
    blurb: 'Give a rough idea. Your editor asks good questions and shapes it into motives, stakes and scenes.',
    needs: 'request',
    placeholder: 'e.g. "Julian owes money to someone dangerous."',
    category: 'plot',
    build: (_p, i) => ({
      role: 'developmental',
      scope: 'whole',
      output: 'text',
      maxTokens: 1800,
      user: `The author has a rough idea she wants to develop.${req(i)}\n\nHelp her develop it. First, in a sentence or two, reflect back what's promising about it. Then, depending on what's missing, help turn it into: character motivation, conflict, stakes, complications, secrets, consequences, and two or three possible scenes. Mark everything you propose as a possibility. End with the 1-3 questions whose answers would most shape this idea. Use short headings and bullets. Keep it under 450 words.`,
      craft: false,
    }),
  },
  scene: {
    id: 'scene',
    label: 'Help me build this scene',
    blurb: 'Work out what each character wants, knows and hides, and what changes. Then outline the scene.',
    placeholder: 'Describe the scene, or leave blank to use this chapter\'s plan.',
    category: 'scene',
    build: (p, i) => {
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      return {
        role: 'scene',
        scope: 'local',
        output: 'text',
        maxTokens: 2000,
        focusText: (i.request ?? '') + (ch?.text.slice(-3000) ?? ''),
        user: `Help the author build a scene for ${ch ? chapterLabel(p, ch.id) : 'the current chapter'}.${req(i)}\n\n${ch?.text.trim() ? `The chapter so far ends with:\n"""${ch.text.slice(-2500)}"""\n\n` : ''}Work through, briefly and specifically: point of view, where and when, who's present, what each character wants, what each knows, what the reader knows, what is being concealed, the conflict, the emotional turn, what information is revealed, what must stay hidden, and how the scene ends (the final beat). Then give a short beat-by-beat outline (5-9 beats). If a key choice isn't clear from the story bible, ask about it at the end instead of guessing. Use headings and bullets. Under 550 words.`,
        craft: false,
      };
    },
  },
  write: {
    id: 'write',
    label: 'Write from my notes',
    blurb: 'Give your rough notes or beats. Your editor turns them into prose, keeping your intent.',
    needs: 'request',
    placeholder: 'e.g. "Nora enters the house. She knows something is wrong. She finds the photograph. She has seen the man in it before."',
    build: (p, i) => {
      const chId = i.selection?.chapterId ?? i.chapterId ?? p.currentChapterId;
      const ch = p.chapters.find((c) => c.id === chId);
      const pos = i.selection?.start ?? ch?.text.length ?? 0;
      const before = ch ? ch.text.slice(Math.max(0, pos - 5000), pos) : '';
      return {
        role: 'prose',
        scope: 'local',
        output: 'prose',
        maxTokens: 3500,
        focusText: `${i.request ?? ''}\n${before.slice(-2000)}`,
        user: `Turn the author's notes into finished prose for ${ch ? chapterLabel(p, ch.id) : 'the chapter'}. Dramatise her beats in order. Keep every fact and choice she gives. Add only small concrete texture, never new plot. Match the point of view, tense and voice of the existing text.${
          before.trim() ? `\n\nThe prose must continue naturally from this existing text (do not repeat it):\n"""${before}"""` : ''
        }\n\nHER NOTES:\n"""${i.request ?? ''}"""\n\n${FORMAT.prose}`,
      };
    },
  },
  continue: {
    id: 'continue',
    label: 'Continue the scene',
    blurb: 'Writes the next few paragraphs from where your cursor is. Say where it should go, or leave blank.',
    placeholder: 'Optional: where should it go next?',
    build: (p, i) => {
      const chId = i.selection?.chapterId ?? i.chapterId ?? p.currentChapterId;
      const ch = p.chapters.find((c) => c.id === chId);
      const pos = i.selection ? i.selection.end : (ch?.text.length ?? 0);
      const before = ch ? ch.text.slice(Math.max(0, pos - 6000), pos) : '';
      return {
        role: 'prose',
        scope: 'local',
        output: 'prose',
        maxTokens: 1500,
        focusText: before.slice(-2500),
        user: `Continue the author's text from exactly where it stops, for roughly 250-400 words. Keep her voice, point of view and tense. Follow the chapter plan if there is one. Don't resolve the scene's tension early, don't reveal secrets marked hidden, and don't end on a forced cliffhanger.${req(i)}\n\nTEXT SO FAR:\n"""${before}"""\n\n${FORMAT.prose}`,
      };
    },
  },
  improve: {
    id: 'improve',
    label: 'Make this better',
    blurb: 'Select a passage and choose how much to change. You see every change before accepting.',
    needs: 'selection',
    build: (p, i) => {
      const level = REVISION_LEVELS.find((l) => l.id === i.variant) ?? REVISION_LEVELS[1];
      return {
        role: 'prose',
        scope: 'local',
        output: 'revision',
        maxTokens: Math.min(8000, Math.ceil((i.selection?.text.length ?? 2000) / 2.5) + 900),
        focusText: i.selection?.text,
        user: `Revise the author's passage. ${level.instruction}\nPreserve plot facts, character knowledge, point of view and tense. Don't add events.${req(i)}${surrounding(p, i)}\n\nPASSAGE TO REVISE:\n"""${i.selection?.text ?? ''}"""\n\n${FORMAT.revision}`,
      };
    },
  },
  tension: {
    id: 'tension',
    label: 'Make this more suspenseful',
    blurb: 'Finds specific chances to add uncertainty, stakes and pressure to a scene.',
    needs: 'selection-or-chapter',
    build: (p, i) => {
      const x = passage(i, p);
      return {
        role: 'developmental',
        scope: 'local',
        output: 'findings',
        maxTokens: 2200,
        focusText: x.text,
        user: `Analyse ${x.label} for suspense. Identify specific opportunities involving: uncertainty, information asymmetry (who knows what), stakes, time pressure, physical vulnerability, emotional vulnerability, secrets, unanswered questions and conflicting goals. Point to exact moments (quote a few words). For each, suggest a concrete change that fits her story. Don't recommend ominous adjectives or announcing danger.${req(i)}\n\nTEXT:\n"""${x.text}"""\n\n${FORMAT.findings}`,
      };
    },
  },
  proseReview: {
    id: 'proseReview',
    label: 'Professional editor review',
    blurb: 'A careful read of your prose: voice, rhythm, dialogue, subtext, clichés, POV and artificial-sounding writing.',
    needs: 'selection-or-chapter',
    build: (p, i) => {
      const x = passage(i, p);
      return {
        role: 'prose',
        scope: 'local',
        output: 'findings',
        maxTokens: 3000,
        focusText: x.text,
        user: `Give a professional line-and-craft review of ${x.label}. Consider: voice (consistent narrative personality?), rhythm (natural variety in sentence length?), dialogue (does each character sound distinct?), subtext (do characters say exactly what they mean too often?), description (specific or generic?), pacing, exposition (information dumps?), clichés and stock thriller phrases, emotional writing (telling the reader what to feel?), point of view slips, repetition (words, sentence patterns, images, emotional beats), and passages that sound overly polished, generic or symmetrical, the kind of prose people associate with AI. Quote the exact words for each finding and give a better alternative. Mention what already works so she keeps it. Don't mention AI detectors.${req(i)}\n\nTEXT:\n"""${x.text}"""\n\n${FORMAT.findings}`,
      };
    },
  },
  whyNotWorking: {
    id: 'whyNotWorking',
    label: 'Why isn\'t this scene working?',
    blurb: 'Diagnoses what might be making a scene feel flat, confusing or slow.',
    needs: 'selection-or-chapter',
    placeholder: 'Optional: what feels wrong about it?',
    build: (p, i) => {
      const x = passage(i, p);
      return {
        role: 'developmental',
        scope: 'local',
        output: 'findings',
        maxTokens: 2200,
        focusText: x.text,
        user: `The author feels ${x.label} isn't working.${req(i)}\nDiagnose likely causes: is there a clear want and obstacle? Does anything change? Is the conflict real? Is information arriving in the best order? Is the tension undercut by explanation? Is the point of view clear? Are we entering too early or leaving too late? Give the 3-5 most likely causes with specific evidence and one fix each.\n\nTEXT:\n"""${x.text}"""\n\n${FORMAT.findings}`,
      };
    },
  },
  mysteryCheck: {
    id: 'mysteryCheck',
    label: 'Check my mystery',
    blurb: 'Looks at clues, secrets, red herrings and the solution. Finds gaps and contradictions.',
    category: 'mystery',
    build: (_p, i) => ({
      role: 'mystery',
      scope: 'mystery',
      output: 'findings',
      maxTokens: 3000,
      user: `Review the mystery as a whole: who/what/when/why/how, clues, red herrings, secrets, character beliefs and what the reader knows by each chapter. Look for: contradictions with established facts; red herrings with no believable innocent explanation; clues that point nowhere; a solution the reader could not possibly infer; a solution so obvious that the reader could solve it too early (say roughly by which chapter); motives that don't hold; characters who know things they couldn't; missing opportunities for misdirection. Explain each as a trade-off. Don't declare her approach wrong.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  fairness: {
    id: 'fairness',
    label: 'Is my mystery fair?',
    blurb: 'Checks whether the big reveals are earned, and whether the reader could solve it too early.',
    category: 'mystery',
    build: (_p, i) => ({
      role: 'mystery',
      scope: 'mystery',
      output: 'findings',
      maxTokens: 2500,
      user: `Assess mystery fair play. For each major reveal (the culprit, key secrets, planned twists): Is it foreshadowed? Supported by genuine clues the reader sees before the reveal? Consistent with prior facts? Surprising but logical in hindsight? Then estimate when an attentive reader could first solve it, and whether every clue points too directly at the culprit. Present the trade-offs (e.g. "more fair, but more guessable").${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  continuity: {
    id: 'continuity',
    label: 'Check continuity',
    blurb: 'Compares this chapter with your story bible and timeline: who knows what, who is where, and established facts.',
    needs: 'selection-or-chapter',
    build: (p, i) => {
      const x = passage(i, p);
      return {
        role: 'continuity',
        scope: 'mystery',
        output: 'findings',
        maxTokens: 2500,
        focusText: x.text,
        user: `Check ${x.label} against the story bible, timeline and earlier chapters. Flag: characters knowing or discovering things inconsistent with what they already know; characters acting against established relationships without explanation; secrets revealed earlier than planned; timeline or location impossibilities; contradicted facts, names or physical details. Quote the exact text. Only report real issues. If there are none, say so. Never assume the fix: offer options.\n\nTEXT:\n"""${x.text}"""\n\n${FORMAT.findings}`,
        craft: false,
      };
    },
  },
  pacing: {
    id: 'pacing',
    label: 'Check my pacing',
    blurb: 'Looks across all your chapters and scenes for patterns in escalation, romance and reveals.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Look across the chapter list, scenes and summaries for structural patterns: stretches without escalation, investigation scenes with no new information, a relationship that hasn't changed for several chapters, reveals clustered too closely or too far apart, a central question that gets resolved too early, point-of-view imbalance, and where the midpoint and climax fall. Describe each pattern and its effect. Don't declare it wrong. Let the author decide.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  missing: {
    id: 'missing',
    label: 'What\'s missing?',
    blurb: 'Points out undecided or thin areas of your story that would help the most to settle.',
    build: (_p, i) => ({
      role: 'developmental',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2000,
      user: `What important pieces of this story are missing, thin or undecided? Consider the mystery's solution, motives, the protagonist's want and wound, antagonist logic, relationships, the ending, and what the reader knows when. Pick the most important 3-6.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  workOn: {
    id: 'workOn',
    label: 'What should I work on?',
    blurb: 'A gentle suggestion for the most useful next step, based on where your book is now.',
    build: (_p, i) => ({
      role: 'developmental',
      scope: 'whole',
      output: 'findings',
      maxTokens: 1500,
      user: `Based on the whole project, suggest the 2-4 most useful next steps for the author right now. Be specific to her book (e.g. "define what Nora actually knows at the end of Chapter 6"). This is a creative suggestion, not homework: gentle, brief, encouraging without flattery. Use level "note" for all.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  stuck: {
    id: 'stuck',
    label: 'I\'m stuck',
    blurb: 'Tell your editor what kind of stuck. You\'ll get targeted help, usually starting with a question.',
    placeholder: 'Optional: say a little about where you\'re stuck.',
    build: (p, i) => {
      const kind = i.variant ?? 'I don\'t know';
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      const role: RoleId =
        kind === 'Mystery' ? 'mystery' : kind === 'Character' || kind === 'Romance' ? 'character' : kind === 'Scene' ? 'scene' : kind === 'Prose' ? 'prose' : kind === 'Research' ? 'research' : 'developmental';
      return {
        role,
        scope: kind === 'Prose' || kind === 'Scene' ? 'local' : 'whole',
        output: 'text',
        maxTokens: 1500,
        focusText: ch?.text.slice(-3000),
        user: `The author is stuck. Kind of problem: ${kind}. She is currently on ${ch ? chapterLabel(p, ch.id) : 'her novel'}.${req(i)}${
          ch?.text.trim() ? `\n\nThe current chapter ends:\n"""${ch.text.slice(-1800)}"""` : ''
        }\n\nHelp her get unstuck like a good developmental editor would. Briefly name what seems to be blocking her, in one or two sentences, based on her project. Then either ask the one question that would unblock her, or offer 2-3 concrete ways forward (small, doable, specific to her story), whichever is more useful here. Warm, plain, under 300 words.`,
        craft: kind === 'Prose',
      };
    },
  },
  twist: {
    id: 'twist',
    label: 'Develop a twist',
    blurb: 'Twists built from your own story, each with the clues needed to make it land.',
    category: 'twist',
    build: (_p, i) => ({
      role: 'mystery',
      scope: 'mystery',
      output: 'options',
      maxTokens: 3500,
      user: `Propose 3-4 twists grounded in the author's actual story and canon. Kind of twist: ${i.variant ?? 'Any kind'}.${req(i)}\nNo twists for pure shock value: each must deepen character or theme and be fair.\n\nRespond ONLY with JSON in a \`\`\`json code block: {"options": [{"title": "", "idea": "what is actually true", "believes": "what the reader currently believes", "hidden": "why the truth was hidden (who hid it and how)", "clues": "genuine clues that support it, and where to plant them", "falseClues": "false clues that support the alternative", "when": "when the reader learns it", "changes": "what it changes", "weaknesses": "potential problems"}], "note": ""}`,
      craft: false,
    }),
  },
  endingCheck: {
    id: 'endingCheck',
    label: 'Check my ending',
    blurb: 'Looks for dangling threads, unresolved arcs and whether the ending pays off the mystery.',
    category: 'ending',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Review the planned ending against everything set up in the story: the central mystery resolution, character arcs, the romance, major secrets, clues and red herrings that need explaining, theme, final image and emotional aftermath. List dangling threads. Distinguish threads that seem accidentally dropped from ones that could work as intentional ambiguity. Don't insist everything be resolved.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  developCharacter: {
    id: 'developCharacter',
    label: 'Develop this character',
    blurb: 'Questions and possibilities that make a character deeper, more specific and more contradictory.',
    category: 'character',
    placeholder: 'Optional: what do you want to figure out about them?',
    build: (p, i) => {
      const name = characterName(p, i.characterId ?? '');
      return {
        role: 'character',
        scope: 'whole',
        output: 'text',
        maxTokens: 1800,
        characterIds: i.characterId ? [i.characterId] : [],
        user: `Help the author develop ${name || 'this character'}.${req(i)}\nLook at what's already established. Offer: the most interesting contradiction in them, a secret or lie that would create story pressure (as a possibility), how their public and private selves differ, what they want versus what they fear, how they might speak (with two sample lines of dialogue in their voice), and a possible breaking point. Then ask the 2-3 questions whose answers would most define them. Mark everything you propose as a possibility. Headings and bullets, under 500 words.`,
        craft: false,
      };
    },
  },
  characterCheck: {
    id: 'characterCheck',
    label: 'Check this character\'s consistency',
    blurb: 'Looks for contradictions in what they know, how they act, and how they sound.',
    build: (p, i) => {
      const c = p.characters.find((x) => x.id === i.characterId);
      const where = p.chapters
        .filter((ch) => c && ch.text.includes(c.name.split(' ')[0]))
        .map((ch) => `${chapterLabel(p, ch.id)}: ${ch.summary || '(no summary)'}`)
        .join('\n');
      return {
        role: 'character',
        scope: 'whole',
        output: 'findings',
        maxTokens: 2000,
        characterIds: c ? [c.id] : [],
        user: `Check ${c?.name ?? 'this character'} for consistency across the story bible and chapter summaries: knowledge (do they learn things they already knew, or act on things they couldn't know?), relationships (behaviour that contradicts established feelings without explanation), secrets (revealed or hinted too early?), voice and motivation.\nChapters where they appear:\n${where || '(none yet)'}\n\n${FORMAT.findings}`,
        craft: false,
      };
    },
  },
  romanceCheck: {
    id: 'romanceCheck',
    label: 'Check the romance',
    blurb: 'How the relationship is developing, and whether it feels like two real people.',
    category: 'romance',
    build: (_p, i) => ({
      role: 'character',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2000,
      user: `Review the romantic thread(s): attraction, trust, chemistry, vulnerability, conflict, secrets, power dynamics, emotional dependence, betrayal, intimacy and progression across chapters. Is it changing? Does it feel like two specific people rather than genre beats? Is it overwhelming the mystery, or is the mystery pressure feeding it (proximity, danger, shared secrets, conflicting desires, restraint)? Not every interaction should be sexual tension. Respect the author's romance and explicitness settings.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  chapterPlan: {
    id: 'chapterPlan',
    label: 'Turn my answers into a chapter plan',
    blurb: 'Uses your answers to the chapter questions to make a clear plan you can write from.',
    build: (p, i) => {
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      return {
        role: 'scene',
        scope: 'local',
        output: 'text',
        maxTokens: 1500,
        user: `Turn the author's answers for ${ch ? chapterLabel(p, ch.id) : 'this chapter'} (see "Chapters" in the story bible) into a structured chapter plan: 2-4 scenes, each with point of view, place, what the protagonist wants, what gets in the way, the key beat, and how it ends. Finish with the question the reader should carry into the next chapter. Stay within her answers; mark any addition as "(suggestion)". Plain text with short headings, under 400 words. No preamble.${req(i)}`,
        craft: false,
      };
    },
  },
  summarize: {
    id: 'summarize',
    label: 'Update chapter summary',
    blurb: 'A short factual summary your editor uses to remember this chapter, so it doesn\'t need to reread everything.',
    build: (p, i) => {
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      return {
        role: 'continuity',
        scope: 'minimal',
        output: 'text',
        maxTokens: 600,
        fast: true,
        user: `Summarise this chapter factually for the author's story bible, in 80-150 words: what happens, who is present, what is revealed to the reader, what each point-of-view character learns or now believes, clues that appear, and where it leaves the characters. No evaluation. No preamble.\n\nCHAPTER: ${ch?.title ?? ''}\n"""${ch?.text ?? ''}"""`,
        craft: false,
      };
    },
  },
  research: {
    id: 'research',
    label: 'Research question',
    blurb: 'Real-world facts for fiction: police procedure, medicine, law, places. Always check the important ones.',
    needs: 'request',
    placeholder: 'e.g. "How long would it take police to identify a body found in the sea?"',
    build: (_p, i) => ({
      role: 'research',
      scope: 'minimal',
      output: 'text',
      maxTokens: 1500,
      user: `Research question from the author:${req(i)}\n\nAnswer in three short sections: "Generally accepted", "Varies / depends on", and "Verify with". Then add "For your story" with one or two ways it could work in her plot, and where fiction can reasonably bend reality. Be honest about uncertainty. Don't invent citations, statute numbers or statistics. Under 400 words.`,
      craft: false,
    }),
  },
  shape: {
    id: 'shape',
    label: 'Shape my thoughts',
    blurb: 'Talk or type freely. Your editor organises it into notes, scene ideas, character notes, outline or prose.',
    needs: 'request',
    placeholder: 'Say or type whatever is on your mind about the story…',
    build: (_p, i) => {
      const target = i.variant ?? 'notes';
      const how: Record<string, string> = {
        notes: 'tidy, organised notes grouped under short headings, keeping all of her ideas and her wording where it matters',
        scene: 'a list of scene ideas, each with who, where, and what happens',
        character: 'character notes grouped by character',
        outline: 'a simple ordered outline',
        prose: 'draft prose that dramatises what she described, in her story\'s voice',
      };
      return {
        role: target === 'prose' ? 'prose' : 'developmental',
        scope: target === 'prose' ? 'local' : 'minimal',
        output: target === 'prose' ? 'prose' : 'text',
        maxTokens: 2000,
        focusText: i.request,
        user: `The author spoke or typed her thoughts freely:\n"""${i.request ?? ''}"""\n\nTurn this into ${how[target] ?? how.notes}. Keep her ideas as hers. Don't add new plot, and mark any gap as a question. ${target === 'prose' ? FORMAT.prose : 'No preamble.'}`,
        craft: target === 'prose',
      };
    },
  },
  ask: {
    id: 'ask',
    label: 'Ask your editor',
    blurb: 'Any question about your story or your writing.',
    needs: 'request',
    placeholder: 'Ask anything about your book…',
    build: (p, i) => {
      const x = i.selection?.text ? `\n\nShe has this passage selected:\n"""${i.selection.text}"""` : '';
      return {
        role: 'developmental',
        scope: 'whole',
        output: 'text',
        maxTokens: 1800,
        focusText: `${i.request ?? ''} ${i.selection?.text ?? ''}`,
        characterIds: i.characterId ? [i.characterId] : [],
        user: `${req(i).trim()}${x}\n\nAnswer as her editor, specific to her book. If the honest answer depends on a choice she hasn't made, say so and ask.${p.chapters.length ? '' : ''}`,
        craft: true,
      };
    },
  },
};

/** The modes shown at the top of the editor panel. */
export const PANEL_MODES: { id: ActionId; short: string }[] = [
  { id: 'think', short: 'Think' },
  { id: 'develop', short: 'Develop' },
  { id: 'scene', short: 'Scene' },
  { id: 'write', short: 'Write' },
  { id: 'improve', short: 'Improve' },
  { id: 'tension', short: 'Tension' },
  { id: 'mysteryCheck', short: 'Mystery' },
  { id: 'ask', short: 'Ask' },
];
