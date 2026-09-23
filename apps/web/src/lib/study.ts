import type { StrategyDefinition, StrategyParamSpec } from "@hypsometra/engine/registry";
import { STRATEGIES } from "@hypsometra/engine/registry";
import {
  serializeSetFile,
  timeframeFromCode,
  type Session,
  type SetFile,
  type SetInput,
  type SymbolSpecification,
  type TesterConfig,
} from "@hypsometra/mt5";
import {
  addDuration,
  expandParam,
  forwardSplit,
  generateWindowsByDuration,
  generateWindowsByRuns,
  oosCoverage,
  validateWindows,
  type Duration,
  type ForwardFraction,
  type ValidationWindow,
  type WindowIssue,
  type WindowMode,
} from "@hypsometra/opt/planning";

export const DAY_MS = 86_400_000;

export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  M1: "M1", M5: "M5", M15: "M15", M30: "M30", H1: "H1", H4: "H4", D1: "D1", W1: "W1 (semanal)", MN1: "MN1 (mensual)",
};

export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440, W1: 10_080, MN1: 43_200,
};

export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "AUD", "CAD"] as const;
export const LEVERAGES = [1, 2, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000] as const;

export interface DatasetMeta {
  id: string;
  symbol: string;
  timeframe: string;
  barCount: number;
  from: number;
  to: number;
  originalFilename?: string;
}

// ------------------------------------------------------------------ provenance

export interface Source {
  kind: "default" | "file" | "tester" | "manual";
  /** File name or short description shown next to the imported block. */
  label: string;
}

// ------------------------------------------------------------------ symbol

export interface StudySpec {
  source: Source;
  symbol: string;
  description: string;
  digits: number;
  tickSize: number;
  tickValue: number;
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  calcModeLabel: string;
  marginRateBuy: number;
  marginRateSell: number;
  swapModeLabel: string;
  swapLong: number;
  swapShort: number;
  swap3Day: number;
  sessions: Session[][] | null;
  spread: { mode: "data" | "fixed"; points: number };
  /** Round-turn commission per lot in deposit currency. Not part of the MT5 spec. */
  commissionPerLot: number;
}

const XAUUSD_EXAMPLE: Omit<StudySpec, "source"> = {
  symbol: "XAUUSD", description: "Gold vs US Dollar", digits: 2, tickSize: 0.01, tickValue: 1, contractSize: 100,
  volumeMin: 0.01, volumeMax: 100, volumeStep: 0.01, calcModeLabel: "CFD", marginRateBuy: 0.05, marginRateSell: 0.05,
  swapModeLabel: "En puntos", swapLong: -35, swapShort: 15, swap3Day: 3, sessions: null,
  spread: { mode: "data", points: 20 }, commissionPerLot: 0,
};

export function specFromMt5(s: SymbolSpecification, fileName: string, prev: StudySpec): StudySpec {
  return {
    source: { kind: "file", label: fileName },
    symbol: s.symbol,
    description: s.description,
    digits: s.digits,
    tickSize: s.tickSize,
    tickValue: s.tickValue,
    contractSize: s.contractSize,
    volumeMin: s.volumeMin,
    volumeMax: s.volumeMax,
    volumeStep: s.volumeStep,
    calcModeLabel: s.calcModeLabel,
    marginRateBuy: s.marginRateBuy,
    marginRateSell: s.marginRateSell,
    swapModeLabel: s.swapModeLabel,
    swapLong: s.swapLong,
    swapShort: s.swapShort,
    swap3Day: s.swap3Day,
    sessions: s.sessionsTrade.length === 7 ? s.sessionsTrade : null,
    spread: s.spreadPoints === null ? { mode: "data", points: prev.spread.points } : { mode: "fixed", points: s.spreadPoints },
    commissionPerLot: prev.commissionPerLot,
  };
}

// ------------------------------------------------------------------ parameters

export type ParamKind = "int" | "double" | "bool" | "enum" | "string";

