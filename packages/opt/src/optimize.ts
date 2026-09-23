import {
  runBacktest,
  type BacktestConfig,
  type Bar,
  type Strategy,
} from "@hypsometra/engine";
import { scoreMetrics } from "./criterion.js";
import {
  countGridSize,
  createRng,
  crossover,
  enumerateGrid,
  mutate,
  paramsKey,
  randomIndividual,
} from "./space.js";
import type {
  Criterion,
  OptimizePass,
  ParamDef,
  ParamMap,
} from "./types.js";

export interface OptimizeInput {
  bars: readonly Bar[];
  config: BacktestConfig;
  space: ParamDef[];
  createStrategy: (params: ParamMap) => Strategy;
  criterion: Criterion;
  mode: "grid" | "genetic";
  /** Safety cap for full grid (default 50_000). */
  maxGridSize?: number;
  genetic?: {
    population?: number;
    generations?: number;
    mutationRate?: number;
    seed?: number;
  };
}

export interface OptimizeResult {
  mode: "grid" | "genetic";
  passes: OptimizePass[];
  best: OptimizePass;
  evaluated: number;
}

function evaluateParams(
  params: ParamMap,
  input: OptimizeInput,
): OptimizePass {
  const result = runBacktest({
    bars: input.bars,
    strategy: input.createStrategy(params),
    config: input.config,
  });
  return {
    params,
    metrics: result.metrics,
    score: scoreMetrics(result.metrics, input.criterion),
  };
}

function byScoreDesc(a: OptimizePass, b: OptimizePass): number {
  return b.score - a.score;
}

export function optimizeGrid(input: OptimizeInput): OptimizeResult {
  const size = countGridSize(input.space);
  const cap = input.maxGridSize ?? 50_000;
  if (size > cap) {
    throw new Error(
      `Grid size ${size} exceeds maxGridSize ${cap}. Narrow the space or use genetic mode.`,
    );
  }

  const passes = enumerateGrid(input.space)
    .map((params) => evaluateParams(params, input))
    .sort(byScoreDesc);

  if (passes.length === 0) {
    throw new Error("Empty parameter space");
  }

  return {
    mode: "grid",
    passes,
    best: passes[0]!,
    evaluated: passes.length,
  };
}

export function optimizeGenetic(input: OptimizeInput): OptimizeResult {
  const populationSize = input.genetic?.population ?? 30;
  const generations = input.genetic?.generations ?? 20;
  const mutationRate = input.genetic?.mutationRate ?? 0.2;
  const rng = createRng(input.genetic?.seed ?? 42);

  const seen = new Map<string, OptimizePass>();
  const evaluate = (params: ParamMap): OptimizePass => {
    const key = paramsKey(params);
    const cached = seen.get(key);
    if (cached) return cached;
    const pass = evaluateParams(params, input);
    seen.set(key, pass);
    return pass;
  };

  let population: OptimizePass[] = [];
  for (let i = 0; i < populationSize; i++) {
    population.push(evaluate(randomIndividual(input.space, rng)));
  }
  population.sort(byScoreDesc);

  for (let gen = 0; gen < generations; gen++) {
    const eliteCount = Math.max(2, Math.floor(populationSize / 4));
    const next: OptimizePass[] = population.slice(0, eliteCount);

    while (next.length < populationSize) {
      const a = population[Math.floor(rng() * Math.min(population.length, eliteCount * 2))]!;
      const b = population[Math.floor(rng() * Math.min(population.length, eliteCount * 2))]!;
      const childParams = mutate(
        crossover(a.params, b.params, input.space, rng),
        input.space,
        rng,
        mutationRate,
      );
      next.push(evaluate(childParams));
    }

    population = next.sort(byScoreDesc);
  }

  const passes = [...seen.values()].sort(byScoreDesc);
  return {
    mode: "genetic",
    passes,
    best: passes[0]!,
    evaluated: seen.size,
  };
}

export function optimize(input: OptimizeInput): OptimizeResult {
  return input.mode === "grid" ? optimizeGrid(input) : optimizeGenetic(input);
}
