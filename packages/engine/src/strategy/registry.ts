import { createSmaCrossStrategy } from "./sma-cross.js";
import type { Strategy } from "./types.js";

export type StrategyParamType = "int" | "double" | "bool" | "enum";

export type StrategyParamValue = number | boolean | string;

export interface StrategyParamSpec {
  name: string;
  label: string;
  type: StrategyParamType;
  default: StrategyParamValue;
  /** Default optimization range for numeric params. */
  range?: { start: number; step: number; stop: number };
  options?: Array<{ value: string; label: string }>;
  description?: string;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  /** `pending-port`: the MQL5 logic has not been ported yet; it cannot run. */
  status: "ready" | "pending-port";
  params: StrategyParamSpec[];
  create?: (params: Record<string, StrategyParamValue>) => Strategy;
}

export const STRATEGIES: readonly StrategyDefinition[] = [
  {
    id: "sma_cross",
    name: "SMA Cross",
    description: "Estrategia de referencia del motor: cruce de dos medias simples.",
    status: "ready",
    params: [
      {
        name: "fastPeriod",
        label: "Periodo media rápida",
        type: "int",
        default: 10,
        range: { start: 5, step: 5, stop: 30 },
      },
      {
        name: "slowPeriod",
        label: "Periodo media lenta",
        type: "int",
        default: 50,
        range: { start: 20, step: 10, stop: 120 },
      },
      {
        name: "volume",
        label: "Lotes",
        type: "double",
        default: 0.1,
        range: { start: 0.1, step: 0.1, stop: 1 },
      },
    ],
    create: (p) =>
      createSmaCrossStrategy({
        fastPeriod: Number(p["fastPeriod"]),
        slowPeriod: Number(p["slowPeriod"]),
        volume: Number(p["volume"]),
      }),
  },
  {
    id: "orb_ml_sizing",
    name: "ORB_ML Sizing",
    description: "EA de PLSystems. Pendiente de portar desde el .mq5.",
    status: "pending-port",
    params: [],
  },
];

export function getStrategy(id: string): StrategyDefinition | undefined {
  return STRATEGIES.find((s) => s.id === id);
}
