# @hypsometra/engine

Motor de backtest de Hypsometra (v0).

## Qué hace ya

- Carga OHLC desde CSV (separadores `,` / `;` / tab, fechas MT5, decimales EU)
- Un pase de backtest barra a barra
- Órdenes de mercado, SL/TP intrabar (conflicto SL/TP configurable; por defecto pesimista)
- Spread y comisión round-turn
- Curva de equity + métricas (PF, drawdown, Sharpe no anualizado, expectancy…)
- Estrategia de ejemplo: cruce de SMAs

## Qué no hace aún

- Ticks reales / every-tick
- Multi-posición / pendientes / trailing
- Multi-símbolo
- Optimización (vive en `@hypsometra/opt`)

## Uso rápido

```ts
import {
  parseOhlcCsv,
  runBacktest,
  createSmaCrossStrategy,
} from "@hypsometra/engine";

const bars = parseOhlcCsv(csvText);
const result = runBacktest({
  bars,
  strategy: createSmaCrossStrategy({ fastPeriod: 10, slowPeriod: 30 }),
  config: {
    conflictResolution: "stop",
    account: { initialBalance: 10_000, currency: "USD" },
    symbol: {
      name: "XAUUSD",
      point: 0.01,
      tickValue: 1,
      spread: 0.25,
      commissionPerTrade: 0,
    },
  },
});

console.log(result.metrics);
```

## Tests

```bash
npm run test -w @hypsometra/engine
```
