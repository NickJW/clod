// Getting everything out: manuscript (DOCX in standard manuscript format, PDF,
// Markdown, plain text), the story bible, notes, and full project backups.
import type { Project } from '../types';
import { CHARACTER_GROUPS, STATUS_LABEL, chapterLabel, characterName, countWords } from '../story/reference';
import { eventWhen, sortEvents } from '../ai/context';
import { normalizeProject, uid } from '../story/factory';

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Novel';
const today = () => new Date().toISOString().slice(0, 10);
const paragraphs = (text: string) =>
  text
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function roundWords(n: number) {
  return n < 1000 ? n : Math.round(n / 1000) * 1000;
}

// ---------- Manuscript ----------

export function manuscriptText(p: Project, md: boolean): string {
  const out: string[] = [md ? `# ${p.title}` : p.title.toUpperCase()];
  if (p.author) out.push(md ? `*by ${p.author}*` : `by ${p.author}`);
  p.chapters.forEach((c, i) => {
    out.push('');
    out.push(md ? `## Chapter ${i + 1}${c.title ? `: ${c.title}` : ''}` : `CHAPTER ${i + 1}${c.title ? `\n${c.title}` : ''}`);
    out.push('');
    out.push(paragraphs(c.text).join('\n\n'));
  });
  out.push('', md ? '*The End*' : 'THE END');
  return out.join('\n');
}

export function exportManuscriptText(p: Project, kind: 'txt' | 'md') {
  download(`${safe(p.title)} - manuscript ${today()}.${kind}`, new Blob([manuscriptText(p, kind === 'md')], { type: 'text/plain;charset=utf-8' }));
}

