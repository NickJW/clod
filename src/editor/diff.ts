// Word-level comparison so the author can see exactly what an edit changed.

export interface DiffPart {
  type: 'same' | 'add' | 'del';
  text: string;
}

function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

function lcsDiff<T>(A: T[], B: T[], eq: (x: T, y: T) => boolean): { type: 'same' | 'add' | 'del'; a?: T; b?: T }[] {
  const n = A.length;
  const m = B.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(A[i], B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { type: 'same' | 'add' | 'del'; a?: T; b?: T }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(A[i], B[j])) out.push({ type: 'same', a: A[i++], b: B[j++] });
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'del', a: A[i++] });
    else out.push({ type: 'add', b: B[j++] });
  }
  while (i < n) out.push({ type: 'del', a: A[i++] });
  while (j < m) out.push({ type: 'add', b: B[j++] });
  return out;
}

function wordDiff(a: string, b: string, push: (type: DiffPart['type'], text: string) => void) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.length * B.length > 4_000_000) {
    push('del', a);
    push('add', b);
    return;
  }
  for (const d of lcsDiff(A, B, (x, y) => x === y)) push(d.type, (d.type === 'add' ? d.b : d.a) as string);
}

/**
 * Word-level comparison. Long texts are compared paragraph by paragraph first,
 * then word by word inside changed paragraphs, so whole chapters stay readable.
 */
export function diffWords(a: string, b: string): DiffPart[] {
  const out: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  const splitParas = (s: string) => s.split(/(\n\s*\n)/);
  const PA = splitParas(a);
  const PB = splitParas(b);
  if (PA.length < 4 && PB.length < 4) {
    wordDiff(a, b, push);
    return out;
  }
  const ops = lcsDiff(PA, PB, (x, y) => x === y);
  // Pair up neighbouring deleted/added paragraphs so edits inside a paragraph show word by word.
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    if (op.type === 'same') push('same', op.a!);
    else if (op.type === 'del' && ops[k + 1]?.type === 'add') {
      wordDiff(op.a!, ops[k + 1].b!, push);
      k++;
    } else push(op.type, (op.type === 'add' ? op.b : op.a)!);
  }
  return out;
}

export function changeRatio(parts: DiffPart[]): number {
  let changed = 0;
  let total = 0;
  for (const p of parts) {
    const w = p.text.trim() ? p.text.split(/\s+/).filter(Boolean).length : 0;
    total += w;
    if (p.type !== 'same') changed += w;
  }
  return total ? changed / total : 0;
}
