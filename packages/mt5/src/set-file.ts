import { MT5_TIMEFRAME_CODES, timeframeFromCode } from "./timeframes.js";

/**
 * MT5 .set line formats:
 *   Name=value||start||step||stop||Y|N   optimizable input (Y = optimize)
 *   Name=value                           sinput / string: fixed, never optimized
 * Enums are written with step 0 and start/stop as the first/last enum value;
 * booleans as false||false||0||true.
 */

export type SetInputKind = "bool" | "int" | "double" | "enum" | "timeframe" | "string";

export interface SetInput {
  name: string;
  group: string | null;
  kind: SetInputKind;
  value: string;
  optimizable: boolean;
  optimize: boolean;
  start?: string;
  step?: string;
  stop?: string;
  /** For enum/timeframe: allowed values (codes as strings). */
  options?: string[];
}

export interface SetFile {
  expertName: string | null;
  savedAt: string | null;
  groups: string[];
  inputs: SetInput[];
}

const TF_CODES = Object.entries(MT5_TIMEFRAME_CODES)
  .filter(([k]) => k !== "CURRENT")
  .map(([, v]) => v);

const isIntText = (s: string) => /^-?\d+$/.test(s.trim());
const isNumText = (s: string) => s.trim() !== "" && Number.isFinite(Number(s));

function inferKind(value: string, parts: string[] | null): { kind: SetInputKind; options?: string[] } {
  const v = value.trim();
  if (v === "true" || v === "false") return { kind: "bool" };
  if (!parts) {
    if (isIntText(v)) return { kind: "int" };
    if (isNumText(v)) return { kind: "double" };
    return { kind: "string" };
  }
  const [start = "", step = "", stop = ""] = parts;
  const allInt = [v, start, stop].every(isIntText);
  if (allInt && Number(step) === 0) {
    const stopN = Number(stop);
    const valueN = Number(v);
    if (stopN === MT5_TIMEFRAME_CODES["MN1"] && (valueN === 0 || timeframeFromCode(valueN))) {
      return { kind: "timeframe", options: TF_CODES.map(String) };
    }
    const from = Number(start);
    const count = stopN - from + 1;
    if (count >= 1 && count <= 256) {
      return { kind: "enum", options: Array.from({ length: count }, (_, i) => String(from + i)) };
    }
  }
  if (allInt && isIntText(step)) return { kind: "int" };
  return { kind: "double" };
}

export function parseSetFile(text: string): SetFile {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let expertName: string | null = null;
  let savedAt: string | null = null;
  let group: string | null = null;
  const groups: string[] = [];
  const inputs: SetInput[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(";")) {
      const saved = /saved automatically on\s+(.+)$/i.exec(line);
      if (saved) savedAt = saved[1]!.trim();
      const ea = /for testing\/optimizing\s+(.+?)\s+expert advisor/i.exec(line);
      if (ea) expertName = ea[1]!.trim();
      const g = /^;\s*={2,}\s*(.*?)\s*=*\s*$/.exec(line);
      if (g && g[1]) {
        group = g[1];
        groups.push(group);
      }
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    const rest = line.slice(eq + 1);
    if (seen.has(name)) continue;
    seen.add(name);

    const fields = rest.split("||");
    const optimizable = fields.length >= 5;
    const value = (fields[0] ?? "").trim();
    const parts = optimizable ? fields.slice(1, 4).map((f) => f.trim()) : null;
    const { kind, options } = inferKind(value, parts);
    const input: SetInput = {
      name,
      group,
      kind,
      value,
      optimizable,
      optimize: optimizable && (fields[4] ?? "").trim().toUpperCase() === "Y",
    };
    if (parts) {
      input.start = parts[0]!;
      input.step = parts[1]!;
      input.stop = parts[2]!;
    }
    if (options) input.options = options;
    inputs.push(input);
  }

  if (inputs.length === 0) {
    throw new Error("El archivo no contiene inputs con formato .set de MT5 (Nombre=valor).");
  }
  return { expertName, savedAt, groups, inputs };
}

export function serializeSetFile(file: {
  expertName: string | null;
  inputs: readonly SetInput[];
  note?: string;
}): string {
  const out: string[] = [];
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ").replace(/-/g, ".");
  out.push(`; saved by Hypsometra on ${stamp}`);
  if (file.expertName) {
    out.push(`; this file contains input parameters for testing/optimizing ${file.expertName} expert advisor`);
  }
  if (file.note) out.push(`; ${file.note}`);
  let group: string | null = null;
  for (const i of file.inputs) {
    if (i.group !== group && i.group) out.push(`; === ${i.group} ===`);
    group = i.group;
    if (i.optimizable) {
      out.push(`${i.name}=${i.value}||${i.start ?? i.value}||${i.step ?? "0"}||${i.stop ?? i.value}||${i.optimize ? "Y" : "N"}`);
    } else {
      out.push(`${i.name}=${i.value}`);
    }
  }
  return out.join("\r\n") + "\r\n";
}
