import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadOhlcCsvFile, type Bar } from "@hypsometra/engine";
import type { DatasetMeta } from "./types.js";
import { LocalDatasetStore } from "./store/local.js";

function slugPart(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function hashFile(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

export function buildDatasetId(
  symbol: string,
  timeframe: string,
  contentHash: string,
): string {
  return `${slugPart(symbol)}_${slugPart(timeframe)}_${contentHash.slice(0, 8)}`;
}

export interface IngestCsvResult {
  meta: DatasetMeta;
  bars: Bar[];
  /** True when an identical hash was already stored. */
  reused: boolean;
}

/**
 * Parse a CSV, normalize bars, and persist under the local dataset store.
 * Idempotent on content hash: re-ingesting the same file returns the existing dataset.
 */
export function ingestCsvFile(input: {
  filePath: string;
  symbol: string;
  timeframe: string;
  storeDir?: string;
}): IngestCsvResult {
  const symbol = input.symbol.trim();
  const timeframe = input.timeframe.trim();
  if (!symbol || !timeframe) {
    throw new Error("symbol and timeframe are required");
  }

  const store = new LocalDatasetStore(input.storeDir);
  const contentHash = hashFile(input.filePath);
  const id = buildDatasetId(symbol, timeframe, contentHash);

  const existing = store.readMeta(id);
  if (existing && existing.contentHash === contentHash) {
    return {
      meta: existing,
      bars: store.readBars(id),
      reused: true,
    };
  }

  const bars = loadOhlcCsvFile(input.filePath);
  if (bars.length === 0) {
    throw new Error("CSV produced zero bars");
  }

  const meta: DatasetMeta = {
    id,
    source: "csv",
    symbol,
    timeframe,
    barCount: bars.length,
    from: bars[0]!.time,
    to: bars[bars.length - 1]!.time,
    createdAt: new Date().toISOString(),
    contentHash,
    originalFilename: basename(input.filePath),
  };

  store.write(meta, bars);
  return { meta, bars, reused: false };
}
