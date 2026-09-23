/** MT5 ENUM_TIMEFRAMES codes as they appear in .set files and tester settings. */
export const MT5_TIMEFRAME_CODES: Readonly<Record<string, number>> = {
  CURRENT: 0,
  M1: 1, M2: 2, M3: 3, M4: 4, M5: 5, M6: 6, M10: 10, M12: 12, M15: 15, M20: 20, M30: 30,
  H1: 16385, H2: 16386, H3: 16387, H4: 16388, H6: 16390, H8: 16392, H12: 16396,
  D1: 16408, W1: 32769, MN1: 49153,
};

const BY_CODE = new Map<number, string>(
  Object.entries(MT5_TIMEFRAME_CODES).map(([k, v]) => [v, k]),
);

export function timeframeFromCode(code: number): string | undefined {
  return BY_CODE.get(code);
}

export function timeframeToCode(name: string): number | undefined {
  return MT5_TIMEFRAME_CODES[name.toUpperCase()];
}

/** Minutes per timeframe (CURRENT excluded; MN1 approximated as 30 days). */
export function timeframeMinutes(name: string): number | undefined {
  const n = name.toUpperCase();
  if (n.startsWith("M") && n !== "MN1") return Number(n.slice(1)) || undefined;
  if (n.startsWith("H")) return (Number(n.slice(1)) || 0) * 60 || undefined;
  if (n === "D1") return 1440;
  if (n === "W1") return 10080;
  if (n === "MN1") return 43200;
  return undefined;
}
