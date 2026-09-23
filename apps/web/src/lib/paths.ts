import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** Monorepo root (…/Hypsometra), whether cwd is root or apps/web. */
export function monorepoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "packages", "engine"))) return cwd;
  const up = resolve(cwd, "../..");
  if (existsSync(join(up, "packages", "engine"))) return up;
  return cwd;
}

export function datasetStoreDir(): string {
  return resolve(monorepoRoot(), "data", "datasets");
}
