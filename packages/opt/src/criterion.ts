import type { PerformanceMetrics } from "@hypsometra/engine";
import type { Criterion } from "./types.js";

/**
 * Higher is always better for search.
 * Known "lower is better" metrics are negated.
 */
const LOWER_IS_BETTER = new Set<keyof PerformanceMetrics>([
  "maxDrawdownAbs",
  "maxDrawdownPct",
  "grossLoss",
  "losingTrades",
]);

export function scoreMetrics(
  metrics: PerformanceMetrics,
  criterion: Criterion,
): number {
  if (typeof criterion === "function") {
    const s = criterion(metrics);
    return Number.isFinite(s) ? s : Number.NEGATIVE_INFINITY;
  }

  const raw = metrics[criterion];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return Number.NEGATIVE_INFINITY;
  }

  return LOWER_IS_BETTER.has(criterion) ? -raw : raw;
}
