import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { LocalDatasetStore } from "@hypsometra/data";
import { run } from "./index.js";

const SAMPLE = `time,open,high,low,close,volume
2024-01-02T00:00:00Z,100,101,99,100,1
2024-01-03T00:00:00Z,100,102,99,101,1
`;

describe("cli dataset", () => {
  it("adds and lists a dataset", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hypsometra-cli-"));
    const csv = join(dir, "sample.csv");
    const store = join(dir, "datasets");
    writeFileSync(csv, SAMPLE, "utf8");

    const addCode = await run([
      "dataset",
      "add",
      csv,
      "--symbol",
      "XAUUSD",
      "--timeframe",
      "H1",
      "--store",
      store,
    ]);
    assert.equal(addCode, 0);

    const list = new LocalDatasetStore(store).list();
    assert.equal(list.length, 1);
    assert.equal(list[0]!.symbol, "XAUUSD");

    const listCode = await run(["dataset", "list", "--store", store]);
    assert.equal(listCode, 0);
  });
});
