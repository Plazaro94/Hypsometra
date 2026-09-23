import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Bar } from "@hypsometra/engine";
import { LocalDatasetStore } from "./store/local.js";

describe("LocalDatasetStore", () => {
  it("round-trips meta and bars", () => {
    const root = mkdtempSync(join(tmpdir(), "hypsometra-store-"));
    const store = new LocalDatasetStore(root);
    const bars: Bar[] = [
      {
        time: 1_000,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10,
      },
    ];
    store.write(
      {
        id: "test_h1_deadbeef",
        source: "csv",
        symbol: "TEST",
        timeframe: "H1",
        barCount: 1,
        from: 1_000,
        to: 1_000,
        createdAt: "2024-01-01T00:00:00.000Z",
        contentHash: "abc",
      },
      bars,
    );

    assert.equal(store.list().length, 1);
    assert.equal(store.readMeta("test_h1_deadbeef")?.symbol, "TEST");
    assert.deepEqual(store.readBars("test_h1_deadbeef"), bars);
  });
});
