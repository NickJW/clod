// Free, instant, private whole-book checks (no AI): manuscript health,
// style-sheet consistency, character names, motifs, and a finish-date forecast.
import type { Project } from '../types';
import { characterName, countWords, manuscriptWords } from '../story/reference';
import { getPref } from '../storage/db';

export interface ChapterStat {
  n: number;
  title: string;
  words: number;
  dialoguePct: number;
  avgSentence: number;
  pov: string;
}

const CRUTCH = ['just', 'really', 'very', 'suddenly', 'began to', 'started to', 'seemed', 'somehow', 'actually', 'slightly', 'almost', 'nodded', 'shrugged', 'sighed', 'smiled', 'glanced', 'turned', 'realized', 'realised', 'felt', 'knew', 'could see', 'could hear', 'in fact', 'a little', 'for a moment', 'at that moment'];

const STOP = new Set('the a an and or but of to in on at for with from by as is was were be been it its he she they we you i his her their our my me him them us this that these those there here then than so if not no do did does had has have what which who whom whose when where why how all any some into out up down over under again once about after before through between also only own same too can will would should could may might must shall said'.split(' '));

export function chapterStats(p: Project): ChapterStat[] {
  return p.chapters.map((c, i) => {
    const words = countWords(c.text);
    const quoted = (c.text.match(/[“"][^”"]*[”"]/g) ?? []).join(' ');
    const sentences = c.text.split(/[.!?]+["”’]?\s/).filter((s) => s.trim().split(/\s+/).length > 1);
    return {
      n: i + 1,
      title: c.title,
      words,
      dialoguePct: words ? Math.round((countWords(quoted) / words) * 100) : 0,
      avgSentence: sentences.length ? Math.round((words / sentences.length) * 10) / 10 : 0,
      pov: characterName(p, c.povCharacterId),
    };
  });
}

export function healthReport(p: Project) {
  const stats = chapterStats(p);
  const written = stats.filter((s) => s.words > 200);
  const total = manuscriptWords(p);
  const mean = written.length ? written.reduce((a, s) => a + s.words, 0) / written.length : 0;
  const text = p.chapters.map((c) => c.text).join('\n').toLowerCase();

  const crutch = CRUTCH.map((w) => {
    const n = (text.match(new RegExp(`\\b${w}\\b`, 'g')) ?? []).length;
    return { word: w, count: n, per10k: total ? Math.round((n / total) * 10000) : 0 };
  })
    .filter((c) => c.per10k >= 12 && c.count >= 4)
    .sort((a, b) => b.per10k - a.per10k)
    .slice(0, 12);

  // Phrases of 4+ words that repeat across the book (tics the author may not notice).
  const tokens = text.replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean);
  const grams = new Map<string, number>();
  for (let i = 0; i + 4 <= tokens.length; i++) {
    const g = tokens.slice(i, i + 4);
    if (g.filter((w) => STOP.has(w)).length >= 3) continue;
    const k = g.join(' ');
    grams.set(k, (grams.get(k) ?? 0) + 1);
  }
  const repeated = [...grams.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const povCounts = new Map<string, number>();
  for (const s of written) povCounts.set(s.pov || 'Not set', (povCounts.get(s.pov || 'Not set') ?? 0) + s.words);

  const verdict =
    total < 60000
      ? `The draft is ${total.toLocaleString()} words. Debut psychological thrillers usually land between 80,000 and 100,000 words when finished.`
      : total <= 105000
        ? `At ${total.toLocaleString()} words, the book is in the range agents expect for a debut thriller (about 80,000–100,000).`
        : `At ${total.toLocaleString()} words, the book is long for a debut thriller. Agents often hesitate above about 110,000. Consider where to tighten.`;

  const outliers = written.filter((s) => mean && (s.words > mean * 1.8 || s.words < mean * 0.4));
  return { stats, total, mean: Math.round(mean), crutch, repeated, povCounts: [...povCounts.entries()], verdict, outliers };
}

const VARIANTS: [string, string][] = [
  ['grey', 'gray'],
  ['okay', 'ok'],
  ['towards', 'toward'],
  ['afterwards', 'afterward'],
  ['whisky', 'whiskey'],
  ['colour', 'color'],
  ['realise', 'realize'],
  ['realised', 'realized'],
  ['recognise', 'recognize'],
  ['favourite', 'favorite'],
  ['mum', 'mom'],
  ['theatre', 'theater'],
  ['per cent', 'percent'],
  ['alright', 'all right'],
  ['blonde', 'blond'],
  ['focussed', 'focused'],
  ['travelled', 'traveled'],
];

export interface StyleIssue {
  title: string;
  detail: string;
}

export function styleIssues(p: Project): StyleIssue[] {
  const text = p.chapters.map((c) => c.text).join('\n');
  const lower = text.toLowerCase();
  const out: StyleIssue[] = [];
  for (const [a, b] of VARIANTS) {
    const na = (lower.match(new RegExp(`\\b${a}\\b`, 'g')) ?? []).length;
    const nb = (lower.match(new RegExp(`\\b${b}\\b`, 'g')) ?? []).length;
    if (na && nb) out.push({ title: `"${a}" and "${b}" both used`, detail: `"${a}" ${na}×, "${b}" ${nb}×. Pick one for your style sheet.` });
  }
  const curly = (text.match(/[“”]/g) ?? []).length;
  const straight = (text.match(/"/g) ?? []).length;
  if (curly && straight) out.push({ title: 'Mixed quotation marks', detail: `${curly} curly (“ ”) and ${straight} straight (") quotation marks. Word export keeps them as typed. Choose one style.` });
  const em = (text.match(/—/g) ?? []).length;
  const dbl = (text.match(/--/g) ?? []).length;
  if (em && dbl) out.push({ title: 'Mixed dashes', detail: `${em} em dashes (—) and ${dbl} double hyphens (--).` });
  const ell = (text.match(/…/g) ?? []).length;
  const dots = (text.match(/\.\.\./g) ?? []).length;
  if (ell && dots) out.push({ title: 'Mixed ellipses', detail: `${ell} "…" characters and ${dots} "..." sets of three dots.` });
  const digits = (text.match(/\b(1[1-9]|[2-9]\d)\b(?! ?(a\.m|p\.m|%))/g) ?? []).length;
  const words = (lower.match(/\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g) ?? []).length;
  if (digits >= 2 && words >= 2) out.push({ title: 'Numbers as digits and as words', detail: `Fiction usually spells out numbers (for example "twenty-two years"). Found ${digits} as digits, ${words} as words.` });

  // Name spellings that differ by one letter (e.g. "Elias" / "Elais").
  const caps = new Map<string, number>();
  for (const m of text.matchAll(/\b[A-Z][a-z]{3,}\b/g)) caps.set(m[0], (caps.get(m[0]) ?? 0) + 1);
  const known = [...caps.entries()].filter(([, n]) => n >= 1);
  const names = new Set(p.characters.flatMap((c) => c.name.split(/\s+/)));
  for (const [w, n] of known) {
    if (names.has(w)) continue;
    for (const nm of names) {
      if (nm.length >= 4 && w !== nm && Math.abs(w.length - nm.length) <= 1 && editDistance(w, nm) === 1 && n <= 3)
        out.push({ title: `Possible misspelling: "${w}"`, detail: `Appears ${n}×. Did you mean "${nm}"?` });
    }
  }
  return out;
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Names that readers could confuse: same first letter and length, similar sound, or near-identical endings. */
export function nameIssues(p: Project): StyleIssue[] {
  const firsts = p.characters.map((c) => ({ full: c.name, first: c.name.split(/\s+/)[0] })).filter((x) => x.first.length > 1);
  const out: StyleIssue[] = [];
  const sound = (s: string) => s.toLowerCase().replace(/[aeiouyhw]/g, '').replace(/(.)\1+/g, '$1').slice(0, 3);
  for (let i = 0; i < firsts.length; i++)
    for (let j = i + 1; j < firsts.length; j++) {
      const a = firsts[i].first;
      const b = firsts[j].first;
      const reasons: string[] = [];
      if (a[0] === b[0]) reasons.push('start with the same letter');
      if (sound(a) === sound(b)) reasons.push('sound alike');
      if (a.length > 3 && b.length > 3 && a.slice(-3).toLowerCase() === b.slice(-3).toLowerCase()) reasons.push('end the same way');
      if (reasons.length) out.push({ title: `${a} and ${b}`, detail: `These names ${reasons.join(' and ')}. Readers skimming may mix them up, especially for minor characters.` });
    }
  return out;
}

export function motifCounts(p: Project): { motif: string; perChapter: number[] }[] {
  const motifs = (p.bible.motifs || '')
    .split(/[,\n]/)
    .map((m) => m.trim())
    .filter(Boolean);
  return motifs.map((m) => {
    const re = new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/s$/, '')}(s|es)?\\b`, 'gi');
    return { motif: m, perChapter: p.chapters.map((c) => (c.text.match(re) ?? []).length) };
  });
}

/** Average words per writing day over the last 14 days, and a projected finish date. */
export function forecast(p: Project): { perDay: number; remaining: number; date: Date | null; activeDays: number } {
  const log = getPref<Record<string, number>>(`wordlog:${p.id}`, {});
  let sum = 0;
  let active = 0;
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    const v = log[d.toDateString()] ?? 0;
    sum += v;
    if (v > 0) active++;
    d.setDate(d.getDate() - 1);
  }
  const perDay = Math.round(sum / 14);
  const remaining = Math.max(0, p.targetWords - manuscriptWords(p));
  const date = perDay > 0 ? new Date(Date.now() + (remaining / perDay) * 864e5) : null;
  return { perDay, remaining, date, activeDays: active };
}

export function progressNote(p: Project): string {
  const words = manuscriptWords(p);
  const done = p.chapters.filter((c) => countWords(c.text) > 500).length;
  const f = forecast(p);
  const log = getPref<Record<string, number>>(`wordlog:${p.id}`, {});
  let week = 0;
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    week += log[d.toDateString()] ?? 0;
    d.setDate(d.getDate() - 1);
  }
  return [
    `Novel update: "${p.title}"`,
    `${words.toLocaleString()} words so far, ${done} chapter${done === 1 ? '' : 's'} drafted.`,
    week ? `${week.toLocaleString()} new words this week.` : '',
    f.date ? `At this pace, the first draft will be finished around ${f.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.` : '',
    `Currently working on: ${p.chapters.find((c) => c.id === p.currentChapterId)?.title ?? 'the next chapter'}.`,
  ]
    .filter(Boolean)
    .join('\n');
}
