import { Account } from "../account/account.js";
import {
  applyIntrabarExits,
  exitFillPrice,
  marketFillPrice,
} from "../broker/execution.js";
import { computeMetrics } from "../metrics/compute.js";
import type { Strategy } from "../strategy/types.js";
import type {
  BacktestConfig,
  BacktestResult,
  Bar,
  MarketOrderRequest,
} from "../types.js";

export interface RunBacktestInput {
  bars: readonly Bar[];
  strategy: Strategy;
  config: BacktestConfig;
}

function executeOrders(
  account: Account,
  bar: Bar,
  orders: MarketOrderRequest[],
  config: BacktestConfig,
): void {
  for (const order of orders) {
    if (account.position) {
      throw new Error(
        "Cannot open a new position while one is already open",
      );
    }
    const price = marketFillPrice(
      order.side,
      bar.close,
      config.symbol,
    );
    account.openPosition({
      side: order.side,
      volume: order.volume,
      time: bar.time,
      price,
      ...(order.sl !== undefined ? { sl: order.sl } : {}),
      ...(order.tp !== undefined ? { tp: order.tp } : {}),
      ...(order.comment !== undefined ? { comment: order.comment } : {}),
    });
  }
}

/**
 * Run a single backtest pass on OHLC bars.
 * Model: SL/TP checked on each bar's range; strategy decisions fill at close.
 */
export function runBacktest(input: RunBacktestInput): BacktestResult {
  const { bars, strategy, config } = input;
  if (bars.length === 0) {
    throw new Error("No bars to backtest");
  }

  const account = new Account(config.account);
  strategy.onInit?.(bars);

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!;

    // 1) Intrabar protective exits first (path-dependent within OHLC uncertainty)
    applyIntrabarExits(
      account,
      bar,
      config.symbol,
      config.conflictResolution,
    );

    const unrealized = account.unrealizedPnL(bar.close, config.symbol);
    const equity = account.balance + unrealized;

    const decision = strategy.onBar(bar, {
      barIndex: i,
      bars,
      position: account.position,
      balance: account.balance,
      equity,
    });

    if (decision?.closePosition && account.position) {
      const side = account.position.side;
      const price = exitFillPrice(side, bar.close, config.symbol);
      account.closePosition({
        time: bar.time,
        price,
        symbol: config.symbol,
        exitReason: "signal",
      });
    }

    if (decision?.orders?.length) {
      executeOrders(account, bar, decision.orders, config);
    }

    account.markEquity(
      bar.time,
      account.unrealizedPnL(bar.close, config.symbol),
    );
  }

  // Flatten at end of data
  if (account.position) {
    const last = bars[bars.length - 1]!;
    const price = exitFillPrice(
      account.position.side,
      last.close,
      config.symbol,
    );
    account.closePosition({
      time: last.time,
      price,
      symbol: config.symbol,
      exitReason: "end_of_data",
    });
    account.markEquity(last.time, 0);
  }

  strategy.onEnd?.(account);

  const finalEquity =
    account.equityCurve[account.equityCurve.length - 1]?.equity ??
    account.balance;

  return {
    trades: account.trades,
    equityCurve: account.equityCurve,
    barsProcessed: bars.length,
    metrics: computeMetrics(
      account.trades,
      account.equityCurve,
      account.balance,
      finalEquity,
    ),
  };
}
