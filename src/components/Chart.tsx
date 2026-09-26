// Small, dependency-free SVG charts for per-chapter data.
export interface Series {
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

export function LineChart({ series, labels, max = 10, height = 220, highlight }: { series: Series[]; labels: string[]; max?: number; height?: number; highlight?: (i: number) => boolean }) {
  const w = Math.max(480, labels.length * 56);
  const pad = { l: 34, r: 12, t: 12, b: 28 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={height} role="img" style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--line-2)" />
            <text x={pad.l - 6} y={y(max * f) + 4} fontSize="11" textAnchor="end" fill="var(--muted)">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <g key={i}>
            {highlight?.(i) && <rect x={x(i) - 14} y={pad.t} width={28} height={ih} fill="var(--del)" opacity={0.6} />}
            <text x={x(i)} y={height - 8} fontSize="11" textAnchor="middle" fill="var(--muted)">
              {l}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
          return (
            <g key={s.label}>
              <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={2.4} strokeDasharray={s.dashed ? '5 4' : undefined} />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="row small" style={{ gap: 14, marginTop: 4 }}>
        {series.map((s) => (
          <span key={s.label} className="row" style={{ gap: 6 }}>
            <span style={{ width: 14, height: 3, background: s.color, display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Bars({ values, labels, color = 'var(--brass)', format = (v: number) => v.toLocaleString() }: { values: number[]; labels: string[]; color?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="stack" style={{ gap: 4 }}>
      {values.map((v, i) => (
        <div key={i} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <span className="small muted" style={{ width: 150, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {labels[i]}
          </span>
          <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 4, height: 14 }}>
            <div style={{ width: `${(v / max) * 100}%`, background: color, height: '100%', borderRadius: 4 }} />
          </div>
          <span className="small" style={{ width: 70, textAlign: 'right' }}>
            {format(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A heat grid (rows × chapters). */
export function Heat({ rows, labels }: { rows: { label: string; values: number[] }[]; labels: string[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div className="matrix">
      <table>
        <thead>
          <tr>
            <th />
            {labels.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th className="rowh">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i} style={{ background: v ? `color-mix(in srgb, var(--accent) ${Math.round(15 + (v / max) * 70)}%, transparent)` : undefined, color: v / max > 0.5 ? '#fff' : undefined }}>
                  {v || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
