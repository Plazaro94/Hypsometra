import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { equityStatsFromPnls, monteCarlo } from "./monte-carlo.js";

describe("equityStatsFromPnls", () => {
  it("tracks profit and drawdown", () => {
    const stats = equityStatsFromPnls([10, -5, 20], 100);
    assert.equal(stats.netProfit, 25);
    assert.equal(stats.finalEquity, 125);
    assert.ok(stats.maxDrawdownAbs >= 5);
  });
});

describe("monteCarlo", () => {
  it("shuffle keeps the same trade set (order only)", () => {
    const pnls = [1, 2, 3, -1, -2, 5, 4, -3];
    const result = monteCarlo({
      tradePnls: pnls,
      initialBalance: 1_000,
      simulations: 200,
      method: "shuffle",
      seed: 1,
    });
    assert.equal(result.method, "shuffle");
    assert.equal(result.tradeCount, pnls.length);
    // Shuffle cannot change total net profit
    assert.equal(result.original.netProfit, pnls.reduce((a, b) => a + b, 0));
    assert.ok(result.netProfit.p50 === result.original.netProfit);
    assert.ok(result.netProfit.min === result.original.netProfit);
    assert.ok(result.maxDrawdownPct.max >= result.original.maxDrawdownPct);
  });

  it("bootstrap varies net profit", () => {
    const pnls = [10, -8, 12, -5, 7, -9, 15];
    const result = monteCarlo({
      tradePnls: pnls,
      initialBalance: 1_000,
      simulations: 500,
      method: "bootstrap",
      seed: 99,
    });
    assert.equal(result.method, "bootstrap");
    assert.ok(result.netProfit.max > result.netProfit.min);
    assert.ok(result.probProfit >= 0 && result.probProfit <= 1);
    assert.ok(result.probRuin >= 0 && result.probRuin <= 1);
  });

  it("rejects empty trade lists", () => {
    assert.throws(() =>
      monteCarlo({
        tradePnls: [],
        initialBalance: 1000,
        simulations: 10,
        method: "shuffle",
      }),
    );
  });
});
