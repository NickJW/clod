// Series: stand alone now, grow into more books later.
import type { Project, SeriesInfo } from '../types';
import { createProject, useApp, updateProject, useProject, openProject } from '../story/store';
import { newChapter, newIdea, newNote, newProject, uid } from '../story/factory';
import { openEditor } from '../ai/session';
import { ACTIONS, type ActionId } from '../ai/actions';
import { Field, Icon, confirmDialog } from '../components/ui';
import { countWords } from '../story/reference';

export function Series() {
  const p = useProject();
  const projects = useApp((s) => s.projects);
  const s = p.series;
  const set = (x: Partial<SeriesInfo>) => updateProject({ series: { ...p.series, ...x } });
  const prev = projects.find((x) => x.id === s.previousProjectId);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Series</div>
          <h1>Book {s.bookNumber}{s.name ? ` of ${s.name}` : ''}</h1>
          <p className="lead">
            Agents usually want a debut that <b>stands completely on its own</b> but <b>could grow into a series</b>. Solve this book's mystery fully, and let the characters and the world live on.
          </p>
        </div>
      </div>
      {prev && (
        <div className="card row">
          <span>
            Follows <b>{prev.title}</b>.
          </span>
          <button className="btn small" onClick={() => openProject(prev.id)}>
            Open the previous book
          </button>
        </div>
      )}
      <div className="card">
        <div className="grid-2">
          <Field label="Series name (optional)" value={s.name} onChange={(name) => set({ name })} placeholder='e.g. "The Carrick Bay Mysteries"' />
          <label className="field">
            <span className="lab">This is book number</span>
            <input className="input" type="number" min={1} value={s.bookNumber} onChange={(e) => set({ bookNumber: Math.max(1, +e.target.value || 1) })} />
          </label>
        </div>
        <Field label="Series arc notes" hint="A bigger question or relationship that could develop across books." value={s.arc} onChange={(arc) => set({ arc })} long />
        <Field label="Sequel seeds planted in this book" hint="Threads you've planted that a future book could pick up." value={s.seeds} onChange={(seeds) => set({ seeds })} long />
      </div>
      <div className="grid-3">
        {(['seriesPotential', 'sequelSeeds', 'newMystery', 'seriesArc'] as ActionId[]).map((id) => (
          <div key={id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="serif" style={{ fontSize: '1.15rem' }}>{ACTIONS[id].label}</div>
            <div className="small muted" style={{ flex: 1 }}>{ACTIONS[id].blurb}</div>
            <button className="btn brass" onClick={() => openEditor({ actionId: id }, true)}>
              <Icon name="spark" size={16} /> Run
            </button>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Start the sequel</h3>
        <p className="small muted">
          Creates Book {s.bookNumber + 1} as a new project. It carries over your characters, relationships, places, research, tone, style sheet and motifs, and adds a recap of this book and its timeline as backstory. The new book starts with a fresh mystery and empty chapters. This book isn't changed.
        </p>
        <div className="note-box small" style={{ margin: '10px 0' }}>
          Tip: before starting, fill in the Ending page (where each character ends up, and which secrets came out). That becomes what everyone knows at the start of the next book.
        </div>
        <button
          className="btn primary"
          onClick={async () => {
            if (!(await confirmDialog(`Start Book ${s.bookNumber + 1}?`, 'A new project will be created and opened. You can switch between books any time in Settings → Your novels.', 'Start the sequel'))) return;
            await createProject(makeSequel(p));
          }}
        >
          <Icon name="plus" size={16} /> Start Book {s.bookNumber + 1}
        </button>
      </div>
    </div>
  );
}

function makeSequel(p: Project): Project {
  const n = p.series.bookNumber;
  const next = newProject(`${p.series.name || p.title}: Book ${n + 1}`);
  const idMap = new Map<string, string>();
  const clone = <T extends { id: string }>(x: T): T => {
    const id = uid();
    idMap.set(x.id, id);
    return { ...structuredClone(x), id, createdAt: Date.now(), updatedAt: Date.now() };
  };
  const endNote = (field: string) => (field.trim() ? `\n\n[At the end of Book ${n}] ${field.trim()}` : '');
  next.characters = p.characters.filter((c) => c.status !== 'discarded').map((c) => {
    const cc = clone(c);
    cc.fields = { ...cc.fields, history: (cc.fields.history ?? '') + endNote(p.ending.characterArcs) };
    delete cc.fields.suspect;
    return cc;
  });
  const map = (id: string) => idMap.get(id) ?? '';
  next.relationships = p.relationships.filter((r) => idMap.has(r.aId) && idMap.has(r.bId)).map((r) => ({ ...clone(r), aId: map(r.aId), bId: map(r.bId), beats: [] }));
  next.places = p.places.map(clone);
  next.research = p.research.map(clone);
  next.ideas = p.ideas.filter((i) => i.status === 'canon' && (i.category === 'character' || i.category === 'world')).map(clone);
  next.timeline = p.timeline
    .filter((e) => e.status !== 'discarded')
    .map((e) => ({ ...clone(e), title: `Book ${n}: ${e.title}`, onPage: false, chapterId: '', characterIds: e.characterIds.map(map).filter(Boolean) }));
  next.bible = { ...p.bible, premise: '', majorReveals: '', structure: '' };
  next.tone = { ...p.tone };
  next.author = p.author;
  next.targetWords = p.targetWords;
  next.publishing = { ...next.publishing, bio: p.publishing.bio };
  next.series = { name: p.series.name, bookNumber: n + 1, previousProjectId: p.id, arc: p.series.arc, seeds: p.series.seeds };
  const recap = [
    `# Recap of Book ${n}: ${p.title}`,
    p.bible.premise && `Premise: ${p.bible.premise}`,
    p.mystery.centralQuestion && `Mystery: ${p.mystery.centralQuestion}. Solution: ${p.mystery.culprit}. ${p.mystery.whatHappened}`,
    p.ending.resolution && `How it ended: ${p.ending.resolution}`,
    p.ending.characterArcs && `Where everyone ended up: ${p.ending.characterArcs}`,
    p.ending.secrets && `Secrets that came out: ${p.ending.secrets}`,
    p.ending.unresolved && `Threads left open: ${p.ending.unresolved}`,
    p.series.seeds && `Sequel seeds: ${p.series.seeds}`,
    '',
    ...p.chapters.map((c, i) => `Chapter ${i + 1} (${c.title}): ${c.summary || c.outline.happens || `${countWords(c.text)} words, no summary`}`),
  ]
    .filter((x) => typeof x === 'string')
    .join('\n');
  next.notes = [newNote({ title: `Recap of Book ${n}`, body: recap })];
  next.ideas.push(newIdea(`This is Book ${n + 1}, following "${p.title}". Everything in the Book ${n} recap (Notes) has already happened and is canon.`, { status: 'canon', category: 'world' }));
  next.chapters = [newChapter('Chapter One')];
  next.currentChapterId = next.chapters[0].id;
  return next;
}
