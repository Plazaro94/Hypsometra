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
3. **Opt + WFO** — genético/búsqueda + ventanas walk-forward ← siguiente
4. **Dashboard** — Next.js en Vercel + workers de cómputo
5. **Monte Carlo** — cuando el engine emita lista de operaciones (ya emite `trades`)
6. **Orometra** (`packages/orometra`) — **aplazado a propósito**. El paquete queda reservado; se integrará cuando el pipeline de backtest/opt ya produzca resultados auditables. No bloquea el desarrollo del motor.
