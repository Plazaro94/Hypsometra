"use client";

import type { ValidationWindow } from "@hypsometra/opt/planning";

const W = 1000;
const PAD_L = 34;
const PAD_R = 8;
const ROW = 14;
const GAP = 5;
const AXIS_H = 22;

export function Timeline(props: {
  windows: ValidationWindow[];
  total: { from: number; to: number };
  unseen: { from: number; to: number } | null;
  issueIndexes: Set<number>;
}) {
  const { windows, total, unseen } = props;
  const span = total.to - total.from;
  const x = (t: number) => PAD_L + ((t - total.from) / span) * (W - PAD_L - PAD_R);
  const rows = Math.max(windows.length, 1);
  const H = rows * (ROW + GAP) + AXIS_H;
  const bodyH = H - AXIS_H;

  const years: number[] = [];
  const startYear = new Date(total.from).getUTCFullYear();
  const endYear = new Date(total.to).getUTCFullYear();
  const every = endYear - startYear > 14 ? 2 : 1;
  for (let y = startYear; y <= endYear + 1; y += every) {
    const t = Date.UTC(y, 0, 1);
    if (t >= total.from && t <= total.to) years.push(t);
  }

  return (
    <svg className="timeline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventanas de validación en el tiempo">
      {years.map((t) => (
        <g key={t}>
          <line className="tl-grid" x1={x(t)} x2={x(t)} y1={0} y2={bodyH + 4} />
          <text className="tl-tick" x={x(t)} y={H - 6} textAnchor="middle">
            {new Date(t).getUTCFullYear()}
          </text>
        </g>
      ))}
      <rect className="tl-period" x={x(total.from)} y={0} width={x(total.to) - x(total.from)} height={bodyH} />
      {unseen && (
        <g>
          <rect className="tl-unseen" x={x(unseen.from)} y={0} width={x(unseen.to) - x(unseen.from)} height={bodyH} rx={3} />
          <text className="tl-unseen-label" x={(x(unseen.from) + x(unseen.to)) / 2} y={Math.min(bodyH / 2 + 4, 16)} textAnchor="middle">
            no visto
          </text>
        </g>
      )}
      {windows.map((w, i) => {
        const y = i * (ROW + GAP) + 2;
        const bad = props.issueIndexes.has(w.index);
        return (
          <g key={i}>
            <text className="tl-label" x={PAD_L - 8} y={y + ROW - 3} textAnchor="end">
              {i + 1}
            </text>
            <rect className={`tl-is${bad ? " bad" : ""}`} x={x(w.isFrom)} y={y} width={Math.max(1, x(w.isTo) - x(w.isFrom))} height={ROW} rx={3} />
            {w.oosTo > w.oosFrom && (
              <rect className={`tl-oos${bad ? " bad" : ""}`} x={x(w.oosFrom)} y={y} width={Math.max(1, x(w.oosTo) - x(w.oosFrom))} height={ROW} rx={3} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
