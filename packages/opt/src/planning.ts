/**
 * Browser-safe planning helpers (no engine / filesystem imports):
 * parameter-space sizing and calendar validation windows.
 */
export { countGridSize, expandParam } from "./space.js";
export type { ParamDef, ParamValue } from "./types.js";
export {
  addDuration,
  forwardSplit,
  generateWindowsByDuration,
  generateWindowsByRuns,
  oosCoverage,
  validateWindows,
  type Duration,
  type DurationUnit,
  type ForwardFraction,
  type ValidationWindow,
  type WindowIssue,
  type WindowMode,
} from "./windows.js";
