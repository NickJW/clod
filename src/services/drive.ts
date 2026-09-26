// Google Drive sync: keeps each novel as one file in the author's own Google Drive, so
// it's backed up online and any computer she signs in on opens the latest version.
//
// Runs entirely in the browser (no server). It uses the "drive.file" permission, so the
// app can only see files it created itself, never the rest of her Drive. Google gives the
// browser an access token that lasts about an hour; renewing it needs a click, so the app
// renews on her next button click, and falls back to a calm "reconnect" banner.
import { useSyncExternalStore } from 'react';
import type { Project } from '../types';
import { getPref, setPref } from '../storage/db';
import { GOOGLE_CLIENT_ID } from '../config';
import { adoptProject, closeProject, getState, onSaved, openProject, toast } from '../story/store';
import { normalizeProject } from '../story/factory';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export function driveClientId(): string {
  return getPref<string>('googleClientId', '') || GOOGLE_CLIENT_ID;
}
export const driveAvailable = () => !!driveClientId();

// ---------- State (for the UI) ----------
export type DriveStatus = 'off' | 'needs-connect' | 'connecting' | 'syncing' | 'synced' | 'error';
interface DriveState {
  enabled: boolean;
  status: DriveStatus;
  email: string;
  lastSyncAt: number;
  message: string;
}
let ds: DriveState = {
  enabled: getPref('drive:on', false),
  status: getPref('drive:on', false) ? 'needs-connect' : 'off',
  email: getPref('drive:email', ''),
  lastSyncAt: 0,
  message: '',
};
const listeners = new Set<() => void>();
function setDs(patch: Partial<DriveState>) {
  ds = { ...ds, ...patch };
  listeners.forEach((l) => l());
}
export function useDrive<T>(sel: (s: DriveState) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => sel(ds),
  );
}

/** Per novel: which Drive file holds it, and the novel's last-changed time when we last matched Drive. */
type SyncMap = Record<string, { fileId: string; syncedAt: number; hash?: string }>;
const syncMap = (): SyncMap => getPref<SyncMap>('drive:files', {});
function setSync(id: string, v: { fileId: string; syncedAt: number; hash?: string }) {
  setPref('drive:files', { ...syncMap(), [id]: v });
}
const device = (() => {
  let d = getPref<string>('drive:device', '');
  if (!d) setPref('drive:device', (d = Math.random().toString(36).slice(2, 10)));
  return d;
})();

// ---------- Sign-in (Google Identity Services) ----------
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  callback: (r: TokenResponse) => void;
  error_callback?: (e: { type: string }) => void;
  requestAccessToken(o?: { prompt?: string; hint?: string }): void;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient(c: object): TokenClient; revoke(t: string, cb?: () => void): void } } };
  }
}

let token = '';
let tokenExpires = 0;
let client: TokenClient | null = null;
let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error('Couldn\'t reach Google. Please check your internet connection.'));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

const tokenValid = () => !!token && Date.now() < tokenExpires - 90_000;

/** Ask Google for access. Must be called from a click (it may open a small Google window). */
async function signIn(prompt: '' | 'consent' | 'select_account'): Promise<boolean> {
  await loadGis();
  client ??= window.google!.accounts.oauth2.initTokenClient({ client_id: driveClientId(), scope: SCOPE, callback: () => undefined });
  return new Promise<boolean>((resolve) => {
    client!.callback = (r) => {
      if (r.access_token) {
        token = r.access_token;
        tokenExpires = Date.now() + (r.expires_in ?? 3600) * 1000;
        resolve(true);
      } else resolve(false);
    };
    client!.error_callback = () => resolve(false);
    client!.requestAccessToken({ prompt, hint: ds.email || undefined });
  });
}

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    token = '';
    throw new Error('expired');
  }
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

// ---------- Drive files ----------
interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  appProperties?: Record<string, string>;
}

async function whoAmI(): Promise<string> {
  const r = await api<{ user?: { emailAddress?: string } }>(`${API}/about?fields=user(emailAddress)`);
  return r.user?.emailAddress ?? '';
}

