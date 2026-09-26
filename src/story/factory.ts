// Creates new records with sensible defaults, and repairs projects loaded from
// older versions or damaged backups so missing fields never crash the app.
import type {
  Chapter,
  ChapterOutline,
  Character,
  Clue,
  Belief,
  Ending,
  Fact,
  Idea,
  MysteryTruth,
  Note,
  Place,
  Project,
  Relationship,
  ResearchItem,
  Scene,
  Secret,
  StoryBible,
  TimelineEvent,
  Tone,
  CollectionKey,
} from '../types';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const stamp = () => {
  const now = Date.now();
  return { id: uid(), createdAt: now, updatedAt: now };
};

export const emptyOutline = (): ChapterOutline => ({
  happens: '',
  who: '',
  wants: '',
  obstacle: '',
  learns: '',
  changes: '',
  question: '',
  feel: '',
  unanswered: '',
  plan: '',
});

export const emptyBible = (): StoryBible => ({
  premise: '',
  genre: 'Dark Mystery / Psychological Thriller',
  themes: '',
  setting: '',
  rules: '',
  objects: '',
  majorReveals: '',
  structure: '',
  povPlan: '',
  tense: '',
  styleSheet: '',
  motifs: '',
});

export const defaultTone = (): Tone => ({
  darkness: 6,
  romance: 3,
  violence: 4,
  psychological: 7,
  complexity: 6,
  atmosphere: 7,
  explicitness: 2,
  pace: 5,
  description: '',
  styleWords: '',
  avoid: '',
  influences: '',
  styleProfile: '',
});

export const emptyMystery = (): MysteryTruth => ({
  centralQuestion: '',
  culprit: '',
  whatHappened: '',
  whatAppears: '',
  whatCharactersBelieve: '',
  when: '',
  motive: '',
  competingMotives: '',
  method: '',
  opportunity: '',
  evidence: '',
  coverUp: '',
  whoIsLying: '',
  whoIsManipulated: '',
});

export const emptyEnding = (): Ending => ({
  resolution: '',
  characterArcs: '',
  romance: '',
  secrets: '',
  unresolved: '',
  intentionallyAmbiguous: '',
  theme: '',
  finalImage: '',
  aftermath: '',
});

export const newChapter = (title = 'Untitled chapter', p: Partial<Chapter> = {}): Chapter => ({
  ...stamp(),
  title,
  text: '',
  status: 'Idea',
  summary: '',
  summaryWordCount: 0,
  outline: emptyOutline(),
  versions: [],
  comments: [],
  povCharacterId: '',
  ...p,
});

export const newScene = (chapterId: string, p: Partial<Scene> = {}): Scene => ({
  ...stamp(),
  chapterId,
  order: Date.now(),
  title: 'New scene',
  location: '',
  time: '',
  povCharacterId: '',
  characterIds: [],
  purpose: '',
  conflict: '',
  povWants: '',
  opposingWants: '',
  revealed: '',
  concealed: '',
  clueIntroduced: '',
  clueResolved: '',
  characterChange: '',
  emotionalChange: '',
  relationshipChange: '',
  foreshadowing: '',
  endingBeat: '',
  status: 'Idea',
  ...p,
});

export const newCharacter = (name = 'New character', p: Partial<Character> = {}): Character => ({
  ...stamp(),
  name,
  role: '',
  status: 'canon',
  fields: {},
  ...p,
});

export const newRelationship = (aId: string, bId: string, p: Partial<Relationship> = {}): Relationship => ({
  ...stamp(),
  aId,
  bId,
  kind: '',
  description: '',
  tension: '',
  status: 'canon',
  isRomance: false,
  romance: { attraction: 0, trust: 0, vulnerability: 0, conflict: 0, dependence: 0, power: 5 },
  beats: [],
  ...p,
});

export const newIdea = (text: string, p: Partial<Idea> = {}): Idea => ({
  ...stamp(),
  text,
  detail: '',
  status: 'possibility',
  category: 'plot',
  source: 'author',
  linkId: '',
  ...p,
});

export const newClue = (p: Partial<Clue> = {}): Clue => ({
  ...stamp(),
  title: 'New clue',
  description: '',
  significance: '',
  kind: 'genuine',
  pointsTo: '',
  trueExplanation: '',
  whoKnowsIds: [],
  appearsChapterId: '',
  resolvedChapterId: '',
  status: 'canon',
  ...p,
});

export const newSecret = (p: Partial<Secret> = {}): Secret => ({
  ...stamp(),
  title: 'New secret',
  description: '',
  holderIds: [],
  hiddenFromIds: [],
  hiddenFromReader: true,
  revealChapterId: '',
  ifRevealed: '',
  status: 'canon',
  ...p,
});

