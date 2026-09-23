import type { ClosedTrade, EquityPoint, PerformanceMetrics } from "../types.js";

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdSample(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v =
    xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function maxDrawdown(equity: EquityPoint[]): {
  abs: number;
  pct: number;
} {
  let peak = -Infinity;
  let maxAbs = 0;
  let maxPct = 0;
  for (const p of equity) {
    if (p.equity > peak) peak = p.equity;
    const ddAbs = peak - p.equity;
    const ddPct = peak > 0 ? ddAbs / peak : 0;
    if (ddAbs > maxAbs) maxAbs = ddAbs;
    if (ddPct > maxPct) maxPct = ddPct;
  }
  return { abs: maxAbs, pct: maxPct };
}

/** Equity-bar returns Sharpe (non-annualized). Null if undefined. */
function sharpeFromEquity(equity: EquityPoint[]): number | null {
  if (equity.length < 3) return null;
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1]!.equity;
    const cur = equity[i]!.equity;
    if (prev === 0) continue;
    rets.push((cur - prev) / prev);
  }
  if (rets.length < 2) return null;
  const s = stdSample(rets);
  if (s === 0) return 0;
  return mean(rets) / s;
}

export function computeMetrics(
  trades: readonly ClosedTrade[],
  equityCurve: readonly EquityPoint[],
  finalBalance: number,
  finalEquity: number,
): PerformanceMetrics {
  const nets = trades.map((t) => t.netProfit);
  const wins = nets.filter((x) => x > 0);
  const losses = nets.filter((x) => x < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));
  const netProfit = nets.reduce((a, b) => a + b, 0);
  const dd = maxDrawdown([...equityCurve]);

  const profitFactor =
    grossLossAbs === 0
      ? grossProfit > 0
        ? Infinity
        : null
      : grossProfit / grossLossAbs;

  const averageTrade = nets.length ? netProfit / nets.length : null;
  const averageWin = wins.length ? mean(wins) : null;
  const averageLoss = losses.length ? mean(losses) : null;
  const winRate = nets.length ? wins.length / nets.length : null;

  let expectancy: number | null = null;
  if (winRate !== null && averageWin !== null && averageLoss !== null) {
    expectancy = winRate * averageWin + (1 - winRate) * averageLoss;
  } else if (averageTrade !== null) {
    expectancy = averageTrade;
  }

  const recoveryFactor =
    dd.abs > 0 ? netProfit / dd.abs : netProfit > 0 ? Infinity : null;

  const sharpe = sharpeFromEquity([...equityCurve]);

  return {
    netProfit,
    grossProfit,
    grossLoss: -grossLossAbs,
    profitFactor:
      profitFactor === Infinity
        ? Number.POSITIVE_INFINITY
        : profitFactor,
    maxDrawdownAbs: dd.abs,
    maxDrawdownPct: dd.pct,
    winRate,
    trades: nets.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    averageTrade,
    averageWin,
    averageLoss,
    expectancy,
    sharpe,
    recoveryFactor:
      recoveryFactor === Infinity
        ? Number.POSITIVE_INFINITY
        : recoveryFactor,
    finalBalance,
    finalEquity,
  };
}