export async function listDriveNovels(): Promise<{ id: string; title: string; updatedAt: number; projectId: string }[]> {
  const q = encodeURIComponent("appProperties has { key='nightjar' and value='1' } and trashed = false");
  const r = await api<{ files: DriveFile[] }>(`${API}/files?q=${q}&fields=files(id,name,modifiedTime,appProperties)&orderBy=modifiedTime desc&pageSize=50`);
  return r.files.map((f) => ({
    id: f.id,
    title: f.appProperties?.title || f.name.replace(/ \(Nightjar\)\.json$/, ''),
    updatedAt: Number(f.appProperties?.updatedAt) || Date.parse(f.modifiedTime),
    projectId: f.appProperties?.nightjarId ?? '',
  }));
}

async function findFile(projectId: string): Promise<DriveFile | null> {
  const known = syncMap()[projectId]?.fileId;
  if (known) {
    try {
      const f = await api<DriveFile & { trashed?: boolean }>(`${API}/files/${known}?fields=id,name,modifiedTime,appProperties,trashed`);
      if (!f.trashed) return f;
    } catch (e) {
      if ((e as Error).message === 'expired') throw e;
    }
  }
  const q = encodeURIComponent(`appProperties has { key='nightjarId' and value='${projectId}' } and trashed = false`);
  const r = await api<{ files: DriveFile[] }>(`${API}/files?q=${q}&fields=files(id,name,modifiedTime,appProperties)&orderBy=modifiedTime desc`);
  return r.files[0] ?? null;
}

