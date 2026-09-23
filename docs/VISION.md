# Hypsometra — visión de producto

## Promesa

Dar al operador algorítmico un **árbitro** entre el optimizador y el capital real:
walk-forward, Monte Carlo, estrés y auditoría de mesetas (Orometra), con datos
de precio que el usuario controla (CSV / ticks exportados).

## No-objetivos (fase actual)

- Ejecutar EAs `.ex5` sin portar la lógica
- Sustituir el terminal MT5 para trading en vivo
- Generación automática de estrategias tipo StrategyQuant (fuera de alcance v1)

## Fases

Cada fase se cierra con una prueba verificable, no con "compila".

1. **Sistema de diseño y estudio** ← hecho. `packages/ui` hereda los tokens, la
   tipografía IBM Plex y los nombres de clase de Orometra. Estudio con pestañas
   01 Configuración · 02 Parámetros · 03 Validación · 04 Optimización; ventanas
   walk-forward por calendario (duración, nº de ventanas y % OOS, o manual).
2. **Motor OHLC M1** ← siguiente. Velas M1 como base y temporalidad del gráfico
   construida a partir de ellas; SL/TP/pendientes evaluados con 4 precios por
   minuto como MT5; cuenta con depósito, divisa, apalancamiento, margen y
   stop-out; contrato, spread, comisión y swaps. Almacén de datos columnar.
3. **Port del EA y prueba de paridad** — `ORB_ML Sizing` desde el `.mq5`
   (en `private/`, nunca en git). Puerta de calidad: mismo backtest en MT5 y en
   Hypsometra, comparado operación a operación con el informe HTML de MT5.
4. **Optimizador multinúcleo** — pases en paralelo en procesos locales.
5. **Walk-forward sobre el motor M1** — ventanas por fecha, selección de pases
   hacia OOS, eficiencia walk-forward y curva OOS encadenada.
6. **Resultados** — 05 IS · 06 OOS · 07 gráfico y operaciones · 08 Monte Carlo.
7. **Orometra** como módulo de auditoría dentro del mismo sistema de diseño.
8. **Catálogo de datos / puente MT5** — mismos contratos de `MarketDataSource`.