/** Unified input definition: from the engine registry or imported from a .set. */
export interface ParamDef {
  name: string;
  label: string;
  kind: ParamKind;
  group: string | null;
  optimizable: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface ParamSetting {
  value: string;
  optimize: boolean;
  start: string;
  step: string;
  stop: string;
}

function defFromRegistry(p: StrategyParamSpec): ParamDef {
  const def: ParamDef = { name: p.name, label: p.label, kind: p.type, group: null, optimizable: true };
  if (p.options) def.options = p.options;
  return def;
}

function defFromSet(i: SetInput): ParamDef {
  const def: ParamDef = {
    name: i.name,
    label: i.name,
    kind: i.kind === "timeframe" ? "enum" : i.kind,
    group: i.group,
    optimizable: i.optimizable,
  };
  if (i.options) {
    def.options = i.options.map((v) => ({
      value: v,
      label: i.kind === "timeframe" ? (timeframeFromCode(Number(v)) ?? v) : v,
    }));
    if (i.kind === "timeframe" && !i.options.includes("0")) def.options.unshift({ value: "0", label: "Actual" });
  }
  return def;
}

export function paramDefs(study: StudyConfig, strategy: StrategyDefinition | undefined): ParamDef[] {
  if (study.inputs) return study.inputs.inputs.map(defFromSet);
  return (strategy?.params ?? []).map(defFromRegistry);
}

export function registryDefaults(def: StrategyDefinition | undefined): Record<string, ParamSetting> {
  const out: Record<string, ParamSetting> = {};
  for (const p of def?.params ?? []) {
    out[p.name] = {
      value: String(p.default),
      optimize: false,
      start: String(p.range?.start ?? p.default),
      step: String(p.range?.step ?? 1),
      stop: String(p.range?.stop ?? p.default),
    };
  }
  return out;
}

function settingsFromSet(set: SetFile): Record<string, ParamSetting> {
  const out: Record<string, ParamSetting> = {};
  for (const i of set.inputs) {
    out[i.name] = {
      value: i.value,
      optimize: i.optimize,
      start: i.start ?? i.value,
      step: i.step ?? "0",
      stop: i.stop ?? i.value,
    };
  }
  return out;
}

export interface ParamAxis {
  def: ParamDef;
  values: number;
  error: string | null;
}

export function paramAxis(def: ParamDef, s: ParamSetting): ParamAxis {
  if (!s.optimize || !def.optimizable) return { def, values: 1, error: null };
  if (def.kind === "bool") {
    return { def, values: s.start === s.stop ? 1 : 2, error: null };
  }
  if (def.kind === "enum") {
    const opts = def.options ?? [];
    const a = opts.findIndex((o) => o.value === s.start);
    const b = opts.findIndex((o) => o.value === s.stop);
    if (a < 0 || b < 0) return { def, values: opts.length || 1, error: null };
    if (b < a) return { def, values: 0, error: "El fin va antes que el inicio." };
    return { def, values: b - a + 1, error: null };
  }
  if (def.kind === "string") return { def, values: 1, error: null };
  const start = Number(s.start);
  const step = Number(s.step);
  const stop = Number(s.stop);
  if (![start, step, stop].every(Number.isFinite)) {
    return { def, values: 0, error: "Inicio, paso y fin deben ser números." };
  }
  if (!(step > 0)) return { def, values: 0, error: "El paso debe ser mayor que 0." };
  if (stop < start) return { def, values: 0, error: "El fin no puede ser menor que el inicio." };
  if (def.kind === "int" && [start, step, stop].some((n) => !Number.isInteger(n))) {
    return { def, values: 0, error: "Input entero: usa valores enteros." };
  }
  const values = expandParam({ name: def.name, kind: def.kind === "int" ? "int" : "float", from: start, to: stop, step }).length;
  return { def, values, error: null };
}

export function combinationCount(axes: ParamAxis[]): number {
  if (axes.some((a) => a.error)) return 0;
  return axes.reduce((acc, a) => acc * a.values, 1);
}

// ------------------------------------------------------------------ study

export type PeriodPreset = "all" | "last1y" | "last3y" | "last5y" | "custom";
export type ValidationMode = "none" | "forward" | "walkforward";
export type WfDefinition = "duration" | "runs" | "manual";
export type Criterion = "netProfit" | "profitFactor" | "recoveryFactor" | "sharpe" | "maxDrawdownPct";

export interface ManualWindow {
  isFrom: string;
  isTo: string;
  oosFrom: string;
  oosTo: string;
}

export interface StudyConfig {
  version: 2;
  name: string;
  strategyId: string;
  datasetId: string | null;
  symbol: string;
  chartTimeframe: Timeframe;
  period: { preset: PeriodPreset; from: string; to: string };
  unseen: { enabled: boolean; mode: "duration" | "date"; duration: Duration; from: string };
  modeling: "ohlc_m1" | "open_prices";
  delay: { mode: "none" | "fixed" | "random"; ms: number };
  account: { deposit: number; currency: string; leverage: number };
  spec: StudySpec;
  /** Input schema imported from a .set; null means use the engine registry. */
  inputs: SetFile | null;
  params: Record<string, ParamSetting>;
  sources: { tester: Source | null; set: Source | null };
  validation: {
    mode: ValidationMode;
    forward: { split: ForwardFraction | "custom"; from: string };
    wf: {
      mode: WindowMode;
      definition: WfDefinition;
      inSample: Duration;
      outOfSample: Duration;
      step: Duration;
      stepEqualsOos: boolean;
      runs: number;
      oosPercent: number;
      manual: ManualWindow[];
    };
  };
  optimization: {
    method: "complete" | "genetic";
    criterion: Criterion;
    genetic: { population: number; generations: number; mutation: number; seed: number };
    oosSelection: "best" | "top_percent";
    topPercent: number;
    cores: number;
  };
}

export const CRITERIA: Array<{ id: Criterion; label: string }> = [
  { id: "netProfit", label: "Beneficio neto máximo" },
  { id: "profitFactor", label: "Factor de beneficio máximo" },
  { id: "recoveryFactor", label: "Factor de recuperación máximo" },
  { id: "sharpe", label: "Ratio de Sharpe máximo" },
  { id: "maxDrawdownPct", label: "Drawdown relativo mínimo" },
];

export function defaultStudy(def: StrategyDefinition | undefined): StudyConfig {
  return {
    version: 2,
    name: "Estudio sin título",
    strategyId: def?.id ?? "sma_cross",
    datasetId: null,
    symbol: "XAUUSD",
    chartTimeframe: "H1",
    period: { preset: "custom", from: "2018-03-01", to: "2026-09-20" },
    unseen: { enabled: true, mode: "duration", duration: { value: 12, unit: "months" }, from: "2025-09-21" },
    modeling: "ohlc_m1",
    delay: { mode: "random", ms: 50 },
    account: { deposit: 100_000, currency: "USD", leverage: 30 },
    spec: { ...XAUUSD_EXAMPLE, source: { kind: "default", label: "Valores de ejemplo" } },
    inputs: null,
    params: registryDefaults(def),
    sources: { tester: null, set: null },
    validation: {
      mode: "walkforward",
      forward: { split: "1/3", from: "2023-03-14" },
      wf: {
        mode: "rolling",
        definition: "duration",
        inSample: { value: 24, unit: "months" },
        outOfSample: { value: 6, unit: "months" },
        step: { value: 6, unit: "months" },
        stepEqualsOos: true,
        runs: 10,
        oosPercent: 20,
        manual: [],
      },
    },
    optimization: {
      method: "genetic",
      criterion: "netProfit",
      genetic: { population: 256, generations: 30, mutation: 0.2, seed: 42 },
      oosSelection: "best",
      topPercent: 25,
      cores: 4,
    },
  };
}

const STORAGE_KEY = "hypsometra.study.v2";

export function loadStudy(): StudyConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyConfig;
    return parsed.version === 2 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStudy(study: StudyConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(study));
  } catch {
    // Storage full or disabled: the study still lives in memory.
  }
}