async function upload(p: Project, fileId: string | null): Promise<string> {
  const meta = {
    name: `${p.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Novel'} (Nightjar).json`,
    mimeType: 'application/json',
    appProperties: { nightjar: '1', nightjarId: p.id, updatedAt: String(p.updatedAt), device, title: p.title.slice(0, 100) },
    ...(fileId ? {} : { description: 'Your novel, saved by Nightjar. Open it from Nightjar on any computer.' }),
  };
  const body = JSON.stringify({ app: 'nightjar', kind: 'project-backup', exportedAt: Date.now(), project: p });
  const boundary = 'nightjar' + Math.random().toString(36).slice(2);
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await api<{ id: string }>(`${UPLOAD}/files${fileId ? `/${fileId}` : ''}?uploadType=multipart&fields=id`, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  return r.id;
}

async function download(fileId: string): Promise<Project> {
  const data = await api<{ project?: unknown } | string>(`${API}/files/${fileId}?alt=media`);
  const obj = typeof data === 'string' ? JSON.parse(data) : data;
  return normalizeProject((obj as { project?: unknown }).project ?? obj);
}

/** Fingerprint of the writing itself (ignores timestamps and automatic history), to tell real edits apart. */
function contentHash(p: Project): string {
  const s = JSON.stringify({ ...p, updatedAt: 0, lastBackupAt: 0, lab: 0, chapters: p.chapters.map((c) => ({ ...c, versions: 0, updatedAt: 0 })) });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + ':' + s.length;
}

// ---------- Sync ----------
let running: Promise<void> | null = null;
let again = false;

/** Bring the open novel and its Drive copy into step. Never loses work: if both changed, both are kept. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      await syncOnce();
    } finally {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return running;
}

async function syncOnce() {
  const p = getState().project;
  if (!ds.enabled || !p || p.isDemo) return;
  if (!tokenValid()) {
    setDs({ status: 'needs-connect' });
    return;
  }
  setDs({ status: 'syncing', message: '' });
  try {
    const f = await findFile(p.id);
    const known = syncMap()[p.id];
    const last = known?.syncedAt ?? 0;
    const remoteAt = Number(f?.appProperties?.updatedAt) || 0;
    const cur = () => getState().project!;
    const localChanged = !known?.hash || contentHash(cur()) !== known.hash;
    const put = async (fileId: string | null) => {
      const snap = cur();
      const id = await upload(snap, fileId);
      setSync(p.id, { fileId: id, syncedAt: snap.updatedAt, hash: contentHash(snap) });
    };
    if (!f) await put(null);
    else if (remoteAt > last && f.appProperties?.device !== device) {
      // Another computer saved newer work.
      const remote = await download(f.id);
      const local = cur();
      if (localChanged && contentHash(local) !== contentHash(remote)) {
        // Both computers changed it since they last matched: keep both, open the Drive version.
        await adoptProject(remote);
        const copy = { ...local, id: `${local.id}-${device}-${Date.now().toString(36)}`, title: `${local.title} (this computer's version)` };
        await adoptProject(copy, false);
        toast('This novel was changed on two computers. I opened the newest version from Google Drive and kept this computer\'s version as a separate novel, so nothing is lost.', 'info', 'See both', () => void closeProject());
      } else {
        await adoptProject(remote);
        toast('Loaded your latest work from Google Drive.');
      }
      setSync(p.id, { fileId: f.id, syncedAt: remoteAt, hash: contentHash(remote) });
    } else if (localChanged) await put(f.id);
    setDs({ status: 'synced', lastSyncAt: Date.now() });
  } catch (e) {
    if ((e as Error).message === 'expired') setDs({ status: 'needs-connect' });
    else {
      setTimeout(() => ds.enabled && void syncNow(), 60_000);
      setDs({ status: 'error', message: navigator.onLine ? 'Couldn\'t reach Google Drive just now. Your work is safe on this computer; I\'ll try again shortly.' : 'You\'re offline. Your work is safe on this computer and will go to Google Drive when you\'re back online.' });
    }
  }
}

/** "Connect Google Drive" / "Continue with Google Drive" buttons. */
export async function connectDrive(): Promise<boolean> {
  setDs({ status: 'connecting', message: '' });
  let ok = false;
  try {
    ok = await signIn(ds.email ? '' : 'select_account');
  } catch (e) {
    setDs({ status: 'error', message: (e as Error).message });
    return false;
  }
  if (!ok) {
    setDs({ status: ds.enabled ? 'needs-connect' : 'off', message: 'Google sign-in was closed before it finished.' });
    return false;
  }
  try {
    const email = await whoAmI();
    setPref('drive:email', email);
    setPref('drive:on', true);
    setDs({ enabled: true, email, status: 'synced' });
  } catch {
    setDs({ status: 'error', message: 'Signed in, but couldn\'t reach Google Drive. Please try again.' });
    return false;
  }
  await syncNow();
  return true;
}

export function disconnectDrive() {
  if (token) window.google?.accounts.oauth2.revoke(token);
  token = '';
  setPref('drive:on', false);
  setDs({ enabled: false, status: 'off', message: '' });
}

/** New computer: sign in, then open a novel straight from Drive. */
export async function openFromDrive(fileId: string): Promise<void> {
  const p = await download(fileId);
  const here = getState().projects.find((x) => x.id === p.id);
  if (here && here.updatedAt > p.updatedAt) {
    // This computer has newer work on it: open that, and let sync send it up to Drive.
    await openProject(p.id);
    setSync(p.id, { fileId, syncedAt: p.updatedAt });
    await syncNow();
    return;
  }
  await adoptProject(p);
  setSync(p.id, { fileId, syncedAt: p.updatedAt, hash: contentHash(p) });
  setDs({ status: 'synced', lastSyncAt: Date.now() });
}

// Save to Drive shortly after changes (at most every 20 seconds).
let pending: ReturnType<typeof setTimeout> | null = null;
onSaved(() => {
  if (!ds.enabled || pending) return;
  pending = setTimeout(() => {
    pending = null;
    void syncNow();
  }, 20_000);
});

// The access token lasts about an hour and can only be renewed from a click, so renew it
// on her next button click once it's close to expiring.
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!ds.enabled || !ds.email || tokenValid() || ds.status === 'connecting') return;
    if (!(e.target as Element | null)?.closest?.('button')) return;
    void signIn('').then((ok) => {
      if (ok) void syncNow();
    });
  },
  true,
);
// Coming back to the window: check for work saved on another computer.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ds.enabled && tokenValid()) void syncNow();
});
