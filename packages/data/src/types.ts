import type { Bar } from "@hypsometra/engine";

export type DataSourceKind = "csv" | "catalog" | "mt5";

export interface DatasetMeta {
  id: string;
  source: DataSourceKind;
  symbol: string;
  timeframe: string;
  barCount: number;
  /** First bar time (UTC ms) */
  from: number;
  /** Last bar time (UTC ms) */
  to: number;
  createdAt: string;
  contentHash: string;
  originalFilename?: string;
}

export interface LoadBarsRequest {
  /** Required for csv-local / stored datasets. */
  datasetId?: string;
  symbol?: string;
  timeframe?: string;
  /** Inclusive lower bound (UTC ms). */
  from?: number;
  /** Inclusive upper bound (UTC ms). */
  to?: number;
}

/**
 * Pluggable market data origin.
 * Engine/opt only ever see `Bar[]` — never CSV paths or broker APIs.
 */
export interface MarketDataSource {
  readonly kind: DataSourceKind;
  load(request: LoadBarsRequest): Promise<Bar[]>;
}

export interface IngestCsvOptions {
  symbol: string;
  timeframe: string;
  /** Absolute or relative path to the CSV file. */
  filePath: string;
  /** Root directory for dataset storage (default: ./data/datasets). */
  storeDir?: string;
}
