import type { PerformanceMetrics } from "@hypsometra/engine";

export type ParamValue = number | string | boolean;

export type ParamDef =
  | {
      name: string;
      kind: "int";
      from: number;
      to: number;
      step: number;
    }
  | {
      name: string;
      kind: "float";
      from: number;
      to: number;
      step: number;
    }
  | {
      name: string;
      kind: "enum";
      values: ParamValue[];
    };

export type ParamMap = Record<string, ParamValue>;

export type Criterion =
  | keyof PerformanceMetrics
  | ((metrics: PerformanceMetrics) => number);

export interface OptimizePass {
  params: ParamMap;
  metrics: PerformanceMetrics;
  score: number;
}

export type WalkForwardMode = "rolling" | "anchored";

export interface WalkForwardFold {
  index: number;
  /** Inclusive start / exclusive end bar indices. */
  inSample: { start: number; end: number };
  outOfSample: { start: number; end: number };
  bestParams: ParamMap;
  inSampleScore: number;
  inSampleMetrics: PerformanceMetrics;
  outOfSampleMetrics: PerformanceMetrics;
  outOfSampleScore: number;
}

export interface WalkForwardResult {
  mode: WalkForwardMode;
  folds: WalkForwardFold[];
  /** Sum of OOS net profits across folds. */
  combinedOosNetProfit: number;
  /** Mean of OOS scores. */
  meanOosScore: number;
  /** Folds where OOS score > 0. */
  positiveOosFolds: number;
}
