import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runBacktest } from "../backtest/runner.js";
import { parseOhlcCsv } from "../data/csv.js";
import { createSmaCrossStrategy } from "../strategy/sma-cross.js";
import type { BacktestConfig, Strategy } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "../../fixtures/sample-ohlc.csv");

const baseConfig: BacktestConfig = {
  conflictResolution: "stop",
  account: { initialBalance: 10_000, currency: "USD" },
  symbol: {
    name: "TEST",
    point: 0.01,
    tickValue: 0.01, // 1 point ($0.01 move * tickValue scaling): simplify — 1.0 volume → $1 per 1.00 price move
    spread: 0,
    commissionPerTrade: 0,
  },
};

describe("runBacktest", () => {
  it("runs SMA cross on the sample fixture and produces metrics", () => {
    // Retune tickValue so 1.0 price move = $1 PnL at volume 1
    const config: BacktestConfig = {
      ...baseConfig,
      symbol: {
        ...baseConfig.symbol,
        point: 1,
        tickValue: 1,
      },
    };

    const bars = parseOhlcCsv(readFileSync(fixture, "utf8"));
    const result = runBacktest({
      bars,
      strategy: createSmaCrossStrategy({ fastPeriod: 3, slowPeriod: 5 }),
      config,
    });

    assert.ok(result.barsProcessed === 20);
    assert.ok(result.trades.length >= 1);
    assert.equal(result.metrics.trades, result.trades.length);
    assert.ok(result.equityCurve.length >= 1);
    assert.ok(Number.isFinite(result.metrics.netProfit));
    assert.equal(
      result.metrics.finalBalance,
      10_000 + result.metrics.netProfit,
    );
  });

  it("honours SL inside a bar before strategy logic", () => {
    const bars = parseOhlcCsv(`time,open,high,low,close,volume
2024-01-01T00:00:00Z,100,100,100,100,1
2024-01-02T00:00:00Z,100,100,100,100,1
2024-01-03T00:00:00Z,100,110,90,105,1
`);

    const strategy: Strategy = {
      name: "open_long_with_sl",
      onBar(_bar, ctx) {
        if (ctx.barIndex === 0) {
          return {
            orders: [
              {
                kind: "market",
                side: "long",
                volume: 1,
                sl: 95,
                tp: 200,
              },
            ],
          };
        }
      },
    };

    const result = runBacktest({
      bars,
      strategy,
      config: {
        ...baseConfig,
        symbol: { ...baseConfig.symbol, point: 1, tickValue: 1, spread: 0 },
      },
    });

    assert.equal(result.trades.length, 1);
    assert.equal(result.trades[0]!.exitReason, "sl");
    assert.equal(result.trades[0]!.closePrice, 95);
    assert.equal(result.trades[0]!.netProfit, -5);
  });
});
