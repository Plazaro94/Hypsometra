import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDuration,
  forwardSplit,
  generateWindowsByDuration,
  generateWindowsByRuns,
  validateWindows,
} from "./windows.js";

const d = (s: string) => Date.parse(`${s}T00:00:00Z`);

describe("addDuration", () => {
  it("clamps month ends", () => {
    assert.equal(addDuration(d("2024-01-31"), { value: 1, unit: "months" }), d("2024-02-29"));
    assert.equal(addDuration(d("2023-01-31"), { value: 1, unit: "months" }), d("2023-02-28"));
  });

  it("adds years and weeks", () => {
    assert.equal(addDuration(d("2020-03-01"), { value: 2, unit: "years" }), d("2022-03-01"));
    assert.equal(addDuration(d("2020-03-01"), { value: 1, unit: "weeks" }), d("2020-03-08"));
  });
});

describe("generateWindowsByDuration", () => {
  it("rolling: fixed IS length, OOS chained without gaps", () => {
    const w = generateWindowsByDuration({
      from: d("2018-03-01"),
      to: d("2026-09-20"),
      mode: "rolling",
      inSample: { value: 24, unit: "months" },
      outOfSample: { value: 6, unit: "months" },
    });
    assert.equal(w[0]!.isFrom, d("2018-03-01"));
    assert.equal(w[0]!.isTo, d("2020-03-01"));
    assert.equal(w[0]!.oosTo, d("2020-09-01"));
    assert.equal(w[1]!.isFrom, d("2018-09-01"));
    for (let i = 1; i < w.length; i++) {
      assert.equal(w[i]!.oosFrom, w[i - 1]!.oosTo);
    }
    assert.ok(w[w.length - 1]!.oosTo <= d("2026-09-20"));
    assert.equal(validateWindows(w, { from: d("2018-03-01"), to: d("2026-09-20") }).length, 0);
  });

  it("anchored: IS always starts at the period start and grows", () => {
    const w = generateWindowsByDuration({
      from: d("2018-01-01"),
      to: d("2022-01-01"),
      mode: "anchored",
      inSample: { value: 2, unit: "years" },
      outOfSample: { value: 6, unit: "months" },
    });
    assert.equal(w.length, 4);
    for (const win of w) assert.equal(win.isFrom, d("2018-01-01"));
    assert.ok(w[1]!.isTo > w[0]!.isTo);
    assert.equal(w[3]!.oosTo, d("2022-01-01"));
  });
});

describe("generateWindowsByRuns", () => {
  it("rolling: N windows, OOS share per window, ends at period end", () => {
    const from = d("2018-01-01");
    const to = d("2026-01-01");
    const w = generateWindowsByRuns({ from, to, mode: "rolling", runs: 10, oosPercent: 20 });
    assert.equal(w.length, 10);
    assert.equal(w[0]!.isFrom, from);
    assert.equal(w[9]!.oosTo, to);
    const share = (w[0]!.oosTo - w[0]!.oosFrom) / (w[0]!.oosTo - w[0]!.isFrom);
    assert.ok(Math.abs(share - 0.2) < 0.01);
    assert.equal(validateWindows(w, { from, to }).length, 0);
  });

  it("anchored: combined OOS equals the requested share", () => {
    const from = d("2018-01-01");
    const to = d("2026-01-01");
    const w = generateWindowsByRuns({ from, to, mode: "anchored", runs: 5, oosPercent: 30 });
    const oos = w.reduce((s, x) => s + (x.oosTo - x.oosFrom), 0);
    assert.ok(Math.abs(oos / (to - from) - 0.3) < 0.01);
    for (const win of w) assert.equal(win.isFrom, from);
  });
});

describe("forwardSplit", () => {
  it("uses the last fraction of the period as forward", () => {
    const w = forwardSplit({ from: d("2020-01-01"), to: d("2024-01-01"), fraction: "1/4" });
    assert.equal(w.oosTo, d("2024-01-01"));
    assert.ok(Math.abs((w.oosTo - w.oosFrom) / (w.oosTo - w.isFrom) - 0.25) < 0.01);
  });

  it("accepts a custom forward start", () => {
    const w = forwardSplit({ from: d("2018-03-01"), to: d("2026-09-20"), forwardFrom: d("2023-03-14") });
    assert.equal(w.oosFrom, d("2023-03-14"));
  });
});

describe("validateWindows", () => {
  it("flags overlapping OOS segments", () => {
    const issues = validateWindows(
      [
        { index: 0, isFrom: d("2020-01-01"), isTo: d("2021-01-01"), oosFrom: d("2021-01-01"), oosTo: d("2021-07-01") },
        { index: 1, isFrom: d("2020-03-01"), isTo: d("2021-03-01"), oosFrom: d("2021-03-01"), oosTo: d("2021-09-01") },
      ],
      { from: d("2020-01-01"), to: d("2022-01-01") },
    );
    assert.ok(issues.some((i) => i.message.includes("se solapan")));
  });
});
