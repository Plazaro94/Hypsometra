export type {
  Criterion,
  OptimizePass,
  ParamDef,
  ParamMap,
  ParamValue,
  WalkForwardFold,
  WalkForwardMode,
  WalkForwardResult,
} from "./types.js";

export {
  countGridSize,
  createRng,
  enumerateGrid,
  expandParam,
  paramsKey,
} from "./space.js";

export { scoreMetrics } from "./criterion.js";

export {
  optimize,
  optimizeGenetic,
  optimizeGrid,
  type OptimizeInput,
  type OptimizeResult,
} from "./optimize.js";

export {
  walkForward,
  type WalkForwardInput,
} from "./walk-forward.js";

export {
  equityStatsFromPnls,
  monteCarlo,
  type EquityStats,
  type MonteCarloInput,
  type MonteCarloMethod,
  type MonteCarloResult,
  type PercentileSummary,
} from "./monte-carlo.js";
