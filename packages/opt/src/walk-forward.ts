import {
  runBacktest,
  type BacktestConfig,
  type Bar,
  type Strategy,
} from "@hypsometra/engine";
import { scoreMetrics } from "./criterion.js";
import { optimize, type OptimizeInput } from "./optimize.js";
import type {
  Criterion,
  ParamDef,
  ParamMap,
  WalkForwardFold,
  WalkForwardMode,
  WalkForwardResult,
} from "./types.js";

export interface WalkForwardInput {
  bars: readonly Bar[];
  config: BacktestConfig;
  space: ParamDef[];
  createStrategy: (params: ParamMap) => Strategy;
  criterion: Criterion;
  mode: WalkForwardMode;
  /** Number of bars used to optimize (in-sample). */
  inSampleBars: number;
  /** Number of bars used to validate (out-of-sample). */
  outOfSampleBars: number;
  /**
   * Bars to advance the window each fold.
   * Defaults to `outOfSampleBars` (non-overlapping OOS).
   */
  stepBars?: number;
  /** Search settings reused on each IS window. */
  search: {
    mode: "grid" | "genetic";
    maxGridSize?: number;
    genetic?: OptimizeInput["genetic"];
  };
}

function sliceBars(bars: readonly Bar[], start: number, end: number): Bar[] {
  return bars.slice(start, end) as Bar[];
}

/**
 * Walk-forward optimization — the capability MT5 lacks natively.
 *
 * - `rolling`: IS window slides forward (fixed length).
 * - `anchored`: IS start stays at 0; IS end grows with each fold.
 */
export function walkForward(input: WalkForwardInput): WalkForwardResult {
  const {
    bars,
    inSampleBars,
    outOfSampleBars,
    mode,
  } = input;
  const step = input.stepBars ?? outOfSampleBars;

  if (inSampleBars < 1 || outOfSampleBars < 1) {
    throw new Error("inSampleBars and outOfSampleBars must be >= 1");
  }
  if (step < 1) {
    throw new Error("stepBars must be >= 1");
  }
  if (bars.length < inSampleBars + outOfSampleBars) {
    throw new Error(
      `Need at least ${inSampleBars + outOfSampleBars} bars, got ${bars.length}`,
    );
  }

  const folds: WalkForwardFold[] = [];
  let foldIndex = 0;

  if (mode === "rolling") {
    for (
      let isStart = 0;
      isStart + inSampleBars + outOfSampleBars <= bars.length;
      isStart += step
    ) {
      const isEnd = isStart + inSampleBars;
      const oosEnd = isEnd + outOfSampleBars;
      folds.push(
        runFold(input, foldIndex++, isStart, isEnd, isEnd, oosEnd),
      );
    }
  } else {
    // anchored: IS always starts at 0; first IS ends at inSampleBars
    for (
      let isEnd = inSampleBars;
      isEnd + outOfSampleBars <= bars.length;
      isEnd += step
    ) {
      const oosStart = isEnd;
      const oosEnd = isEnd + outOfSampleBars;
      folds.push(runFold(input, foldIndex++, 0, isEnd, oosStart, oosEnd));
    }
  }

  if (folds.length === 0) {
    throw new Error("Walk-forward produced zero folds — check window sizes");
  }

  const combinedOosNetProfit = folds.reduce(
    (s, f) => s + f.outOfSampleMetrics.netProfit,
    0,
  );
  const meanOosScore =
    folds.reduce((s, f) => s + f.outOfSampleScore, 0) / folds.length;
  const positiveOosFolds = folds.filter((f) => f.outOfSampleScore > 0).length;

  return {
    mode,
    folds,
    combinedOosNetProfit,
    meanOosScore,
    positiveOosFolds,
  };
}

function runFold(
  input: WalkForwardInput,
  index: number,
  isStart: number,
  isEnd: number,
  oosStart: number,
  oosEnd: number,
): WalkForwardFold {
  const isBars = sliceBars(input.bars, isStart, isEnd);
  const oosBars = sliceBars(input.bars, oosStart, oosEnd);

  const opt = optimize({
    bars: isBars,
    config: input.config,
    space: input.space,
    createStrategy: input.createStrategy,
    criterion: input.criterion,
    mode: input.search.mode,
    ...(input.search.maxGridSize !== undefined
      ? { maxGridSize: input.search.maxGridSize }
      : {}),
    ...(input.search.genetic !== undefined
      ? { genetic: input.search.genetic }
      : {}),
  });

  const oosResult = runBacktest({
    bars: oosBars,
    strategy: input.createStrategy(opt.best.params),
    config: input.config,
  });

  return {
    index,
    inSample: { start: isStart, end: isEnd },
    outOfSample: { start: oosStart, end: oosEnd },
    bestParams: opt.best.params,
    inSampleScore: opt.best.score,
    inSampleMetrics: opt.best.metrics,
    outOfSampleMetrics: oosResult.metrics,
    outOfSampleScore: scoreMetrics(oosResult.metrics, input.criterion),
  };
}
