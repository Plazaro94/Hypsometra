import { createRng } from "./space.js";

export type MonteCarloMethod = "shuffle" | "bootstrap";

export interface MonteCarloInput {
  /** Per-trade net P&amp;L sequence from a backtest. */
  tradePnls: readonly number[];
  initialBalance: number;
  simulations: number;
  method: MonteCarloMethod;
  seed?: number;
  /**
   * Optional stress: randomly drop this fraction of trades each simulation (0–1).
   * Applied after shuffle/bootstrap sampling.
   */
  dropRate?: number;
}

export interface EquityStats {
  netProfit: number;
  finalEquity: number;
  maxDrawdownAbs: number;
  maxDrawdownPct: number;
  ruined: boolean;
}

export interface MonteCarloResult {
  method: MonteCarloMethod;
  simulations: number;
  tradeCount: number;
  original: EquityStats;
  /** Sorted sample of simulation stats (by netProfit ascending) for percentiles. */
  netProfit: PercentileSummary;
  maxDrawdownPct: PercentileSummary;
  probProfit: number;
  probRuin: number;
  /** Share of sims with maxDrawdownPct worse (higher) than the original. */
  probWorseDrawdownThanOriginal: number;
}

export interface PercentileSummary {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  mean: number;
  min: number;
  max: number;
}

export function equityStatsFromPnls(
  pnls: readonly number[],
  initialBalance: number,
): EquityStats {
  let equity = initialBalance;
  let peak = initialBalance;
  let maxDrawdownAbs = 0;
  let maxDrawdownPct = 0;

  for (const pnl of pnls) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const ddAbs = peak - equity;
    const ddPct = peak > 0 ? ddAbs / peak : 0;
    if (ddAbs > maxDrawdownAbs) maxDrawdownAbs = ddAbs;
    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
  }

  return {
    netProfit: equity - initialBalance,
    finalEquity: equity,
    maxDrawdownAbs,
    maxDrawdownPct,
    ruined: equity <= 0,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function summarize(values: number[]): PercentileSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const mean =
    sorted.length === 0
      ? Number.NaN
      : sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    p5: percentile(sorted, 0.05),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
    mean,
    min: sorted[0] ?? Number.NaN,
    max: sorted[sorted.length - 1] ?? Number.NaN,
  };
}

function shuffleInPlace(xs: number[], rng: () => number): void {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = xs[i]!;
    xs[i] = xs[j]!;
    xs[j] = tmp;
  }
}

function sampleSequence(
  source: readonly number[],
  method: MonteCarloMethod,
  rng: () => number,
): number[] {
  if (method === "shuffle") {
    const copy = [...source];
    shuffleInPlace(copy, rng);
    return copy;
  }
  // bootstrap: sample with replacement
  const out: number[] = [];
  for (let i = 0; i < source.length; i++) {
    out.push(source[Math.floor(rng() * source.length)]!);
  }
  return out;
}

function applyDrop(pnls: number[], dropRate: number, rng: () => number): number[] {
  if (!(dropRate > 0)) return pnls;
  const rate = Math.min(1, Math.max(0, dropRate));
  return pnls.filter(() => rng() >= rate);
}

/**
 * Trade-sequence Monte Carlo for robustness (shuffle / bootstrap).
 * Does not re-simulate bars — stresses the realized trade P&amp;L path.
 */
export function monteCarlo(input: MonteCarloInput): MonteCarloResult {
  if (input.simulations < 1) {
    throw new Error("simulations must be >= 1");
  }
  if (input.initialBalance <= 0) {
    throw new Error("initialBalance must be > 0");
  }
  if (input.tradePnls.length === 0) {
    throw new Error("monteCarlo requires at least one trade");
  }

  const rng = createRng(input.seed ?? 42);
  const original = equityStatsFromPnls(input.tradePnls, input.initialBalance);

  const netProfits: number[] = [];
  const drawdowns: number[] = [];
  let profitable = 0;
  let ruined = 0;
  let worseDd = 0;

  for (let i = 0; i < input.simulations; i++) {
    let seq = sampleSequence(input.tradePnls, input.method, rng);
    seq = applyDrop(seq, input.dropRate ?? 0, rng);
    if (seq.length === 0) {
      // All trades dropped — treat as flat path
      netProfits.push(0);
      drawdowns.push(0);
      continue;
    }
    const stats = equityStatsFromPnls(seq, input.initialBalance);
    netProfits.push(stats.netProfit);
    drawdowns.push(stats.maxDrawdownPct);
    if (stats.netProfit > 0) profitable++;
    if (stats.ruined) ruined++;
    if (stats.maxDrawdownPct > original.maxDrawdownPct) worseDd++;
  }

  return {
    method: input.method,
    simulations: input.simulations,
    tradeCount: input.tradePnls.length,
    original,
    netProfit: summarize(netProfits),
    maxDrawdownPct: summarize(drawdowns),
    probProfit: profitable / input.simulations,
    probRuin: ruined / input.simulations,
    probWorseDrawdownThanOriginal: worseDd / input.simulations,
  };
}
