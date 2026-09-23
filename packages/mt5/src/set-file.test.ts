import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseSetFile, serializeSetFile } from "./set-file.js";
import { decodeMt5Text, encodeUtf16le } from "./text.js";

const SAMPLE = [
  "; saved automatically on 2026.09.21 21:02:59",
  "; this file contains last used input parameters for testing/optimizing ORB Demo expert advisor",
  "; === 0) Reference ===",
  "Ref_Columns=cash open-close | OpenHour/Min",
  "; === 1) Session ===",
  "InpExchangeTZ=0||0||0||3||N",
  "InpOpenHour=9||9||1||90||Y",
  "InpORBuildTFSel=5||1||0||49153||N",
  "InpATR_TFSel=16408||1||0||49153||N",
  "InpCLV_LongMin=0.5||0.5||0.050000||5.000000||N",
  "InpMinStopATR=0.0||0.0||0.000000||0.000000||N",
  "InpUseBreakEven=false||false||0||true||N",
  "; === 2) Size ===",
  "InpSizeMode=2",
  "InpRiskPercent=1.0",
  "InpUseRiskCap=true",
  "InpComment=PLSystems_ORB",
].join("\r\n");

describe("parseSetFile", () => {
  const set = parseSetFile(SAMPLE);
  const by = (n: string) => set.inputs.find((i) => i.name === n)!;

  it("reads header, groups and every input", () => {
    assert.equal(set.expertName, "ORB Demo");
    assert.equal(set.savedAt, "2026.09.21 21:02:59");
    assert.deepEqual(set.groups, ["0) Reference", "1) Session", "2) Size"]);
    assert.equal(set.inputs.length, 12);
    assert.equal(by("InpOpenHour").group, "1) Session");
  });

  it("infers kinds from MT5 conventions", () => {
    assert.equal(by("InpExchangeTZ").kind, "enum");
    assert.deepEqual(by("InpExchangeTZ").options, ["0", "1", "2", "3"]);
    assert.equal(by("InpOpenHour").kind, "int");
    assert.equal(by("InpORBuildTFSel").kind, "timeframe");
    assert.equal(by("InpATR_TFSel").kind, "timeframe");
    assert.equal(by("InpCLV_LongMin").kind, "double");
    assert.equal(by("InpMinStopATR").kind, "double");
    assert.equal(by("InpUseBreakEven").kind, "bool");
    assert.equal(by("InpSizeMode").kind, "int");
    assert.equal(by("InpRiskPercent").kind, "double");
    assert.equal(by("InpUseRiskCap").kind, "bool");
    assert.equal(by("InpComment").kind, "string");
    assert.equal(by("Ref_Columns").kind, "string");
  });

  it("keeps optimization flags and ranges", () => {
    assert.equal(by("InpOpenHour").optimize, true);
    assert.equal(by("InpOpenHour").stop, "90");
    assert.equal(by("InpExchangeTZ").optimize, false);
    assert.equal(by("InpSizeMode").optimizable, false);
  });

  it("round-trips through serializeSetFile", () => {
    const again = parseSetFile(serializeSetFile({ expertName: set.expertName, inputs: set.inputs }));
    assert.equal(again.expertName, "ORB Demo");
    assert.deepEqual(
      again.inputs.map(({ name, value, optimize, start, step, stop }) => ({ name, value, optimize, start, step, stop })),
      set.inputs.map(({ name, value, optimize, start, step, stop }) => ({ name, value, optimize, start, step, stop })),
    );
  });

  it("decodes UTF-16LE with BOM as MT5 writes it", () => {
    const decoded = decodeMt5Text(encodeUtf16le(SAMPLE));
    assert.equal(parseSetFile(decoded).inputs.length, 12);
  });

  it("rejects files without inputs", () => {
    assert.throws(() => parseSetFile("; only a comment\n"));
  });
});

// Optional: validate against real MT5 files kept outside git.
const samples = process.env["MT5_SAMPLES"];
describe("real MT5 .set (MT5_SAMPLES)", { skip: !samples }, () => {
  it("parses every .set in the folder", () => {
    const file = join(samples!, "sample.set");
    if (!existsSync(file)) return;
    const set = parseSetFile(decodeMt5Text(readFileSync(file)));
    assert.ok(set.inputs.length > 0);
    assert.ok(set.expertName);
  });
});
