import type { Strategy } from "./types.js";

export interface SmaCrossParams {
  fastPeriod: number;
  slowPeriod: number;
  volume?: number;
}

function sma(values: number[], period: number, endIndex: number): number | null {
  if (endIndex + 1 < period) return null;
  let sum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += values[i]!;
  }
  return sum / period;
}

/** Classic SMA crossover — fixture strategy to validate the engine. */
export function createSmaCrossStrategy(params: SmaCrossParams): Strategy {
  const volume = params.volume ?? 1;
  const closes: number[] = [];

  return {
    name: `sma_cross_${params.fastPeriod}_${params.slowPeriod}`,
    onInit(bars) {
      closes.length = 0;
      for (const b of bars) closes.push(b.close);
    },
    onBar(bar, ctx) {
      const i = ctx.barIndex;
      const fast = sma(closes, params.fastPeriod, i);
      const slow = sma(closes, params.slowPeriod, i);
      if (fast === null || slow === null || i === 0) return;

      const prevFast = sma(closes, params.fastPeriod, i - 1);
      const prevSlow = sma(closes, params.slowPeriod, i - 1);
      if (prevFast === null || prevSlow === null) return;

      const bullish = prevFast <= prevSlow && fast > slow;
      const bearish = prevFast >= prevSlow && fast < slow;

      if (bullish) {
        if (ctx.position?.side === "long") return;
        return {
          closePosition: ctx.position !== null,
          orders: [
            {
              kind: "market",
              side: "long",
              volume,
              comment: "sma_bullish",
            },
          ],
        };
      }

      if (bearish) {
        if (ctx.position?.side === "short") return;
        return {
          closePosition: ctx.position !== null,
          orders: [
            {
              kind: "market",
              side: "short",
              volume,
              comment: "sma_bearish",
            },
          ],
        };
      }
    },
  };
}