// ------------------------------------------------------------------ MT5 imports

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findStrategyByExpert(expert: string | null | undefined): StrategyDefinition | undefined {
  if (!expert) return undefined;
  const key = norm(expert.split(/[\\/]/).pop()!.replace(/\.ex5$/i, ""));
  return STRATEGIES.find((s) => norm(s.name) === key || norm(s.id) === key);
}

/** Apply a .set to the study. Returns a human summary of what changed. */
export function applySetFile(s: StudyConfig, set: SetFile, fileName: string): string[] {
  const notes: string[] = [];
  const match = findStrategyByExpert(set.expertName);
  if (match) {
    s.strategyId = match.id;
    notes.push(`Experto: ${match.name}${match.status === "pending-port" ? " (pendiente de portar)" : ""}.`);
  } else if (set.expertName) {
    notes.push(`"${set.expertName}" aún no está portado a Hypsometra: sus inputs se guardan, pero no se puede ejecutar.`);
  }
  s.inputs = set;
  s.params = settingsFromSet(set);
  s.sources.set = { kind: "file", label: fileName };
  const optimized = set.inputs.filter((i) => i.optimize).length;
  notes.push(`${set.inputs.length} inputs en ${set.groups.length} grupos; ${optimized} marcados para optimizar.`);
  return notes;
}

