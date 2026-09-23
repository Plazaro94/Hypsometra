# Hypsometra

**Mide el relieve de tu estrategia, no la altura de un pico.**

Hypsometra es un laboratorio de investigación cuantitativa para Expert Advisors y sistemas algorítmicos. No sustituye a MetaTrader 5 como terminal de trading: **supera lo que MT5 no hace bien en robustez** — walk-forward, Monte Carlo, estrés de parámetros — y decide si hay cordillera o solo una roca suelta.

El nombre viene de la *hipsometría*, la medición de altitudes del relieve. Donde el optimizador celebra una cima, Hypsometra pregunta cuánto terreno alto y estable hay alrededor — y si ese terreno sobrevive fuera de muestra.

## Qué es (y qué no es)

| Es | No es |
|----|--------|
| Motor de backtest + optimización propios | Un clon bit-a-bit del Strategy Tester de MT5 |
| Walk-forward, Monte Carlo, auditoría de mesetas | Un generador mágico de EAs “rentables” |
| Árbitro entre el optimizador y el capital real | Ejecución de binarios `.ex5` opacos sin portar la lógica |

## Arquitectura (monorepo)

```
Hypsometra/
├── apps/web              Dashboard (Vercel)
├── packages/engine       Backtest, ticks, costes, cuenta
├── packages/opt          Optimización, WFO, Monte Carlo
├── packages/orometra     Auditoría de mesetas y evidencia
└── workers               Cómputo pesado (no serverless)
```

### Orometra

[Orometra](https://github.com/Plazaro94/Orometra) es el módulo de **auditoría post-optimización**: umbrales absolutos, vecindad, mesetas, representante maximin y calificación de evidencia. En Hypsometra deja de ser una app aislada y pasa a ser `packages/orometra` — el instrumento que mide el relieve después (y también sobre resultados generados aquí).

## Principios

1. **Nunca juzgar con la vara con la que se optimizó.** El criterio de búsqueda no es la prueba de robustez.
2. **La calidad combinada es el mínimo de los periodos, no la media.**
3. **Se elige el centro de la meseta, no su cima.**
4. **Lo que no se puede calcular, no se calcula — y se dice cuál es.**
5. **Los datos de precio son exportables** (CSV / ticks). La fuente de verdad no es un formato binario opaco del broker-tester.

## Estado

Cimiento del monorepo. Siguiente foco: motor de backtest mínimo (`packages/engine`) y cableado de Orometra como paquete.

## Desarrollo local

Requisitos: Node 20+, [pnpm](https://pnpm.io) 9+.

```bash
pnpm install
pnpm dev:web
```

## Licencia

Privado / por definir. El repositorio puede ser público mientras el producto madura; la licencia de uso se fijará antes de distribución.
