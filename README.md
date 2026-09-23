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
├── packages/data         Fuentes de mercado (CSV → catalog/MT5)
├── packages/cli          CLI (`hypsometra dataset …`)
├── packages/orometra     Auditoría de mesetas (aplazado)
└── workers               Cómputo pesado (no serverless)
```

### Orometra (aplazado)

[Orometra](https://github.com/Plazaro94/Orometra) será el módulo de **auditoría post-optimización** (`packages/orometra`): mesetas, evidencia, maximin. **De momento no se desarrolla**; el stub del paquete solo reserva el sitio en el monorepo. Se añadirá cuando el engine y la optimización ya generen resultados dignos de auditar.

## Principios

1. **Nunca juzgar con la vara con la que se optimizó.** El criterio de búsqueda no es la prueba de robustez.
2. **La calidad combinada es el mínimo de los periodos, no la media.**
3. **Se elige el centro de la meseta, no su cima.**
4. **Lo que no se puede calcular, no se calcula — y se dice cuál es.**
5. **Los datos de precio son exportables** (CSV / ticks). La fuente de verdad no es un formato binario opaco del broker-tester.

## Estado

**Engine** + **Opt/WFO** + **Data** + **CLI** + **Monte Carlo** listos.

```bash
npm run hypsometra -- dataset add ./XAUUSD_H1.csv --symbol XAUUSD --timeframe H1
npm run hypsometra -- wfo --dataset <id> --is 500 --oos 100 --fast 5:15:5 --slow 20:60:10 --out wfo.json
npm run hypsometra -- montecarlo --dataset <id> --fast 10 --slow 40 --method bootstrap --sims 2000 --out mc.json
```

Estrategia CLI v1: cruce SMA. Orometra aparcado. Siguiente: dashboard web.

## Desarrollo local

Requisitos: Node 20+.

```bash
npm install
npm test
npm run hypsometra -- help
```

## Licencia

Privado / por definir. El repositorio puede ser público mientras el producto madura; la licencia de uso se fijará antes de distribución.
