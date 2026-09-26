// The yarn board: what can be pinned, the strings implied by her story bible,
// and a small physics layout for "Pin it all up for me".
import type { Pin, PinKind, Project, Yarn } from '../types';

export const BOARD_W = 2400;
export const BOARD_H = 1500;

export interface BoardItem {
  id: string;
  kind: PinKind;
  title: string;
  sub: string;
  detail: string;
}

export function boardItems(p: Project): BoardItem[] {
  const live = <T extends { status?: string }>(x: T) => x.status !== 'discarded';
  const chName = (id: string) => p.chapters.findIndex((c) => c.id === id);
  return [
    ...p.characters.filter(live).map((c) => ({ id: c.id, kind: 'character' as const, title: c.name, sub: c.role || 'Character', detail: [c.fields.occupation, c.fields.personality].filter(Boolean).join('. ') })),
    ...p.clues.filter(live).map((c) => ({ id: c.id, kind: 'clue' as const, title: c.title, sub: c.kind === 'red-herring' ? 'Red herring' : c.kind === 'misleading' ? 'Misleading clue' : 'Clue', detail: c.description + (chName(c.appearsChapterId) >= 0 ? ` (Ch. ${chName(c.appearsChapterId) + 1})` : '') })),
    ...p.secrets.filter(live).map((s) => ({ id: s.id, kind: 'secret' as const, title: s.title, sub: 'Secret', detail: s.description })),
    ...p.timeline.filter(live).map((e) => ({ id: e.id, kind: 'event' as const, title: e.title, sub: e.dateKind === 'exact' && e.date ? `${e.date}${e.time ? ` ${e.time}` : ''}` : e.approxLabel || 'Event', detail: e.description })),
    ...p.places.map((pl) => ({ id: pl.id, kind: 'place' as const, title: pl.name, sub: 'Place', detail: pl.description })),
  ];
}

/** Strings her story bible already implies. */
export function impliedStrings(p: Project): Omit<Yarn, 'id'>[] {
  const out: Omit<Yarn, 'id'>[] = [];
  const has = new Set(boardItems(p).map((i) => i.id));
  const add = (a: string, b: string, label: string) => {
    if (!a || !b || a === b || !has.has(a) || !has.has(b)) return;
    if (out.some((y) => (y.a === a && y.b === b) || (y.a === b && y.b === a))) return;
    out.push({ a, b, label, auto: true });
  };
  const byName = (text: string) => {
    const t = text.toLowerCase();
    return p.characters.filter((c) => c.name && t.includes(c.name.toLowerCase().split(' ')[0])).map((c) => c.id);
  };
  const placeByName = (text: string) => p.places.filter((pl) => pl.name && text.toLowerCase().includes(pl.name.toLowerCase())).map((pl) => pl.id);
  for (const r of p.relationships) if (r.status !== 'discarded') add(r.aId, r.bId, r.kind || 'connected');
  for (const c of p.clues) {
    for (const id of byName(c.pointsTo)) add(c.id, id, c.kind === 'red-herring' ? 'seems to point to' : 'points to');
    for (const id of c.whoKnowsIds) add(c.id, id, 'knows about it');
  }
  for (const s of p.secrets) {
    for (const id of s.holderIds) add(s.id, id, 'keeps it');
    for (const id of s.hiddenFromIds.slice(0, 2)) add(s.id, id, 'hidden from');
  }
  for (const e of p.timeline) {
    for (const id of e.characterIds) add(e.id, id, 'was there');
    for (const id of placeByName(e.location)) add(e.id, id, 'here');
  }
  return out;
}

/** Force-directed layout: strings pull together, everything else pushes apart. */
export function autoLayout(p: Project, strings: Omit<Yarn, 'id'>[], keep: Pin[] = []): Pin[] {
  const items = boardItems(p);
  const n = items.length;
  if (!n) return [];
  const cx = BOARD_W / 2, cy = BOARD_H / 2;
  const ring: Record<PinKind, number> = { character: 0.25, secret: 0.55, clue: 0.7, event: 0.85, place: 0.95, note: 0.9 };
  const idx = new Map(items.map((it, i) => [it.id, i]));
  // Seeded pseudo-random, so the same board arranges the same way.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pos = items.map((it, i) => {
    const old = keep.find((k) => k.id === it.id);
    if (old) return { x: old.x, y: old.y };
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const r = ring[it.kind] * Math.min(cx, cy) * 0.95;
    return { x: cx + Math.cos(a) * r * 1.5, y: cy + Math.sin(a) * r };
  });
  const edges = strings.map((s) => [idx.get(s.a), idx.get(s.b)]).filter((e): e is [number, number] => e[0] !== undefined && e[1] !== undefined);
  for (let step = 0; step < 400; step++) {
    const cool = 1 - step / 400;
    const f = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x, dy = (pos[i].y - pos[j].y) * 1.4;
        const d2 = Math.max(dx * dx + dy * dy, 400);
        const rep = 2.2e6 / d2 / Math.sqrt(d2);
        f[i].x += dx * rep; f[i].y += dy * rep; f[j].x -= dx * rep; f[j].y -= dy * rep;
      }
    for (const [a, b] of edges) {
      const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = (d - 210) * 0.035;
      f[a].x += (dx / d) * pull; f[a].y += (dy / d) * pull; f[b].x -= (dx / d) * pull; f[b].y -= (dy / d) * pull;
    }
    for (let i = 0; i < n; i++) {
      f[i].x += (cx - pos[i].x) * 0.012;
      f[i].y += (cy - pos[i].y) * 0.02;
      const m = Math.min(40 * cool + 2, Math.hypot(f[i].x, f[i].y));
      const len = Math.hypot(f[i].x, f[i].y) || 1;
      pos[i].x = Math.min(BOARD_W - 150, Math.max(40, pos[i].x + (f[i].x / len) * m));
      pos[i].y = Math.min(BOARD_H - 150, Math.max(40, pos[i].y + (f[i].y / len) * m));
    }
  }
  // Nudge apart any cards that still overlap (cards are roughly 190 x 130 on the board).
  const W = (k: PinKind) => (k === 'character' ? 150 : k === 'place' ? 160 : 190) + 24;
  const H = (k: PinKind) => (k === 'character' ? 190 : 110) + 20;
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const ox = (W(items[i].kind) + W(items[j].kind)) / 2 - Math.abs(pos[i].x - pos[j].x);
        const oy = (H(items[i].kind) + H(items[j].kind)) / 2 - Math.abs(pos[i].y - pos[j].y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy) {
            const s = (pos[i].x < pos[j].x ? -1 : 1) * (ox / 2 + 1);
            pos[i].x += s; pos[j].x -= s;
          } else {
            const s = (pos[i].y < pos[j].y ? -1 : 1) * (oy / 2 + 1);
            pos[i].y += s; pos[j].y -= s;
          }
        }
      }
    for (const q of pos) {
      q.x = Math.min(BOARD_W - 200, Math.max(30, q.x));
      q.y = Math.min(BOARD_H - 200, Math.max(30, q.y));
    }
    if (!moved) break;
  }
  return items.map((it, i) => ({ id: it.id, kind: it.kind, x: Math.round(pos[i].x), y: Math.round(pos[i].y), tilt: Math.round((rnd() * 8 - 4) * 10) / 10 }));
}
