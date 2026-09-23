import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTesterConfig } from "./tester-config.js";

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
