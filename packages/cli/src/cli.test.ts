import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { LocalDatasetStore } from "@hypsometra/data";
import { run } from "./index.js";

function makeCsv(n: number): string {
  const lines = ["time,open,high,low,close,volume"];
  const start = Date.parse("2020-01-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    const close = 100 + i * 0.05 + Math.sin(i / 8) * 4;
    const t = new Date(start + i * 86_400_000).toISOString();
    lines.push(
      `${t},${close - 0.2},${close + 1},${close - 1},${close},500`,
    );
  }
  return lines.join("\n");
}

describe("cli dataset", () => {
  it("adds and lists a dataset", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hypsometra-cli-"));
    const csv = join(dir, "sample.csv");
    const store = join(dir, "datasets");
    writeFileSync(csv, makeCsv(2), "utf8");

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

describe("cli optimize + wfo", () => {
  it("runs optimize and walk-forward on an ingested dataset", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hypsometra-cli-jobs-"));
    const csv = join(dir, "bars.csv");
    const store = join(dir, "datasets");
    const optOut = join(dir, "opt.json");
    const wfoOut = join(dir, "wfo.json");
    writeFileSync(csv, makeCsv(120), "utf8");

    assert.equal(
      await run([
        "dataset",
        "add",
        csv,
        "--symbol",
        "XAUUSD",
        "--timeframe",
        "D1",
        "--store",
        store,
      ]),
      0,
    );

    const id = new LocalDatasetStore(store).list()[0]!.id;

    assert.equal(
      await run([
        "optimize",
        "--dataset",
        id,
        "--store",
        store,
        "--search",
        "grid",
        "--fast",
        "3:5:1",
        "--slow",
        "8:12:2",
        "--out",
        optOut,
      ]),
      0,
    );

    const optReport = JSON.parse(readFileSync(optOut, "utf8")) as {
      kind: string;
      result: { evaluated: number; best: { score: number } };
    };
    assert.equal(optReport.kind, "optimize");
    assert.ok(optReport.result.evaluated >= 6);
    assert.ok(Number.isFinite(optReport.result.best.score));

    assert.equal(
      await run([
        "wfo",
        "--dataset",
        id,
        "--store",
        store,
        "--wf",
        "rolling",
        "--is",
        "40",
        "--oos",
        "20",
        "--step",
        "20",
        "--fast",
        "3:5:1",
        "--slow",
        "10:14:2",
        "--search",
        "grid",
        "--out",
        wfoOut,
      ]),
      0,
    );

    const wfoReport = JSON.parse(readFileSync(wfoOut, "utf8")) as {
      kind: string;
      result: { folds: unknown[]; combinedOosNetProfit: number };
    };
    assert.equal(wfoReport.kind, "walk-forward");
    assert.ok(wfoReport.result.folds.length >= 2);
    assert.ok(Number.isFinite(wfoReport.result.combinedOosNetProfit));

    const mcOut = join(dir, "mc.json");
    assert.equal(
      await run([
        "montecarlo",
        "--dataset",
        id,
        "--store",
        store,
        "--fast",
        "3",
        "--slow",
        "10",
        "--method",
        "bootstrap",
        "--sims",
        "200",
        "--out",
        mcOut,
      ]),
      0,
    );
    const mcReport = JSON.parse(readFileSync(mcOut, "utf8")) as {
      kind: string;
      result: { simulations: number; probProfit: number };
    };
    assert.equal(mcReport.kind, "montecarlo");
    assert.equal(mcReport.result.simulations, 200);
    assert.ok(mcReport.result.probProfit >= 0);
  });
});
