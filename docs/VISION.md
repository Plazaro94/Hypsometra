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
1b. **Importación desde MT5** ← hecho. `packages/mt5` lee (y escribe) el `.set`,
   la especificación del símbolo exportada y la configuración del probador
   (Ctrl+C), con detección de UTF-16. `tools/mt5/HypsometraExporter.mq5` exporta
   M1 con spread, especificación y cuenta en un paso. Periodo no visto reservado
   y bloqueado, fuera de todas las ventanas. Ayuda contextual en cada dato que no
   se puede elegir de una lista.
2. **Motor OHLC M1** ← siguiente. Velas M1 como base y temporalidad del gráfico
   construida a partir de ellas; SL/TP/pendientes evaluados con 4 precios por
   minuto como MT5; cuenta con depósito, divisa, apalancamiento, margen y
   stop-out; contrato, spread (por vela o fijo), comisión, swaps con día triple y
   sesiones de trading de la especificación. Almacén de datos columnar. Diario de
   eventos (órdenes, rechazos, mensajes del EA) como el del probador de MT5.
3. **Port del EA y prueba de paridad** — `ORB_ML Sizing` desde el `.mq5`
   (en `private/`, nunca en git). Puerta de calidad: mismo backtest en MT5 y en
   Hypsometra, comparado operación a operación con el informe HTML de MT5.
4. **Optimizador multinúcleo** — pases en paralelo en procesos locales.
5. **Walk-forward sobre el motor M1** — ventanas por fecha, selección de pases
   hacia OOS, eficiencia walk-forward y curva OOS encadenada.
6. **Resultados** — 05 IS · 06 OOS · 07 gráfico y operaciones · 08 Monte Carlo.
7. **Orometra** como módulo de auditoría dentro del mismo sistema de diseño.
   Trazabilidad por manifiesto de ejecución (huella del CSV y de la especificación,
   versión del EA, parámetros, ventanas, semilla): Hypsometra optimiza → Orometra
   elige la meseta y su representante → Hypsometra abre el periodo no visto una
   vez → Orometra valida. Con curvas y operaciones por pase, Orometra podrá
   calcular el PBO real (CSCV), que con los exports de MT5 no es posible.
8. **Catálogo de datos / puente MT5** — mismos contratos de `MarketDataSource`.