export function applyTesterConfig(s: StudyConfig, cfg: TesterConfig): string[] {
  const notes: string[] = [];
  if (cfg.symbol) {
    s.symbol = cfg.symbol;
    notes.push(`Símbolo ${cfg.symbol}.`);
  }
  if (cfg.period && (TIMEFRAMES as readonly string[]).includes(cfg.period)) {
    s.chartTimeframe = cfg.period as Timeframe;
    notes.push(`Temporalidad ${cfg.period}.`);
  } else if (cfg.period) {
    notes.push(`La temporalidad ${cfg.period} no está disponible; se mantiene ${s.chartTimeframe}.`);
  }
  if (cfg.fromDate && cfg.toDate) {
    s.period = { preset: "custom", from: cfg.fromDate, to: cfg.toDate };
    notes.push(`Intervalo ${cfg.fromDate} → ${cfg.toDate}.`);
  }
  if (cfg.model === "ohlc_m1" || cfg.model === "open_prices") {
    s.modeling = cfg.model;
  } else if (cfg.model) {
    s.modeling = "ohlc_m1";
    notes.push("MT5 usaba modelado por ticks; Hypsometra trabaja con OHLC en M1.");
  }
  if (cfg.delay) {
    s.delay = { mode: cfg.delay.mode, ms: cfg.delay.ms ?? s.delay.ms };
  }
  if (cfg.deposit !== undefined) s.account.deposit = cfg.deposit;
  if (cfg.currency) s.account.currency = cfg.currency;
  if (cfg.leverage !== undefined) s.account.leverage = cfg.leverage;
  if (cfg.deposit !== undefined || cfg.leverage !== undefined) {
    notes.push(`Cuenta: ${s.account.deposit.toLocaleString("es-ES")} ${s.account.currency}, 1:${s.account.leverage}.`);
  }
  if (cfg.forward && cfg.forward.mode !== "off") {
    s.validation.mode = "forward";
    s.validation.forward = {
      split: cfg.forward.mode === "custom" ? "custom" : cfg.forward.mode,
      from: cfg.forward.date ?? s.validation.forward.from,
    };
    notes.push("Forward de MT5 importado; puedes cambiarlo a walk-forward en Validación.");
  }
  if (cfg.optimization === "complete" || cfg.optimization === "genetic") s.optimization.method = cfg.optimization;
  s.sources.tester = { kind: "tester", label: "Configuración del probador de MT5" };
  if (cfg.inputs) {
    notes.push(...applySetFile(s, cfg.inputs, "inputs del probador"));
  } else if (cfg.expert) {
    const match = findStrategyByExpert(cfg.expert);
    if (match) s.strategyId = match.id;
    notes.push(match ? `Experto: ${match.name}.` : `"${cfg.expert}" aún no está portado a Hypsometra.`);
  }
  return notes;
}

