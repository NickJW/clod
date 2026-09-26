// Context selection. Instead of sending the whole manuscript, each request gets
// the parts of the story bible that matter for the task: the characters in the
// passage, their relationships and secrets, relevant clues and timeline events,
// and chapter summaries.
import type { CanonStatus, Character, Project, Tone } from '../types';
import { CHARACTER_GROUPS, chapterLabel, characterName, charactersMentioned, countWords } from '../story/reference';
import { getPref, setPref } from '../storage/db';

export type Scope = 'local' | 'mystery' | 'whole' | 'minimal';

export interface Focus {
  scope: Scope;
  chapterId?: string;
  /** The passage being worked on, used to detect which characters and places are relevant. */
  text?: string;
  characterIds?: string[];
  /** Include a sample of the author's own prose so drafts match her voice. */
  voice?: boolean;
}

const TAG: Record<CanonStatus, string> = {
  canon: 'CANON',
  possibility: 'POSSIBILITY (not decided)',
  draft: 'DRAFT (undecided)',
  discarded: 'SET ASIDE (rejected, do not suggest)',
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);

function toneWords(t: Tone): string {
  const scale = (n: number, low: string, high: string) =>
    `${n}/10 (${n <= 3 ? low : n >= 8 ? high : 'moderate'})`;
  return [
    `Darkness ${scale(t.darkness, 'light', 'very dark')}`,
    `Romance ${scale(t.romance, 'minimal', 'central')}`,
    `Violence ${scale(t.violence, 'mostly off-page', 'graphic when it occurs')}`,
    `Psychological intensity ${scale(t.psychological, 'gentle', 'intense')}`,
    `Mystery complexity ${scale(t.complexity, 'simple', 'intricate')}`,
    `Atmosphere ${scale(t.atmosphere, 'spare', 'rich')}`,
    `Sexual explicitness ${scale(t.explicitness, 'fade to black', 'explicit')}`,
    `Pace ${scale(t.pace, 'slow burn', 'fast')}`,
  ].join('; ');
}

function characterProfile(c: Character, full: boolean): string {
  const lines = [`### ${c.name}${c.role ? ` (${c.role})` : ''} [${TAG[c.status]}]`];
  if (!full) {
    const brief = [c.fields.occupation, c.fields.personality, c.fields.goals].filter(Boolean).join('. ');
    if (brief) lines.push(clip(brief, 300));
    return lines.join('\n');
  }
  for (const g of CHARACTER_GROUPS) {
    for (const f of g.fields) {
      const v = c.fields[f.key]?.trim();
      if (v) lines.push(`${f.label}: ${clip(v, 600)}`);
    }
  }
  return lines.join('\n');
}

