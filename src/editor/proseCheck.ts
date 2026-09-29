// A free, instant, local prose check (no AI, no cost, nothing leaves the device).
// It flags habits associated with generic or "AI-sounding" prose. These are hints
// for a human eye, not a score, and not an authorship detector.

export interface ProseFlag {
  kind: string;
  title: string;
  explain: string;
  examples: { text: string; index: number }[];
  weight: number; // for ordering
}

const CLICHES = [
  "couldn't help but",
  'could not help but',
  'little did she know',
  'little did he know',
  'a chill ran down',
  'shiver down her spine',
  'shiver down his spine',
  'the air was thick',
  'air thick with',
  "breath she didn't know",
  "breath he didn't know",
  'let out a breath',
  'released a breath',
  'something shifted',
  'the weight of',
  'carried more weight',
  'carried the weight',
  'more than words',
  'said everything',
  'spoke volumes',
  'a beat of silence',
  'let the silence',
  'the silence stretched',
  'a flicker of',
  'palpable',
  'tapestry',
  'a testament to',
  'in that moment',
  'every fiber of',
  'eyes darkened',
  'heart pounded',
  'heart hammered',
  'blood ran cold',
  'time stood still',
  'deafening silence',
  'silence was deafening',
  'a wave of',
  'washed over her',
  'washed over him',
  'sent shivers',
  'hung in the air',
  'hung heavy',
  'dance of',
  'unspoken',
  'the ghost of a smile',
  'barely above a whisper',
  'voice barely a whisper',
  'searing',
  'jolt of',
  'pang of',
  'a knot in her stomach',
  'pit of her stomach',
  'pit of his stomach',
  'electric',
  'intoxicating',
  'eerily',
  'ominous',
  'sinister',
  'shrouded',
  'ethereal',
  'visceral',
  'gossamer',
  'liminal',
  'delve',
  'undeniable',
  'unmistakable',
];

const AI_VOCAB = [
  'delve', 'delved', 'tapestry', 'testament', 'intricate', 'intricately', 'nestled', 'myriad', 'amidst', 'labyrinthine', 'enigmatic', 'palpable', 'visceral',
  'ethereal', 'liminal', 'gossamer', 'kaleidoscope', 'symphony', 'cacophony', 'resonate', 'resonated', 'resonating', 'unspoken', 'unwavering', 'indelible',
  'juxtaposition', 'ministrations', 'shimmered', 'shimmering', 'thrumming', 'thrummed', 'thrum', 'reverie', 'imbued', 'tendrils', 'tendril', 'embark',
  'intertwined', 'unravel', 'unraveling', 'unravelling', 'weaving', 'realm', 'beacon', 'crescendo', 'profound', 'poignant', 'meticulous', 'meticulously',
];

const FILTERS = ['she felt', 'he felt', 'i felt', 'she noticed', 'he noticed', 'i noticed', 'she realized', 'he realized', 'i realized', 'she realised', 'he realised', 'i realised', 'she wondered', 'he wondered', 'she could see', 'he could see', 'she could hear', 'he could hear', 'she could feel', 'he could feel', 'she knew that', 'he knew that'];

function sentences(text: string): { s: string; index: number }[] {
  const out: { s: string; index: number }[] = [];
  const re = /[^.!?\n]+[.!?]+["'”’)]*|[^.!?\n]+$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const s = m[0].trim();
    if (s.split(/\s+/).length >= 2) out.push({ s, index: m.index + m[0].indexOf(s) });
  }
  return out;
}

function findAll(text: string, re: RegExp, limit = 6): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = g.exec(text)) && out.length < limit) {
    out.push({ text: snippet(text, m.index, m[0].length), index: m.index });
    if (m[0].length === 0) g.lastIndex++;
  }
  return out;
}

function countAll(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) ?? []).length;
}

function snippet(text: string, index: number, len: number): string {
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, index - 30)) + 1);
  const end = Math.min(text.length, text.indexOf(' ', index + len + 30) === -1 ? text.length : text.indexOf(' ', index + len + 30));
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '');
}

