import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseSetFile } from "./set-file.js";
import { parseTesterConfig } from "./tester-config.js";
import { decodeMt5Text } from "./text.js";

const INI = [
  "[Tester]",
  "Expert=PLSystems\\ORB\\ORB_ML Sizing.ex5",
  "Symbol=XAUUSD",
  "Period=H1",
  "Optimization=2",
  "Model=1",
  "FromDate=2018.03.01",
  "ToDate=2026.09.20",
  "ForwardMode=4",
  "ForwardDate=2023.03.14",
  "Deposit=100000",
  "Currency=USD",
  "Leverage=1:30",
  "ExecutionMode=-1",
  "OptimizationCriterion=0",
  "[TesterInputs]",
  "; === 1) Session ===",
  "InpOpenHour=9||9||1||90||Y",
  "InpComment=PLSystems_ORB",
].join("\r\n");

describe("parseTesterConfig", () => {
  const cfg = parseTesterConfig(INI);

  it("maps [Tester] keys to study settings", () => {
    assert.equal(cfg.expert, "ORB_ML Sizing");
    assert.equal(cfg.symbol, "XAUUSD");
    assert.equal(cfg.period, "H1");
    assert.equal(cfg.model, "ohlc_m1");
    assert.equal(cfg.fromDate, "2018-03-01");
    assert.equal(cfg.toDate, "2026-09-20");
    assert.deepEqual(cfg.forward, { mode: "custom", date: "2023-03-14" });
    assert.equal(cfg.deposit, 100000);
    assert.equal(cfg.currency, "USD");
    assert.equal(cfg.leverage, 30);
    assert.deepEqual(cfg.delay, { mode: "random" });
    assert.equal(cfg.optimization, "genetic");
  });

  it("reads [TesterInputs] as a .set", () => {
    assert.equal(cfg.inputs?.expertName, "ORB_ML Sizing");
    assert.equal(cfg.inputs?.inputs.length, 2);
    assert.equal(cfg.inputs?.inputs[0]!.optimize, true);
    assert.equal(cfg.inputs?.inputs[0]!.group, "1) Session");
  });

  it("accepts numeric period codes and plain leverage", () => {
    const c = parseTesterConfig("Symbol=EURUSD\nPeriod=16385\nLeverage=100\nExecutionMode=50");
    assert.equal(c.period, "H1");
    assert.equal(c.leverage, 100);
    assert.deepEqual(c.delay, { mode: "fixed", ms: 50 });
  });

  it("rejects unrelated text", () => {
    assert.throws(() => parseTesterConfig("hola\nmundo"));
  });
});

// Same shape as a real Ctrl+C copy from the MT5 tester (build 5xxx), generic EA.
const CTRL_C = [
  "[Tester]",
  "Expert=Examples\\MACD\\MACD Sample.ex5",
  "Symbol=EURUSD",
  "Period=M15",
  "Optimization=0",
  "Model=1",
  "FromDate=2020.01.01",
  "ToDate=2024.12.31",
  "ForwardMode=2",
  "Deposit=10000",
  "Currency=EUR",
  "ProfitInPips=0",
  "Leverage=30",
  "ExecutionMode=-1",
  "OptimizationCriterion=7",
  "Visual=0",
  "[TesterInputs]",
  "; === Signals",
  "Ref_Note=reference only | not used",
  "InpLots=0.1||0.1||0.010000||1.000000||N",
  "InpTakeProfit=50||50||1||500||N",
  "InpUseTrailing=false||false||0||true||N",
  "InpSignalTF=16385||1||0||49153||N",
  "InpMode=0||0||0||2||N",
  "InpMagic=12345",
  "InpComment=macd",
].join("\r\n");

describe("parseTesterConfig on a Ctrl+C copy", () => {
  const c = parseTesterConfig(CTRL_C);

  it("maps every [Tester] key without leftovers", () => {
    assert.equal(c.expert, "MACD Sample");
    assert.equal(c.period, "M15");
    assert.deepEqual(c.forward, { mode: "1/3" });
    assert.equal(c.leverage, 30);
    assert.equal(c.optimization, "disabled");
    assert.equal(c.criterion, "complex_max");
    assert.equal(c.profitInPips, false);
    assert.deepEqual(c.unknownKeys, []);
  });

  it("reads inputs with kinds and the expert name from [Tester]", () => {
    assert.equal(c.inputs?.expertName, "MACD Sample");
    const kinds = Object.fromEntries(c.inputs!.inputs.map((i) => [i.name, i.kind]));
    assert.deepEqual(kinds, {
      Ref_Note: "string",
      InpLots: "double",
      InpTakeProfit: "int",
      InpUseTrailing: "bool",
      InpSignalTF: "timeframe",
      InpMode: "enum",
      InpMagic: "int",
      InpComment: "string",
    });
  });
});

const samples = process.env["MT5_SAMPLES"];
describe("real tester copy (MT5_SAMPLES)", { skip: !samples }, () => {
  it("yields the same inputs as the matching .set", () => {
    const tester = join(samples!, "tester.txt");
    const set = join(samples!, "sample.set");
    if (!existsSync(tester) || !existsSync(set)) return;
    const cfg = parseTesterConfig(decodeMt5Text(readFileSync(tester)));
    const fromSet = parseSetFile(decodeMt5Text(readFileSync(set)));
    const pick = (i: { name: string; value: string; kind: string; optimize: boolean }) => [i.name, i.value, i.kind, i.optimize];
    assert.deepEqual(cfg.inputs!.inputs.map(pick), fromSet.inputs.map(pick));
    assert.deepEqual(cfg.unknownKeys, []);
  });
});