export async function exportManuscriptDocx(p: Project) {
  const { AlignmentType, Document, Footer, Header, Packer, PageNumber, Paragraph, TextRun } = await import('docx');
  const font = 'Times New Roman';
  const words = p.chapters.reduce((n, c) => n + countWords(c.text), 0);
  const surname = p.author.trim().split(/\s+/).pop() || 'Author';
  const runs = (text: string) =>
    text
      .split(/(\*[^*\n]+\*)/g)
      .filter(Boolean)
      .map((part) => (/^\*[^*]+\*$/.test(part) ? new TextRun({ text: part.slice(1, -1), font, size: 24, italics: true }) : new TextRun({ text: part, font, size: 24 })));
  const body = (text: string, first = false) =>
    new Paragraph({
      children: runs(text),
      indent: first ? undefined : { firstLine: 720 },
      spacing: { line: 480 },
    });

  const title = [
    new Paragraph({ children: [new TextRun({ text: p.author || 'Author name', font, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `About ${roundWords(words).toLocaleString()} words`, font, size: 24 })] }),
    ...Array.from({ length: 12 }, () => new Paragraph({ children: [] })),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.title.toUpperCase(), font, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun({ text: p.author ? `by ${p.author}` : '', font, size: 24 })] }),
  ];

  const sections = p.chapters.map((c, i) => ({
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ font, size: 24, children: [`${surname} / ${p.title.toUpperCase()} / `, PageNumber.CURRENT] })],
          }),
        ],
      }),
    },
    children: [
      ...Array.from({ length: 6 }, () => new Paragraph({ children: [] })),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Chapter ${i + 1}`, font, size: 24 })] }),
      ...(c.title ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [new TextRun({ text: c.title, font, size: 24 })] })] : []),
      ...paragraphs(c.text).map((t, k) => (t === '#' || t === '*' || t === '* * *' || t === '***' ? new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', font, size: 24 })] }) : body(t, k === 0))),
      ...(i === p.chapters.length - 1 ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480 }, children: [new TextRun({ text: 'THE END', font, size: 24 })] })] : []),
    ],
  }));

  const doc = new Document({
    creator: p.author || 'Author',
    title: p.title,
    sections: [{ properties: {}, children: title, footers: { default: new Footer({ children: [] }) } }, ...sections],
  });
  download(`${safe(p.title)} - manuscript ${today()}.docx`, await Packer.toBlob(doc));
}

export function printManuscript(p: Project) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.title)}</title>
<style>
@page { size: auto; margin: 1in; }
body { font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-size: 12.5pt; line-height: 1.6; color: #111; }
.title { text-align: center; margin-top: 35vh; page-break-after: always; }
.title h1 { font-size: 26pt; font-weight: 500; letter-spacing: .04em; margin: 0 0 .5em; }
h2 { text-align: center; font-weight: 500; font-size: 15pt; margin: 2.5in 0 .2in; page-break-before: always; }
h3 { text-align: center; font-weight: 400; font-style: italic; font-size: 13pt; margin: 0 0 .6in; }
p { margin: 0; text-indent: 1.5em; text-align: justify; hyphens: auto; }
h3 + p, h2 + p { text-indent: 0; }
.sep { text-align: center; text-indent: 0; margin: 1em 0; }
</style></head><body>
<div class="title"><h1>${esc(p.title)}</h1>${p.author ? `<div>${esc(p.author)}</div>` : ''}</div>
${p.chapters
  .map(
    (c, i) =>
      `<h2>Chapter ${i + 1}</h2>${c.title ? `<h3>${esc(c.title)}</h3>` : '<h3></h3>'}${paragraphs(c.text)
        .map((t) => (/^(#|\*|\*\s?\*\s?\*)$/.test(t) ? '<p class="sep">*</p>' : `<p>${esc(t).replace(/\*([^*\n]+)\*/g, '<em>$1</em>')}</p>`))
        .join('')}`,
  )
  .join('')}
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

// ---------- Story bible ----------

const line = (label: string, v: string) => (v?.trim() ? `**${label}:** ${v.trim()}\n` : '');

export function storyBibleMarkdown(p: Project): string {
  const b = p.bible;
  const s: string[] = [`# ${p.title}: Story Bible`, `_Exported ${today()}_`, ''];
  s.push('## The story', line('Genre', b.genre), line('Premise', b.premise), line('Themes', b.themes), line('Setting', b.setting), line('Rules of the world', b.rules), line('Point of view', b.povPlan), line('Tense', b.tense), line('Structure', b.structure), line('Important objects', b.objects), line('Major reveals', b.majorReveals));
  const t = p.tone;
  s.push('## Tone', `Darkness ${t.darkness}/10 · Romance ${t.romance}/10 · Violence ${t.violence}/10 · Psychological intensity ${t.psychological}/10 · Mystery complexity ${t.complexity}/10 · Atmosphere ${t.atmosphere}/10 · Explicitness ${t.explicitness}/10 · Pace ${t.pace}/10\n`, line('In my words', t.description), line('The feel', t.styleWords), line('Never', t.avoid));
  s.push('## Characters');
  for (const c of p.characters) {
    s.push(`### ${c.name}${c.role ? `: ${c.role}` : ''} (${STATUS_LABEL[c.status]})`);
    for (const g of CHARACTER_GROUPS) for (const f of g.fields) s.push(line(f.label, c.fields[f.key] ?? ''));
  }
  if (p.relationships.length) {
    s.push('## Relationships');
    for (const r of p.relationships) s.push(`- **${characterName(p, r.aId)} & ${characterName(p, r.bId)}** (${r.kind || 'relationship'}): ${r.description} ${r.tension ? `_Unresolved:_ ${r.tension}` : ''}`);
    s.push('');
  }
  const m = p.mystery;
  s.push('## The mystery', line('Central question', m.centralQuestion), line('Culprit', m.culprit), line('What actually happened', m.whatHappened), line('What appears to have happened', m.whatAppears), line('What characters believe', m.whatCharactersBelieve), line('When', m.when), line('Motive', m.motive), line('Competing motives', m.competingMotives), line('Method', m.method), line('Opportunity', m.opportunity), line('Evidence', m.evidence), line('Cover-up', m.coverUp), line('Who is lying', m.whoIsLying), line('Who is manipulated', m.whoIsManipulated));
  if (p.clues.length) {
    s.push('### Clues and red herrings');
    for (const c of p.clues) s.push(`- **${c.title}** (${c.kind}${c.appearsChapterId ? `, ${chapterLabel(p, c.appearsChapterId)}` : ''}): ${c.description} ${c.pointsTo ? `→ points to ${c.pointsTo}.` : ''} ${c.trueExplanation ? `Truth: ${c.trueExplanation}` : ''}`);
    s.push('');
  }
  if (p.secrets.length) {
    s.push('### Secrets');
    for (const x of p.secrets) s.push(`- **${x.title}**: ${x.description} (held by ${x.holderIds.map((id) => characterName(p, id)).join(', ') || '?'}${x.revealChapterId ? `; revealed ${chapterLabel(p, x.revealChapterId)}` : ''})`);
    s.push('');
  }
  if (p.beliefs.length) {
    s.push('### Who believes what');
    for (const x of p.beliefs) s.push(`- ${characterName(p, x.characterId)} believes ${x.belief} (${x.truth})`);
    s.push('');
  }
  if (p.timeline.length) {
    s.push('## Timeline');
    for (const e of sortEvents(p.timeline)) s.push(`- **${eventWhen(e)}**: ${e.title}${e.location ? ` @ ${e.location}` : ''}${e.characterIds.length ? ` (${e.characterIds.map((id) => characterName(p, id)).join(', ')})` : ''}. ${e.description}`);
    s.push('');
  }
  if (p.places.length) {
    s.push('## Places');
    for (const pl of p.places) s.push(`### ${pl.name}`, pl.description, pl.details, '');
  }
  const ideas = p.ideas.filter((i) => i.status !== 'discarded');
  if (ideas.length) {
    s.push('## Ideas and decisions');
    for (const i of ideas) s.push(`- [${STATUS_LABEL[i.status]}] ${i.text}${i.detail ? `: ${i.detail}` : ''}`);
    s.push('');
  }
  const e = p.ending;
  s.push('## Ending', line('Resolution', e.resolution), line('Character arcs', e.characterArcs), line('Romance', e.romance), line('Secrets', e.secrets), line('Unresolved threads', e.unresolved), line('Intentionally ambiguous', e.intentionallyAmbiguous), line('Theme', e.theme), line('Final image', e.finalImage), line('Aftermath', e.aftermath));
  s.push('## Chapter summaries');
  p.chapters.forEach((c, i) => s.push(`### ${i + 1}. ${c.title}`, c.summary || c.outline.plan || c.outline.happens || '_No summary yet._', ''));
  return s.filter((x) => x !== '').join('\n\n').replace(/\n{3,}/g, '\n\n');
}

export function notesMarkdown(p: Project): string {
  const s = [`# ${p.title}: Notes and research`, ''];
  for (const n of p.notes) s.push(`## ${n.title}`, n.body, '');
  if (p.research.length) {
    s.push('# Research');
    const label = { known: 'Known fact', needed: 'Research needed', fictional: 'Fictionalised' };
    for (const r of p.research) s.push(`## ${r.title} (${label[r.factStatus]})`, r.url ? `<${r.url}>` : '', r.content, '');
  }
  return s.join('\n');
}

export async function markdownToDocx(md: string, name: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const children = md.split('\n').map((l) => {
    const h = l.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][h[1].length - 1];
      return new Paragraph({ heading: level, children: [new TextRun(h[2])] });
    }
    const runs = l
      .replace(/^- /, '• ')
      .split(/(\*\*[^*]+\*\*|_[^_]+_)/)
      .filter(Boolean)
      .map((part) =>
        part.startsWith('**') ? new TextRun({ text: part.slice(2, -2), bold: true }) : part.startsWith('_') ? new TextRun({ text: part.slice(1, -1), italics: true }) : new TextRun(part),
      );
    return new Paragraph({ children: runs, spacing: { after: 120 } });
  });
  download(name, await Packer.toBlob(new Document({ sections: [{ children }] })));
}

export function exportMarkdown(md: string, name: string) {
  download(name, new Blob([md], { type: 'text/markdown;charset=utf-8' }));
}

export const fileNames = {
  bible: (p: Project, ext: string) => `${safe(p.title)} - story bible ${today()}.${ext}`,
  notes: (p: Project, ext: string) => `${safe(p.title)} - notes ${today()}.${ext}`,
};

// ---------- Backup ----------

export function backupProject(p: Project) {
  const data = JSON.stringify({ app: 'nightjar', kind: 'project-backup', exportedAt: Date.now(), project: p }, null, 1);
  download(`${safe(p.title)} - BACKUP ${today()}.nightjar.json`, new Blob([data], { type: 'application/json' }));
}

export async function readBackup(file: File): Promise<Project> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file isn\'t a readable backup. Choose a file ending in .nightjar.json.');
  }
  const raw = (data as { project?: unknown }).project ?? data;
  if (!raw || typeof raw !== 'object' || !('chapters' in (raw as object))) throw new Error('This file doesn\'t look like a Nightjar backup.');
  return normalizeProject(raw);
}

