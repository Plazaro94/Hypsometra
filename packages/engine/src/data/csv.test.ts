import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseOhlcCsv } from "../data/csv.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "../../fixtures/sample-ohlc.csv");

describe("parseOhlcCsv", () => {
  it("loads the sample fixture", () => {
    const bars = parseOhlcCsv(readFileSync(fixture, "utf8"));
    assert.equal(bars.length, 20);
    assert.equal(bars[0]!.open, 100);
    assert.equal(bars[0]!.close, 100);
    assert.ok(bars[1]!.time > bars[0]!.time);
  });

  it("accepts MT5-style date/time and semicolon", () => {
    const csv = [
      "<DATE>;<TIME>;<OPEN>;<HIGH>;<LOW>;<CLOSE>;<TICKVOL>",
      "2024.03.01;12:00:00;2000.10;2001.00;1999.50;2000.50;120",
      "2024.03.01;13:00:00;2000.50;2002.00;2000.00;2001.25;130",
    ].join("\n");
    const bars = parseOhlcCsv(csv);
    assert.equal(bars.length, 2);
    assert.equal(bars[0]!.open, 2000.1);
    assert.equal(bars[1]!.volume, 130);
  });

  it("parses European decimals", () => {
    const csv = [
      "time;open;high;low;close",
      "2024-01-01;1.100,50;1.101,00;1.099,00;1.100,75",
    ].join("\n");
    const bars = parseOhlcCsv(csv);
    assert.equal(bars[0]!.open, 1100.5);
  });
});