/** Export the current inputs in MT5 .set format (UTF-16 is applied by the caller). */
export function studyToSet(study: StudyConfig, defs: ParamDef[], expertName: string | null): string {
  const inputs: SetInput[] = defs.map((d) => {
    const p = study.params[d.name];
    const input: SetInput = {
      name: d.name,
      group: d.group,
      kind: d.kind,
      value: p?.value ?? "",
      optimizable: d.optimizable,
      optimize: Boolean(p?.optimize) && d.optimizable,
    };
    if (d.optimizable && p) {
      input.start = p.start;
      input.step = p.step;
      input.stop = p.stop;
    }
    return input;
  });
  return serializeSetFile({ expertName, inputs, note: `study: ${study.name}` });
}

// ------------------------------------------------------------------ dates & periods

export function parseDay(s: string): number {
  return Date.parse(`${s}T00:00:00Z`);
}

export function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** MT5 display format: 2018.03.01 */
export function formatDayMt5(ms: number): string {
  return formatDay(ms).replace(/-/g, ".");
}

export interface Range {
  from: number;
  to: number;
}

export interface Periods {
  /** Whole selected range, half-open; the user-facing end date is inclusive. */
  total: Range;
  /** Where optimization and validation windows live. */
  research: Range;
  /** Reserved final segment for the go / no-go test, or null. */
  unseen: Range | null;
}

function resolveTotal(study: StudyConfig, dataset: DatasetMeta | undefined): Range | null {
  const p = study.period;
  if (p.preset !== "custom" && dataset) {
    const to = Math.floor(dataset.to / DAY_MS) * DAY_MS + DAY_MS;
    const first = Math.floor(dataset.from / DAY_MS) * DAY_MS;
    if (p.preset === "all") return { from: first, to };
    const years = p.preset === "last1y" ? 1 : p.preset === "last3y" ? 3 : 5;
    const d = new Date(to);
    return { from: Math.max(first, Date.UTC(d.getUTCFullYear() - years, d.getUTCMonth(), d.getUTCDate())), to };
  }
  const from = parseDay(p.from);
  const to = parseDay(p.to) + DAY_MS;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return { from, to };
}

export function resolvePeriods(study: StudyConfig, dataset: DatasetMeta | undefined): Periods | null {
  const total = resolveTotal(study, dataset);
  if (!total) return null;
  if (!study.unseen.enabled) return { total, research: total, unseen: null };
  let cut: number;
  if (study.unseen.mode === "date") {
    cut = parseDay(study.unseen.from);
  } else {
    const back = { ...study.unseen.duration, value: -study.unseen.duration.value };
    cut = addDuration(total.to, back);
  }
  if (!Number.isFinite(cut) || cut <= total.from || cut >= total.to) {
    return { total, research: total, unseen: null };
  }
  return { total, research: { from: total.from, to: cut }, unseen: { from: cut, to: total.to } };
}

export function periodIssues(study: StudyConfig, periods: Periods | null, dataset: DatasetMeta | undefined): string[] {
  if (!periods) return ["El periodo no es válido: la fecha final debe ser posterior a la inicial."];
  const issues: string[] = [];
  if (study.unseen.enabled && !periods.unseen) {
    issues.push("El periodo no visto queda fuera del intervalo o lo ocupa entero: ajústalo.");
  }
  if (periods.unseen && periods.research.to - periods.research.from < (periods.total.to - periods.total.from) * 0.4) {
    issues.push("El periodo no visto ocupa más del 60 % del intervalo: queda poco para optimizar.");
  }
  if (dataset) {
    if (periods.total.from < Math.floor(dataset.from / DAY_MS) * DAY_MS) {
      issues.push(`Los datos empiezan el ${formatDayMt5(dataset.from)}; el intervalo empieza antes.`);
    }
    if (periods.total.to > Math.floor(dataset.to / DAY_MS) * DAY_MS + DAY_MS) {
      issues.push(`Los datos terminan el ${formatDayMt5(dataset.to)}; el intervalo termina después.`);
    }
  }
  return issues;
}

