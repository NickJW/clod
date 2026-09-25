// Local persistence. Projects live in IndexedDB in this browser only.
// Nothing is sent anywhere unless the author uses the AI editor or exports a file.
import type { Project, ProjectMeta } from '../types';

const DB_NAME = 'nightjar';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const SNAPSHOTS = 'snapshots';
const MAX_SNAPSHOTS = 12;

export interface Snapshot {
  key: string; // `${projectId}:${at}`
  projectId: string;
  at: number;
  data: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        const s = db.createObjectStore(SNAPSHOTS, { keyPath: 'key' });
        s.createIndex('projectId', 'projectId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = (await tx<Project[]>(PROJECTS, 'readonly', (s) => s.getAll())) ?? [];
  return all
    .map((p) => ({
      id: p.id,
      title: p.title,
      updatedAt: p.updatedAt,
      isDemo: p.isDemo,
      words: p.chapters.reduce((n, c) => n + countWordsQuick(c.text), 0),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id: string): Promise<Project | undefined> {
  return tx<Project | undefined>(PROJECTS, 'readonly', (s) => s.get(id));
}

export async function saveProject(p: Project): Promise<void> {
  await tx(PROJECTS, 'readwrite', (s) => s.put(p));
  // Emergency copy of the most recent state in localStorage, in case IndexedDB is ever wiped/corrupted.
  try {
    localStorage.setItem(`nightjar:last:${p.id}`, JSON.stringify(p));
  } catch {
    /* quota exceeded: IndexedDB is the primary store, so this is best-effort */
  }
}

export function deleteProjectData(id: string): Promise<unknown> {
  try {
    localStorage.removeItem(`nightjar:last:${id}`);
  } catch {
    /* ignore */
  }
  return tx(PROJECTS, 'readwrite', (s) => s.delete(id));
}

export function emergencyCopy(id: string): Project | null {
  try {
    const raw = localStorage.getItem(`nightjar:last:${id}`);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

/** Automatic safety copies, taken at most every 20 minutes while writing. */
export async function addSnapshot(p: Project): Promise<void> {
  const list = await listSnapshots(p.id);
  if (list[0] && Date.now() - list[0].at < 20 * 60 * 1000) return;
  const at = Date.now();
  await tx(SNAPSHOTS, 'readwrite', (s) => s.put({ key: `${p.id}:${at}`, projectId: p.id, at, data: JSON.stringify(p) }));
  for (const old of list.slice(MAX_SNAPSHOTS - 1)) {
    await tx(SNAPSHOTS, 'readwrite', (s) => s.delete(old.key));
  }
}

export async function listSnapshots(projectId: string): Promise<Snapshot[]> {
  const all = await tx<Snapshot[]>(SNAPSHOTS, 'readonly', (s) => s.index('projectId').getAll(projectId));
  return (all ?? []).sort((a, b) => b.at - a.at);
}

function countWordsQuick(t: string): number {
  const m = t.match(/\S+/g);
  return m ? m.length : 0;
}

// Small per-device preferences (not part of the novel).
export function getPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`nightjar:pref:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function setPref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`nightjar:pref:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
