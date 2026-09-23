import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSmaCrossStrategy,
  type BacktestConfig,
  type Bar,
} from "@hypsometra/engine";
import type { ParamMap } from "./types.js";
import { walkForward } from "./walk-forward.js";

function synthBars(n: number): Bar[] {
  const bars: Bar[] = [];
  const start = Date.parse("2020-01-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    const price = 100 + i * 0.05 + Math.sin(i / 8) * 4;
    const close = price;
    bars.push({
      time: start + i * 86_400_000,
      open: close - 0.2,
      high: close + 1,
      low: close - 1,
      close,
      volume: 500,
    });
  }
  return bars;
}

const config: BacktestConfig = {
  conflictResolution: "stop",
  account: { initialBalance: 10_000, currency: "USD" },
  symbol: {
    name: "TEST",
    point: 1,
    tickValue: 1,
    spread: 0,
    commissionPerTrade: 0,
  },
};

describe("walkForward", () => {
  it("runs rolling folds with IS optimize and OOS holdout", () => {
    const bars = synthBars(120);
    const result = walkForward({
      bars,
      config,
      mode: "rolling",
      inSampleBars: 40,
      outOfSampleBars: 20,
      stepBars: 20,
      criterion: "netProfit",
      space: [
        { name: "fast", kind: "int", from: 3, to: 5, step: 1 },
        { name: "slow", kind: "int", from: 10, to: 14, step: 2 },
      ],
      createStrategy: (params: ParamMap) =>
        createSmaCrossStrategy({
          fastPeriod: Number(params["fast"]),
          slowPeriod: Number(params["slow"]),
        }),
      search: { mode: "grid" },
    });

    assert.equal(result.mode, "rolling");
    assert.ok(result.folds.length >= 2);
    for (const fold of result.folds) {
      assert.equal(fold.inSample.end - fold.inSample.start, 40);
      assert.equal(fold.outOfSample.end - fold.outOfSample.start, 20);
      assert.equal(fold.outOfSample.start, fold.inSample.end);
      assert.ok(fold.bestParams["fast"] !== undefined);
      assert.ok(Number.isFinite(fold.outOfSampleMetrics.netProfit));
    }
    assert.ok(Number.isFinite(result.combinedOosNetProfit));
    assert.equal(
      result.positiveOosFolds,
      result.folds.filter((f) => f.outOfSampleScore > 0).length,
    );
  });

  it("anchored mode keeps IS start at zero", () => {
    const bars = synthBars(100);
    const result = walkForward({
      bars,
      config,
      mode: "anchored",
      inSampleBars: 40,
      outOfSampleBars: 15,
      stepBars: 15,
      criterion: "netProfit",
      space: [
        { name: "fast", kind: "int", from: 3, to: 4, step: 1 },
        { name: "slow", kind: "int", from: 10, to: 12, step: 2 },
      ],
      createStrategy: (params: ParamMap) =>
        createSmaCrossStrategy({
          fastPeriod: Number(params["fast"]),
          slowPeriod: Number(params["slow"]),
        }),
      search: { mode: "grid" },
    });

    assert.equal(result.mode, "anchored");
    assert.ok(result.folds.length >= 2);
    for (const fold of result.folds) {
      assert.equal(fold.inSample.start, 0);
      assert.ok(fold.inSample.end >= 40);
    }
    assert.ok(result.folds[1]!.inSample.end > result.folds[0]!.inSample.end);
  });
});