// ---------- Import ----------

export async function readManuscriptFile(file: File): Promise<string> {
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import('mammoth');
    // Convert via HTML so italics survive as *asterisks*.
    const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return res.value
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/g, (_m, _t, inner: string) => `*${inner.replace(/<[^>]+>/g, '').trim()}*`)
      .replace(/<\/(p|h\d|li)>|<br\s*\/?>/g, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n');
  }
  if (/\.(txt|md|markdown|text)$/i.test(file.name) || file.type.startsWith('text/')) return file.text();
  throw new Error('Please choose a Word (.docx), text (.txt) or Markdown (.md) file.');
}

/** Split imported text into chapters on lines like "Chapter 3" or "# Chapter Three". */
export function splitChapters(text: string, fallbackTitle: string): { title: string; text: string }[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: { title: string; text: string[] }[] = [];
  const heading = /^\s*#{0,3}\s*(chapter|ch\.)\s+([\w-]+)[\s:.–—-]*(.*)$/i;
  for (const l of lines) {
    const m = l.match(heading);
    if (m && l.trim().length < 90) out.push({ title: m[3]?.trim() || `Chapter ${m[2]}`, text: [] });
    else {
      if (!out.length) out.push({ title: fallbackTitle, text: [] });
      out[out.length - 1].text.push(l.replace(/^#+\s*/, ''));
    }
  }
  return out
    .map((c) => ({ title: c.title, text: c.text.join('\n').replace(/\n{3,}/g, '\n\n').trim() }))
    .filter((c, i) => c.text || i > 0);
}

export const newId = uid;