export const newBelief = (characterId = '', p: Partial<Belief> = {}): Belief => ({
  ...stamp(),
  characterId,
  belief: '',
  truth: 'unknown',
  sinceChapterId: '',
  status: 'canon',
  ...p,
});

export const newFact = (text = '', p: Partial<Fact> = {}): Fact => ({
  ...stamp(),
  text,
  readerLearnsChapterId: '',
  status: 'canon',
  ...p,
});

export const newEvent = (p: Partial<TimelineEvent> = {}): TimelineEvent => ({
  ...stamp(),
  title: 'New event',
  description: '',
  dateKind: 'relative',
  date: '',
  time: '',
  approxLabel: '',
  order: Date.now(),
  location: '',
  characterIds: [],
  chapterId: '',
  onPage: true,
  status: 'canon',
  ...p,
});

export const newPlace = (p: Partial<Place> = {}): Place => ({
  ...stamp(),
  name: 'New place',
  description: '',
  details: '',
  significance: '',
  ...p,
});

export const newResearch = (p: Partial<ResearchItem> = {}): ResearchItem => ({
  ...stamp(),
  title: 'New research note',
  category: 'General',
  content: '',
  url: '',
  factStatus: 'needed',
  ...p,
});

export const newNote = (p: Partial<Note> = {}): Note => ({ ...stamp(), title: 'New note', body: '', ...p });

export function newProject(title = 'My Novel'): Project {
  const first = newChapter('Chapter One');
  return {
    ...stamp(),
    schema: 1,
    title,
    author: '',
    status: 'Planning',
    targetChapters: 30,
    targetWords: 85000,
    isDemo: false,
    lastBackupAt: 0,
    currentChapterId: first.id,
    bible: emptyBible(),
    tone: defaultTone(),
    mystery: emptyMystery(),
    ending: emptyEnding(),
    chapters: [first],
    scenes: [],
    characters: [],
    relationships: [],
    ideas: [],
    clues: [],
    secrets: [],
    beliefs: [],
    facts: [],
    timeline: [],
    places: [],
    research: [],
    notes: [],
    publishing: emptyPublishing(),
    series: { name: '', bookNumber: 1, previousProjectId: '', arc: '', seeds: '' },
    lab: {},
    aiText: {},
  };
}

export const emptyPublishing = () => ({ logline: '', blurb: '', synopsis: '', query: '', bio: '', comps: '', agents: [] });

const COLLECTION_DEFAULTS: Record<CollectionKey, () => object> = {
  chapters: () => newChapter(),
  scenes: () => newScene(''),
  characters: () => newCharacter(),
  relationships: () => newRelationship('', ''),
  ideas: () => newIdea(''),
  clues: () => newClue(),
  secrets: () => newSecret(),
  beliefs: () => newBelief(),
  facts: () => newFact(),
  timeline: () => newEvent(),
  places: () => newPlace(),
  research: () => newResearch(),
  notes: () => newNote(),
};

/** Fill in any missing fields (older backups, partial imports). Never throws on odd data. */
export function normalizeProject(raw: unknown): Project {
  const base = newProject();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p: Project = {
    ...base,
    ...(r as Partial<Project>),
    schema: 1,
    bible: { ...base.bible, ...((r.bible as object) ?? {}) },
    tone: { ...base.tone, ...((r.tone as object) ?? {}) },
    mystery: { ...base.mystery, ...((r.mystery as object) ?? {}) },
    ending: { ...base.ending, ...((r.ending as object) ?? {}) },
    publishing: { ...base.publishing, ...((r.publishing as object) ?? {}) },
    series: { ...base.series, ...((r.series as object) ?? {}) },
    lab: (r.lab as Project['lab']) ?? {},
    aiText: (r.aiText as Project['aiText']) ?? {},
  };
  if (!Array.isArray(p.publishing.agents)) p.publishing.agents = [];
  for (const key of Object.keys(COLLECTION_DEFAULTS) as CollectionKey[]) {
    const list = Array.isArray(r[key]) ? (r[key] as object[]) : key === 'chapters' ? base.chapters : [];
    (p as unknown as Record<string, unknown>)[key] = list
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const d = COLLECTION_DEFAULTS[key]() as Record<string, unknown>;
        const merged = { ...d, ...x } as Record<string, unknown>;
        if (key === 'chapters') merged.outline = { ...emptyOutline(), ...((x as { outline?: object }).outline ?? {}) };
        if (!merged.id) merged.id = uid();
        return merged;
      });
  }
  if (p.chapters.length === 0) p.chapters = [newChapter('Chapter One')];
  if (!p.chapters.some((c) => c.id === p.currentChapterId)) p.currentChapterId = p.chapters[0].id;
  if (typeof p.title !== 'string' || !p.title.trim()) p.title = 'My Novel';
  return p;
}
