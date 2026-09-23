import type {
  StrategyDefinition,
  StrategyParamSpec,
} from "@hypsometra/engine/registry";
import {
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

export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440,
};

export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY"] as const;
export const LEVERAGES = [1, 10, 20, 30, 50, 100, 200, 500, 1000] as const;

export interface DatasetMeta {
  id: string;
  symbol: string;
  timeframe: string;
  barCount: number;
  from: number;
  to: number;
  originalFilename?: string;
}

export interface SymbolSpec {
  contractSize: number;
  digits: number;
  spreadPoints: number;
  commissionPerLot: number;
  swapLong: number;
  swapShort: number;
}

export const SYMBOL_PRESETS: Record<string, SymbolSpec> = {
  XAUUSD: { contractSize: 100, digits: 2, spreadPoints: 20, commissionPerLot: 7, swapLong: -35, swapShort: 15 },
  EURUSD: { contractSize: 100_000, digits: 5, spreadPoints: 8, commissionPerLot: 7, swapLong: -6, swapShort: 1.5 },
  GBPUSD: { contractSize: 100_000, digits: 5, spreadPoints: 10, commissionPerLot: 7, swapLong: -4, swapShort: -1 },
};

export interface ParamSetting {
  value: string;
  optimize: boolean;
  start: string;
  step: string;
  stop: string;
}

export type PeriodPreset = "all" | "last1y" | "last3y" | "last5y" | "custom";
export type ValidationMode = "none" | "forward" | "walkforward";
export type WfDefinition = "duration" | "runs" | "manual";
export type Criterion =
  | "netProfit"
  | "profitFactor"
  | "recoveryFactor"
  | "sharpe"
  | "maxDrawdownPct";

export interface ManualWindow {
  isFrom: string;
  isTo: string;
  oosFrom: string;
  oosTo: string;
}

