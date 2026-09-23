import { readFileSync } from "node:fs";
import type { Bar } from "../types.js";

export interface CsvLoadOptions {
  /** Column separator. Auto-detected from the header line if omitted. */
  delimiter?: "," | ";" | "\t";
  /** Treat timestamps as UTC. Default true. */
  utc?: boolean;
}

const TIME_ALIASES = new Set([
  "time",
  "date",
  "datetime",
  "timestamp",
  "date_time",
  "<date>",
  "<time>",
]);

const OPEN_ALIASES = new Set(["open", "o", "<open>"]);
const HIGH_ALIASES = new Set(["high", "h", "<high>"]);
const LOW_ALIASES = new Set(["low", "l", "<low>"]);
const CLOSE_ALIASES = new Set(["close", "c", "<close>"]);
const VOLUME_ALIASES = new Set([
  "volume",
  "vol",
  "tickvol",
  "tick_volume",
  "tick volume",
  "<tickvol>",
  "<vol>",
]);

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts: Array<{ d: "," | ";" | "\t"; n: number }> = [
    { d: ",", n: (headerLine.match(/,/g) ?? []).length },
    { d: ";", n: (headerLine.match(/;/g) ?? []).length },
    { d: "\t", n: (headerLine.match(/\t/g) ?? []).length },
  ];
  counts.sort((a, b) => b.n - a.n);
  return counts[0]?.d ?? ",";
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/^\uFEFF/, "").toLowerCase();
}

function parseNumber(raw: string): number {
  const t = raw.trim();
  if (!t) return Number.NaN;
  // European: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^\d+,\d+$/.test(t)) {
    return Number(t.replace(/\./g, "").replace(",", "."));
  }
  return Number(t.replace(/,/g, ""));
}

function parseTime(raw: string, utc: boolean): number {
  const t = raw.trim();
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    // seconds vs ms heuristic
    return n < 1e12 ? n * 1000 : n;
  }

  // Prefer native parse for ISO-8601 (including fractional seconds).
  // Do NOT globally replace "." — that breaks "2024-01-01T00:00:00.000Z".
  let ms = Date.parse(t);
  if (!Number.isNaN(ms)) return ms;

  // MT5 often exports "2024.01.15 12:00" or "2024.01.15"
  const mt5Date = t.replace(/^(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3");
  const normalized = mt5Date.replace(/\//g, "-").replace(" ", "T");
  const iso = /T\d/.test(normalized)
    ? normalized
    : `${normalized}T00:00:00`;
  const withZone =
    utc && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? `${iso}Z` : iso;
  ms = Date.parse(withZone);
  if (Number.isNaN(ms)) {
    throw new Error(`Unrecognized datetime: "${raw}"`);
  }
  return ms;
}

function findColumn(headers: string[], aliases: Set<string>): number {
  return headers.findIndex((h) => aliases.has(h));
}

/**
 * Parse OHLC bars from a CSV/TSV string (MT5 exports and common formats).
 * Requires columns for time/open/high/low/close; volume is optional (defaults to 0).
 */
export function parseOhlcCsv(text: string, options: CsvLoadOptions = {}): Bar[] {
  const utc = options.utc ?? true;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must contain a header and at least one data row");
  }

  const headerLine = lines[0]!;
  const delimiter = options.delimiter ?? detectDelimiter(headerLine);
  const headers = headerLine.split(delimiter).map(normalizeHeader);

  // MT5 sometimes splits Date and Time into two columns
  const dateIdx = headers.findIndex((h) => h === "date" || h === "<date>");
  const timeOnlyIdx = headers.findIndex((h) => h === "time" || h === "<time>");
  const combinedTimeIdx = findColumn(headers, TIME_ALIASES);

  const openIdx = findColumn(headers, OPEN_ALIASES);
  const highIdx = findColumn(headers, HIGH_ALIASES);
  const lowIdx = findColumn(headers, LOW_ALIASES);
  const closeIdx = findColumn(headers, CLOSE_ALIASES);
  const volumeIdx = findColumn(headers, VOLUME_ALIASES);

  if (openIdx < 0 || highIdx < 0 || lowIdx < 0 || closeIdx < 0) {
    throw new Error(
      `Missing OHLC columns. Found headers: ${headers.join(", ")}`,
    );
  }

  const hasSplitDateTime =
    dateIdx >= 0 && timeOnlyIdx >= 0 && dateIdx !== timeOnlyIdx;
  if (!hasSplitDateTime && combinedTimeIdx < 0) {
    throw new Error(
      `Missing time/date column. Found headers: ${headers.join(", ")}`,
    );
  }

  const bars: Bar[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(delimiter);
    const timeRaw = hasSplitDateTime
      ? `${cols[dateIdx]?.trim() ?? ""} ${cols[timeOnlyIdx]?.trim() ?? ""}`
      : (cols[combinedTimeIdx]?.trim() ?? "");

    const open = parseNumber(cols[openIdx] ?? "");
    const high = parseNumber(cols[highIdx] ?? "");
    const low = parseNumber(cols[lowIdx] ?? "");
    const close = parseNumber(cols[closeIdx] ?? "");
    const volume =
      volumeIdx >= 0 ? parseNumber(cols[volumeIdx] ?? "0") : 0;

    if ([open, high, low, close].some((x) => Number.isNaN(x))) {
      throw new Error(`Invalid numeric OHLC at row ${i + 1}`);
    }

    bars.push({
      time: parseTime(timeRaw, utc),
      open,
      high,
      low,
      close,
      volume: Number.isNaN(volume) ? 0 : volume,
    });
  }

  for (let i = 1; i < bars.length; i++) {
    if (bars[i]!.time <= bars[i - 1]!.time) {
      throw new Error(
        `Bars must be strictly ascending in time (row ${i + 2})`,
      );
    }
  }

  return bars;
}

export function loadOhlcCsvFile(
  path: string,
  options: CsvLoadOptions = {},
): Bar[] {
  return parseOhlcCsv(readFileSync(path, "utf8"), options);
}
