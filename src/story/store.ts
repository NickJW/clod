// A small, dependency-free app store. The novel is saved automatically,
// independently of anything the AI does, a moment after every change.
import { useSyncExternalStore } from 'react';
import type { CollectionKey, ItemOf, Project, ProjectMeta } from '../types';
import * as db from '../storage/db';
import { normalizeProject, uid } from './factory';

export type SaveState = 'saved' | 'saving' | 'error' | 'idle';

export type Page =
  | 'home'
  | 'write'
  | 'story'
  | 'characters'
  | 'mystery'
  | 'timeline'
  | 'scenes'
  | 'ending'
  | 'research'
  | 'settings';

export interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
  tone?: 'info' | 'error';
}

export interface AppState {
  ready: boolean;
  projects: ProjectMeta[];
  project: Project | null;
  page: Page;
  saveState: SaveState;
  lastSavedAt: number;
  saveError: string;
  toasts: Toast[];
  focusMode: boolean;
}

let state: AppState = {
  ready: false,
  projects: [],
  project: null,
  page: 'home',
  saveState: 'idle',
  lastSavedAt: 0,
  saveError: '',
  toasts: [],
  focusMode: false,
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/** Convenience: the open project (components only render inside an open project). */
export function useProject(): Project {
  return useApp((s) => s.project) as Project;
}

// ---------- Saving ----------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  setState({ saveState: 'saving' });
  saveTimer = setTimeout(flushSave, 700);
}

export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const p = state.project;
  if (!p) return;
  try {
    await db.saveProject(p);
    setState({ saveState: 'saved', lastSavedAt: Date.now(), saveError: '' });
    db.addSnapshot(p).catch(() => undefined);
  } catch (e) {
    setState({ saveState: 'error', saveError: e instanceof Error ? e.message : String(e) });
    // retry in a few seconds; the text is still safe in memory and in the emergency copy
    saveTimer = setTimeout(flushSave, 5000);
  }
}

window.addEventListener('beforeunload', (e) => {
  if (state.saveState === 'saving' || state.saveState === 'error') {
    flushSave();
    e.preventDefault();
  }
});

// ---------- Project lifecycle ----------

export async function init(): Promise<void> {
  try {
    const projects = await db.listProjects();
    setState({ projects });
    const lastId = db.getPref<string>('lastProject', '');
    const pick = projects.find((p) => p.id === lastId) ?? projects.find((p) => !p.isDemo) ?? projects[0];
    if (pick) await openProject(pick.id);
  } catch (e) {
    toast('Your browser blocked local storage. Your work cannot be saved until this is fixed.', 'error');
    console.error(e);
  }
  setState({ ready: true });
}

export async function refreshProjects() {
  setState({ projects: await db.listProjects() });
}

export async function openProject(id: string): Promise<void> {
  await flushSave();
  let raw = await db.loadProject(id);
  if (!raw) {
    const emergency = db.emergencyCopy(id);
    if (!emergency) return;
    raw = emergency;
    toast('Recovered your novel from its emergency copy.');
  }
  const project = normalizeProject(raw);
  db.setPref('lastProject', id);
  setState({ project, page: 'home' });
}

export async function createProject(p: Project): Promise<void> {
  await flushSave();
  await db.saveProject(p);
  db.setPref('lastProject', p.id);
  setState({ project: p, page: 'home' });
  await refreshProjects();
}

export async function closeProject(): Promise<void> {
  await flushSave();
  setState({ project: null });
  await refreshProjects();
}

export async function deleteProject(id: string): Promise<void> {
  await db.deleteProjectData(id);
  if (state.project?.id === id) setState({ project: null });
  await refreshProjects();
}

// ---------- Editing ----------

/** Replace top-level fields of the project. */
export function updateProject(patch: Partial<Project> | ((p: Project) => Partial<Project>)): void {
  const p = state.project;
  if (!p) return;
  const changes = typeof patch === 'function' ? patch(p) : patch;
  setState({ project: { ...p, ...changes, updatedAt: Date.now() } });
  scheduleSave();
}

export function addItem<K extends CollectionKey>(key: K, item: ItemOf<K>): void {
  updateProject((p) => ({ [key]: [...(p[key] as ItemOf<K>[]), item] }) as Partial<Project>);
}

export function patchItem<K extends CollectionKey>(key: K, id: string, patch: Partial<ItemOf<K>>): void {
  updateProject(
    (p) =>
      ({
        [key]: (p[key] as ItemOf<K>[]).map((it) => (it.id === id ? { ...it, ...patch, updatedAt: Date.now() } : it)),
      }) as Partial<Project>,
  );
}

/** Removes an item and shows an "Undo" toast so nothing is lost by accident. */
export function removeItem<K extends CollectionKey>(key: K, id: string, label = 'Deleted'): void {
  const p = state.project;
  if (!p) return;
  const list = p[key] as ItemOf<K>[];
  const index = list.findIndex((it) => it.id === id);
  if (index < 0) return;
  const item = list[index];
  updateProject({ [key]: list.filter((it) => it.id !== id) } as Partial<Project>);
  toast(label, 'info', 'Undo', () => {
    const cur = (state.project?.[key] ?? []) as ItemOf<K>[];
    const next = [...cur];
    next.splice(Math.min(index, next.length), 0, item);
    updateProject({ [key]: next } as Partial<Project>);
  });
}

export function moveItem<K extends CollectionKey>(key: K, id: string, dir: -1 | 1): void {
  updateProject((p) => {
    const list = [...(p[key] as ItemOf<K>[])];
    const i = list.findIndex((it) => it.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return {};
    [list[i], list[j]] = [list[j], list[i]];
    return { [key]: list } as Partial<Project>;
  });
}

export function go(page: Page): void {
  setState({ page, focusMode: false });
  window.scrollTo(0, 0);
}

export function toast(message: string, tone: Toast['tone'] = 'info', actionLabel?: string, action?: () => void) {
  const t: Toast = { id: uid(), message, tone, actionLabel, action };
  setState({ toasts: [...state.toasts, t] });
  setTimeout(() => dismissToast(t.id), action ? 9000 : 4500);
}

export function dismissToast(id: string) {
  setState({ toasts: state.toasts.filter((t) => t.id !== id) });
}
