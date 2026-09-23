/**
 * Symbol specification exported from MT5 (Symbols window → Export).
 * Every value arrives as a string; volumes are stored in fixed-point units
 * (…Ext = 1e-8 lot, plain = 1e-4 lot).
 */

export interface Session {
  /** Minutes from midnight, server time. */
  open: number;
  close: number;
}

export interface SymbolSpecification {
  symbol: string;
  description: string;
  path: string;
  currencyBase: string;
  currencyProfit: string;
  currencyMargin: string;
  digits: number;
  point: number;
  tickSize: number;
  /** Money value of one tickSize move for 1.0 lot, in profit currency. */
  tickValue: number;
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  /** Fixed spread in points, or null when the spread floats (taken from price data). */
  spreadPoints: number | null;
  stopsLevel: number;
  freezeLevel: number;
  calcMode: number;
  calcModeLabel: string;
  marginInitial: number;
  marginRateBuy: number;
  marginRateSell: number;
  marginHedged: number;
  swapMode: number;
  swapModeLabel: string;
  swapLong: number;
  swapShort: number;
  /** Day of the week (0 = Sunday) charged with triple swap. */
  swap3Day: number;
  /** Swap multiplier per weekday, Sunday first. */
  swapRates: number[];
  /** Trading sessions per weekday, Sunday first. */
  sessionsTrade: Session[][];
}

const CALC_MODES: Record<number, string> = {
  0: "Forex", 1: "Futuros", 2: "CFD", 3: "CFD índice", 4: "CFD apalancado", 5: "Forex sin apalancamiento",
  32: "Acciones (bolsa)", 33: "Futuros (bolsa)", 34: "Futuros FORTS", 35: "Bonos (bolsa)",
  36: "Acciones MOEX", 37: "Bonos MOEX", 64: "Colateral",
};

const SWAP_MODES: Record<number, string> = {
  0: "Sin swap", 1: "En puntos", 2: "En divisa base", 3: "En divisa de margen", 4: "En divisa del depósito",
  5: "Interés (precio actual)", 6: "Interés (precio de apertura)", 7: "Reapertura (precio actual)", 8: "Reapertura (bid)",
};

type Raw = Record<string, unknown>;

const num = (r: Raw, k: string, fallback = 0): number => {
  const v = r[k];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
};
const str = (r: Raw, k: string): string => (typeof r[k] === "string" ? (r[k] as string).trim() : "");

function volume(r: Raw, key: string): number {
  const ext = num(r, `${key}Ext`, Number.NaN);
  if (Number.isFinite(ext) && ext > 0) return ext / 1e8;
  return num(r, key) / 1e4;
}

function sessions(value: unknown): Session[][] {
  if (!Array.isArray(value)) return [];
  return value.map((day) =>
    Array.isArray(day)
      ? day.map((s: Raw) => ({ open: num(s, "Open"), close: num(s, "Close") }))
      : [],
  );
}

function normalize(r: Raw): SymbolSpecification {
  const spread = num(r, "Spread");
  const calcMode = num(r, "CalcMode");
  const swapMode = num(r, "SwapMode");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return {
    symbol: str(r, "Symbol"),
    description: str(r, "Description"),
    path: str(r, "Path"),
    currencyBase: str(r, "CurrencyBase"),
    currencyProfit: str(r, "CurrencyProfit"),
    currencyMargin: str(r, "CurrencyMargin"),
    digits: num(r, "Digits"),
    point: num(r, "Point"),
    tickSize: num(r, "TickSize"),
    tickValue: num(r, "TickValue"),
    contractSize: num(r, "ContractSize"),
    volumeMin: volume(r, "VolumeMin"),
    volumeMax: volume(r, "VolumeMax"),
    volumeStep: volume(r, "VolumeStep"),
    spreadPoints: spread > 0 ? spread : null,
    stopsLevel: num(r, "StopsLevel"),
    freezeLevel: num(r, "FreezeLevel"),
    calcMode,
    calcModeLabel: CALC_MODES[calcMode] ?? `Modo ${calcMode}`,
    marginInitial: num(r, "MarginInitial"),
    marginRateBuy: num(r, "MarginInitialBuy"),
    marginRateSell: num(r, "MarginInitialSell"),
    marginHedged: num(r, "MarginHedged"),
    swapMode,
    swapModeLabel: SWAP_MODES[swapMode] ?? `Modo ${swapMode}`,
    swapLong: num(r, "SwapLong"),
    swapShort: num(r, "SwapShort"),
    swap3Day: num(r, "Swap3Day"),
    swapRates: days.map((d) => num(r, `SwapRate${d}`)),
    sessionsTrade: sessions(r["SessionsTrades"]),
  };
}

/** Parse an MT5 symbol export. Returns every symbol in the file. */
export function parseSymbolSpecJson(text: string): SymbolSpecification[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("El archivo no es un JSON válido. Exporta la especificación desde MT5 (Símbolos → Exportar).");
  }
  const list: unknown[] = Array.isArray((data as Raw)?.["ConfigSymbols"])
    ? ((data as Raw)["ConfigSymbols"] as unknown[])
    : Array.isArray(data)
      ? (data as unknown[])
      : [data];
  const specs = list
    .filter((x): x is Raw => typeof x === "object" && x !== null && typeof (x as Raw)["Symbol"] === "string")
    .map(normalize);
  if (specs.length === 0) {
    throw new Error("No se encontró ningún símbolo en el archivo (falta el campo \"Symbol\").");
  }
  for (const s of specs) {
    if (!(s.tickSize > 0) || !(s.contractSize > 0)) {
      throw new Error(`Especificación de ${s.symbol} incompleta: faltan TickSize o ContractSize.`);
    }
  }
  return specs;
}

export function formatSessionMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
