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
  period: { from: number; to: number };
  issueIndexes: Set<number>;
}) {
  const { windows, period } = props;
  const span = period.to - period.from;
  const x = (t: number) => PAD_L + ((t - period.from) / span) * (W - PAD_L - PAD_R);
  const rows = Math.max(windows.length, 1);
  const H = rows * (ROW + GAP) + AXIS_H;

  const years: number[] = [];
  const startYear = new Date(period.from).getUTCFullYear();
  const endYear = new Date(period.to).getUTCFullYear();
  const every = endYear - startYear > 14 ? 2 : 1;
  for (let y = startYear; y <= endYear + 1; y += every) {
    const t = Date.UTC(y, 0, 1);
    if (t >= period.from && t <= period.to) years.push(t);
  }

  return (
    <svg className="timeline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventanas de validación en el tiempo">
      {years.map((t) => (
        <g key={t}>
          <line className="tl-grid" x1={x(t)} x2={x(t)} y1={0} y2={H - AXIS_H + 4} />
          <text className="tl-tick" x={x(t)} y={H - 6} textAnchor="middle">
            {new Date(t).getUTCFullYear()}
          </text>
        </g>
      ))}
      <rect className="tl-period" x={x(period.from)} y={0} width={x(period.to) - x(period.from)} height={H - AXIS_H} />
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
