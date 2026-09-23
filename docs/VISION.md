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

1. **Cimiento monorepo** ← (este commit)
2. **Engine mínimo** — OHLC CSV → un pase → métricas
3. **Opt + WFO** — genético/búsqueda + ventanas walk-forward
4. **Port Orometra** → `packages/orometra`
5. **Dashboard** — Next.js en Vercel + workers de cómputo
6. **Monte Carlo** — cuando el engine emita lista de operaciones
