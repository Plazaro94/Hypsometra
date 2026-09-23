import type { Account } from "../account/account.js";
import type { Bar, Side, SymbolSpec } from "../types.js";

/** Fill price for a market order at bar close, including spread. */
export function marketFillPrice(
  side: Side,
  close: number,
  symbol: SymbolSpec,
): number {
  // Long enters at ask (worse); short enters at bid (worse).
  const half = symbol.spread / 2;
  return side === "long" ? close + half : close - half;
}

/** Exit fill: long sells at bid; short covers at ask. */
export function exitFillPrice(
  side: Side,
  price: number,
  symbol: SymbolSpec,
): number {
  const half = symbol.spread / 2;
  return side === "long" ? price - half : price + half;
}

export type IntrabarHit = "sl" | "tp" | null;

/**
 * Check whether SL/TP are touched inside an OHLC bar.
 * Conservative default: if both are touchable, `prefer` wins.
 */
export function resolveIntrabarExit(
  side: Side,
  bar: Bar,
  sl: number | undefined,
  tp: number | undefined,
  prefer: "stop" | "target",
): IntrabarHit {
  const stopHit =
    sl !== undefined &&
    (side === "long" ? bar.low <= sl : bar.high >= sl);
  const targetHit =
    tp !== undefined &&
    (side === "long" ? bar.high >= tp : bar.low <= tp);

  if (stopHit && targetHit) {
    return prefer === "stop" ? "sl" : "tp";
  }
  if (stopHit) return "sl";
  if (targetHit) return "tp";
  return null;
}

export function applyIntrabarExits(
  account: Account,
  bar: Bar,
  symbol: SymbolSpec,
  prefer: "stop" | "target",
): void {
  const pos = account.position;
  if (!pos) return;

  const hit = resolveIntrabarExit(pos.side, bar, pos.sl, pos.tp, prefer);
  if (!hit) return;

  const raw = hit === "sl" ? pos.sl! : pos.tp!;
  const price = exitFillPrice(pos.side, raw, symbol);
  account.closePosition({
    time: bar.time,
    price,
    symbol,
    exitReason: hit,
  });
}
