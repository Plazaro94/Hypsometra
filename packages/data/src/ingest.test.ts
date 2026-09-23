import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ingestCsvFile } from "./ingest.js";
import { CsvLocalSource } from "./sources.js";

const SAMPLE = `time,open,high,low,close,volume
2024-01-02T00:00:00Z,100,101,99,100,1
2024-01-03T00:00:00Z,100,102,99,101,1
2024-01-04T00:00:00Z,101,103,100,102,1
`;

describe("ingestCsvFile", () => {
  it("stores meta + bars and is idempotent on hash", () => {
    const dir = mkdtempSync(join(tmpdir(), "hypsometra-data-"));
    const csvPath = join(dir, "xau.csv");
    writeFileSync(csvPath, SAMPLE, "utf8");
    const storeDir = join(dir, "datasets");

    const first = ingestCsvFile({
      filePath: csvPath,
      symbol: "XAUUSD",
      timeframe: "H1",
      storeDir,
    });
    assert.equal(first.reused, false);
    assert.equal(first.meta.barCount, 3);
    assert.equal(first.meta.symbol, "XAUUSD");
    assert.match(first.meta.id, /^xauusd_h1_[a-f0-9]{8}$/);

    const second = ingestCsvFile({
      filePath: csvPath,
      symbol: "XAUUSD",
      timeframe: "H1",
      storeDir,
    });
    assert.equal(second.reused, true);
    assert.equal(second.meta.id, first.meta.id);
  });
});

describe("CsvLocalSource", () => {
  it("loads and filters by time range", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hypsometra-data-"));
    const csvPath = join(dir, "xau.csv");
    writeFileSync(csvPath, SAMPLE, "utf8");
    const storeDir = join(dir, "datasets");

    const { meta } = ingestCsvFile({
      filePath: csvPath,
      symbol: "XAUUSD",
      timeframe: "D1",
      storeDir,
    });

    const source = new CsvLocalSource(storeDir);
    const all = await source.load({ datasetId: meta.id });
    assert.equal(all.length, 3);

    const sliced = await source.load({
      datasetId: meta.id,
      from: Date.parse("2024-01-03T00:00:00Z"),
      to: Date.parse("2024-01-03T00:00:00Z"),
    });
    assert.equal(sliced.length, 1);
    assert.equal(sliced[0]!.close, 101);
  });
});
