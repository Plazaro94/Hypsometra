import type { Bar } from "@hypsometra/engine";
import { LocalDatasetStore } from "./store/local.js";
import type { LoadBarsRequest, MarketDataSource } from "./types.js";

function filterBars(bars: Bar[], request: LoadBarsRequest): Bar[] {
  let out = bars;
  if (request.from !== undefined) {
    out = out.filter((b) => b.time >= request.from!);
  }
  if (request.to !== undefined) {
    out = out.filter((b) => b.time <= request.to!);
  }
  return out;
}

/**
 * Loads bars from datasets previously ingested via CSV.
 * This is the v1 production path: upload/ingest once, reuse by id.
 */
export class CsvLocalSource implements MarketDataSource {
  readonly kind = "csv" as const;
  private readonly store: LocalDatasetStore;

  constructor(storeDir?: string) {
    this.store = new LocalDatasetStore(storeDir);
  }

  async load(request: LoadBarsRequest): Promise<Bar[]> {
    if (!request.datasetId) {
      throw new Error("CsvLocalSource requires request.datasetId");
    }
    const meta = this.store.readMeta(request.datasetId);
    if (!meta) {
      throw new Error(`Unknown dataset: ${request.datasetId}`);
    }
    if (request.symbol && request.symbol !== meta.symbol) {
      throw new Error(
        `Dataset ${meta.id} is ${meta.symbol}, requested ${request.symbol}`,
      );
    }
    if (request.timeframe && request.timeframe !== meta.timeframe) {
      throw new Error(
        `Dataset ${meta.id} is ${meta.timeframe}, requested ${request.timeframe}`,
      );
    }
    return filterBars(this.store.readBars(request.datasetId), request);
  }
}

/**
 * Reserved for Hypsometra-hosted series (S3/R2 catalog).
 * Same MarketDataSource contract — swap without touching opt/engine.
 */
export class CatalogSource implements MarketDataSource {
  readonly kind = "catalog" as const;

  async load(_request: LoadBarsRequest): Promise<Bar[]> {
    throw new Error(
      "CatalogSource is not implemented yet. Use CsvLocalSource (dataset ingest) for v1.",
    );
  }
}

/**
 * Reserved for MT5 / broker bridges (e.g. MetaApi or a local agent).
 */
export class Mt5BridgeSource implements MarketDataSource {
  readonly kind = "mt5" as const;

  async load(_request: LoadBarsRequest): Promise<Bar[]> {
    throw new Error(
      "Mt5BridgeSource is not implemented yet. Use CsvLocalSource (dataset ingest) for v1.",
    );
  }
}
