import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createSmaCrossStrategy,
  runBacktest,
  type BacktestConfig,
  type PerformanceMetrics,
} from "@hypsometra/engine";
import { CsvLocalSource, LocalDatasetStore } from "@hypsometra/data";
import {
  optimize,
  walkForward,
  monteCarlo,
  type Criterion,
  type MonteCarloMethod,
  type ParamMap,
} from "@hypsometra/opt";
import { buildSmaSpace } from "./space.js";

export interface JobFlags {
  dataset?: string;
  store?: string;
  search?: string;
  criterion?: string;
  fast?: string;
  slow?: string;
  balance?: string;
  point?: string;
  tickValue?: string;
  spread?: string;
  commission?: string;
  out?: string;
  /** optimize only */
  population?: string;
  generations?: string;
  seed?: string;
  /** wfo only */
  wf?: string;
  is?: string;
  oos?: string;
  step?: string;
  /** montecarlo only */
  sims?: string;
  method?: string;
  dropRate?: string;
}

const METRIC_KEYS = new Set<string>([
  "netProfit",
  "grossProfit",
  "grossLoss",
  "profitFactor",
  "maxDrawdownAbs",
  "maxDrawdownPct",
  "winRate",
  "trades",
  "winningTrades",
  "losingTrades",
  "averageTrade",
  "averageWin",
  "averageLoss",
  "expectancy",
  "sharpe",
  "recoveryFactor",
  "finalBalance",
  "finalEquity",
]);

function num(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${raw}`);
  return n;
}

function resolveCriterion(raw: string | undefined): Criterion {
  const key = raw ?? "netProfit";
  if (!METRIC_KEYS.has(key)) {
    throw new Error(
      `Unknown criterion "${key}". Use a PerformanceMetrics key (e.g. netProfit, sharpe, profitFactor).`,
    );
  }
  return key as keyof PerformanceMetrics;
}

function buildConfig(flags: JobFlags, symbolName: string): BacktestConfig {
  return {
    conflictResolution: "stop",
    account: {
      initialBalance: num(flags.balance, 10_000),
      currency: "USD",
    },
    symbol: {
      name: symbolName,
      point: num(flags.point, 1),
      tickValue: num(flags.tickValue, 1),
      spread: num(flags.spread, 0),
      commissionPerTrade: num(flags.commission, 0),
    },
  };
}

function createStrategyFromParams(params: ParamMap) {
  const fast = Number(params["fast"]);
  const slow = Number(params["slow"]);
  if (!(fast < slow)) {
    // Still runnable; engine will trade — genetic/grid should prefer valid pairs via score
  }
  return createSmaCrossStrategy({
    fastPeriod: fast,
    slowPeriod: slow,
  });
}

async function loadJobContext(flags: JobFlags) {
  if (!flags.dataset) throw new Error("--dataset is required");
  if (!flags.fast || !flags.slow) {
    throw new Error(
      "SMA space required: --fast from:to:step and --slow from:to:step",
    );
  }
  const storeDir = flags.store;
  const store = new LocalDatasetStore(storeDir);
  const meta = store.readMeta(flags.dataset);
  if (!meta) throw new Error(`Unknown dataset: ${flags.dataset}`);

  const bars = await new CsvLocalSource(storeDir).load({
    datasetId: flags.dataset,
  });
  const space = buildSmaSpace(flags.fast, flags.slow);
  const config = buildConfig(flags, meta.symbol);
  const criterion = resolveCriterion(flags.criterion);
  const searchMode = (flags.search ?? "grid") as "grid" | "genetic";
  if (searchMode !== "grid" && searchMode !== "genetic") {
    throw new Error('--search must be "grid" or "genetic"');
  }

  return { meta, bars, space, config, criterion, searchMode, storeDir };
}

function writeOut(path: string | undefined, payload: unknown): void {
  if (!path) return;
  const abs = resolve(path);
  writeFileSync(abs, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote report: ${abs}`);
}

export async function cmdOptimize(flags: JobFlags): Promise<void> {
  const ctx = await loadJobContext(flags);
  const result = optimize({
    bars: ctx.bars,
    config: ctx.config,
    space: ctx.space,
    criterion: ctx.criterion,
    mode: ctx.searchMode,
    createStrategy: createStrategyFromParams,
    ...(ctx.searchMode === "genetic"
      ? {
          genetic: {
            population: Math.floor(num(flags.population, 20)),
            generations: Math.floor(num(flags.generations, 10)),
            seed: Math.floor(num(flags.seed, 42)),
          },
        }
      : {}),
  });

  console.log(`Optimize (${result.mode}) on ${ctx.meta.id}`);
  console.log(`  bars:       ${ctx.bars.length}`);
  console.log(`  evaluated:  ${result.evaluated}`);
  console.log(`  best score: ${result.best.score}`);
  console.log(`  best params:${JSON.stringify(result.best.params)}`);
  console.log(`  netProfit:  ${result.best.metrics.netProfit}`);
  console.log(`  trades:     ${result.best.metrics.trades}`);
  console.log(`  maxDD%:     ${(result.best.metrics.maxDrawdownPct * 100).toFixed(2)}%`);

  writeOut(flags.out, {
    kind: "optimize",
    dataset: ctx.meta,
    result: {
      mode: result.mode,
      evaluated: result.evaluated,
      best: result.best,
      top: result.passes.slice(0, 20),
    },
  });
}

