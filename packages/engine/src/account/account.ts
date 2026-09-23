import type {
  AccountConfig,
  ClosedTrade,
  EquityPoint,
  Position,
  Side,
  SymbolSpec,
} from "../types.js";

export class Account {
  balance: number;
  readonly currency: string;
  readonly equityCurve: EquityPoint[] = [];
  readonly trades: ClosedTrade[] = [];
  position: Position | null = null;
  private nextId = 1;

  constructor(config: AccountConfig) {
    this.balance = config.initialBalance;
    this.currency = config.currency;
  }

  markEquity(time: number, unrealized: number): void {
    this.equityCurve.push({
      time,
      balance: this.balance,
      equity: this.balance + unrealized,
    });
  }

  openPosition(input: {
    side: Side;
    volume: number;
    time: number;
    price: number;
    sl?: number;
    tp?: number;
    comment?: string;
  }): Position {
    if (this.position) {
      throw new Error("Only one open position is supported in v0");
    }
    const position: Position = {
      id: this.nextId++,
      side: input.side,
      volume: input.volume,
      openTime: input.time,
      openPrice: input.price,
      ...(input.sl !== undefined ? { sl: input.sl } : {}),
      ...(input.tp !== undefined ? { tp: input.tp } : {}),
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    };
    this.position = position;
    return position;
  }

  closePosition(input: {
    time: number;
    price: number;
    symbol: SymbolSpec;
    exitReason: ClosedTrade["exitReason"];
  }): ClosedTrade {
    const pos = this.position;
    if (!pos) {
      throw new Error("No open position to close");
    }

    const direction = pos.side === "long" ? 1 : -1;
    const points = (input.price - pos.openPrice) / input.symbol.point;
    const profit =
      direction * points * input.symbol.tickValue * pos.volume;
    const commission = input.symbol.commissionPerTrade;
    const netProfit = profit - commission;

    const trade: ClosedTrade = {
      id: pos.id,
      side: pos.side,
      volume: pos.volume,
      openTime: pos.openTime,
      openPrice: pos.openPrice,
      closeTime: input.time,
      closePrice: input.price,
      profit,
      commission,
      netProfit,
      exitReason: input.exitReason,
      ...(pos.comment !== undefined ? { comment: pos.comment } : {}),
    };

    this.balance += netProfit;
    this.trades.push(trade);
    this.position = null;
    return trade;
  }

  unrealizedPnL(price: number, symbol: SymbolSpec): number {
    const pos = this.position;
    if (!pos) return 0;
    const direction = pos.side === "long" ? 1 : -1;
    const points = (price - pos.openPrice) / symbol.point;
    return direction * points * symbol.tickValue * pos.volume;
  }
}
