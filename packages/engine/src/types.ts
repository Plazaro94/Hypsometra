/** Core market and trading types for the Hypsometra engine. */

export interface Bar {
  /** UTC epoch milliseconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Spread in points at the bar (MT5 <SPREAD> column), when the export includes it. */
  spread?: number;
}

export type Side = "long" | "short";

export type OrderKind = "market";

export interface MarketOrderRequest {
  kind: OrderKind;
  side: Side;
  /** Position size in lots (or units — strategy decides the scale). */
  volume: number;
  sl?: number;
  tp?: number;
  comment?: string;
}

export interface Position {
  id: number;
  side: Side;
  volume: number;
  openTime: number;
  openPrice: number;
  sl?: number;
  tp?: number;
  comment?: string;
}

export interface ClosedTrade {
  id: number;
  side: Side;
  volume: number;
  openTime: number;
  openPrice: number;
  closeTime: number;
  closePrice: number;
  /** Gross P&amp;L before commission */
  profit: number;
  commission: number;
  /** profit - commission */
  netProfit: number;
  comment?: string;
  exitReason: "signal" | "sl" | "tp" | "end_of_data";
}

export interface EquityPoint {
  time: number;
  equity: number;
  balance: number;
}

export interface SymbolSpec {
  name: string;
  /** Price increment for one point (e.g. 0.01). */
  point: number;
  /** Monetary value of one point for 1.0 volume. */
  tickValue: number;
  /** Spread in price units (absolute, e.g. 0.30 for XAUUSD). */
  spread: number;
  /** Commission charged once per round-turn trade (open+close), absolute money. */
  commissionPerTrade: number;
}

export interface AccountConfig {
  initialBalance: number;
  currency: string;
}

export interface BacktestConfig {
  symbol: SymbolSpec;
  account: AccountConfig;
  /**
   * If SL and TP are both touchable in the same bar, which wins.
   * `stop` is pessimistic (preferred for robustness research).
   */
  conflictResolution: "stop" | "target";
}

export interface BacktestResult {
  trades: ClosedTrade[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  barsProcessed: number;
}

export interface PerformanceMetrics {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  maxDrawdownAbs: number;
  maxDrawdownPct: number;
  winRate: number | null;
  trades: number;
  winningTrades: number;
  losingTrades: number;
  averageTrade: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  expectancy: number | null;
  sharpe: number | null;
  recoveryFactor: number | null;
  finalBalance: number;
  finalEquity: number;
}