export function buildContext(p: Project, focus: Focus): string {
  const out: string[] = [];
  const b = p.bible;
  const whole = focus.scope === 'whole';
  const mystery = focus.scope === 'mystery' || whole;
  const minimal = focus.scope === 'minimal';

  out.push(`# STORY BIBLE: "${p.title}"`);
  out.push(
    'Canon markers: CANON = true in the story. POSSIBILITY/DRAFT = undecided ideas, never treat as fact. SET ASIDE = rejected by the author.',
  );
  const basics = [
    b.genre && `Genre: ${b.genre}`,
    b.premise && `Premise: ${clip(b.premise, 1500)}`,
    b.themes && `Themes: ${clip(b.themes, 500)}`,
    b.setting && `Setting: ${clip(b.setting, 800)}`,
    b.rules && `Rules of this world: ${clip(b.rules, 600)}`,
    b.povPlan && `Point of view plan: ${b.povPlan}`,
    b.tense && `Tense and person: ${b.tense}`,
    (whole || mystery) && b.structure && `Structure: ${clip(b.structure, 600)}`,
    (whole || mystery) && b.majorReveals && `Planned major reveals: ${clip(b.majorReveals, 800)}`,
    b.objects && !minimal && `Important objects: ${clip(b.objects, 500)}`,
  ].filter(Boolean);
  out.push(basics.join('\n'));

  const t = p.tone;
  out.push(
    `## Tone (creative controls, not quality scores)\n${toneWords(t)}` +
      (t.description ? `\nThe author describes the tone as: "${t.description}"` : '') +
      (t.styleWords ? `\nDesired feel: ${t.styleWords}` : '') +
      (t.avoid ? `\nThe author never wants: ${t.avoid}` : ''),
  );
  if (b.styleSheet?.trim()) out.push(`## House style sheet (follow it)\n${clip(b.styleSheet, 800)}`);
  const taste = tasteSummary(p.id);
  if (taste) out.push(`## What the author has taught her editor about her taste\n${taste}`);

  if (minimal) return out.join('\n\n');

  // Which characters matter for this request?
  const relevant = new Set<string>(focus.characterIds ?? []);
  if (focus.text) charactersMentioned(p, focus.text).forEach((id) => relevant.add(id));
  const chapter = p.chapters.find((c) => c.id === focus.chapterId);
  if (chapter) {
    if (chapter.povCharacterId) relevant.add(chapter.povCharacterId);
    p.scenes
      .filter((s) => s.chapterId === chapter.id)
      .forEach((s) => {
        if (s.povCharacterId) relevant.add(s.povCharacterId);
        s.characterIds.forEach((id) => relevant.add(id));
      });
  }

  const chars = p.characters.filter((c) => c.status !== 'discarded');
  if (chars.length) {
    const lines = ['## Characters'];
    for (const c of chars) lines.push(characterProfile(c, whole ? chars.length <= 6 : relevant.has(c.id)));
    out.push(lines.join('\n'));
  }

  const rels = p.relationships.filter(
    (r) => r.status !== 'discarded' && (whole || mystery || relevant.has(r.aId) || relevant.has(r.bId)),
  );
  if (rels.length) {
    out.push(
      '## Relationships\n' +
        rels
          .map((r) => {
            const m = r.romance;
            const rom = r.isRomance
              ? ` Romance tracker: attraction ${m.attraction}/10, trust ${m.trust}/10, vulnerability ${m.vulnerability}/10, conflict ${m.conflict}/10, emotional dependence ${m.dependence}/10.` +
                (r.beats.length ? ` Progression: ${r.beats.map((x) => `${chapterLabel(p, x.chapterId)}: ${x.note}`).join('; ')}` : '')
              : '';
            return `- ${characterName(p, r.aId)} & ${characterName(p, r.bId)} [${TAG[r.status]}]: ${r.kind}. ${clip(r.description, 400)}${r.tension ? ` Unresolved: ${clip(r.tension, 300)}` : ''}${rom}`;
          })
          .join('\n'),
    );
  }

  const ideas = p.ideas.filter((i) => i.status !== 'discarded');
  const ideaList = whole || mystery ? ideas : ideas.filter((i) => i.status === 'canon' || relevant.has(i.linkId));
  if (ideaList.length)
    out.push(
      '## Story decisions and ideas\n' +
        ideaList.slice(-60).map((i) => `- [${TAG[i.status]}] (${i.category}) ${clip(i.text, 300)}${i.detail ? `: ${clip(i.detail, 300)}` : ''}`).join('\n'),
    );

  // Mystery
  const m = p.mystery;
  if (mystery) {
    const truth = [
      m.centralQuestion && `Central question: ${m.centralQuestion}`,
      m.culprit && `Culprit (the truth): ${m.culprit}`,
      m.whatHappened && `What actually happened: ${m.whatHappened}`,
      m.whatAppears && `What appears to have happened: ${m.whatAppears}`,
      m.whatCharactersBelieve && `What characters believe happened: ${m.whatCharactersBelieve}`,
      m.when && `When: ${m.when}`,
      m.motive && `Motive: ${m.motive}`,
      m.competingMotives && `Competing motives: ${m.competingMotives}`,
      m.method && `Method: ${m.method}`,
      m.opportunity && `Opportunity: ${m.opportunity}`,
      m.evidence && `Evidence: ${m.evidence}`,
      m.coverUp && `Cover-up: ${m.coverUp}`,
      m.whoIsLying && `Who is lying: ${m.whoIsLying}`,
      m.whoIsManipulated && `Who is being manipulated: ${m.whoIsManipulated}`,
    ].filter(Boolean);
    if (truth.length) out.push('## The mystery: the hidden truth (the author\'s private notes)\n' + truth.join('\n'));
  } else if (m.centralQuestion) {
    out.push(`## Central mystery question\n${m.centralQuestion}`);
  }

  const chapIdx = chapter ? p.chapters.indexOf(chapter) : p.chapters.length;
  const upToHere = (chId: string) => !chId || whole || mystery || p.chapters.findIndex((c) => c.id === chId) <= chapIdx;

  const clues = p.clues.filter((c) => c.status !== 'discarded' && upToHere(c.appearsChapterId));
  if (clues.length)
    out.push(
      '## Clues\n' +
        clues
          .map(
            (c) =>
              `- ${c.title} [${c.kind === 'red-herring' ? 'RED HERRING' : c.kind === 'misleading' ? 'MISLEADING' : 'GENUINE'}; ${TAG[c.status]}]` +
              `${c.appearsChapterId ? ` appears ${chapterLabel(p, c.appearsChapterId)}` : ' (not placed yet)'}` +
              `${c.resolvedChapterId ? `, resolved ${chapterLabel(p, c.resolvedChapterId)}` : ''}: ${clip(c.description, 300)}` +
              `${c.pointsTo ? ` Points to: ${c.pointsTo}.` : ''}${c.significance ? ` Significance: ${clip(c.significance, 200)}.` : ''}` +
              `${c.trueExplanation ? ` Innocent/true explanation: ${clip(c.trueExplanation, 200)}.` : ''}` +
              `${c.whoKnowsIds.length ? ` Known by: ${c.whoKnowsIds.map((id) => characterName(p, id)).join(', ')}.` : ''}`,
          )
          .join('\n'),
    );

  const secrets = p.secrets.filter((s) => s.status !== 'discarded' && (mystery || s.holderIds.some((id) => relevant.has(id))));
  if (secrets.length)
    out.push(
      '## Secrets\n' +
        secrets
          .map(
            (s) =>
              `- ${s.title} [${TAG[s.status]}], held by ${s.holderIds.map((id) => characterName(p, id)).join(', ') || 'unknown'}` +
              `${s.hiddenFromIds.length ? `, hidden from ${s.hiddenFromIds.map((id) => characterName(p, id)).join(', ')}` : ''}` +
              `${s.hiddenFromReader ? ', hidden from the reader' : ', the reader knows'}` +
              `${s.revealChapterId ? `, revealed ${chapterLabel(p, s.revealChapterId)}` : ', reveal not placed'}: ${clip(s.description, 300)}` +
              `${s.ifRevealed ? ` If revealed early: ${clip(s.ifRevealed, 200)}` : ''}`,
          )
          .join('\n'),
    );

  const beliefs = p.beliefs.filter((b) => b.status !== 'discarded' && (mystery || relevant.has(b.characterId)));
  if (beliefs.length)
    out.push(
      '## What characters believe\n' +
        beliefs
          .map(
            (b) =>
              `- ${characterName(p, b.characterId)} believes: ${clip(b.belief, 250)} (actually ${b.truth === 'unknown' ? 'undecided' : b.truth})` +
              `${b.sinceChapterId ? ` since ${chapterLabel(p, b.sinceChapterId)}` : ''}`,
          )
          .join('\n'),
    );

  const facts = p.facts.filter((f) => f.status !== 'discarded');
  if (facts.length && mystery)
    out.push(
      '## Facts and when the reader learns them\n' +
        facts
          .map((f) => `- [${TAG[f.status]}] ${clip(f.text, 250)}. Reader learns: ${f.readerLearnsChapterId ? chapterLabel(p, f.readerLearnsChapterId) : 'not yet placed'}`)
          .join('\n'),
    );

  // Timeline
  const events = p.timeline.filter(
    (e) => e.status !== 'discarded' && (whole || mystery || e.characterIds.some((id) => relevant.has(id)) || e.chapterId === focus.chapterId),
  );
  if (events.length)
    out.push(
      '## Timeline\n' +
        sortEvents(events)
          .slice(0, 60)
          .map(
            (e) =>
              `- ${eventWhen(e)}: ${e.title}${e.location ? ` @ ${e.location}` : ''}${e.characterIds.length ? ` (${e.characterIds.map((id) => characterName(p, id)).join(', ')})` : ''}` +
              `${e.onPage ? '' : ' [backstory/off-page]'}${e.chapterId ? ` [${chapterLabel(p, e.chapterId)}]` : ''}${e.description ? `: ${clip(e.description, 200)}` : ''}`,
          )
          .join('\n'),
    );

  // Places mentioned
  if (focus.text && p.places.length) {
    const lower = focus.text.toLowerCase();
    const places = p.places.filter((pl) => pl.name && lower.includes(pl.name.toLowerCase().split(/[,(]/)[0].trim()));
    if (places.length)
      out.push('## Places in this passage\n' + places.map((pl) => `- ${pl.name}: ${clip(pl.description, 300)} ${clip(pl.details, 300)}`).join('\n'));
  }

  // Chapters: summaries of what came before, plus the current chapter's plan.
  const chLines: string[] = [];
  p.chapters.forEach((c, i) => {
    const near = chapter ? i >= chapIdx - 3 && i <= chapIdx : true;
    if (!whole && !mystery && !near) return;
    if (chapter && i > chapIdx && !whole && !mystery) return;
    const words = countWords(c.text);
    let s = `### Chapter ${i + 1}: ${c.title} [${c.status}, ${words} words]`;
    if (c.summary) s += `\nSummary: ${clip(c.summary, whole ? 700 : 1000)}`;
    else if (c.outline.plan || c.outline.happens) s += `\nPlanned: ${clip(c.outline.plan || c.outline.happens, 600)}`;
    else if (words > 0 && c.id !== focus.chapterId) s += `\n(No summary yet. Opening: "${clip(c.text.trim(), 300)}")`;
    if (c.id === focus.chapterId) {
      const o = c.outline;
      const plan = [
        o.happens && `What happens: ${o.happens}`,
        o.wants && `Protagonist wants: ${o.wants}`,
        o.obstacle && `Obstacle: ${o.obstacle}`,
        o.learns && `She learns: ${o.learns}`,
        o.changes && `What changes: ${o.changes}`,
        o.question && `Question the reader should have afterward: ${o.question}`,
        o.feel && `Reader should feel: ${o.feel}`,
        o.unanswered && `Should remain unanswered: ${o.unanswered}`,
        o.plan && `Chapter plan: ${clip(o.plan, 1200)}`,
      ].filter(Boolean);
      if (plan.length) s += '\n' + plan.join('\n');
      const scenes = p.scenes.filter((x) => x.chapterId === c.id);
      if (scenes.length)
        s +=
          '\nScenes: ' +
          scenes
            .map(
              (x) =>
                `"${x.title}" (POV ${characterName(p, x.povCharacterId) || '?'}${x.location ? `, ${x.location}` : ''}${x.time ? `, ${x.time}` : ''}): ${clip(
                  [x.purpose, x.conflict && `conflict: ${x.conflict}`, x.revealed && `reveals: ${x.revealed}`, x.concealed && `conceals: ${x.concealed}`]
                    .filter(Boolean)
                    .join('; '),
                  400,
                )}`,
            )
            .join(' | ');
    }
    chLines.push(s);
  });
  if (chLines.length) out.push('## Chapters\n' + chLines.join('\n'));

  if (focus.voice) {
    const sample = voiceSample(p, focus.chapterId);
    if (sample)
      out.push(
        `## A sample of the author's own prose\nMatch its voice, rhythm, diction and level of restraint. Do not copy its content or reuse its images.\n"""${sample}"""`,
      );
  }

  return out.join('\n\n');
}

/** ~350 words from the author's longest chapter (preferring one other than the current), cut at paragraph boundaries. */
function voiceSample(p: Project, currentId?: string): string {
  const withText = p.chapters.filter((c) => countWords(c.text) > 300);
  if (!withText.length) return '';
  const others = withText.filter((c) => c.id !== currentId);
  const src = (others.length ? others : withText).reduce((a, b) => (countWords(b.text) > countWords(a.text) ? b : a));
  const paras = src.text.split(/\n\s*\n/).map((x) => x.trim()).filter((x) => x.length > 40);
  const start = Math.floor(paras.length / 3);
  let out = '';
  for (const para of paras.slice(start)) {
    if ((out + para).length > 2200) break;
    out += (out ? '\n\n' : '') + para;
  }
  return out || paras[0]?.slice(0, 2200) || '';
}

/** Learned from her reactions to suggested edits (see "Keep mine → why?"). */
export function tasteSummary(projectId: string): string {
  const t = getPref<{ rejected: Record<string, number>; accepted: Record<string, number> }>(`taste:${projectId}`, { rejected: {}, accepted: {} });
  const rej = Object.entries(t.rejected).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const acc = Object.entries(t.accepted).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const lines: string[] = [];
  if (rej.length) lines.push(`She has turned down suggested edits for being: ${rej.map(([k, n]) => `${k} (${n}×)`).join(', ')}. Avoid these tendencies.`);
  if (acc.length) lines.push(`Edit styles she usually accepts: ${acc.slice(0, 5).map(([k, n]) => `${k} (${n}×)`).join(', ')}.`);
  return lines.join('\n');
}

export function recordTaste(projectId: string, kind: 'rejected' | 'accepted', key: string) {
  const k = `taste:${projectId}`;
  const t = getPref<{ rejected: Record<string, number>; accepted: Record<string, number> }>(k, { rejected: {}, accepted: {} });
  t[kind][key] = (t[kind][key] ?? 0) + 1;
  setPref(k, t);
}

export function eventWhen(e: { dateKind: string; date: string; time: string; approxLabel: string }): string {
  if (e.dateKind === 'exact' && e.date) return `${e.date}${e.time ? ` ${e.time}` : ''}`;
  return e.approxLabel || 'undated';
}

export function sortEvents<T extends { dateKind: string; date: string; time: string; order: number }>(events: T[]): T[] {
  // Manual order is the source of truth. Exact dates are used only to break ties.
  return [...events].sort((a, b) => a.order - b.order || (a.date + a.time).localeCompare(b.date + b.time));
}

/** The text surrounding the cursor/selection, so prose help has local continuity without the whole chapter. */
export function nearbyText(full: string, start: number, end: number, before = 6000, after = 1500): { before: string; after: string } {
  return {
    before: full.slice(Math.max(0, start - before), start),
    after: full.slice(end, end + after),
  };
}
