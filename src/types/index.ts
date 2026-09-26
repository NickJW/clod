// Core data model for a novel project.
// Everything the author creates lives in a single Project object that is
// stored locally (IndexedDB) and can be exported as one JSON backup file.

/** The canon system. Nothing the AI suggests becomes CANON unless the author promotes it. */
export type CanonStatus = 'canon' | 'possibility' | 'draft' | 'discarded';

export type Source = 'author' | 'ai';

export type ChapterStatus = 'Idea' | 'Outlined' | 'Drafting' | 'Revising' | 'Done';
export type ProjectStatus = 'Planning' | 'Drafting' | 'Revising' | 'Finished';

export interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChapterOutline {
  happens: string;
  who: string;
  wants: string;
  obstacle: string;
  learns: string;
  changes: string;
  question: string;
  feel: string;
  unanswered: string;
  plan: string; // structured plan (author-written or accepted from the AI)
}

export interface Version {
  id: string;
  at: number;
  label: string;
  text: string;
}

export interface Comment {
  id: string;
  at: number;
  quote: string;
  note: string;
}

export interface Chapter extends Base {
  title: string;
  text: string;
  status: ChapterStatus;
  summary: string;
  summaryWordCount: number; // word count when summary was last written, to detect staleness
  outline: ChapterOutline;
  versions: Version[];
  comments: Comment[];
  povCharacterId: string;
}

export interface Scene extends Base {
  chapterId: string;
  order: number;
  title: string;
  location: string;
  time: string;
  povCharacterId: string;
  characterIds: string[];
  purpose: string;
  conflict: string;
  povWants: string;
  opposingWants: string;
  revealed: string;
  concealed: string;
  clueIntroduced: string;
  clueResolved: string;
  characterChange: string;
  emotionalChange: string;
  relationshipChange: string;
  foreshadowing: string;
  endingBeat: string;
  status: ChapterStatus;
}

export interface Character extends Base {
  name: string;
  role: string; // e.g. "Protagonist", "Suspect"
  status: CanonStatus;
  fields: Record<string, string>;
}

export interface RomanceMeters {
  attraction: number;
  trust: number;
  vulnerability: number;
  conflict: number;
  dependence: number;
  power: number; // -5 (A holds power) .. +5 (B holds power), stored 0-10 with 5 = balanced
}

export interface RomanceBeat {
  id: string;
  chapterId: string;
  note: string;
}

export interface Relationship extends Base {
  aId: string;
  bId: string;
  kind: string; // "sisters", "former lovers", ...
  description: string;
  tension: string; // what's unresolved between them
  status: CanonStatus;
  isRomance: boolean;
  romance: RomanceMeters;
  beats: RomanceBeat[];
}

export type IdeaCategory =
  | 'plot'
  | 'character'
  | 'mystery'
  | 'romance'
  | 'world'
  | 'theme'
  | 'twist'
  | 'scene'
  | 'ending'
  | 'other';

/** A piece of story information with a canon status: the heart of the canon system. */
export interface Idea extends Base {
  text: string;
  detail: string;
  status: CanonStatus;
  category: IdeaCategory;
  source: Source;
  linkId: string; // optional link to a character/chapter/etc.
}

export type ClueKind = 'genuine' | 'misleading' | 'red-herring';

export interface Clue extends Base {
  title: string;
  description: string;
  significance: string;
  kind: ClueKind;
  pointsTo: string;
  trueExplanation: string; // for red herrings/misleading clues: the innocent explanation
  whoKnowsIds: string[];
  appearsChapterId: string;
  resolvedChapterId: string;
  status: CanonStatus;
}

export interface Secret extends Base {
  title: string;
  description: string;
  holderIds: string[];
  hiddenFromIds: string[];
  hiddenFromReader: boolean;
  revealChapterId: string;
  ifRevealed: string; // what breaks if it comes out
  status: CanonStatus;
}

export interface Belief extends Base {
  characterId: string;
  belief: string;
  truth: 'true' | 'false' | 'partly' | 'unknown';
  sinceChapterId: string;
  status: CanonStatus;
}

/** Objective truths inside the story, and when the reader learns them. */
export interface Fact extends Base {
  text: string;
  readerLearnsChapterId: string; // '' = reader never told / not yet decided
  status: CanonStatus;
}

