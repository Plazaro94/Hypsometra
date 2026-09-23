import type { ParamDef } from "@hypsometra/opt";

/** Parse `from:to:step` (e.g. `3:5:1` or `10:20:2`). */
export function parseIntRange(spec: string, name: string): ParamDef {
  const parts = spec.split(":").map((p) => p.trim());
  if (parts.length !== 3) {
    throw new Error(
      `Invalid range for --${name}: expected from:to:step (got "${spec}")`,
    );
  }
  const from = Number(parts[0]);
  const to = Number(parts[1]);
  const step = Number(parts[2]);
  if (![from, to, step].every((n) => Number.isFinite(n))) {
    throw new Error(`Invalid numeric range for --${name}: "${spec}"`);
  }
  return { name, kind: "int", from, to, step };
}

export function buildSmaSpace(fast: string, slow: string): ParamDef[] {
  return [parseIntRange(fast, "fast"), parseIntRange(slow, "slow")];
}
