import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { Bar } from "@hypsometra/engine";
import type { DatasetMeta } from "../types.js";

const META_FILE = "meta.json";
const BARS_FILE = "bars.jsonl";

export function defaultStoreDir(cwd = process.cwd()): string {
  return resolve(cwd, "data", "datasets");
}

/**
 * Filesystem dataset store.
 * Layout: `{storeDir}/{id}/meta.json` + `bars.jsonl`
 * Swap later for S3/R2 without touching MarketDataSource callers.
 */
export class LocalDatasetStore {
  readonly root: string;

  constructor(storeDir?: string) {
    this.root = resolve(storeDir ?? defaultStoreDir());
  }

  ensureRoot(): void {
    mkdirSync(this.root, { recursive: true });
  }

  datasetDir(id: string): string {
    return join(this.root, id);
  }

  list(): DatasetMeta[] {
    if (!existsSync(this.root)) return [];
    const out: DatasetMeta[] = [];
    for (const name of readdirSync(this.root, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const meta = this.readMeta(name.name);
      if (meta) out.push(meta);
    }
    return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  readMeta(id: string): DatasetMeta | null {
    const path = join(this.datasetDir(id), META_FILE);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as DatasetMeta;
  }

  readBars(id: string): Bar[] {
    const path = join(this.datasetDir(id), BARS_FILE);
    if (!existsSync(path)) {
      throw new Error(`Dataset bars not found: ${id}`);
    }
    const text = readFileSync(path, "utf8");
    return text
      .split(/\r?\n/)
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as Bar);
  }

  write(meta: DatasetMeta, bars: Bar[]): void {
    this.ensureRoot();
    const dir = this.datasetDir(meta.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, META_FILE), JSON.stringify(meta, null, 2), "utf8");
    const body = bars.map((b) => JSON.stringify(b)).join("\n") + "\n";
    writeFileSync(join(dir, BARS_FILE), body, "utf8");
  }

  exists(id: string): boolean {
    return existsSync(join(this.datasetDir(id), META_FILE));
  }
}
