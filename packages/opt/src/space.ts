import type { ParamDef, ParamMap, ParamValue } from "./types.js";

function assertStep(
  def: Extract<ParamDef, { kind: "int" | "float" }>,
): void {
  if (!(def.step > 0)) {
    throw new Error(`Parameter "${def.name}" requires step > 0`);
  }
  if (def.to < def.from) {
    throw new Error(`Parameter "${def.name}": to must be >= from`);
  }
}

/** Expand a single parameter definition into its discrete values. */
export function expandParam(def: ParamDef): ParamValue[] {
  if (def.kind === "enum") {
    if (def.values.length === 0) {
      throw new Error(`Parameter "${def.name}" enum is empty`);
    }
    return [...def.values];
  }

  assertStep(def);
  const values: number[] = [];
  const decimals =
    def.kind === "float"
      ? Math.max(
          decimalsOf(def.from),
          decimalsOf(def.to),
          decimalsOf(def.step),
        )
      : 0;

  for (let v = def.from; v <= def.to + def.step / 1e9; v += def.step) {
    const n =
      def.kind === "int"
        ? Math.round(v)
        : roundTo(v, decimals);
    if (values.length === 0 || values[values.length - 1] !== n) {
      values.push(n);
    }
  }
  return values;
}

function decimalsOf(n: number): number {
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Cartesian product of the parameter space. */
export function enumerateGrid(space: ParamDef[]): ParamMap[] {
  if (space.length === 0) return [{}];

  const axes = space.map((d) => ({
    name: d.name,
    values: expandParam(d),
  }));

  let combos: ParamMap[] = [{}];
  for (const axis of axes) {
    const next: ParamMap[] = [];
    for (const base of combos) {
      for (const value of axis.values) {
        next.push({ ...base, [axis.name]: value });
      }
    }
    combos = next;
  }
  return combos;
}

export function countGridSize(space: ParamDef[]): number {
  return space.reduce((acc, d) => acc * expandParam(d).length, 1);
}

/** Mulberry32 — small deterministic PRNG for reproducible genetics. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomIndividual(
  space: ParamDef[],
  rng: () => number,
): ParamMap {
  const params: ParamMap = {};
  for (const def of space) {
    const values = expandParam(def);
    params[def.name] = values[Math.floor(rng() * values.length)]!;
  }
  return params;
}

export function crossover(
  a: ParamMap,
  b: ParamMap,
  space: ParamDef[],
  rng: () => number,
): ParamMap {
  const child: ParamMap = {};
  for (const def of space) {
    child[def.name] = rng() < 0.5 ? a[def.name]! : b[def.name]!;
  }
  return child;
}

export function mutate(
  individual: ParamMap,
  space: ParamDef[],
  rng: () => number,
  rate: number,
): ParamMap {
  const next: ParamMap = { ...individual };
  for (const def of space) {
    if (rng() < rate) {
      const values = expandParam(def);
      next[def.name] = values[Math.floor(rng() * values.length)]!;
    }
  }
  return next;
}

export function paramsKey(params: ParamMap): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join("|");
}
