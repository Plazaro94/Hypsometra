# @hypsometra/opt

Optimización y **walk-forward** sobre `@hypsometra/engine`.

Esta es la capa donde Hypsometra se separa de MT5: no un solo corte forward,
sino ventanas que avanzan (`rolling` / `anchored`), optimizando in-sample y
validando out-of-sample en cada pliegue.

## API

- `optimize({ mode: "grid" | "genetic", ... })` — barrido o búsqueda genética
- `walkForward({ mode: "rolling" | "anchored", ... })` — WFO completo
- Espacio de parámetros: `int` / `float` / `enum`

## Ejemplo walk-forward

```ts
import { createSmaCrossStrategy } from "@hypsometra/engine";
import { walkForward } from "@hypsometra/opt";

const result = walkForward({
  bars,
  config,
  mode: "rolling",
  inSampleBars: 5000,
  outOfSampleBars: 1000,
  criterion: "netProfit",
  space: [
    { name: "fast", kind: "int", from: 5, to: 20, step: 5 },
    { name: "slow", kind: "int", from: 30, to: 100, step: 10 },
  ],
  createStrategy: (p) =>
    createSmaCrossStrategy({
      fastPeriod: Number(p.fast),
      slowPeriod: Number(p.slow),
    }),
  search: { mode: "genetic", genetic: { population: 40, generations: 25 } },
});

console.log(result.combinedOosNetProfit, result.folds.length);
```

## Tests

```bash
npm run test -w @hypsometra/opt
```