export function checkProse(text: string): { flags: ProseFlag[]; stats: { words: number; sentences: number; avgSentence: number; variety: string } } {
  const flags: ProseFlag[] = [];
  const words = (text.match(/\S+/g) ?? []).length;
  const sents = sentences(text);
  const lower = text.toLowerCase();
  const per1k = (n: number) => (words ? (n / words) * 1000 : 0);

  // Stock phrases
  const clicheHits: { text: string; index: number }[] = [];
  for (const c of CLICHES) {
    let i = lower.indexOf(c);
    while (i >= 0 && clicheHits.length < 12) {
      clicheHits.push({ text: snippet(text, i, c.length), index: i });
      i = lower.indexOf(c, i + c.length);
    }
  }
  if (clicheHits.length)
    flags.push({
      kind: 'cliche',
      title: `Stock phrases (${clicheHits.length})`,
      explain: 'Familiar phrases readers skim past. A specific detail from this exact moment usually works harder.',
      examples: clicheHits.sort((a, b) => a.index - b.index),
      weight: 10 + clicheHits.length,
    });

  // Words AI models lean on far more than novelists do (only flagged when they cluster).
  const aiRe = new RegExp(`\\b(${AI_VOCAB.join('|')})\\b`, 'gi');
  const aiHits = findAll(text, aiRe, 12);
  const aiCount = countAll(text, aiRe);
  if (words > 150 && (aiCount >= 4 || per1k(aiCount) > 3))
    flags.push({
      kind: 'aivocab',
      title: `Words AI tends to overuse (${aiCount})`,
      explain: 'Words like these show up far more in machine-written prose than in novels, so screeners notice them in clusters. Use your own plainer word, or cut.',
      examples: aiHits,
      weight: 9 + aiCount,
    });

  // Em dashes
  const dashes = countAll(text, /—|--| – /);
  if (words > 150 && per1k(dashes) > 6)
    flags.push({
      kind: 'dash',
      title: `Lots of dashes (${dashes})`,
      explain: 'Frequent dashes are a strong "AI prose" tell. Try a comma, a full stop, or restructuring the sentence.',
      examples: findAll(text, /—|--| – /),
      weight: 8,
    });

  const semis = countAll(text, /;/);
  if (words > 150 && per1k(semis) > 4)
    flags.push({ kind: 'semi', title: `Many semicolons (${semis})`, explain: 'In fiction, a full stop is usually stronger.', examples: findAll(text, /;/), weight: 4 });

  // "as if" / "as though"
  const asIf = countAll(text, /\bas (if|though)\b/i);
  if (per1k(asIf) > 3 && asIf >= 3)
    flags.push({ kind: 'asif', title: `"As if" comparisons (${asIf})`, explain: 'Frequent comparisons can blur the real thing. Keep the best one or two.', examples: findAll(text, /\bas (if|though)\b/i), weight: 5 });

  // not X but Y
  const notBut = findAll(text, /\bnot (?:just |only |because )?[^.,;!?]{1,40}, but\b|\bit wasn'?t [^.;!?]{1,40}\. it was\b/i);
  if (notBut.length >= 2)
    flags.push({ kind: 'notbut', title: `"Not X, but Y" patterns (${notBut.length})`, explain: 'A recognisable rhetorical pattern. It can sound clever once and mechanical the third time.', examples: notBut, weight: 6 });

  // Filter words
  const filterHits: { text: string; index: number }[] = [];
  for (const f of FILTERS) {
    const re = new RegExp(`\\b${f}\\b`, 'gi');
    filterHits.push(...findAll(text, re, 4));
  }
  if (per1k(filterHits.length) > 5 && filterHits.length >= 3)
    flags.push({
      kind: 'filter',
      title: `Filtering through feelings (${filterHits.length})`,
      explain: '"She felt", "she noticed", "she realised" put a layer between the reader and the moment. Often you can show the thing itself.',
      examples: filterHits.sort((a, b) => a.index - b.index).slice(0, 8),
      weight: 6,
    });

  // Named emotions
  const emo = findAll(text, /\b(felt|feel|feeling) (a |an )?(sense of |surge of |wave of )?(fear|dread|anger|sadness|guilt|relief|panic|terror|shame|grief|love|joy|anxiety|unease)\b/i, 8);
  if (emo.length >= 2)
    flags.push({ kind: 'emotion', title: `Emotions named directly (${emo.length})`, explain: 'Naming the emotion tells the reader what to feel. A gesture, action or line of dialogue lets them feel it.', examples: emo, weight: 7 });

  // Adverbs
  const adverbs = (text.match(/\b\w{4,}ly\b/gi) ?? []).filter((w) => !/^(only|family|early|really|likely|reply|supply|apply|holy|belly|jelly|ugly|lily|daily|lonely|elderly|friendly|lovely|silly|chilly|curly|hilly|rally|ally|folly|bully|fully|imply|rely|gully|tally|july|italy|emily|molly|holly|sally|kelly|billy|lily|assembly|anomaly|monopoly|melancholy)$/i.test(w));
  if (per1k(adverbs.length) > 18)
    flags.push({ kind: 'adverb', title: `Many -ly adverbs (${adverbs.length})`, explain: 'A stronger verb often replaces a verb plus adverb ("walked slowly" → "trudged", "shuffled").', examples: findAll(text, /\b\w{4,}ly\b/i, 8), weight: 3 });

  // was/were
  const was = countAll(text, /\b(was|were)\b/i);
  if (per1k(was) > 38)
    flags.push({ kind: 'was', title: `Heavy "was/were" (${was})`, explain: 'Lots of was/were can make prose static. Try active verbs in the key moments.', examples: findAll(text, /\b(was|were) \w+ing\b/i, 6), weight: 3 });

  // Rhetorical questions in narration (outside quotes)
  const narr = text.replace(/[“"][^”"]*[”"]/g, (m) => ' '.repeat(m.length));
  const rq = findAll(narr, /[^.!?\n]{8,}\?/, 8).map((e) => ({ ...e, text: snippet(text, e.index, 20) }));
  if (rq.length >= 3)
    flags.push({ kind: 'rq', title: `Questions in the narration (${rq.length})`, explain: 'Several rhetorical questions in a row can feel like the narrator is prompting the reader. One is often enough.', examples: rq, weight: 5 });

  // Repeated sentence openings
  const openers = new Map<string, { text: string; index: number }[]>();
  for (const { s, index } of sents) {
    const w = s.replace(/^["“'‘]/, '').split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, '');
    if (!w || w.length < 2) continue;
    if (!openers.has(w)) openers.set(w, []);
    openers.get(w)!.push({ text: snippet(text, index, 10), index });
  }
  const heavy = [...openers.entries()].filter(([w, l]) => l.length >= 4 && l.length / Math.max(1, sents.length) > 0.18 && !['i'].includes(w));
  for (const [w, l] of heavy)
    flags.push({ kind: 'opener', title: `Many sentences start with "${w}" (${l.length})`, explain: 'Repeated openings create a monotonous rhythm.', examples: l.slice(0, 6), weight: 5 });

  // Sentence length variety
  const lens = sents.map((x) => x.s.split(/\s+/).length);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const sd = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length) : 0;
  const variety = sd < 4 ? 'even' : sd < 7 ? 'moderate' : 'varied';
  if (lens.length >= 12 && sd < 4.2)
    flags.push({ kind: 'rhythm', title: 'Very even sentence rhythm', explain: `Most sentences are about ${Math.round(avg)} words long. Real prose tends to vary more: a long sentence, then a short one. Then a fragment.`, examples: [], weight: 6 });

  // Triplets
  const triples = findAll(text, /\b\w+(?: \w+)?, \w+(?: \w+)?,? and \w+(?: \w+)?\b/i, 8);
  if (per1k(triples.length) > 5 && triples.length >= 4)
    flags.push({ kind: 'triple', title: `Lists of three (${triples.length})`, explain: 'Three-part lists are satisfying, but as a habit they become a recognisable cadence.', examples: triples, weight: 4 });

  // Repeated distinctive words
  const counts = new Map<string, number>();
  for (const w of lower.match(/\b[a-z]{6,}\b/g) ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
  const common = new Set(['something', 'nothing', 'because', 'before', 'through', 'thought', 'another', 'looked', 'around', 'should', 'little', 'enough', 'already', 'against', 'turned', 'nothing', 'people', 'things', 'always', 'though', 'himself', 'herself', 'without', 'toward', 'towards', 'behind', 'between', 'moment', 'father', 'mother', 'sister']);
  const repeated = [...counts.entries()].filter(([w, n]) => !common.has(w) && n >= Math.max(4, words / 250)).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (repeated.length && words > 200)
    flags.push({
      kind: 'repeat',
      title: 'Repeated words',
      explain: `These words appear often: ${repeated.map(([w, n]) => `"${w}" ×${n}`).join(', ')}. Deliberate repetition can work, but check it's on purpose.`,
      examples: [],
      weight: 4,
    });

  // Paragraph endings that sound ominous
  const paras = text.split(/\n\s*\n|\n/).filter((x) => x.trim().split(/\s+/).length > 4);
  const ominous = paras
    .map((x) => x.trim())
    .filter((x) => /(nothing would ever be the same|if only (she|he) had known|that was the (first|last) mistake|would change everything|(she|he) didn'?t know it yet|was only the beginning|little did)/i.test(x.slice(-160)));
  if (ominous.length)
    flags.push({
      kind: 'ominous',
      title: 'Announced foreshadowing',
      explain: 'Lines that tell the reader something bad is coming tend to release tension rather than build it.',
      examples: ominous.slice(0, 4).map((x) => ({ text: '…' + x.slice(-120), index: text.indexOf(x) + x.length - 120 })),
      weight: 7,
    });

  // Paragraph length monotony
  const plens = paras.map((x) => x.split(/\s+/).length);
  if (plens.length >= 8) {
    const pavg = plens.reduce((a, b) => a + b, 0) / plens.length;
    const psd = Math.sqrt(plens.reduce((a, b) => a + (b - pavg) ** 2, 0) / plens.length);
    if (psd / pavg < 0.35)
      flags.push({ kind: 'paras', title: 'Paragraphs are all a similar length', explain: 'Varying paragraph length, including the occasional one-line paragraph, controls pace and emphasis.', examples: [], weight: 4 });
  }

  return {
    flags: flags.sort((a, b) => b.weight - a.weight),
    stats: { words, sentences: sents.length, avgSentence: Math.round(avg * 10) / 10, variety },
  };
}