export async function cmdWfo(flags: JobFlags): Promise<void> {
  const ctx = await loadJobContext(flags);
  const wfMode = (flags.wf ?? "rolling") as "rolling" | "anchored";
  if (wfMode !== "rolling" && wfMode !== "anchored") {
    throw new Error('--wf must be "rolling" or "anchored"');
  }
  const inSampleBars = Math.floor(num(flags.is, 0));
  const outOfSampleBars = Math.floor(num(flags.oos, 0));
  if (inSampleBars < 1 || outOfSampleBars < 1) {
    throw new Error("--is and --oos (bar counts) are required and must be >= 1");
  }
  const stepBars =
    flags.step !== undefined
      ? Math.floor(num(flags.step, outOfSampleBars))
      : outOfSampleBars;

  const result = walkForward({
    bars: ctx.bars,
    config: ctx.config,
    space: ctx.space,
    criterion: ctx.criterion,
    mode: wfMode,
    inSampleBars,
    outOfSampleBars,
    stepBars,
    createStrategy: createStrategyFromParams,
    search: {
      mode: ctx.searchMode,
      ...(ctx.searchMode === "genetic"
        ? {
            genetic: {
              population: Math.floor(num(flags.population, 16)),
              generations: Math.floor(num(flags.generations, 8)),
              seed: Math.floor(num(flags.seed, 42)),
            },
          }
        : {}),
    },
  });

  console.log(`Walk-forward (${result.mode}) on ${ctx.meta.id}`);
  console.log(`  bars:          ${ctx.bars.length}`);
  console.log(`  folds:         ${result.folds.length}`);
  console.log(`  OOS net sum:   ${result.combinedOosNetProfit}`);
  console.log(`  mean OOS score:${result.meanOosScore}`);
  console.log(`  positive OOS:  ${result.positiveOosFolds}/${result.folds.length}`);
  for (const fold of result.folds) {
    console.log(
      `  fold ${fold.index}: IS[${fold.inSample.start},${fold.inSample.end}) → OOS[${fold.outOfSample.start},${fold.outOfSample.end})  params=${JSON.stringify(fold.bestParams)}  oosNet=${fold.outOfSampleMetrics.netProfit}`,
    );
  }

  writeOut(flags.out, {
    kind: "walk-forward",
    dataset: ctx.meta,
    result,
  });
}

export async function cmdMonteCarlo(flags: JobFlags): Promise<void> {
  if (!flags.dataset) throw new Error("--dataset is required");
  if (!flags.fast || !flags.slow) {
    throw new Error(
      "Fixed SMA periods required: --fast <n> --slow <n> (single values, not ranges)",
    );
  }
  const fast = Number(flags.fast);
  const slow = Number(flags.slow);
  if (!Number.isFinite(fast) || !Number.isFinite(slow) || fast < 1 || slow < 1) {
    throw new Error("--fast and --slow must be positive numbers");
  }
  if (String(flags.fast).includes(":") || String(flags.slow).includes(":")) {
    throw new Error(
      "montecarlo uses fixed periods (--fast 10 --slow 30), not ranges. Run optimize/wfo first to choose them.",
    );
  }

  const storeDir = flags.store;
  const store = new LocalDatasetStore(storeDir);
  const meta = store.readMeta(flags.dataset);
  if (!meta) throw new Error(`Unknown dataset: ${flags.dataset}`);

  const bars = await new CsvLocalSource(storeDir).load({
    datasetId: flags.dataset,
  });
  const config = buildConfig(flags, meta.symbol);
  const backtest = runBacktest({
    bars,
    config,
    strategy: createSmaCrossStrategy({
      fastPeriod: Math.floor(fast),
      slowPeriod: Math.floor(slow),
    }),
  });

  if (backtest.trades.length === 0) {
    throw new Error("Backtest produced zero trades — nothing to stress-test");
  }

  const method = (flags.method ?? "shuffle") as MonteCarloMethod;
  if (method !== "shuffle" && method !== "bootstrap") {
    throw new Error('--method must be "shuffle" or "bootstrap"');
  }

  const result = monteCarlo({
    tradePnls: backtest.trades.map((t) => t.netProfit),
    initialBalance: config.account.initialBalance,
    simulations: Math.floor(num(flags.sims, 1_000)),
    method,
    seed: Math.floor(num(flags.seed, 42)),
    ...(flags.dropRate !== undefined
      ? { dropRate: num(flags.dropRate, 0) }
      : {}),
  });

  console.log(`Monte Carlo (${result.method}) on ${meta.id}`);
  console.log(`  params:       fast=${Math.floor(fast)} slow=${Math.floor(slow)}`);
  console.log(`  trades:       ${result.tradeCount}`);
  console.log(`  simulations:  ${result.simulations}`);
  console.log(`  original net: ${result.original.netProfit}`);
  console.log(`  original DD%: ${(result.original.maxDrawdownPct * 100).toFixed(2)}%`);
  console.log(
    `  net p5/p50/p95: ${result.netProfit.p5.toFixed(2)} / ${result.netProfit.p50.toFixed(2)} / ${result.netProfit.p95.toFixed(2)}`,
  );
  console.log(
    `  DD%  p5/p50/p95: ${(result.maxDrawdownPct.p5 * 100).toFixed(2)}% / ${(result.maxDrawdownPct.p50 * 100).toFixed(2)}% / ${(result.maxDrawdownPct.p95 * 100).toFixed(2)}%`,
  );
  console.log(`  P(profit):    ${(result.probProfit * 100).toFixed(1)}%`);
  console.log(`  P(ruin):      ${(result.probRuin * 100).toFixed(1)}%`);
  console.log(
    `  P(worse DD):  ${(result.probWorseDrawdownThanOriginal * 100).toFixed(1)}%`,
  );

  writeOut(flags.out, {
    kind: "montecarlo",
    dataset: meta,
    params: { fast: Math.floor(fast), slow: Math.floor(slow) },
    backtestMetrics: backtest.metrics,
    result,
  });
}
