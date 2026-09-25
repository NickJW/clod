// Lets the editor panel talk to the open manuscript editor (get the selection,
// insert or replace text) without the two components knowing about each other.
import type { Selection } from '../ai/actions';
import { getState, patchItem, toast } from '../story/store';
import { saveChapterVersion } from '../story/reference';

export interface EditorHandle {
  chapterId: string;
  getSelection(): Selection;
  replaceRange(start: number, end: number, text: string): void;
  focus(): void;
  select(start: number, end: number): void;
  /** Push any not-yet-saved typing into the store. */
  flush(): void;
}

let handle: EditorHandle | null = null;

export function registerEditor(h: EditorHandle | null) {
  handle = h;
}

export function currentSelection(): Selection | undefined {
  const s = handle?.getSelection();
  return s && s.text.trim() ? s : undefined;
}

export function cursorSelection(): Selection | undefined {
  return handle?.getSelection();
}

/** Save any typing that hasn't been committed yet (called before AI requests read the chapter). */
export function flushEditor() {
  handle?.flush();
}

export function jumpTo(start: number, end: number) {
  handle?.select(start, end);
}

/** Replace `original` in a chapter with `replacement`. Returns false if the original text can no longer be found. */
export function applyReplacement(chapterId: string, start: number, original: string, replacement: string, label: string): boolean {
  handle?.flush();
  const ch = getState().project?.chapters.find((c) => c.id === chapterId);
  if (!ch) return false;
  let at = ch.text.slice(start, start + original.length) === original ? start : -1;
  if (at < 0) {
    const first = ch.text.indexOf(original);
    // only accept an unambiguous match
    if (first >= 0 && ch.text.indexOf(original, first + 1) < 0) at = first;
  }
  if (at < 0) return false;
  saveChapterVersion(chapterId, label);
  if (handle && handle.chapterId === chapterId) handle.replaceRange(at, at + original.length, replacement);
  else patchItem('chapters', chapterId, { text: ch.text.slice(0, at) + replacement + ch.text.slice(at + original.length) });
  return true;
}

/** Insert text at the cursor if the chapter is open, otherwise at the end of the chapter. */
export function insertText(chapterId: string, text: string, where: 'cursor' | 'end', label: string) {
  handle?.flush();
  const ch = getState().project?.chapters.find((c) => c.id === chapterId);
  if (!ch) return;
  saveChapterVersion(chapterId, label);
  if (where === 'cursor' && handle && handle.chapterId === chapterId) {
    const s = handle.getSelection();
    const pad = s.end > 0 && !/\n\s*$/.test(ch.text.slice(0, s.end)) ? '\n\n' : '';
    handle.replaceRange(s.end, s.end, pad + text + '\n\n');
  } else {
    const sep = ch.text.trim() ? '\n\n' : '';
    // The open editor picks up external changes to its chapter automatically.
    patchItem('chapters', chapterId, { text: ch.text.replace(/\s*$/, '') + sep + text + '\n' });
  }
  toast('Added to your chapter. An earlier version was kept in History.');
}
