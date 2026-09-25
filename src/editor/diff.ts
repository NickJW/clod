// Word-level comparison so the author can see exactly what an edit changed.

export interface DiffPart {
  type: 'same' | 'add' | 'del';
  text: string;
}

function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

export function diffWords(a: string, b: string): DiffPart[] {
  const A = tokenize(a);
  const B = tokenize(b);
  // Guard against very long passages (O(n·m) memory): fall back to whole-block replacement.
  if (A.length * B.length > 9_000_000) return [{ type: 'del', text: a }, { type: 'add', text: b }];
  const n = A.length;
  const m = B.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push('same', A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', A[i++]);
    else push('add', B[j++]);
  }
  while (i < n) push('del', A[i++]);
  while (j < m) push('add', B[j++]);
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
