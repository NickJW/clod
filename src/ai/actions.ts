// Every AI feature in the app is one of these actions. Each picks an editor
// role, decides how much of the story it needs (to keep cost down), and says
// what shape of answer it expects so the UI can offer the right buttons.
import type { IdeaCategory, Project } from '../types';
import { FORMAT, type RoleId } from './prompts';
import type { Scope } from './context';
import { characterName, chapterLabel, countWords } from '../story/reference';
import { freshnessBrief, draftAudit } from '../editor/freshness';
import { nearbyText } from './context';

export type OutputKind = 'prose' | 'revision' | 'options' | 'findings' | 'text' | 'extract';

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
  /** Weak patterns found in a previous draft, to steer the retry away from them. */
  avoid?: string;
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
  /** Use web search where the provider supports it. */
  search?: boolean;
  /** Ask the provider for strict JSON output. */
  json?: boolean;
  /** A second, line-editing pass over the first result (prose only; skipped for copy & paste). */
  secondPass?: (draft: string, cutShort: boolean) => { user: string; maxTokens: number };
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
  | 'draftChapter'
  | 'styleProfile'
  | 'summarize'
  | 'research'
  | 'shape'
  | 'extract'
  | 'backwards'
  | 'connect'
  | 'hiddenConnections'
  | 'betaReader'
  | 'interview'
  | 'pitch'
  | 'bookAnalysis'
  | 'solvability'
  | 'readerPanel'
  | 'killerCounter'
  | 'plotHoles'
  | 'detective'
  | 'twistImpact'
  | 'setPieces'
  | 'rootForHer'
  | 'chemistry'
  | 'altEndings'
  | 'characterArcs'
  | 'dialogueVoices'
  | 'premiseTest'
  | 'hookAmplifier'
  | 'learnFrom'
  | 'editorialLetter'
  | 'firstPages'
  | 'firstLine'
  | 'wordOfMouth'
  | 'genrePromise'
  | 'proofread'
  | 'voiceDrift'
  | 'permissions'
  | 'sensitivity'
  | 'contentNotes'
  | 'todayScene'
  | 'weeklyPlan'
  | 'trends'
  | 'pitchComps'
  | 'titleLab'
  | 'coverBrief'
  | 'readerProfile'
  | 'queryBuilder'
  | 'queryPanel'
  | 'agentMatch'
  | 'contests'
  | 'storeListing'
  | 'humanFeedback'
  | 'seriesPotential'
  | 'sequelSeeds'
  | 'newMystery'
  | 'seriesArc'
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

/** A compact, spoiler-free view of the whole book: each chapter's summary plus its opening and closing lines. */
function bookDigest(p: Project, excerptWords = 120): string {
  return p.chapters
    .map((c, n) => {
      const words = c.text.trim().split(/\s+/).filter(Boolean);
      if (!words.length && !c.summary) return `### Chapter ${n + 1}: ${c.title}\n(not written yet${c.outline.happens ? `; planned: ${c.outline.happens}` : ''})`;
      const open = words.slice(0, excerptWords).join(' ');
      const close = words.length > excerptWords * 2 ? words.slice(-excerptWords).join(' ') : '';
      return `### Chapter ${n + 1}: ${c.title} (${words.length} words)\n${c.summary ? `Summary: ${c.summary}\n` : ''}Opening: "${open}${words.length > excerptWords ? '…' : ''}"${close ? `\nEnding: "…${close}"` : ''}`;
    })
    .join('\n\n');
}

function previousSummaries(p: Project, idx: number): string {
  const prev = p.chapters.slice(0, idx).map((c, n) => `Chapter ${n + 1}: ${c.summary || c.outline.happens || '(no summary)'}`);
  return prev.length ? `What happened before:\n${prev.join('\n')}` : '';
}

