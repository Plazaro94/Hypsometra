import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseSymbolSpecJson } from "./symbol-spec.js";
import { decodeMt5Text } from "./text.js";

const day = (open: number, close: number) => [{ Open: String(open), Close: String(close) }];

const SAMPLE = JSON.stringify({
  ConfigSymbols: [
    {
      Symbol: "XAUUSD", Path: "Commodities\\Metals\\XAUUSD", Description: "Gold vs US Dollar ",
      CurrencyBase: "USD", CurrencyProfit: "USD", CurrencyMargin: "USD",
      Digits: "2", Point: "0.01000000", Spread: "0", TickValue: "1.00000000", TickSize: "0.01000000",
      ContractSize: "100.00000000", StopsLevel: "0", FreezeLevel: "0",
      VolumeMin: "100", VolumeMinExt: "1000000", VolumeMax: "1000000", VolumeMaxExt: "10000000000",
      VolumeStep: "100", VolumeStepExt: "1000000", CalcMode: "2",
      MarginInitial: "0.00000000", MarginInitialBuy: "0.05000000", MarginInitialSell: "0.05000000", MarginHedged: "0.00000000",
      SwapMode: "1", SwapLong: "-63.90000000", SwapShort: "36.80000000", Swap3Day: "3",
      SwapRateSunday: "0", SwapRateMonday: "1", SwapRateTuesday: "1", SwapRateWednesday: "3",
      SwapRateThursday: "1", SwapRateFriday: "1", SwapRateSaturday: "0",
      SessionsTrades: [[], day(61, 1439), day(61, 1439), day(61, 1439), day(61, 1439), day(61, 1435), []],
    },
  ],
});

describe("parseSymbolSpecJson", () => {
  const [s] = parseSymbolSpecJson(SAMPLE);

  it("normalizes numbers and fixed-point volumes", () => {
    assert.equal(s!.symbol, "XAUUSD");
    assert.equal(s!.description, "Gold vs US Dollar");
    assert.equal(s!.digits, 2);
    assert.equal(s!.tickSize, 0.01);
    assert.equal(s!.tickValue, 1);
    assert.equal(s!.contractSize, 100);
    assert.equal(s!.volumeMin, 0.01);
    assert.equal(s!.volumeMax, 100);
    assert.equal(s!.volumeStep, 0.01);
  });

  it("treats Spread 0 as floating spread", () => {
    assert.equal(s!.spreadPoints, null);
  });

  it("decodes margin and swap modes", () => {
    assert.equal(s!.calcModeLabel, "CFD");
    assert.equal(s!.marginRateBuy, 0.05);
    assert.equal(s!.swapModeLabel, "En puntos");
    assert.equal(s!.swapLong, -63.9);
    assert.equal(s!.swap3Day, 3);
    assert.deepEqual(s!.swapRates, [0, 1, 1, 3, 1, 1, 0]);
  });

  it("reads trading sessions per weekday", () => {
    assert.equal(s!.sessionsTrade.length, 7);
    assert.deepEqual(s!.sessionsTrade[0], []);
    assert.deepEqual(s!.sessionsTrade[5], [{ open: 61, close: 1435 }]);
  });

  it("rejects non-spec JSON", () => {
    assert.throws(() => parseSymbolSpecJson("{\"foo\": 1}"));
    assert.throws(() => parseSymbolSpecJson("not json"));
  });
});

const samples = process.env["MT5_SAMPLES"];
describe("real MT5 symbol export (MT5_SAMPLES)", { skip: !samples }, () => {
  it("parses symbol.json", () => {
    const file = join(samples!, "symbol.json");
    if (!existsSync(file)) return;
    const [spec] = parseSymbolSpecJson(decodeMt5Text(readFileSync(file)));
    assert.ok(spec!.contractSize > 0);
    assert.ok(spec!.sessionsTrade.length === 7);
  });
});
