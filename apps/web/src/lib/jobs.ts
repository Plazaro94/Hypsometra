import type { BacktestConfig } from "@hypsometra/engine";

export function defaultBacktestConfig(symbol: string): BacktestConfig {
  return {
    conflictResolution: "stop",
    account: { initialBalance: 10_000, currency: "USD" },
    symbol: {
      name: symbol,
      point: 1,
      tickValue: 1,
      spread: 0,
      commissionPerTrade: 0,
    },
  };
}

export function parseIntRange(
  spec: string,
  name: string,
): { name: string; kind: "int"; from: number; to: number; step: number } {
  const parts = spec.split(":").map((p) => p.trim());
  if (parts.length !== 3) {
    throw new Error(`Invalid ${name} range: use from:to:step`);
  }
  const from = Number(parts[0]);
  const to = Number(parts[1]);
  const step = Number(parts[2]);
  if (![from, to, step].every((n) => Number.isFinite(n))) {
    throw new Error(`Invalid numeric ${name} range`);
  }
  return { name, kind: "int", from, to, step };
}
