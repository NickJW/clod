// Automatic backups to a folder the author chooses once (Chrome and Edge).
// The browser keeps the permission; if it asks again, one click restores it.
import type { Project } from '../types';
import { kvGet, kvSet } from '../storage/db';

type Perm = 'granted' | 'denied' | 'prompt';
interface DirHandle {
  name: string;
  queryPermission(o: { mode: 'readwrite' }): Promise<Perm>;
  requestPermission(o: { mode: 'readwrite' }): Promise<Perm>;
  getFileHandle(name: string, o: { create: boolean }): Promise<{ createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void> }> }>;
}

export const folderSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function getFolder(): Promise<DirHandle | undefined> {
  if (!folderSupported) return undefined;
  try {
    return await kvGet<DirHandle>('backupFolder');
  } catch {
    return undefined;
  }
}

export async function chooseFolder(): Promise<DirHandle | undefined> {
  const pick = (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker;
  try {
    const h = await pick({ mode: 'readwrite', id: 'nightjar-backups', startIn: 'documents' });
    await kvSet('backupFolder', h);
    return h;
  } catch {
    return undefined; // cancelled
  }
}

export type FolderResult = 'saved' | 'needs-permission' | 'no-folder' | 'failed';

/** Write today's backup file (one per novel per day, overwritten through the day). */
export async function backupToFolder(p: Project, interactive: boolean): Promise<FolderResult> {
  const h = await getFolder();
  if (!h) return 'no-folder';
  try {
    let perm = await h.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && interactive) perm = await h.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return 'needs-permission';
    const name = `${p.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Novel'} - backup ${new Date().toISOString().slice(0, 10)}.nightjar.json`;
    const file = await h.getFileHandle(name, { create: true });
    const w = await file.createWritable();
    await w.write(JSON.stringify({ app: 'nightjar', kind: 'project-backup', exportedAt: Date.now(), project: p }));
    await w.close();
    return 'saved';
  } catch {
    return 'failed';
  }
}
