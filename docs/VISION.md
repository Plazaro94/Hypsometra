# Hypsometra — visión de producto

## Promesa

Dar al operador algorítmico un **árbitro** entre el optimizador y el capital real:
walk-forward, Monte Carlo, estrés y auditoría de mesetas (Orometra), con datos
de precio que el usuario controla (CSV / ticks exportados).

## No-objetivos (fase actual)

- Ejecutar EAs `.ex5` sin portar la lógica
- Sustituir el terminal MT5 para trading en vivo
- Generación automática de estrategias tipo StrategyQuant (fuera de alcance v1)

## Roadmap corto

1. **Cimiento monorepo** ← hecho
2. **Engine mínimo** — OHLC CSV → un pase → métricas ← hecho (v0)
3. **Opt + WFO** — grid / genético + walk-forward rolling/anchored ← hecho (v0)
4. **CLI** — lanzar backtest / WFO con CSV exportado de MT5 ← siguiente
5. **Dashboard** — Next.js en Vercel + workers de cómputo
6. **Monte Carlo** — sobre la lista de `trades` del engine
7. **Orometra** (`packages/orometra`) — **aplazado a propósito**
