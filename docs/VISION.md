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
2. **Engine mínimo** — OHLC CSV → un pase → métricas ← hecho
3. **Opt + WFO** — grid / genético + walk-forward ← hecho
4. **Data + CLI** — `MarketDataSource` + ingestión CSV + `hypsometra dataset` ← hecho
5. **CLI WFO / optimize** — jobs sobre dataset id (SMA v1) ← hecho
6. **Monte Carlo** — shuffle / bootstrap sobre trades ← hecho
7. **Dashboard** — Next.js en Vercel + workers ← siguiente
8. **Orometra** — aplazado
9. **Catalog / MT5 bridge** — mismos contratos, más adelante
