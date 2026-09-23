export type {
  AccountConfig,
  BacktestConfig,
  BacktestResult,
  Bar,
  ClosedTrade,
  EquityPoint,
  MarketOrderRequest,
  PerformanceMetrics,
  Position,
  Side,
  SymbolSpec,
} from "./types.js";

export { parseOhlcCsv, loadOhlcCsvFile } from "./data/csv.js";
export type { CsvLoadOptions } from "./data/csv.js";

export { Account } from "./account/account.js";
export {
  marketFillPrice,
  exitFillPrice,
  resolveIntrabarExit,
  applyIntrabarExits,
} from "./broker/execution.js";

export type { Strategy, StrategyContext } from "./strategy/types.js";
export {
  createSmaCrossStrategy,
  type SmaCrossParams,
} from "./strategy/sma-cross.js";

export { runBacktest, type RunBacktestInput } from "./backtest/runner.js";
export { computeMetrics } from "./metrics/compute.js";