export interface MysteryTruth {
  centralQuestion: string;
  culprit: string;
  whatHappened: string;
  whatAppears: string;
  whatCharactersBelieve: string;
  when: string;
  motive: string;
  competingMotives: string;
  method: string;
  opportunity: string;
  evidence: string;
  coverUp: string;
  whoIsLying: string;
  whoIsManipulated: string;
}

export interface TimelineEvent extends Base {
  title: string;
  description: string;
  dateKind: 'exact' | 'approx' | 'relative';
  date: string; // YYYY-MM-DD when exact
  time: string; // HH:MM, optional
  approxLabel: string; // "Late autumn, 20 years ago"
  order: number; // manual ordering for relative/approx events
  location: string;
  characterIds: string[];
  chapterId: string;
  onPage: boolean; // does this event appear in the book, or is it backstory?
  status: CanonStatus;
}

export interface Place extends Base {
  name: string;
  description: string;
  details: string; // concrete, specific sensory details
  significance: string;
}

export type FactStatus = 'known' | 'needed' | 'fictional';

export interface ResearchItem extends Base {
  title: string;
  category: string;
  content: string;
  url: string;
  factStatus: FactStatus;
}

export interface Note extends Base {
  title: string;
  body: string;
}

export interface Ending {
  resolution: string;
  characterArcs: string;
  romance: string;
  secrets: string;
  unresolved: string;
  intentionallyAmbiguous: string;
  theme: string;
  finalImage: string;
  aftermath: string;
}

export interface Tone {
  darkness: number;
  romance: number;
  violence: number;
  psychological: number;
  complexity: number;
  atmosphere: number;
  explicitness: number;
  pace: number;
  description: string; // "disturbing but not gratuitous"
  styleWords: string; // "restrained, claustrophobic, literary but accessible"
  avoid: string; // things the author never wants
}

export interface StoryBible {
  premise: string;
  genre: string;
  themes: string;
  setting: string;
  rules: string;
  objects: string;
  majorReveals: string;
  structure: string;
  povPlan: string;
  tense: string;
  /** House style decisions (spellings, numbers, punctuation) like a copyeditor's style sheet. */
  styleSheet: string;
  /** Recurring images and objects to track across the book, comma-separated. */
  motifs: string;
}

export type AgentStatus = 'researching' | 'queried' | 'requested' | 'rejected' | 'offer' | 'no response';

export interface Agent {
  id: string;
  name: string;
  agency: string;
  link: string;
  status: AgentStatus;
  queriedOn: string;
  notes: string;
}

export interface Publishing {
  logline: string;
  blurb: string;
  synopsis: string;
  query: string;
  bio: string;
  comps: string;
  agents: Agent[];
}

export interface SeriesInfo {
  name: string;
  bookNumber: number;
  previousProjectId: string;
  arc: string;
  seeds: string;
}

export interface Project extends Base {
  schema: 1;
  title: string;
  author: string;
  status: ProjectStatus;
  targetChapters: number;
  targetWords: number;
  isDemo: boolean;
  lastBackupAt: number;
  currentChapterId: string;

  bible: StoryBible;
  tone: Tone;
  mystery: MysteryTruth;
  ending: Ending;

  chapters: Chapter[];
  scenes: Scene[];
  characters: Character[];
  relationships: Relationship[];
  ideas: Idea[];
  clues: Clue[];
  secrets: Secret[];
  beliefs: Belief[];
  facts: Fact[];
  timeline: TimelineEvent[];
  places: Place[];
  research: ResearchItem[];
  notes: Note[];

  publishing: Publishing;
  series: SeriesInfo;
  /** Saved results of whole-book analyses (page-turner chart, solvability test…). */
  lab: Record<string, { at: number; data: unknown }>;
}

export type CollectionKey =
  | 'chapters'
  | 'scenes'
  | 'characters'
  | 'relationships'
  | 'ideas'
  | 'clues'
  | 'secrets'
  | 'beliefs'
  | 'facts'
  | 'timeline'
  | 'places'
  | 'research'
  | 'notes';

export type ItemOf<K extends CollectionKey> = Project[K][number];

export interface ProjectMeta {
  id: string;
  title: string;
  updatedAt: number;
  words: number;
  isDemo: boolean;
}
