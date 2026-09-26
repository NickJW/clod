// A small, dependency-free app store. The novel is saved automatically,
// independently of anything the AI does, a moment after every change.
import { useSyncExternalStore } from 'react';
import type { CollectionKey, ItemOf, Project, ProjectMeta } from '../types';
import * as db from '../storage/db';
import { normalizeProject, uid } from './factory';
import { backupToFolder } from '../services/backupFolder';

export type SaveState = 'saved' | 'saving' | 'error' | 'idle';

export type Page =
  | 'home'
  | 'guide'
  | 'write'
  | 'story'
  | 'characters'
  | 'mystery'
  | 'timeline'
  | 'scenes'
  | 'ending'
  | 'research'
  | 'lab'
  | 'polish'
  | 'publish'
  | 'series'
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
  /** A backup folder is set up but the browser needs one click to allow writing again. */
  folderNeedsPermission: boolean;
  /** The guide step being followed, if any (shows the guide bar). */
  guideStep: number | null;
  /** The same novel is open in another window or tab. */
  otherWindow: boolean;
  /** Open onboarding straight at "Start a new novel" (e.g. leaving the example book). */
  startNew: boolean;
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
  folderNeedsPermission: false,
  guideStep: null,
  otherWindow: false,
  startNew: false,
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
let lastFolderTry = 0;
let lastEmergency = 0;

/** Places holding not-yet-committed text (the open editor) register here, so every save includes it. */
const flushHooks = new Set<() => void>();
export function registerFlushHook(fn: () => void): () => void {
  flushHooks.add(fn);
  return () => flushHooks.delete(fn);
}
function runFlushHooks() {
  flushHooks.forEach((fn) => {
    try {
      fn();
    } catch {
      /* never let a hook stop a save */
    }
  });
}

/** Called when the window is hidden or closing: save synchronously what we can, then start the normal save. */
function saveNow() {
  runFlushHooks();
  const p = state.project;
  if (!p) return;
  db.writeEmergencyCopy(p);
  lastEmergency = Date.now();
  void flushSave();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  setState({ saveState: 'saving' });
  saveTimer = setTimeout(flushSave, 700);
}

export async function flushSave(): Promise<void> {
  runFlushHooks();
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const p = state.project;
  if (!p) return;
  try {
    await db.saveProject(p);
    // Only say "Saved" if nothing changed while we were writing.
    if (state.project === p) setState({ saveState: 'saved', lastSavedAt: Date.now(), saveError: '' });
    if (Date.now() - lastEmergency > 60000) {
      lastEmergency = Date.now();
      db.writeEmergencyCopy(p);
    }
    db.addSnapshot(p).catch(() => undefined);
    // Quiet hourly backup to the author's chosen folder, if she set one up and the browser still allows it.
    if (Date.now() - lastFolderTry > 3600e3) {
      lastFolderTry = Date.now();
      backupToFolder(p, false).then((r) => {
        if (r === 'saved') updateProject({ lastBackupAt: Date.now() });
        setState({ folderNeedsPermission: r === 'needs-permission' });
      });
    }
  } catch (e) {
    setState({ saveState: 'error', saveError: e instanceof Error ? e.message : String(e) });
    // retry in a few seconds; the text is still safe in memory and in the emergency copy
    saveTimer = setTimeout(flushSave, 5000);
  }
}

window.addEventListener('beforeunload', (e) => {
  const pending = state.saveState === 'saving' || state.saveState === 'error' || saveTimer !== null;
  saveNow();
  if (pending) e.preventDefault();
});
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});

// ---------- Only one window per novel ----------
// Two windows editing the same novel would overwrite each other's work, so warn clearly.
const tabId = Math.random().toString(36).slice(2);
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nightjar') : null;
channel?.addEventListener('message', (e: MessageEvent<{ type: string; projectId: string; tab: string }>) => {
  const m = e.data;
  const mine = state.project?.id;
  if (!mine || m.projectId !== mine || m.tab === tabId) return;
  if (m.type === 'open') {
    channel.postMessage({ type: 'here', projectId: mine, tab: tabId });
    setState({ otherWindow: true });
  } else if (m.type === 'here') setState({ otherWindow: true });
  else if (m.type === 'closed') setState({ otherWindow: false });
});
function announceOpen(projectId: string) {
  channel?.postMessage({ type: 'open', projectId, tab: tabId });
}
window.addEventListener('pagehide', () => state.project && channel?.postMessage({ type: 'closed', projectId: state.project.id, tab: tabId }));

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
  const emergency = db.emergencyCopy(id);
  if (!raw) {
    if (!emergency) return;
    raw = emergency;
    toast('Recovered your novel from its emergency copy.');
  } else if (emergency && (emergency.updatedAt ?? 0) > (raw.updatedAt ?? 0)) {
    // The window closed before the last save finished: use the newer emergency copy, keeping chapter histories.
    const versions = new Map(raw.chapters.map((c) => [c.id, c.versions]));
    raw = { ...emergency, chapters: emergency.chapters.map((c) => ({ ...c, versions: versions.get(c.id) ?? [] })) };
    toast('Recovered your latest changes.');
  }
  const project = normalizeProject(raw);
  db.setPref('lastProject', id);
  setState({ project, page: 'home', otherWindow: false, startNew: false });
  announceOpen(project.id);
  if (raw === emergency || (emergency && raw.updatedAt === emergency.updatedAt)) void flushSave();
}

export async function createProject(p: Project): Promise<void> {
  await flushSave();
  // A restored backup must win over any older emergency copy of the same novel.
  p = { ...p, updatedAt: Date.now() };
  await db.saveProject(p);
  db.writeEmergencyCopy(p);
  db.setPref('lastProject', p.id);
  setState({ project: p, page: 'home', otherWindow: false, startNew: false });
  announceOpen(p.id);
  await refreshProjects();
}

export async function closeProject(startNew = false): Promise<void> {
  await flushSave();
  setState({ project: null, startNew, guideStep: null, focusMode: false });
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
  setTimeout(() => dismissToast(t.id), action ? 14000 : tone === 'error' ? 10000 : 6500);
}

export function dismissToast(id: string) {
  setState({ toasts: state.toasts.filter((t) => t.id !== id) });
}
