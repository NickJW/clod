// Local (free, instant) analysis that keeps drafted chapters fresh: what the book
// already leans on (phrases, crutch words, images, chapter openings) so a new
// chapter doesn't repeat it, and a targeted audit of a new draft for the
// line-editing pass.

import type { Project } from '../types';
import { checkProse } from './proseCheck';

const STOP = new Set(
  `a an the and or but if then than so to of in on at by for from with without into onto over under up down out off about as is was were be been being am are it its it's this that these those there here he she they them his her their hers him i me my we us our you your not no nor do did does done had has have having would could should can will just very really all any some more most much many such only own same too again once also still even back now well like what which who whom whose when where why how one two said says say get got go went come came see saw know knew think thought look looked looking turned turn felt feel way something nothing anything everything someone anyone thing things time day night another other before after while through around because though although against between into onto upon toward towards across along behind beside near`.split(/\s+/),
);

const words = (t: string) => t.toLowerCase().replace(/[’']/g, "'").match(/[a-z][a-z']*/g) ?? [];

function nameTokens(p: Project): Set<string> {
  const s = new Set<string>();
  for (const c of p.characters) for (const w of words(c.name)) s.add(w);
  for (const pl of p.places) for (const w of words(pl.name)) s.add(w);
  return s;
}

/** Word sequences (3-5 words) that recur at least `min` times, longest first, without overlap noise. */
export function repeatedPhrases(text: string, min: number, names: Set<string>, limit = 12): { phrase: string; n: number }[] {
  const w = words(text);
  const counts = new Map<string, number>();
  for (let size = 3; size <= 5; size++)
    for (let i = 0; i + size <= w.length; i++) {
      const g = w.slice(i, i + size);
      if (g.every((x) => STOP.has(x) || x.length < 3)) continue;
      if (g.some((x) => names.has(x))) continue;
      const k = g.join(' ');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  const list = [...counts.entries()].filter(([, n]) => n >= min).sort((a, b) => b[0].split(' ').length - a[0].split(' ').length || b[1] - a[1]);
  const out: { phrase: string; n: number }[] = [];
  for (const [phrase, n] of list) {
    if (out.some((o) => o.phrase.includes(phrase) || phrase.includes(o.phrase))) continue;
    out.push({ phrase, n });
    if (out.length >= limit) break;
  }
  return out;
}

/** Content words used far more than a writer would notice (per-thousand rate). */
export function crutchWords(text: string, names: Set<string>, limit = 12): { word: string; n: number }[] {
  const w = words(text);
  if (w.length < 400) return [];
  const counts = new Map<string, number>();
  for (const x of w) if (x.length >= 4 && !STOP.has(x) && !names.has(x)) counts.set(x, (counts.get(x) ?? 0) + 1);
  const floor = Math.max(4, Math.round(w.length / 900));
  return [...counts.entries()]
    .filter(([, n]) => n >= floor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, n]) => ({ word, n }));
}

/** Similes and "as if" images already used, so a new chapter doesn't reach for the same ones. */
export function imagesUsed(text: string, limit = 14): string[] {
  const out = new Set<string>();
  const re = /\b(like (?:a|an|the|someone|something) [a-z'-]+(?: [a-z'-]+){0,3}|as if [a-z'-]+(?: [a-z'-]+){0,4}|as though [a-z'-]+(?: [a-z'-]+){0,4})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.size < limit) out.add(m[0].toLowerCase());
  return [...out];
}

const firstSentence = (t: string) => (t.trim().match(/^[^.!?\n]+[.!?]*["”’]?/)?.[0] ?? '').slice(0, 160);
const lastSentence = (t: string) => (t.trim().match(/[^.!?\n]+[.!?]+["”’]?\s*$/)?.[0] ?? '').trim().slice(0, 160);

/** For the drafting prompt: what this book already leans on. */
export function freshnessBrief(p: Project, chapterId: string): string {
  const idx = p.chapters.findIndex((c) => c.id === chapterId);
  const written = p.chapters.filter((c, i) => c.id !== chapterId && c.text.trim().length > 200 && (idx < 0 || i !== idx));
  if (!written.length) return '';
  const all = written.map((c) => c.text).join('\n\n');
  const names = nameTokens(p);
  const parts: string[] = [];
  const phrases = repeatedPhrases(all, 3, names, 10);
  if (phrases.length) parts.push(`Phrases the book already repeats (do not use them again): ${phrases.map((x) => `"${x.phrase}"`).join(', ')}`);
  const crutch = crutchWords(all, names, 10);
  if (crutch.length) parts.push(`Words the book already leans on (use them sparingly, find other ways): ${crutch.map((x) => x.word).join(', ')}`);
  const imgs = imagesUsed(all, 12);
  if (imgs.length) parts.push(`Images and comparisons already used (don't reuse or echo them): ${imgs.map((x) => `"${x}"`).join(', ')}`);
  const recent = written.slice(-5);
  const opens = recent.map((c) => firstSentence(c.text)).filter(Boolean);
  const ends = recent.map((c) => lastSentence(c.text)).filter(Boolean);
  if (opens.length) parts.push(`How recent chapters OPEN (open this one differently: a different kind of first sentence and entry point):\n${opens.map((x) => `- "${x}"`).join('\n')}`);
  if (ends.length) parts.push(`How recent chapters END (end this one differently):\n${ends.map((x) => `- "${x}"`).join('\n')}`);
  return parts.join('\n\n');
}

/** For the line-editing pass: specific, countable problems in a new draft. */
export function draftAudit(p: Project, draft: string): string {
  const names = nameTokens(p);
  const lines: string[] = [];
  const check = checkProse(draft);
  for (const f of check.flags.filter((f) => ['cliche', 'dash', 'notbut', 'filter', 'emotion', 'ominous', 'asif', 'semi', 'rq', 'adverb', 'triple', 'rhythm', 'opener', 'repeat', 'paras', 'was'].includes(f.kind)))
    lines.push(`- ${f.title}${f.examples.length ? `: ${f.examples.slice(0, 4).map((e) => `"${e.text}"`).join('; ')}` : ''}`);
  const rep = repeatedPhrases(draft, 2, names, 10);
  if (rep.length) lines.push(`- Repeated phrases within this draft: ${rep.map((x) => `"${x.phrase}" (${x.n}×)`).join(', ')}`);
  const crutch = crutchWords(draft, names, 8);
  if (crutch.length) lines.push(`- Overused words in this draft: ${crutch.map((x) => `${x.word} (${x.n}×)`).join(', ')}`);
  lines.push(`- Sentence rhythm: average ${check.stats.avgSentence} words, variety ${check.stats.variety}.`);
  return lines.join('\n');
}
