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
    assert.equal(bars[0]!.time, Date.parse("2024-03-01T12:00:00Z"));
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

  it("reads the MT5 bars export with tabs, tick volume and spread", () => {
    const csv = [
      "<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>",
      "2024.01.02\t01:01:00\t2062.66\t2063.10\t2062.40\t2062.90\t38\t0\t21",
      "2024.01.02\t01:02:00\t2062.90\t2063.00\t2062.55\t2062.70\t25\t0\t18",
    ].join("\r\n");
    const bars = parseOhlcCsv(csv);
    assert.equal(bars.length, 2);
    assert.equal(bars[0]!.time, Date.parse("2024-01-02T01:01:00Z"));
    assert.equal(bars[0]!.volume, 38);
    assert.equal(bars[0]!.spread, 21);
    assert.equal(bars[1]!.spread, 18);
  });

  it("parses ISO datetimes with fractional seconds", () => {
    const csv = [
      "time,open,high,low,close",
      "2020-01-01T00:00:00.000Z,1,2,0.5,1.5",
      "2020-01-02T00:00:00.000Z,1.5,2.5,1,2",
    ].join("\n");
    const bars = parseOhlcCsv(csv);
    assert.equal(bars.length, 2);
    assert.equal(bars[0]!.time, Date.parse("2020-01-01T00:00:00.000Z"));
  });
});