// ------------------------------------------------------------------ validation windows

export interface WindowPlan {
  windows: ValidationWindow[];
  issues: WindowIssue[];
  error: string | null;
  coverage: number;
}

export function planWindows(study: StudyConfig, research: Range | null): WindowPlan {
  const empty: WindowPlan = { windows: [], issues: [], error: null, coverage: 0 };
  if (!research) return { ...empty, error: "Define un intervalo válido en Configuración." };
  const v = study.validation;
  try {
    if (v.mode === "none") {
      return {
        windows: [{ index: 0, isFrom: research.from, isTo: research.to, oosFrom: research.to, oosTo: research.to }],
        issues: [],
        error: null,
        coverage: 0,
      };
    }
    if (v.mode === "forward") {
      const w =
        v.forward.split === "custom"
          ? forwardSplit({ ...research, forwardFrom: parseDay(v.forward.from) })
          : forwardSplit({ ...research, fraction: v.forward.split });
      return { windows: [w], issues: [], error: null, coverage: oosCoverage([w], research) };
    }
    const wf = v.wf;
    let windows: ValidationWindow[];
    if (wf.definition === "duration") {
      windows = generateWindowsByDuration({
        ...research,
        mode: wf.mode,
        inSample: wf.inSample,
        outOfSample: wf.outOfSample,
        step: wf.stepEqualsOos ? wf.outOfSample : wf.step,
      });
    } else if (wf.definition === "runs") {
      windows = generateWindowsByRuns({ ...research, mode: wf.mode, runs: wf.runs, oosPercent: wf.oosPercent });
    } else {
      windows = wf.manual.map((m, index) => ({
        index,
        isFrom: parseDay(m.isFrom),
        isTo: parseDay(m.isTo),
        oosFrom: parseDay(m.oosFrom),
        oosTo: parseDay(m.oosTo),
      }));
      if (windows.some((w) => [w.isFrom, w.isTo, w.oosFrom, w.oosTo].some((x) => !Number.isFinite(x)))) {
        return { ...empty, error: "Hay fechas vacías o inválidas en la tabla manual." };
      }
    }
    return { windows, issues: validateWindows(windows, research), error: null, coverage: oosCoverage(windows, research) };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Configuración inválida." };
  }
}

export function toManual(windows: ValidationWindow[]): ManualWindow[] {
  return windows.map((w) => ({
    isFrom: formatDay(w.isFrom),
    isTo: formatDay(w.isTo),
    oosFrom: formatDay(w.oosFrom),
    oosTo: formatDay(w.oosTo),
  }));
}

export function spanLabel(from: number, to: number): string {
  const days = Math.round((to - from) / DAY_MS);
  if (days >= 365 * 1.5) return `${(days / 365.25).toFixed(1)} años`;
  if (days >= 45) return `${Math.round(days / 30.44)} meses`;
  return `${days} días`;
}

export function rangeLabel(r: Range): string {
  return `${formatDayMt5(r.from)} → ${formatDayMt5(r.to - DAY_MS)}`;
}

// ------------------------------------------------------------------ run plan

export interface RunPlan {
  combinations: number;
  windows: number;
  passesPerWindow: number;
  totalPasses: number;
  barsPerPassM1: number;
}

export function planRun(study: StudyConfig, combinations: number, plan: WindowPlan, research: Range | null): RunPlan {
  const windows = study.validation.mode === "none" ? 1 : plan.windows.length;
  const passesPerWindow =
    study.optimization.method === "complete"
      ? combinations
      : Math.min(combinations, study.optimization.genetic.population * study.optimization.genetic.generations);
  const days = research ? (research.to - research.from) / DAY_MS : 0;
  // ~5 trading days per week, ~23 h per day for XAUUSD-like CFDs
  const barsPerPassM1 = Math.round(days * (5 / 7) * 23 * 60);
  return { combinations, windows, passesPerWindow, totalPasses: passesPerWindow * windows, barsPerPassM1 };
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}