/** Pre-scan the whole book locally for passages that could need permission, so long books fit in one request. */
function permissionCandidates(p: Project): string {
  const out: string[] = [];
  let size = 0;
  const known = new Set(p.characters.flatMap((c) => c.name.split(/\s+/)));
  p.chapters.forEach((c, n) => {
    const paras = c.text.split(/\n\s*\n/);
    paras.forEach((para, k) => {
      const t = para.trim();
      if (!t) return;
      const lines = t.split('\n');
      const verse = lines.length >= 3 && lines.every((l) => l.trim().split(/\s+/).length <= 10);
      const epigraph = k === 0 && t.split(/\s+/).length < 40 && /[—–-]\s*[A-Z]/.test(t);
      const mentions = /\b(song|sang|sings|singing|lyric|lyrics|poem|poet|verse|chorus|quoted|quote|radio|album|hymn)\b/i.test(t);
      const italics = /\*[^*\n]{20,}\*/.test(t);
      const names = (t.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z']+)+\b/g) ?? []).filter((m) => !m.split(/\s+/).every((w) => known.has(w)));
      if (verse || epigraph || mentions || italics || names.length) {
        const piece = `[Chapter ${n + 1}] ${t.slice(0, 1200)}`;
        if (size + piece.length < 60000) {
          out.push(piece);
          size += piece.length;
        }
      }
    });
  });
  return out.join('\n\n') || '(No quotations, verse, song or poem mentions, or outside names found in the manuscript.)';
}

function premiseLine(p: Project): string {
  return `"${p.title}", ${p.bible.genre}. ${p.bible.premise || p.mystery.centralQuestion || ''}`.slice(0, 900);
}

function endingText(p: Project): string {
  const e = p.ending;
  return [
    e.resolution && `Resolution: ${e.resolution}`,
    e.characterArcs && `Where characters end up: ${e.characterArcs}`,
    e.romance && `Romance: ${e.romance}`,
    e.secrets && `Secrets that come out: ${e.secrets}`,
    e.intentionallyAmbiguous && `Deliberately ambiguous: ${e.intentionallyAmbiguous}`,
    e.theme && `Theme: ${e.theme}`,
    e.finalImage && `Final image: ${e.finalImage}`,
    e.aftermath && `Aftermath: ${e.aftermath}`,
  ]
    .filter(Boolean)
    .join('\n') || '(Not written yet. Use the mystery truth and premise, and ask her about the ending in "questions".)';
}

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
  draftChapter: {
    id: 'draftChapter',
    label: 'Draft this chapter for me',
    blurb: 'Writes a full first draft of this chapter from your plan, characters, clues and style, then line-edits it. It\'s a starting point for you to make your own.',
    placeholder: 'Optional: anything this draft must include, or a note on how it should feel',
    build: (p, i) => {
      const idx = Math.max(0, p.chapters.findIndex((c) => c.id === (i.chapterId ?? p.currentChapterId)));
      const ch = p.chapters[idx];
      const prev = p.chapters[idx - 1];
      const next = p.chapters[idx + 1];
      const perChapter = p.targetWords && p.targetChapters ? p.targetWords / p.targetChapters : 3000;
      const target = Math.round(Math.min(4500, Math.max(1800, perChapter)) / 100) * 100;
      const existing = ch.text.trim();
      const remaining = existing ? Math.max(800, target - countWords(existing)) : target;
      const clues = p.clues.filter((c) => c.appearsChapterId === ch.id && c.status !== 'discarded');
      const resolved = p.clues.filter((c) => c.resolvedChapterId === ch.id && c.status !== 'discarded');
      const reveals = p.secrets.filter((s) => s.revealChapterId === ch.id && s.status !== 'discarded');
      const facts = p.facts.filter((f) => f.readerLearnsChapterId === ch.id && f.status !== 'discarded');
      const scenes = p.scenes.filter((s) => s.chapterId === ch.id);
      const due = [
        ...clues.map((c) => `- Plant this clue${c.kind ? ` (${c.kind})` : ''}: ${c.title}. ${c.description}${c.trueExplanation ? ` (Its innocent explanation must stay plausible: ${c.trueExplanation})` : ''} Plant it inside ordinary action so it doesn't announce itself.`),
        ...resolved.map((c) => `- Pay off this clue: ${c.title}. ${c.description}`),
        ...reveals.map((s) => `- This secret comes out here: ${s.title}. ${s.description}`),
        ...facts.map((f) => `- The reader learns: ${f.text}`),
      ];
      const fresh = freshnessBrief(p, ch.id);
      const plain = (t: string) => t.replace(/\s+/g, ' ').trim();
      return {
        role: 'prose',
        scope: 'local',
        output: 'prose',
        maxTokens: Math.min(9000, Math.round(remaining * 1.7) + 800),
        focusText: [ch.outline.happens, ch.outline.who, ch.outline.plan, ...scenes.map((s) => `${s.title} ${s.purpose} ${s.conflict}`), i.request ?? ''].join('\n'),
        characterIds: [...new Set([ch.povCharacterId, ...scenes.flatMap((s) => [s.povCharacterId, ...s.characterIds])].filter(Boolean))],
        user: `Write ${existing ? `the rest of ${chapterLabel(p, ch.id)}, continuing from where her text stops` : `a complete first draft of ${chapterLabel(p, ch.id)}`}, about ${remaining.toLocaleString()} words (not fewer than ${Math.round(remaining * 0.85).toLocaleString()}: give the important scenes room to breathe). Use her plan, scenes, characters and clues in the story bible above ("Chapters" has this chapter's plan and scenes). If the plan is thin, build only what the story bible supports and list the choices you had to make in an EDITOR'S NOTE.${req(i)}

${due.length ? `MUST HAPPEN IN THIS CHAPTER:\n${due.join('\n')}\n\n` : ''}${prev?.text.trim() ? `The previous chapter ends like this (continue the story from here, and don't repeat its beats):\n"""${prev.text.trim().slice(-2200)}"""\n\n` : prev?.summary ? `Previous chapter: ${prev.summary}\n\n` : ''}${next && (next.outline.plan || next.outline.happens) ? `Next chapter's plan (set it up, but don't steal its events or reveals): ${plain(next.outline.plan || next.outline.happens).slice(0, 600)}\n\n` : ''}${existing ? `HER TEXT SO FAR (continue seamlessly; do not repeat or rewrite it):\n"""${existing.slice(-5000)}"""\n\n` : ''}Before writing, silently decide: the scenes (use a line with a single * between scenes), each scene's turn (what is different at its end), what the point-of-view character wants in each, what she notices that another person wouldn't, and what stays hidden. Don't output this plan.

How to write it:
- Write like a skilled human novelist, not a machine. A publisher's reader should never suspect AI. Be specific and surprising; sometimes plain; never generic.
- Stay in her voice: match the author's sample, point of view, tense and the tone settings. Where her influences or style guide are given, take their craft qualities, not their phrasing.
- Enter each scene late and leave early. Dramatise the important moments; summarise the connective tissue in a line or two.
- Give every character their own way of speaking. People evade, interrupt, misunderstand and don't say what they feel. No speeches, no exposition in dialogue.
- One precise sensory detail beats three general ones. Ground each scene in place and body.
- Vary sentence length and paragraph length on purpose. Avoid runs of sentences that start the same way, and avoid repeating any distinctive word or image within the chapter.
- Plant clues inside ordinary action and let red herrings stay plausible. Keep secrets secret unless listed above.
- End on the chapter's open question or an emotional turn, not a manufactured cliffhanger or an ominous one-liner.
- No em dashes (—): use commas, full stops or a new sentence. No "the weight of", "a beat of silence", "something shifted", "let out a breath" or any line that explains what a moment meant.
${fresh ? `\nKEEP IT FRESH. This book already has these patterns; don't repeat them:\n${fresh}\n` : ''}
${FORMAT.prose}`,
        secondPass: (draft: string, cutShort: boolean) => ({
          maxTokens: Math.min(10000, Math.round(Math.max(countWords(draft), remaining) * 1.7) + 800),
          user: `You are now her line editor. Below is a first draft of ${chapterLabel(p, ch.id)}. Revise it into the version a demanding editor at a major publisher would sign off on, keeping every event, fact, clue and choice in it.

Fix, in this order:
1. Anything that reads as machine-written or generic: stock phrases, tidy three-part lists, "not X but Y", explained emotions or explained significance ("a small gesture that said more than…"), ominous closing lines, symmetrical sentences, over-polished sameness. Remove every em dash (—).
2. These specific problems found in the draft:
${draftAudit(p, draft)}
3. Voice: bring it closer to the author's own sample (rhythm, diction, restraint). Keep it consistent across the chapter without repeating words, images or sentence shapes.
4. Dialogue: sharpen it so each person sounds like themselves; cut lines that explain.
5. Cut 5-10% of flab: throat-clearing, repeated beats, stage directions nobody needs.
${fresh ? `\nAlso make sure it avoids what the book has already used:\n${fresh}\n` : ''}
${cutShort ? `The draft was cut off before the end. After revising, finish the chapter in the same voice so it reaches about ${remaining.toLocaleString()} words in total, following her plan, and ending on the chapter's open question.` : `Keep every scene and at least the same length (about ${remaining.toLocaleString()} words is the target; if it's well short, deepen the scenes that matter rather than adding plot).`} Don't add new plot beyond her plan.

DRAFT:
"""${draft}"""

Respond with the full revised chapter only: no title, no commentary. Keep any "EDITOR'S NOTE:" line from the draft at the end if it's still true.`,
        }),
      };
    },
  },
  styleProfile: {
    id: 'styleProfile',
    label: 'Turn my influences into a style guide',
    blurb: 'Reads the authors you love and your own pages, and writes a concrete style guide your editor follows in every draft.',
    build: (p, i) => {
      const own = p.chapters.filter((c) => countWords(c.text) > 300).sort((a, b) => countWords(b.text) - countWords(a.text))[0];
      return {
        role: 'prose',
        scope: 'minimal',
        output: 'text',
        maxTokens: 1600,
        user: `The author's influences (authors and books she loves, and what she loves about them):\n"""${p.tone.influences || '(none given yet)'}"""\n${own ? `\nA sample of her own prose:\n"""${own.text.trim().slice(0, 3500)}"""\n` : ''}${req(i)}\n\nWrite a practical style guide for HER book: the craft qualities to take from these influences, translated into concrete instructions a writer can follow. Don't imitate or name any author's signature phrasing; describe techniques. Cover, in short bullets under these headings: Point of view and distance; Sentences and rhythm; Description and atmosphere; Dialogue; Suspense and what to withhold; Romance and tension; Chapter openings and endings; Words and habits to avoid. Where her own sample already has a strong quality, keep it and say so; her voice wins over any influence. Under 380 words. No preamble.`,
        craft: false,
      };
    },
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
  extract: {
    id: 'extract',
    label: 'Update my story bible from this chapter',
    blurb: 'Reads the chapter and lists new facts, clues, events and characters it establishes, so you can add them to your story bible with one click.',
    build: (p, i) => {
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      return {
        role: 'continuity',
        scope: 'mystery',
        output: 'extract',
        maxTokens: 2500,
        focusText: ch?.text,
        user: `Read ${ch ? chapterLabel(p, ch.id) : 'this chapter'} and list what it ESTABLISHES that is NOT already recorded in the story bible: facts, clues (or red herrings), events for the timeline, what a character now believes, new characters, new places. Only include things actually on the page. Don't add interpretation or suggestions. Skip anything already recorded, even if worded differently. At most 12 items, most important first.\n\nRespond ONLY with JSON in a \`\`\`json code block: {"items": [{"kind": "fact" | "clue" | "event" | "belief" | "character" | "place", "title": "short name", "detail": "one or two sentences, quoting the text where useful", "characters": ["names involved"], "when": "time/date if stated"}]}\n\nCHAPTER TEXT:\n"""${ch?.text ?? ''}"""`,
        craft: false,
      };
    },
  },
  backwards: {
    id: 'backwards',
    label: 'Plan backwards from my ending',
    blurb: 'Starts from your ending and works back: what must be true, what to plant, and where.',
    category: 'plot',
    build: (p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'extract',
      maxTokens: 3500,
      user: `Work BACKWARDS from the author's planned ending (see "Ending" below and the mystery truth) to build the path the book needs. For the ending to land, what must the reader have seen, learned or felt, and when? Cover: the mystery solution (clues and their placement), character arcs (the moments that change them), the romance, major secrets and their reveals, and the final image's setups. Mark each item "have": true if the story bible already covers it, false if it's missing. Suggest a chapter number where it belongs (the book currently has ${p.chapters.length} chapters of a planned ~${p.targetChapters}). Order from the beginning of the book to the end. Maximum 14 items. Mark everything as a suggestion. Don't change her ending.\n\nENDING PLAN:\n${endingText(p)}${req(i)}\n\nRespond ONLY with JSON in a \`\`\`json code block: {"summary": "one or two sentences on the overall shape", "items": [{"kind": "clue" | "scene" | "secret" | "fact" | "event" | "character", "title": "short name", "detail": "what and why it's needed for the ending", "chapter": 7, "have": false, "characters": ["names"]}], "questions": ["what she needs to decide"]}`,
      craft: false,
    }),
  },
  connect: {
    id: 'connect',
    label: 'Connect these',
    blurb: 'How could these pieces of your story be connected? A few options, with the pros and cons of each.',
    needs: 'request',
    category: 'plot',
    build: (_p, i) => ({
      role: 'mystery',
      scope: 'mystery',
      output: 'options',
      maxTokens: 3000,
      user: `The author wants to connect these pieces of her story:\n${i.request}\n\nPropose 3-4 distinct, believable ways they could be connected, grounded in her canon (never contradict CANON; never reuse SET ASIDE ideas). Favour connections that deepen character and make earlier moments mean more in hindsight. Avoid coincidence.\n\n${FORMAT.options}`,
      craft: false,
    }),
  },
  hiddenConnections: {
    id: 'hiddenConnections',
    label: 'Find hidden connections',
    blurb: 'Looks across your whole story for threads that could tie together in satisfying ways.',
    category: 'plot',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Look across the whole story bible for HIDDEN CONNECTIONS the author may not have noticed: characters, objects, places, clues, secrets or events that could be linked so that earlier moments pay off, coincidences become causes, and the ending feels inevitable. Also note elements that currently connect to nothing. For each finding, explain the possible connection and what it would add. These are possibilities, not instructions.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  betaReader: {
    id: 'betaReader',
    label: 'Read it like a reader',
    blurb: 'A first reader who only knows what\'s on the page tells you what they felt, what confused them, and who they suspect.',
    build: (p, i) => {
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      const idx = ch ? p.chapters.indexOf(ch) : 0;
      const before = p.chapters
        .slice(0, idx)
        .map((c, n) => `Chapter ${n + 1}: ${c.summary || c.outline.happens || '(no summary)'}`)
        .join('\n');
      return {
        role: 'developmental',
        scope: 'minimal',
        output: 'text',
        maxTokens: 1800,
        user: `Act as a thoughtful first reader of dark mystery fiction (a "beta reader"), NOT an editor. You know ONLY what's on the page so far: nothing about the author's plans or the solution.${before ? `\n\nWhat happened in earlier chapters:\n${before}` : ''}\n\nNow you've just read ${ch ? `Chapter ${idx + 1}` : 'this chapter'}:\n<chapter>${ch?.text ?? ''}</chapter>\n\nWrite your honest reader's reaction in plain, warm language, under these headings: "What I felt", "Where I was gripped", "Where my attention drifted or I got confused" (quote a few words), "Who I suspect right now, and why", "What I think will happen next", "Questions I'm carrying into the next chapter". Be specific and honest. Don't give writing advice. Under 450 words.${req(i)}`,
        craft: false,
      };
    },
  },
  interview: {
    id: 'interview',
    label: 'Interview this character',
    blurb: 'Talk with your character in their own voice to discover how they speak and what they hide. Ask follow-up questions below the answer.',
    needs: 'request',
    placeholder: 'Ask them anything, e.g. "Where were you the night Tess died?"',
    build: (p, i) => {
      const c = p.characters.find((x) => x.id === i.characterId);
      return {
        role: 'character',
        scope: 'whole',
        output: 'text',
        maxTokens: 1000,
        characterIds: c ? [c.id] : [],
        user: `Role-play as ${c?.name ?? 'this character'} being interviewed by the author, for the rest of this conversation. Answer in first person, in their own voice, diction and rhythm (see their profile). You know ONLY what ${c?.name ?? 'they'} would know at this point in the story. If they would lie, evade, deflect or get defensive, do that, in character, and let small tells show. Keep answers short, like real speech (1-3 short paragraphs). Don't step out of character, and don't reveal plot solutions they wouldn't admit.\n\nThe author asks: "${i.request ?? ''}"`,
        craft: true,
      };
    },
  },
  pitch: {
    id: 'pitch',
    label: 'Write my pitch',
    blurb: 'A one-line logline, a back-cover blurb, or a one-page synopsis, for when you\'re ready to share your book.',
    build: (_p, i) => {
      const kind = i.variant ?? 'blurb';
      const how: Record<string, string> = {
        logline: 'Write 5 alternative one-sentence loglines (under 35 words each): protagonist, inciting problem, stakes, and the hook. No spoilers.',
        blurb: 'Write a back-cover blurb (150-200 words): the hook, the protagonist and what she wants, the rising threat, and a final line that makes the reader need to know. No spoilers. Avoid blurb clichés ("in a world where", "nothing is as it seems").',
        synopsis: 'Write a one-page synopsis (about 500 words) in present tense, as agents expect: the full story INCLUDING the ending and the solution to the mystery, main characters in caps on first mention, and the emotional arc. Plain, confident prose.',
      };
      return {
        role: 'architect',
        scope: 'whole',
        output: 'text',
        maxTokens: 2000,
        user: `${how[kind] ?? how.blurb} Base it only on the story bible and chapter summaries.${req(i)}`,
        craft: true,
      };
    },
  },
  // ================= Story Lab: whole-book analysis =================
  bookAnalysis: {
    id: 'bookAnalysis',
    label: 'Page-turner analysis',
    blurb: 'Reads the whole book like a reader and charts where it grips, where it sags, and what questions keep them turning pages.',
    build: (p) => ({
      role: 'developmental',
      scope: 'minimal',
      output: 'text',
      json: true,
      maxTokens: 6000,
      user: `You are an experienced reader of dark mystery and psychological thrillers. Read this book chapter by chapter, as a reader who knows only what's on the page (no author plans).\n\n${bookDigest(p)}\n\nFor EACH chapter, rate honestly (1-10, where 5 is average published quality): keepReading (at 11 p.m., would you read one more chapter?), tension, endingHook (does the last page pull you on, without being a cheap cliffhanger?). Score emotions present (0-10): dread, relief, warmth, humour, desire, grief, curiosity. List the reader questions RAISED in the chapter and the questions ANSWERED (short, e.g. "Why was Tess wearing the oilskin?"). Give a one-line note on the biggest reason a reader might put the book down there (or "none").\n\nRespond ONLY with JSON in a \`\`\`json code block: {"chapters": [{"chapter": 1, "keepReading": 7, "tension": 6, "endingHook": 7, "emotions": {"dread": 6, "relief": 1, "warmth": 3, "humour": 1, "desire": 0, "grief": 7, "curiosity": 8}, "raised": ["..."], "answered": ["..."], "putDownRisk": "..."}], "overall": "two or three sentences on the reading experience", "sags": ["where and why it sags"], "strengths": ["what's most gripping"]}`,
      craft: false,
    }),
  },
  solvability: {
    id: 'solvability',
    label: 'Solvability test',
    blurb: 'Simulated readers guess the culprit after each chapter, so you see when (or whether) readers crack it.',
    build: (p) => ({
      role: 'developmental',
      scope: 'minimal',
      output: 'text',
      json: true,
      maxTokens: 4000,
      user: `Simulate three different attentive readers of mystery fiction (a casual reader, a genre fan, and a puzzle-solving expert). You know ONLY what the text reveals, chapter by chapter. Here is what each chapter reveals to the reader:\n\n${bookDigest(p)}\n\nAfter EACH chapter, each reader names who they currently suspect (a character name, or "no idea"), their confidence (0-100), and the main clue or feeling behind it. Do not use any knowledge beyond the chapters so far.\n\nRespond ONLY with JSON in a \`\`\`json code block: {"chapters": [{"chapter": 1, "guesses": [{"reader": "casual", "suspect": "name", "confidence": 20, "why": "..."}, {"reader": "fan", ...}, {"reader": "expert", ...}]}]}`,
      craft: false,
    }),
  },
  readerPanel: {
    id: 'readerPanel',
    label: 'Reader panel',
    blurb: 'Four different readers react to this chapter: a crime fan, a casual reader, a literary reader, and a literary agent.',
    build: (p, i) => {
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      const idx = ch ? p.chapters.indexOf(ch) : 0;
      return {
        role: 'developmental',
        scope: 'minimal',
        output: 'findings',
        maxTokens: 2500,
        user: `Four readers have just read Chapter ${idx + 1}. They know only what's on the page.\n${previousSummaries(p, idx)}\n\nCHAPTER TEXT:\n<chapter>${ch?.text ?? ''}</chapter>\n\nReaders: (1) a devoted crime and psychological-thriller fan, (2) a casual reader who picked it up at an airport, (3) a literary-fiction reader who cares about prose and character, (4) a literary agent reading a submission. For each, give a finding whose title is "<reader>: <n>/10 would keep reading", and whose detail is their honest reaction in their own voice (what hooked them, where they drifted, what they'd tell a friend, and for the agent whether they'd request more). Level: "likely problem" if their score is under 5, "worth a look" for 5-6, otherwise "note". Summary: what the four agree on.${req(i)}\n\n${FORMAT.findings}`,
        craft: false,
      };
    },
  },
  killerCounter: {
    id: 'killerCounter',
    label: 'The killer\'s counter-move',
    blurb: 'Your culprit tries to get away with it, and shows you every hole in the investigation and every smarter move they\'d make.',
    build: (_p, i) => ({
      role: 'mystery',
      scope: 'mystery',
      output: 'findings',
      maxTokens: 3000,
      user: `Take the role of the story's real culprit (see the mystery truth): intelligent, motivated and desperate not to be caught. Go through the plot, the clues, the witnesses and the investigation. For each, explain (1) what you, the culprit, would realistically have done to cover it that the story doesn't account for (a plot hole the author must answer), and (2) a SMARTER move you could make that would raise the stakes and make a better, scarier antagonist. Keep it in the author's canon. Present trade-offs. A cleverer villain makes a better book.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  plotHoles: {
    id: 'plotHoles',
    label: 'Plot-hole hunter',
    blurb: 'A sceptical reader\'s "why didn\'t they just…?" questions, with fixes that fit your story.',
    build: (_p, i) => ({
      role: 'continuity',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Read the story bible and chapters as a sharp, sceptical reader. List the "why didn't they just…?" questions readers will ask: call the police, check the phone, tell someone, leave town, look in the obvious place. Also list convenient coincidences and characters who act unnaturally to serve the plot. For each, give the best in-story fix (a line of motivation, an obstacle, a planted fact). Prioritise what a reader would actually notice.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  detective: {
    id: 'detective',
    label: 'Detective plausibility check',
    blurb: 'Would a competent investigator notice this? Would police procedure really go this way?',
    build: (_p, i) => ({
      role: 'research',
      scope: 'mystery',
      output: 'findings',
      maxTokens: 2500,
      user: `Check the investigation for realism the way crime-fiction readers will: what would a competent police detective, medical examiner or forensic team realistically find, check or do at each stage (autopsy findings, phone records, CCTV, tide and time-of-death estimates, witness interviews)? Where does the story rely on the police missing something, and is that believable (small-town resources, a closed case, bias)? Suggest a line or scene that makes it plausible. Flag facts to verify; don't invent statistics or laws.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  twistImpact: {
    id: 'twistImpact',
    label: 'Twist impact test',
    blurb: 'Rates each twist for surprise and inevitability. A great twist needs both.',
    build: (_p, i) => ({
      role: 'mystery',
      scope: 'mystery',
      output: 'findings',
      maxTokens: 2500,
      user: `Evaluate each major twist and reveal (from the mystery truth, secrets, planned reveals and twist ideas). For each, give a finding titled "<twist>: surprise n/10, inevitability n/10". Surprise = how unexpected on first read. Inevitability = how strongly, in hindsight, the clues and character logic make it feel earned. Explain what raises the weaker score (a subtler plant, a stronger misdirect, better timing), and whether it deepens character or theme or is just a shock.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  setPieces: {
    id: 'setPieces',
    label: 'Set-piece planner',
    blurb: 'Finds your most memorable scenes, the ones readers retell, and where the book needs one.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Great thrillers have four to six unforgettable set pieces: vivid, high-stakes, visual scenes readers retell (a discovery, a confrontation, a chase, a reveal in a striking place). Identify the set pieces the book has or plans, and rate how memorable each is. Then identify stretches with no set piece and propose one or two set pieces that grow from her own characters, places and mystery, with the setting, the stakes and the turn. Make them specific to her world, not generic.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  rootForHer: {
    id: 'rootForHer',
    label: 'Would readers root for her?',
    blurb: 'Is your heroine active, capable and compelling? Is your villain frightening and fascinating?',
    build: (_p, i) => ({
      role: 'character',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Assess the protagonist's appeal the way readers and agents do: agency (does she drive events or just react?), competence (what is she good at?), a sympathetic flaw, a secret or wound, wit or a distinctive way of seeing, and stakes that are personal. Then assess the antagonist: are they frightening, intelligent, and humanly understandable, or just evil? Also check that the supporting cast is vivid. For each gap, suggest specific moments that would make readers love, fear or ache for these people.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  chemistry: {
    id: 'chemistry',
    label: 'Chemistry check',
    blurb: 'Banter, tension and push-and-pull. What keeps a slow-burn romance exciting.',
    build: (_p, i) => ({
      role: 'character',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2200,
      user: `Evaluate the romantic thread for chemistry and enjoyment, not just logic: banter and distinctive exchanges, physical awareness shown through small details, push-and-pull (wanting versus reasons not to), trust tested by secrets, moments of unexpected tenderness, and whether the danger plot feeds the attraction. Point to moments that work, and propose two or three specific scenes or exchanges that would raise the heat and the ache within her tone and explicitness settings.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  altEndings: {
    id: 'altEndings',
    label: 'Alternative endings',
    blurb: 'Several ways your ending could go, each judged for surprise, fairness and emotional payoff.',
    category: 'ending',
    build: (p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'options',
      maxTokens: 3500,
      user: `The author's current ending plan:\n${endingText(p)}\n\nPropose 3-4 alternative ways the book could end (including a stronger version of hers), each consistent with the canon so far. For each, cover in the fields: "why" (emotional payoff and surprise), "changes" (what must be set up earlier), "clues", "complications" (sequel potential), and "weaknesses" (fairness risks, reader frustration). Don't just go for shock. The best endings feel inevitable and devastating or satisfying.${req(i)}\n\n${FORMAT.options}`,
      craft: false,
    }),
  },
  characterArcs: {
    id: 'characterArcs',
    label: 'Character arc chart',
    blurb: 'How each main character changes chapter by chapter, flagging flat or unearned arcs.',
    build: (_p, i) => ({
      role: 'character',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `For each main character, trace their arc across the chapters: what they believe and want at the start, the key turning points (with chapter numbers), and who they are by the end. One finding per character, titled "<name>: <start> → <end>". In the detail, list the turning points by chapter and flag flat stretches (no change for many chapters) and changes that aren't earned on the page. Suggest where one scene could deepen the arc.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  dialogueVoices: {
    id: 'dialogueVoices',
    label: 'Dialogue voice test',
    blurb: 'If you hid the names, could you tell who\'s speaking? Finds characters who sound alike.',
    needs: 'selection-or-chapter',
    build: (p, i) => {
      const x = passage(i, p);
      return {
        role: 'character',
        scope: 'local',
        output: 'findings',
        maxTokens: 2200,
        focusText: x.text,
        user: `Run the "cover the names" test on the dialogue in ${x.label}. For each speaking character, describe their speech pattern on the page (sentence length, vocabulary, what they avoid saying, verbal habits). Identify lines that could be spoken by anyone, and characters who sound alike (or like the narrator). For each, rewrite one or two lines in a more distinctive voice consistent with their profile, and quote the original.\n\nTEXT:\n<chapter>${x.text}</chapter>\n\n${FORMAT.findings}`,
        craft: true,
      };
    },
  },
  premiseTest: {
    id: 'premiseTest',
    label: 'Premise and hook stress test',
    blurb: 'How strong is your hook, as an agent sees it in one sentence? And how could it be stronger?',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2200,
      user: `Stress-test the premise the way a literary agent does in the first ten seconds. Findings on: the one-sentence hook (write it, then rate its originality and urgency out of 10), what's fresh versus familiar in the genre, the emotional core readers will care about, the stakes (personal and escalating), and the "why this book, why now". For each weakness, suggest a concrete way to sharpen the concept without changing her story.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  hookAmplifier: {
    id: 'hookAmplifier',
    label: 'Hook amplifier',
    blurb: 'Makes your premise punchier and more high-concept, without changing your story.',
    category: 'plot',
    build: (_p, i) => ({
      role: 'brainstorm',
      scope: 'whole',
      output: 'options',
      maxTokens: 2500,
      user: `Propose 3-4 ways to make the book's central concept more high-concept and irresistible ("what if…?"), using elements already in her story (sharpening, reframing or adding one twist of the knife), not replacing it. For each, "idea" is the new one-sentence hook. Fill the other fields with what changes, what it adds to marketability, and the risks.${req(i)}\n\n${FORMAT.options}`,
      craft: false,
    }),
  },
  learnFrom: {
    id: 'learnFrom',
    label: 'Learn from a book you love',
    blurb: 'Paste a passage from a favourite novel. Your editor shows how it works, and how to use the technique (not the style) in your own scene.',
    needs: 'request',
    placeholder: 'Paste a short passage (a page or less) from a book you admire…',
    build: (p, i) => {
      const ch = p.chapters.find((c) => c.id === (i.chapterId ?? p.currentChapterId));
      return {
        role: 'prose',
        scope: 'local',
        output: 'text',
        maxTokens: 2200,
        user: `The author admires this published passage and wants to learn from it (for study only, never to copy):\n<passage>${i.request ?? ''}</passage>\n\nBreak down HOW it works as craft: point of view, what's withheld, sentence rhythm, choice of concrete detail, how dialogue and silence carry subtext, and how tension builds. Name 3-5 transferable techniques. Then show how she could apply one or two of those TECHNIQUES (not the author's voice, images or phrasing) to a moment in her own current chapter:\n<chapter>${(ch?.text ?? '').slice(-3000)}</chapter>\nDo not imitate the author's style. Headings and bullets, under 550 words.`,
        craft: true,
      };
    },
  },
  editorialLetter: {
    id: 'editorialLetter',
    label: 'Editorial letter',
    blurb: 'A whole-book memo like the ones professional editors write: strengths, the big issues, and a revision plan.',
    build: (p, i) => ({
      role: 'developmental',
      scope: 'whole',
      output: 'text',
      maxTokens: 4000,
      user: `Write a professional developmental editor's letter for this manuscript, addressed warmly to the author, as a top editor at a publishing house would. Base it on the story bible, chapter summaries and these excerpts:\n${bookDigest(p, 250)}\n\nStructure: a short opening on what the book is and what's special about it; "What's working" (specific); "The three biggest opportunities" (big-picture, such as structure, stakes, character, mystery fairness, pacing, voice, marketability), each with why it matters and concrete revision suggestions; "Smaller notes"; and "A revision plan" in order of passes. Honest, specific, encouraging, and focused on making it publishable and gripping. Under 1200 words.${req(i)}`,
      craft: false,
    }),
  },
  firstPages: {
    id: 'firstPages',
    label: 'The agent\'s desk',
    blurb: 'A literary agent reads your opening pages and says where they\'d stop, and whether they\'d ask for more.',
    build: (p, i) => {
      const opening = p.chapters.map((c) => c.text).join('\n\n').slice(0, 9000);
      return {
        role: 'developmental',
        scope: 'minimal',
        output: 'text',
        maxTokens: 2200,
        user: `You are a busy literary agent who represents dark psychological thrillers and reads hundreds of submissions a month. Read these opening pages as you would in your inbox:\n<pages>${opening}</pages>\n\nRespond under these headings: "First line" (rating out of 10, and why); "Where I would have stopped reading" (quote the exact sentence, or "I kept reading"); "What's working"; "What made me hesitate"; "Voice, hook, stakes, character" (a line each); "Decision" (pass / request partial / request full, and why); "What would change my answer" (three specific fixes). Be candid and specific.${req(i)}`,
        craft: false,
      };
    },
  },
  firstLine: {
    id: 'firstLine',
    label: 'First-line workshop',
    blurb: 'Your first line critiqued, with alternatives that keep your voice and your story.',
    category: 'scene',
    build: (p, i) => {
      const first = p.chapters.find((c) => c.text.trim())?.text.trim().split(/\n\s*\n/).slice(0, 2).join('\n\n') ?? '';
      return {
        role: 'prose',
        scope: 'local',
        output: 'options',
        maxTokens: 2200,
        user: `The book's current opening:\n<opening>${first}</opening>\n\nIn "note", critique the first line: what it promises, its voice, its hook. Then offer 4 alternative first lines (or first two sentences) in her voice and consistent with her story, each taking a different approach (a striking image, a voice-led line, a line of dialogue, a quiet wrongness). Put the line in "idea", and in "why" explain what it promises the reader.${req(i)}\n\n${FORMAT.options}`,
        craft: true,
      };
    },
  },
  wordOfMouth: {
    id: 'wordOfMouth',
    label: 'What will readers tell their friends?',
    blurb: 'The hook, twist and character people will talk about, and book-club questions.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'text',
      maxTokens: 1800,
      user: `Word of mouth sells books. Based on the story: (1) The one-sentence way a reader would describe it to a friend. (2) The moment or twist they'll say "you won't believe…" about, and whether the book delivers it strongly enough. (3) The character they'll talk about most. (4) The emotional experience ("I couldn't put it down" / "it wrecked me"). (5) What's missing that would make it more talkable. (6) Eight book-club discussion questions (spoiler-marked where needed). Headings, under 600 words.${req(i)}`,
      craft: false,
    }),
  },
  genrePromise: {
    id: 'genrePromise',
    label: 'Genre promise check',
    blurb: 'What thriller readers expect, how your book meets or deliberately breaks those expectations, and whether your opening promises the book you deliver.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Compare the book with what readers of dark mystery and psychological thrillers expect: an early hook (a body, a disappearance or a threat within the first chapter or two), rising stakes, a midpoint reversal, a major twist around 70-80%, short to medium chapters, a satisfying resolution of the central mystery, and a protagonist with personal stakes. For each expectation: met, missing, or deliberately subverted (and whether that subversion is clear enough to feel intentional). Also check the "promise of the premise": does the opening promise the book that's delivered?${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  // ================= Polish =================
  proofread: {
    id: 'proofread',
    label: 'Proofread',
    blurb: 'Typos, grammar and punctuation only. Every change shown before you accept.',
    needs: 'selection',
    build: (_p, i) => ({
      role: 'prose',
      scope: 'minimal',
      output: 'revision',
      maxTokens: Math.min(16000, Math.ceil((i.selection?.text.length ?? 2000) / 2.4) + 800),
      user: `PROOFREAD ONLY. Fix spelling, typos, grammar, punctuation (including dialogue punctuation), missing or doubled words, and inconsistent capitalisation. Do NOT change word choices, style, rhythm or content, and don't "improve" anything. Keep *asterisk* italics and scene-break lines exactly. If a stylistic choice is deliberate (fragments, dialect), leave it.\n\nTEXT:\n"""${i.selection?.text ?? ''}"""\n\n${FORMAT.revision}`,
      craft: false,
    }),
  },
  voiceDrift: {
    id: 'voiceDrift',
    label: 'Voice drift check',
    blurb: 'Compares this chapter with your own earlier writing, and flags passages that don\'t sound like you.',
    needs: 'selection-or-chapter',
    build: (p, i) => {
      const x = passage(i, p);
      const first = p.chapters.find((c) => c.text.trim().length > 1500 && c.id !== (i.chapterId ?? p.currentChapterId));
      return {
        role: 'prose',
        scope: 'minimal',
        output: 'findings',
        maxTokens: 2200,
        user: `Here is a sample of the author's established voice:\n<voice>${(first?.text ?? '').slice(0, 3500)}</voice>\n\nCompare ${x.label} with it:\n<chapter>${x.text}</chapter>\n\nFlag passages whose voice drifts: more ornate or more generic, a different rhythm, vocabulary she doesn't use, or "polished" prose that sounds machine-written. Quote each passage, explain the difference, and suggest how to bring it back to her voice. Also note what's consistent. If there's no sample (no earlier chapter), judge internal consistency instead.\n\n${FORMAT.findings}`,
        craft: true,
      };
    },
  },
  permissions: {
    id: 'permissions',
    label: 'Permissions and legal flags',
    blurb: 'Quoted lyrics, poems and epigraphs that need permission, and real people or businesses shown badly.',
    build: (p) => ({
      role: 'research',
      scope: 'minimal',
      output: 'findings',
      maxTokens: 2200,
      user: `Check these passages for publishing permission and legal risks a debut author often misses: quoted song lyrics (any length usually needs permission), quoted poems or epigraphs still in copyright, long quotations from other books, real living people, real named businesses or institutions portrayed negatively, identifiable real private individuals, and trademarks used in a disparaging way. The whole book was pre-scanned, and these are the only passages containing quotations, verse, italics, song or poem mentions, or capitalised names. For each risk, quote the text, give the chapter, and explain the typical options (paraphrase, invent, request permission, use a public-domain source). If nothing is risky, say so. Note: this is general information, not legal advice.\n\n<passages>${permissionCandidates(p)}</passages>\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  sensitivity: {
    id: 'sensitivity',
    label: 'Sensitivity read',
    blurb: 'How characters of different backgrounds, disabilities, or experiences of violence are portrayed.',
    needs: 'selection-or-chapter',
    build: (p, i) => {
      const x = passage(i, p);
      return {
        role: 'developmental',
        scope: 'local',
        output: 'findings',
        maxTokens: 2200,
        focusText: x.text,
        user: `Do a thoughtful sensitivity read of ${x.label}: portrayals of ethnicity, culture, disability, mental illness, age, class, sexuality, and survivors of violence or abuse. Flag stereotypes, one-dimensional portrayals, harmful tropes (such as "bury your gays", or mental illness as the villain's explanation) and careless language, with better options that keep the book dark and honest. Don't sanitise the genre: darkness is fine, and cliché and harm are the issue.\n\n<chapter>${x.text}</chapter>\n\n${FORMAT.findings}`,
        craft: false,
      };
    },
  },
  contentNotes: {
    id: 'contentNotes',
    label: 'Content notes',
    blurb: 'A draft list of sensitive content, which agents and publishers now often ask for.',
    build: () => ({
      role: 'developmental',
      scope: 'whole',
      output: 'text',
      maxTokens: 900,
      user: 'Draft a concise content-notes list for this book (for example: death of a sibling, drowning, domestic abuse, grief), based on the story bible and chapter summaries. A bullet list only, with an optional one-line note on intensity. Mark anything uncertain with (check).',
      craft: false,
    }),
  },
  // ================= Finishing =================
  todayScene: {
    id: 'todayScene',
    label: 'Today\'s scene',
    blurb: 'One small, concrete thing to write today, drawn from your outline.',
    build: (p) => {
      const next = p.chapters.find((c) => c.status !== 'Done' && c.status !== 'Revising') ?? p.chapters[p.chapters.length - 1];
      return {
        role: 'scene',
        scope: 'local',
        output: 'text',
        maxTokens: 700,
        user: `Suggest ONE small, doable writing task for today, for ${chapterLabel(p, next.id)} (current words: ${next.text.split(/\s+/).filter(Boolean).length}). Base it on the chapter plan and where the text stops. Format: a bold one-line task ("Write the moment Nora…"), then two or three short bullet prompts to get her started (what she wants, what gets in the way, one sensory detail to include). Under 110 words. Warm and simple.`,
        craft: false,
      };
    },
  },
  weeklyPlan: {
    id: 'weeklyPlan',
    label: 'This week\'s plan',
    blurb: 'A gentle plan for the week: three scenes, sized to your pace.',
    build: (p, i) => ({
      role: 'scene',
      scope: 'whole',
      output: 'text',
      maxTokens: 900,
      user: `Make a gentle writing plan for this week: three scenes or tasks to write, in order, based on the outline and where the draft stops.${i.variant ? ` Her recent pace: about ${i.variant} words a day.` : ''} For each: the chapter, one line on what happens, and the key beat. End with one encouraging, specific sentence (no flattery). Under 200 words.${p.chapters.length ? '' : ''}`,
      craft: false,
    }),
  },
  // ================= Market & publishing =================
  trends: {
    id: 'trends',
    label: 'Market trends',
    blurb: 'What\'s selling in the genre now, what agents are tired of, and where your book fits. Uses real web search.',
    build: (_p, i) => ({
      role: 'research',
      scope: 'minimal',
      output: 'text',
      maxTokens: 1800,
      search: true,
      user: `Using current web information, summarise the market for dark mystery and psychological thrillers: what's selling now, what agents and editors say they want or are tired of, and typical debut word counts. Then say where this book fits: ${premiseLine(_p)}. Headings: "What's working in the market", "What's oversaturated", "Where this book fits", "Opportunities". Cite sources. If you can't verify something, say so.${req(i)}`,
      craft: false,
    }),
  },
  pitchComps: {
    id: 'pitchComps',
    label: 'Pitch and comparable titles',
    blurb: '"X meets Y" pitches and real comparable books from the last few years, found with web search.',
    build: (p, i) => ({
      role: 'research',
      scope: 'whole',
      output: 'text',
      maxTokens: 1800,
      search: true,
      user: `Find 4-6 REAL comparable titles ("comps") for this book: published in roughly the last 5 years, commercially successful but not mega-bestsellers, and similar in tone, premise or readership. Verify each is real (title, author, year) using search, and explain the specific similarity. Then write three "X meets Y" pitch lines and three taglines. Never invent a book. If unsure, leave it out.\n\nBook: ${premiseLine(p)}${req(i)}`,
      craft: false,
    }),
  },
  titleLab: {
    id: 'titleLab',
    label: 'Title lab',
    blurb: 'Title ideas that signal the genre, checked against existing books.',
    build: (p, i) => ({
      role: 'brainstorm',
      scope: 'whole',
      output: 'text',
      maxTokens: 1500,
      search: true,
      user: `Suggest 10 strong titles for this dark psychological mystery, in the style of titles that sell in the genre (evocative, often short, a hint of threat or secrecy). Current working title: "${p.title}". For each: the title, what it signals, and whether a well-known book already uses it (check with search). Mark the top three. Then give one line on the current title's strengths and weaknesses.${req(i)}`,
      craft: false,
    }),
  },
  coverBrief: {
    id: 'coverBrief',
    label: 'Cover brief',
    blurb: 'A cover-design brief: mood, imagery and genre signals, for a designer or a publisher.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'text',
      maxTokens: 1200,
      user: `Write a professional cover-design brief: genre signals readers recognise in dark psychological thrillers, mood, colour palette, 2-3 imagery concepts drawn from the book's own objects and places (avoid clichés like a woman walking away in a red coat, unless subverted), typography feel, and what to avoid. Under 350 words.${req(i)}`,
      craft: false,
    }),
  },
  readerProfile: {
    id: 'readerProfile',
    label: 'Who is this book for?',
    blurb: 'A clear picture of your ideal reader, which shapes the pitch, blurb and comparable titles.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'text',
      maxTokens: 1000,
      user: `Describe this book's ideal reader: age range, what they read and love, why they pick up a thriller, what they want to feel, where they discover books, and what would make them recommend this one. Then one line on the "reader promise" the cover and blurb must make. Under 300 words.${req(i)}`,
      craft: false,
    }),
  },
  queryBuilder: {
    id: 'queryBuilder',
    label: 'Write my query letter',
    blurb: 'A professional query letter to literary agents: hook, story, stakes, comps and bio.',
    build: (p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'text',
      maxTokens: 1800,
      user: `Write a professional query letter (250-350 words) for this manuscript, following current agent conventions: an opening hook paragraph; two short paragraphs on the protagonist, what she wants, the conflict and the stakes, WITHOUT revealing the ending; a housekeeping line with the title in caps, genre, word count (about ${Math.round(p.chapters.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0) / 1000) || '??'},000 now; target ${Math.round(p.targetWords / 1000)},000) and comps${p.publishing.comps ? ` (${p.publishing.comps})` : ' (placeholders: [COMP 1], [COMP 2])'}; and a short, warm bio${p.publishing.bio ? `: ${p.publishing.bio}` : ' placeholder'}. Plain, confident, specific. No rhetorical questions and no clichés. Use [AGENT NAME] as the greeting placeholder.${req(i)}`,
      craft: true,
    }),
  },
  queryPanel: {
    id: 'queryPanel',
    label: 'Agent panel for my query',
    blurb: 'Three simulated agents with different tastes critique your query before it goes out.',
    needs: 'request',
    placeholder: 'Paste your query letter…',
    build: (_p, i) => ({
      role: 'developmental',
      scope: 'minimal',
      output: 'findings',
      maxTokens: 2500,
      user: `Three literary agents review this query: (1) a commercial-thriller agent, (2) an agent who loves literary suspense, (3) a tough agent who rejects 99% of queries. For each, a finding titled "<agent>: request / pass" with their honest reaction: where they stopped, what hooked them, what's unclear or generic, and whether they'd request pages. Then add findings with specific line edits to fix the biggest problems.\n\nQUERY:\n"""${i.request ?? ''}"""\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  agentMatch: {
    id: 'agentMatch',
    label: 'Find agents',
    blurb: 'Real literary agents who represent dark psychological thrillers, with source links. Always check their current submission guidelines.',
    build: (p, i) => ({
      role: 'research',
      scope: 'minimal',
      output: 'text',
      maxTokens: 2200,
      search: true,
      user: `Using web search, find 8-10 real literary agents currently open to (or known for) dark psychological thrillers and mysteries, ideally ones who have mentioned wanting books like this: ${premiseLine(p)}. For each: name, agency, what they're looking for (from their wishlist or interviews), how to submit (if found), and a suggested personal first line for the query. Include a source link for each. Only include agents you can verify, and tell the author to check each agency's current guidelines before querying.${req(i)}`,
      craft: false,
    }),
  },
  contests: {
    id: 'contests',
    label: 'Contests, pitch events and conferences',
    blurb: 'Opportunities for debut crime writers, found with web search.',
    build: (_p, i) => ({
      role: 'research',
      scope: 'minimal',
      output: 'text',
      maxTokens: 1800,
      search: true,
      user: `Using web search, list current opportunities for an unpublished debut crime or psychological-thriller writer: manuscript contests and prizes for unpublished writers (such as debut crime-writing awards), online pitch events, mentorship programmes, and writing conferences with agent pitch sessions. For each: name, what it is, typical deadlines or season, cost if known, and a link. Mark anything you couldn't confirm is current.${req(i)}`,
      craft: false,
    }),
  },
  storeListing: {
    id: 'storeListing',
    label: 'Self-publishing listing',
    blurb: 'A store description, categories and keywords, for publishing an e-book yourself.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'text',
      maxTokens: 1500,
      user: `Prepare a self-publishing store listing: a book description (about 200 words, formatted for online bookstores, hook first, no spoilers), 3 suitable bookstore categories, 7 keyword phrases readers of this genre search for, a short author-bio template, and a one-line tagline for ads.${req(i)}`,
      craft: true,
    }),
  },
  humanFeedback: {
    id: 'humanFeedback',
    label: 'Make sense of reader feedback',
    blurb: 'Paste comments from human readers. Your editor groups them into themes and suggests which to act on.',
    needs: 'request',
    placeholder: 'Paste the comments you received (from beta readers, a writing group, an editor)…',
    build: (_p, i) => ({
      role: 'developmental',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2500,
      user: `Here is feedback the author received from human readers:\n"""${i.request ?? ''}"""\n\nGroup it into themes. For each theme, say how many readers raised it, whether it's a symptom of a deeper issue (readers often identify a problem correctly but suggest the wrong fix), and what to do about it in her story. Separate "act on this" from "matter of taste". Be kind about harsh comments.\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  // ================= Series =================
  seriesPotential: {
    id: 'seriesPotential',
    label: 'Series potential check',
    blurb: 'Does the book stand alone and still leave room for more? Agents usually want exactly that.',
    build: (_p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'findings',
      maxTokens: 2200,
      user: `Agents usually want a debut that stands completely on its own (the central mystery fully resolved) but has series potential. Assess: does the book resolve its main mystery satisfyingly? Which characters, relationships, places and unanswered personal questions could carry a series? Is the protagonist someone readers would follow into new cases, and what would bring her into another mystery? Flag anything that currently feels like an unfinished cliffhanger that could frustrate agents.${req(i)}\n\n${FORMAT.findings}`,
      craft: false,
    }),
  },
  sequelSeeds: {
    id: 'sequelSeeds',
    label: 'Sequel seeds',
    blurb: 'Threads to quietly plant in this book that could grow into a sequel, without weakening the ending.',
    category: 'plot',
    build: (_p, i) => ({
      role: 'brainstorm',
      scope: 'whole',
      output: 'options',
      maxTokens: 2500,
      user: `Suggest 3-5 "sequel seeds": small threads she could plant in THIS book (a minor character with a secret, an unexplained object, an unresolved relationship, a hint about the protagonist's past) that enrich this book on their own and could grow into a future mystery, without leaving this book's central mystery unresolved. In "changes", say where to plant it (chapter). In "complications", say what book two could do with it.${req(i)}\n\n${FORMAT.options}`,
      craft: false,
    }),
  },
  newMystery: {
    id: 'newMystery',
    label: 'New mystery from this world',
    blurb: 'Fresh cases that grow out of your existing characters, places and history.',
    category: 'plot',
    build: (_p, i) => ({
      role: 'brainstorm',
      scope: 'whole',
      output: 'options',
      maxTokens: 3000,
      user: `Propose 3-4 premises for the NEXT book, growing organically from this book's characters, places, unresolved personal threads and history, in the same genre and tone. Each should have a fresh central mystery (not a repeat of this one), personal stakes for the protagonist, and a reason she's drawn in. Use "idea" for the one-sentence hook. The other fields cover why it works, what carries over, new characters needed, and risks.${req(i)}\n\n${FORMAT.options}`,
      craft: false,
    }),
  },
  seriesArc: {
    id: 'seriesArc',
    label: 'Series arc planner',
    blurb: 'A larger mystery or relationship that develops across several books.',
    build: (p, i) => ({
      role: 'architect',
      scope: 'whole',
      output: 'text',
      maxTokens: 2000,
      user: `Sketch a series arc for ${p.series.name || 'this series'} (this is book ${p.series.bookNumber}): an overarching question or relationship that develops across three to five books while each book stays a complete mystery. Include: the arc's central question, how the protagonist changes across the series, a one-paragraph outline per book (case of the book plus arc development), and the ending of the series arc. ${p.series.arc ? `Build on her notes: ${p.series.arc}` : ''} Mark everything as a possibility. Under 700 words.${req(i)}`,
      craft: false,
    }),
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
