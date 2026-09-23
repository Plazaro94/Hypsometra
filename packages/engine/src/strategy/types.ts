import type { Account } from "../account/account.js";
import type { Bar, MarketOrderRequest, Position } from "../types.js";

export interface StrategyContext {
  barIndex: number;
  bars: readonly Bar[];
  position: Position | null;
  balance: number;
  equity: number;
}

export interface Strategy {
  readonly name: string;
  onInit?(bars: readonly Bar[]): void;
  /**
   * Called once per bar after intrabar SL/TP have been processed.
   * Return orders to open/close. Closing is done by returning a market
   * order on the opposite side or via `closePosition: true`.
   */
  onBar(
    bar: Bar,
    ctx: StrategyContext,
  ): {
    closePosition?: boolean;
    orders?: MarketOrderRequest[];
  } | void;
  onEnd?(account: Account): void;
}
