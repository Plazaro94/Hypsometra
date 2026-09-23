/**
 * Calendar-based validation windows (forward split and walk-forward).
 * All boundaries are UTC epoch ms; every segment is half-open: [from, to).
 */

export type DurationUnit = "days" | "weeks" | "months" | "years";

export interface Duration {
  value: number;
  unit: DurationUnit;
}

export interface ValidationWindow {
  index: number;
  isFrom: number;
  isTo: number;
  oosFrom: number;
  oosTo: number;
}

export type WindowMode = "rolling" | "anchored";

const DAY_MS = 86_400_000;

export function addDuration(time: number, d: Duration, times = 1): number {
  const n = d.value * times;
  if (d.unit === "days") return time + n * DAY_MS;
  if (d.unit === "weeks") return time + n * 7 * DAY_MS;
  const date = new Date(time);
  const months = d.unit === "months" ? n : n * 12;
  const targetMonth = date.getUTCMonth() + months;
  const result = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      targetMonth,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  // Clamp the day (e.g. Jan 31 + 1 month → Feb 28/29).
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result.getTime();
}

function floorToDay(time: number): number {
  return Math.floor(time / DAY_MS) * DAY_MS;
}

function assertPositive(d: Duration, label: string): void {
  if (!(d.value > 0) || !Number.isFinite(d.value)) {
    throw new Error(`${label} must be > 0`);
  }
}

function assertRange(from: number, to: number): void {
  if (!(to > from)) throw new Error("Period end must be after its start");
}

export function generateWindowsByDuration(input: {
  from: number;
  to: number;
  mode: WindowMode;
  inSample: Duration;
  outOfSample: Duration;
  /** Advance per window. Defaults to the out-of-sample length. */
  step?: Duration;
}): ValidationWindow[] {
  const { from, to, mode, inSample, outOfSample } = input;
  const step = input.step ?? outOfSample;
  assertRange(from, to);
  assertPositive(inSample, "In-sample length");
  assertPositive(outOfSample, "Out-of-sample length");
  assertPositive(step, "Step");

  const windows: ValidationWindow[] = [];
  for (let k = 0; k < 10_000; k++) {
    const isFrom = mode === "rolling" ? addDuration(from, step, k) : from;
    const isTo =
      mode === "rolling"
        ? addDuration(isFrom, inSample)
        : addDuration(addDuration(from, inSample), step, k);
    const oosTo = addDuration(isTo, outOfSample);
    if (oosTo > to) break;
    windows.push({ index: k, isFrom, isTo, oosFrom: isTo, oosTo });
  }
  return windows;
}

/**
 * StrategyQuant-style definition: number of runs and out-of-sample percentage.
 * - rolling: OOS is `oosPercent` of each window (IS + OOS); windows step by OOS.
 * - anchored: all OOS segments together are `oosPercent` of the period, split in `runs` equal parts.
 * Boundaries are floored to UTC midnight.
 */
export function generateWindowsByRuns(input: {
  from: number;
  to: number;
  mode: WindowMode;
  runs: number;
  oosPercent: number;
}): ValidationWindow[] {
  const { from, to, mode, runs, oosPercent } = input;
  assertRange(from, to);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error("Runs must be an integer >= 1");
  }
  if (!(oosPercent > 0 && oosPercent < 100)) {
    throw new Error("OOS percentage must be between 0 and 100");
  }
  const total = to - from;
  const p = oosPercent / 100;

  let isLen0: number;
  let oosLen: number;
  if (mode === "rolling") {
    const windowLen = total / (1 + (runs - 1) * p);
    oosLen = windowLen * p;
    isLen0 = windowLen - oosLen;
  } else {
    oosLen = (total * p) / runs;
    isLen0 = total - runs * oosLen;
  }

  const windows: ValidationWindow[] = [];
  for (let k = 0; k < runs; k++) {
    const isFrom = mode === "rolling" ? floorToDay(from + k * oosLen) : from;
    const isTo = floorToDay(
      mode === "rolling"
        ? from + k * oosLen + isLen0
        : from + isLen0 + k * oosLen,
    );
    const oosTo =
      k === runs - 1 ? to : floorToDay(isTo + oosLen);
    windows.push({ index: k, isFrom, isTo, oosFrom: isTo, oosTo });
  }
  return windows;
}

export type ForwardFraction = "1/2" | "1/3" | "1/4";

/** MT5-style single forward split: the last fraction of the period is forward. */
export function forwardSplit(input: {
  from: number;
  to: number;
  fraction?: ForwardFraction;
  /** Custom forward start; takes precedence over `fraction`. */
  forwardFrom?: number;
}): ValidationWindow {
  const { from, to } = input;
  assertRange(from, to);
  let oosFrom: number;
  if (input.forwardFrom !== undefined) {
    oosFrom = input.forwardFrom;
  } else {
    const denom = Number((input.fraction ?? "1/2").split("/")[1]);
    oosFrom = floorToDay(to - (to - from) / denom);
  }
  if (!(oosFrom > from && oosFrom < to)) {
    throw new Error("Forward start must fall inside the period");
  }
  return { index: 0, isFrom: from, isTo: oosFrom, oosFrom, oosTo: to };
}

export interface WindowIssue {
  index: number | null;
  message: string;
}

/** Structural checks for generated or manually edited windows. */
export function validateWindows(
  windows: readonly ValidationWindow[],
  period: { from: number; to: number },
): WindowIssue[] {
  const issues: WindowIssue[] = [];
  if (windows.length === 0) {
    issues.push({
      index: null,
      message: "No cabe ninguna ventana completa en el periodo.",
    });
    return issues;
  }
  for (const w of windows) {
    const n = w.index + 1;
    if (!(w.isTo > w.isFrom)) {
      issues.push({ index: w.index, message: `Ventana ${n}: IS vacío o invertido.` });
    }
    if (!(w.oosTo > w.oosFrom)) {
      issues.push({ index: w.index, message: `Ventana ${n}: OOS vacío o invertido.` });
    }
    if (w.oosFrom < w.isTo) {
      issues.push({ index: w.index, message: `Ventana ${n}: el OOS se solapa con su IS.` });
    }
    if (w.isFrom < period.from || w.oosTo > period.to) {
      issues.push({ index: w.index, message: `Ventana ${n}: fuera del periodo de datos.` });
    }
  }
  for (let i = 1; i < windows.length; i++) {
    const prev = windows[i - 1]!;
    const cur = windows[i]!;
    if (cur.oosFrom < prev.oosTo) {
      issues.push({
        index: cur.index,
        message: `Ventanas ${i} y ${i + 1}: los OOS se solapan; la curva OOS encadenada contaría días dos veces.`,
      });
    }
  }
  return issues;
}

/** Share of the period covered by the chained OOS segments (0–1). */
export function oosCoverage(
  windows: readonly ValidationWindow[],
  period: { from: number; to: number },
): number {
  const total = period.to - period.from;
  if (total <= 0) return 0;
  const covered = windows.reduce((s, w) => s + Math.max(0, w.oosTo - w.oosFrom), 0);
  return Math.min(1, covered / total);
}
