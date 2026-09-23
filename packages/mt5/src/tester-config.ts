import { parseSetFile, type SetFile } from "./set-file.js";
import { timeframeFromCode } from "./timeframes.js";

/**
 * MT5 Strategy Tester settings as copied with Ctrl+C in the tester's Settings
 * tab or saved as .ini: a [Tester] section plus [TesterInputs] in .set format.
 * Key meanings follow the MT5 "Configuration at startup" documentation.
 */

export type TesterModel = "every_tick" | "ohlc_m1" | "open_prices" | "math" | "real_ticks";

export interface TesterConfig {
  expert?: string;
  symbol?: string;
  period?: string;
  model?: TesterModel;
  fromDate?: string;
  toDate?: string;
  forward?: { mode: "off" | "1/2" | "1/3" | "1/4" | "custom"; date?: string };
  deposit?: number;
  currency?: string;
  leverage?: number;
  delay?: { mode: "none" | "random" | "fixed"; ms?: number };
  optimization?: "disabled" | "complete" | "genetic" | "all_symbols";
  criterion?: number;
  inputs: SetFile | null;
  /** Keys present in the text that were not recognized (shown to the user). */
  unknownKeys: string[];
}

const TESTER_KEYS = new Set([
  "expert", "expertparameters", "symbol", "period", "login", "model", "executionmode", "optimization",
  "optimizationcriterion", "fromdate", "todate", "forwardmode", "forwarddate", "report", "replacereport",
  "shutdownterminal", "deposit", "currency", "profitinpips", "leverage", "uselocal",
  "useremote", "usecloud", "visual", "port",
]);

const MODELS: TesterModel[] = ["every_tick", "ohlc_m1", "open_prices", "math", "real_ticks"];
const FORWARD = ["off", "1/2", "1/3", "1/4", "custom"] as const;
const OPTIMIZATION = ["disabled", "complete", "genetic", "all_symbols"] as const;

/** "2018.03.01" → "2018-03-01" */
function isoDate(s: string): string | undefined {
  const m = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})/.exec(s.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

export function parseTesterConfig(text: string): TesterConfig {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const tester = new Map<string, string>();
  const inputLines: string[] = [];
  const unknownKeys: string[] = [];
  let section: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) {
      section = sec[1]!.trim().toLowerCase();
      continue;
    }
    if (line.startsWith(";")) {
      if (section === "testerinputs") inputLines.push(line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    const lower = key.toLowerCase();
    if (section === "testerinputs" || (section === null && !TESTER_KEYS.has(lower))) {
      inputLines.push(line);
    } else if (section === "tester" || section === null) {
      tester.set(lower, value);
    } else {
      unknownKeys.push(`[${section}] ${key}`);
    }
  }

  if (tester.size === 0 && inputLines.length === 0) {
    throw new Error("No se reconoce la configuración del probador. En MT5, pestaña Configuración del probador, pulsa Ctrl+C y pega aquí el texto.");
  }

  const cfg: TesterConfig = { inputs: null, unknownKeys };
  const get = (k: string) => tester.get(k);

  const expert = get("expert");
  if (expert) cfg.expert = expert.replace(/\.ex5$/i, "").split(/[\\/]/).pop()!;
  const symbol = get("symbol");
  if (symbol) cfg.symbol = symbol.toUpperCase();
  const period = get("period");
  if (period) cfg.period = /^\d+$/.test(period) ? timeframeFromCode(Number(period)) ?? period : period.toUpperCase();
  const model = get("model");
  if (model !== undefined && MODELS[Number(model)]) cfg.model = MODELS[Number(model)]!;
  const from = get("fromdate");
  if (from) {
    const d = isoDate(from);
    if (d) cfg.fromDate = d;
  }
  const to = get("todate");
  if (to) {
    const d = isoDate(to);
    if (d) cfg.toDate = d;
  }
  const fwd = get("forwardmode");
  if (fwd !== undefined && FORWARD[Number(fwd)]) {
    cfg.forward = { mode: FORWARD[Number(fwd)]! };
    const fd = get("forwarddate");
    const d = fd ? isoDate(fd) : undefined;
    if (d) cfg.forward.date = d;
  }
  const deposit = Number(get("deposit"));
  if (get("deposit") !== undefined && Number.isFinite(deposit)) cfg.deposit = deposit;
  const currency = get("currency");
  if (currency) cfg.currency = currency.toUpperCase();
  const leverage = get("leverage");
  if (leverage) {
    const n = Number(leverage.includes(":") ? leverage.split(":")[1] : leverage);
    if (Number.isFinite(n) && n > 0) cfg.leverage = n;
  }
  const exec = get("executionmode");
  if (exec !== undefined) {
    const n = Number(exec);
    if (n === 0) cfg.delay = { mode: "none" };
    else if (n < 0) cfg.delay = { mode: "random" };
    else if (n > 0) cfg.delay = { mode: "fixed", ms: n };
  }
  const opt = get("optimization");
  if (opt !== undefined && OPTIMIZATION[Number(opt)]) cfg.optimization = OPTIMIZATION[Number(opt)]!;
  const crit = get("optimizationcriterion");
  if (crit !== undefined && Number.isFinite(Number(crit))) cfg.criterion = Number(crit);

  const inputsText = inputLines.filter((l) => !l.startsWith(";") || l.startsWith("; ==")).join("\n");
  if (inputLines.some((l) => !l.startsWith(";"))) {
    const set = parseSetFile(inputsText);
    if (!set.expertName && cfg.expert) set.expertName = cfg.expert;
    cfg.inputs = set;
  }
  return cfg;
}