export interface StudyConfig {
  version: 1;
  name: string;
  strategyId: string;
  datasetId: string | null;
  symbol: string;
  chartTimeframe: Timeframe;
  period: { preset: PeriodPreset; from: string; to: string };
  modeling: "ohlc_m1" | "open_prices";
  delay: { mode: "none" | "fixed" | "random"; ms: number };
  account: { deposit: number; currency: string; leverage: number };
  symbolSpec: SymbolSpec;
  params: Record<string, ParamSetting>;
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

export function paramDefaults(def: StrategyDefinition | undefined): Record<string, ParamSetting> {
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

export function defaultStudy(def: StrategyDefinition | undefined): StudyConfig {
  return {
    version: 1,
    name: "Estudio sin título",
    strategyId: def?.id ?? "sma_cross",
    datasetId: null,
    symbol: "XAUUSD",
    chartTimeframe: "H1",
    period: { preset: "custom", from: "2018-03-01", to: "2026-09-20" },
    modeling: "ohlc_m1",
    delay: { mode: "random", ms: 50 },
    account: { deposit: 100_000, currency: "USD", leverage: 30 },
    symbolSpec: { ...SYMBOL_PRESETS["XAUUSD"]! },
    params: paramDefaults(def),
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

const STORAGE_KEY = "hypsometra.study.v1";

export function loadStudy(): StudyConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyConfig;
    return parsed.version === 1 ? parsed : null;
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

// ------------------------------------------------------------------ dates

export function parseDay(s: string): number {
  return Date.parse(`${s}T00:00:00Z`);
}

export function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Display format used by MT5: 2018.03.01 */
export function formatDayMt5(ms: number): string {
  return formatDay(ms).replace(/-/g, ".");
}

/** Resolved period as half-open UTC ms range; the end date is inclusive for the user. */
export function resolvePeriod(
  study: StudyConfig,
  dataset: DatasetMeta | undefined,
): { from: number; to: number } | null {
  const p = study.period;
  if (p.preset !== "custom" && dataset) {
    const to = Math.floor(dataset.to / DAY_MS) * DAY_MS + DAY_MS;
    if (p.preset === "all") {
      return { from: Math.floor(dataset.from / DAY_MS) * DAY_MS, to };
    }
    const years = p.preset === "last1y" ? 1 : p.preset === "last3y" ? 3 : 5;
    const d = new Date(to);
    const from = Date.UTC(d.getUTCFullYear() - years, d.getUTCMonth(), d.getUTCDate());
    return { from: Math.max(from, Math.floor(dataset.from / DAY_MS) * DAY_MS), to };
  }
  const from = parseDay(p.from);
  const to = parseDay(p.to) + DAY_MS;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return { from, to };
}

export function periodIssues(
  period: { from: number; to: number } | null,
  dataset: DatasetMeta | undefined,
): string[] {
  if (!period) return ["El periodo no es válido: la fecha final debe ser posterior a la inicial."];
  if (!dataset) return [];
  const issues: string[] = [];
  if (period.from < Math.floor(dataset.from / DAY_MS) * DAY_MS) {
    issues.push(`Los datos empiezan el ${formatDayMt5(dataset.from)}; el periodo empieza antes.`);
  }
  if (period.to > Math.floor(dataset.to / DAY_MS) * DAY_MS + DAY_MS) {
    issues.push(`Los datos terminan el ${formatDayMt5(dataset.to)}; el periodo termina después.`);
  }
  return issues;
}

// ------------------------------------------------------------------ parameters

export interface ParamAxis {
  spec: StrategyParamSpec;
  values: number;
  error: string | null;
}

export function paramAxis(spec: StrategyParamSpec, s: ParamSetting): ParamAxis {
  if (!s.optimize) return { spec, values: 1, error: null };
  if (spec.type === "bool") return { spec, values: 2, error: null };
  if (spec.type === "enum") return { spec, values: spec.options?.length ?? 1, error: null };
  const start = Number(s.start);
  const step = Number(s.step);
  const stop = Number(s.stop);
  if (![start, step, stop].every(Number.isFinite)) {
    return { spec, values: 0, error: "Inicio, paso y fin deben ser números." };
  }
  if (!(step > 0)) return { spec, values: 0, error: "El paso debe ser mayor que 0." };
  if (stop < start) return { spec, values: 0, error: "El fin no puede ser menor que el inicio." };
  if (spec.type === "int" && [start, step, stop].some((n) => !Number.isInteger(n))) {
    return { spec, values: 0, error: "Parámetro entero: usa valores enteros." };
  }
  const values = expandParam({
    name: spec.name,
    kind: spec.type === "int" ? "int" : "float",
    from: start,
    to: stop,
    step,
  }).length;
  return { spec, values, error: null };
}

export function combinationCount(axes: ParamAxis[]): number {
  if (axes.some((a) => a.error)) return 0;
  return axes.reduce((acc, a) => acc * a.values, 1);
}

// ------------------------------------------------------------------ validation windows

export interface WindowPlan {
  windows: ValidationWindow[];
  issues: WindowIssue[];
  error: string | null;
  coverage: number;
}

export function planWindows(
  study: StudyConfig,
  period: { from: number; to: number } | null,
): WindowPlan {
  const empty: WindowPlan = { windows: [], issues: [], error: null, coverage: 0 };
  if (!period) return { ...empty, error: "Define un periodo válido en Configuración." };
  const v = study.validation;
  try {
    if (v.mode === "none") {
      return {
        windows: [{ index: 0, isFrom: period.from, isTo: period.to, oosFrom: period.to, oosTo: period.to }],
        issues: [],
        error: null,
        coverage: 0,
      };
    }
    if (v.mode === "forward") {
      const w =
        v.forward.split === "custom"
          ? forwardSplit({ ...period, forwardFrom: parseDay(v.forward.from) })
          : forwardSplit({ ...period, fraction: v.forward.split });
      return { windows: [w], issues: [], error: null, coverage: oosCoverage([w], period) };
    }
    const wf = v.wf;
    let windows: ValidationWindow[];
    if (wf.definition === "duration") {
      windows = generateWindowsByDuration({
        ...period,
        mode: wf.mode,
        inSample: wf.inSample,
        outOfSample: wf.outOfSample,
        step: wf.stepEqualsOos ? wf.outOfSample : wf.step,
      });
    } else if (wf.definition === "runs") {
      windows = generateWindowsByRuns({ ...period, mode: wf.mode, runs: wf.runs, oosPercent: wf.oosPercent });
    } else {
      windows = wf.manual.map((m, index) => ({
        index,
        isFrom: parseDay(m.isFrom),
        isTo: parseDay(m.isTo),
        oosFrom: parseDay(m.oosFrom),
        oosTo: parseDay(m.oosTo),
      }));
      if (windows.some((w) => [w.isFrom, w.isTo, w.oosFrom, w.oosTo].some((x) => !Number.isFinite(x)))) {
        return { ...empty, windows: [], error: "Hay fechas vacías o inválidas en la tabla manual." };
      }
    }
    return {
      windows,
      issues: validateWindows(windows, period),
      error: null,
      coverage: oosCoverage(windows, period),
    };
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

// ------------------------------------------------------------------ run plan

export interface RunPlan {
  combinations: number;
  windows: number;
  passesPerWindow: number;
  totalPasses: number;
  barsPerPassM1: number;
}

export function planRun(
  study: StudyConfig,
  combinations: number,
  plan: WindowPlan,
  period: { from: number; to: number } | null,
): RunPlan {
  const windows = study.validation.mode === "none" ? 1 : plan.windows.length;
  const passesPerWindow =
    study.optimization.method === "complete"
      ? combinations
      : Math.min(combinations, study.optimization.genetic.population * study.optimization.genetic.generations);
  const days = period ? (period.to - period.from) / DAY_MS : 0;
  // ~5 trading days/week, ~23h/day for XAUUSD-like CFDs
  const barsPerPassM1 = Math.round(days * (5 / 7) * 23 * 60);
  return { combinations, windows, passesPerWindow, totalPasses: passesPerWindow * windows, barsPerPassM1 };
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}
