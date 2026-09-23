"use client";

import type { Duration, DurationUnit, ForwardFraction, WindowMode } from "@hypsometra/opt/planning";
import { Field, NumInput, Panel, Seg } from "@/components/ui";
import { Timeline } from "@/components/studio/Timeline";
import {
  formatDay,
  formatDayMt5,
  parseDay,
  planWindows,
  spanLabel,
  toManual,
  type Periods,
  type StudyConfig,
  type ValidationMode,
  type WfDefinition,
  type WindowPlan,
} from "@/lib/study";

interface Props {
  study: StudyConfig;
  update: (fn: (s: StudyConfig) => void) => void;
  /** Research period: the windows live here, never in the unseen segment. */
  period: { from: number; to: number } | null;
  periods: Periods | null;
  plan: WindowPlan;
}

const UNITS: Array<{ value: DurationUnit; label: string }> = [
  { value: "days", label: "días" },
  { value: "weeks", label: "semanas" },
  { value: "months", label: "meses" },
  { value: "years", label: "años" },
];

const DURATION_PRESETS: Array<{ label: string; is: Duration; oos: Duration }> = [
  { label: "IS 6m · OOS 1m", is: { value: 6, unit: "months" }, oos: { value: 1, unit: "months" } },
  { label: "IS 12m · OOS 3m", is: { value: 12, unit: "months" }, oos: { value: 3, unit: "months" } },
  { label: "IS 24m · OOS 6m", is: { value: 24, unit: "months" }, oos: { value: 6, unit: "months" } },
  { label: "IS 36m · OOS 12m", is: { value: 36, unit: "months" }, oos: { value: 12, unit: "months" } },
];

const RUN_PRESETS = [
  { label: "5 × 30 %", runs: 5, pct: 30 },
  { label: "8 × 25 %", runs: 8, pct: 25 },
  { label: "10 × 20 %", runs: 10, pct: 20 },
  { label: "15 × 15 %", runs: 15, pct: 15 },
];

function DurationInput(props: { label: string; value: Duration; onChange: (d: Duration) => void; hint?: string }) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <div className="unit-input wide">
          <NumInput id={id} value={props.value.value} min={1} integer onChange={(n) => props.onChange({ ...props.value, value: n })} />
          <select
            className="input"
            aria-label={`${props.label}: unidad`}
            value={props.value.unit}
            onChange={(e) => props.onChange({ ...props.value, unit: e.target.value as DurationUnit })}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}

export function ValidationTab({ study, update, period, periods, plan }: Props) {
  const v = study.validation;
  const wf = v.wf;
  const issueIndexes = new Set(plan.issues.map((i) => i.index).filter((i): i is number => i !== null));
  const showWindows = v.mode !== "none" && plan.windows.length > 0 && period !== null;

  const avg = (f: (w: (typeof plan.windows)[number]) => number) =>
    plan.windows.length ? plan.windows.reduce((s, w) => s + f(w), 0) / plan.windows.length : 0;

  return (
    <>
      <Panel
        kicker="03 · Validación"
        title="Cómo se separa lo optimizado de lo validado"
        intro="MT5 solo permite un corte forward. Aquí puedes encadenar ventanas: optimizar en cada tramo IS y medir con los parámetros elegidos en el tramo OOS siguiente, que el optimizador nunca vio."
      >
        <Seg<ValidationMode>
          label="Tipo de validación"
          value={v.mode}
          onChange={(m) => update((s) => void (s.validation.mode = m))}
          options={[
            { value: "none", label: "Sin validación" },
            { value: "forward", label: "Forward (como MT5)" },
            { value: "walkforward", label: "Walk-forward" },
          ]}
        />

        {v.mode === "forward" && (
          <div className="form-grid cols-3 mt">
            <div className="field">
              <span className="field-label">Periodo forward</span>
              <Seg<ForwardFraction | "custom">
                label="Periodo forward"
                value={v.forward.split}
                onChange={(x) => update((s) => void (s.validation.forward.split = x))}
                options={[
                  { value: "1/2", label: "1/2" },
                  { value: "1/3", label: "1/3" },
                  { value: "1/4", label: "1/4" },
                  { value: "custom", label: "Fecha personalizada" },
                ]}
              />
            </div>
            {v.forward.split === "custom" && (
              <Field label="Inicio del forward">
                {(id) => (
                  <input id={id} type="date" value={v.forward.from} onChange={(e) => update((s) => void (s.validation.forward.from = e.target.value))} />
                )}
              </Field>
            )}
          </div>
        )}

        {v.mode === "walkforward" && (
          <div className="wf-config">
            <div className="form-grid cols-2 mt">
              <div className="field">
                <span className="field-label">Tipo de ventana</span>
                <Seg<WindowMode>
                  label="Tipo de ventana"
                  value={wf.mode}
                  onChange={(m) => update((s) => void (s.validation.wf.mode = m))}
                  options={[
                    { value: "rolling", label: "Rolling" },
                    { value: "anchored", label: "Anchored" },
                  ]}
                />
                <span className="field-hint">
                  {wf.mode === "rolling"
                    ? "El IS tiene longitud fija y se desplaza: prioriza el régimen reciente."
                    : "El IS empieza siempre al inicio y crece: prioriza la muestra grande."}
                </span>
              </div>
              <div className="field">
                <span className="field-label">Definición de ventanas</span>
                <Seg<WfDefinition>
                  label="Definición de ventanas"
                  value={wf.definition}
                  onChange={(d) =>
                    update((s) => {
                      if (d === "manual" && s.validation.wf.manual.length === 0) {
                        s.validation.wf.manual = toManual(plan.windows);
                      }
                      s.validation.wf.definition = d;
                    })
                  }
                  options={[
                    { value: "duration", label: "Por duración" },
                    { value: "runs", label: "Nº de ventanas y % OOS" },
                    { value: "manual", label: "Manual" },
                  ]}
                />
              </div>
            </div>

            {wf.definition === "duration" && (
              <>
                <div className="chips mt">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="seg-btn"
                      aria-pressed={
                        wf.inSample.value === p.is.value && wf.inSample.unit === p.is.unit &&
                        wf.outOfSample.value === p.oos.value && wf.outOfSample.unit === p.oos.unit
                      }
                      onClick={() =>
                        update((s) => {
                          s.validation.wf.inSample = { ...p.is };
                          s.validation.wf.outOfSample = { ...p.oos };
                        })
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="form-grid cols-3 mt">
                  <DurationInput label="In-sample (optimización)" value={wf.inSample} onChange={(d) => update((s) => void (s.validation.wf.inSample = d))} />
                  <DurationInput label="Out-of-sample (validación)" value={wf.outOfSample} onChange={(d) => update((s) => void (s.validation.wf.outOfSample = d))} />
                  <div className="field">
                    <label className="field checkbox">
                      <input
                        type="checkbox"
                        checked={wf.stepEqualsOos}
                        onChange={(e) => update((s) => void (s.validation.wf.stepEqualsOos = e.target.checked))}
                      />
                      Paso = OOS
                    </label>
                    {wf.stepEqualsOos ? (
                      <span className="field-hint">Los tramos OOS quedan encadenados, sin huecos ni solapes.</span>
                    ) : (
                      <DurationInput label="Paso entre ventanas" value={wf.step} onChange={(d) => update((s) => void (s.validation.wf.step = d))} />
                    )}
                  </div>
                </div>
              </>
            )}

            {wf.definition === "runs" && (
              <>
                <div className="chips mt">
                  {RUN_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="seg-btn"
                      aria-pressed={wf.runs === p.runs && wf.oosPercent === p.pct}
                      onClick={() =>
                        update((s) => {
                          s.validation.wf.runs = p.runs;
                          s.validation.wf.oosPercent = p.pct;
                        })
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="form-grid cols-3 mt">
                  <Field label="Número de ventanas">
                    {(id) => <NumInput id={id} value={wf.runs} min={1} max={200} integer onChange={(n) => update((s) => void (s.validation.wf.runs = n))} />}
                  </Field>
                  <Field
                    label="% out-of-sample"
                    hint={wf.mode === "rolling" ? "Proporción OOS dentro de cada ventana." : "Proporción del periodo total dedicada a OOS."}
                  >
                    {(id) => <NumInput id={id} value={wf.oosPercent} min={1} max={90} onChange={(n) => update((s) => void (s.validation.wf.oosPercent = n))} />}
                  </Field>
                </div>
              </>
            )}

            {wf.definition === "manual" && (
              <ManualWindows study={study} update={update} period={period} />
            )}
          </div>
        )}
      </Panel>

      {plan.error && <div className="error-box">{plan.error}</div>}

      {showWindows && period && (
        <>
          <div className="kpi-row">
            <div className="kpi">
              <div className="kpi-label">Ventanas</div>
              <div className="kpi-value">{plan.windows.length}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">IS medio</div>
              <div className="kpi-value">{spanLabel(0, avg((w) => w.isTo - w.isFrom))}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">OOS medio</div>
              <div className="kpi-value">{spanLabel(0, avg((w) => w.oosTo - w.oosFrom))}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Cobertura OOS</div>
              <div className="kpi-value">{Math.round(plan.coverage * 100)} %</div>
              <div className="kpi-note">
                {periods?.unseen ? "del periodo de investigación" : "del periodo se valida fuera de muestra"}
              </div>
            </div>
          </div>

          <Panel kicker="Plan" title="Ventanas en el tiempo">
            <div className="chart-legend">
              <span className="chart-legend-item"><span className="legend-bar is" />In-sample · optimización</span>
              <span className="chart-legend-item"><span className="legend-bar oos" />Out-of-sample · validación</span>
              {periods?.unseen && (
                <span className="chart-legend-item"><span className="legend-bar unseen" />No visto · prueba final, bloqueado</span>
              )}
            </div>
            <Timeline windows={plan.windows} total={periods?.total ?? period} unseen={periods?.unseen ?? null} issueIndexes={issueIndexes} />

            {plan.issues.length > 0 && (
              <div className="error-box">
                {plan.issues.map((i, k) => (
                  <div key={k}>{i.message}</div>
                ))}
              </div>
            )}

            <div className="table-wrap mt">
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>IS desde</th>
                    <th>IS hasta</th>
                    <th className="num">Duración IS</th>
                    <th>OOS desde</th>
                    <th>OOS hasta</th>
                    <th className="num">Duración OOS</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.windows.map((w, i) => (
                    <tr key={i} className={issueIndexes.has(w.index) ? "dim" : undefined}>
                      <td className="num">{i + 1}</td>
                      <td className="mono">{formatDayMt5(w.isFrom)}</td>
                      <td className="mono">{formatDayMt5(w.isTo - 86_400_000)}</td>
                      <td className="num">{spanLabel(w.isFrom, w.isTo)}</td>
                      <td className="mono">{w.oosTo > w.oosFrom ? formatDayMt5(w.oosFrom) : "—"}</td>
                      <td className="mono">{w.oosTo > w.oosFrom ? formatDayMt5(w.oosTo - 86_400_000) : "—"}</td>
                      <td className="num">{w.oosTo > w.oosFrom ? spanLabel(w.oosFrom, w.oosTo) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {period && plan.windows.length > 0 && v.mode === "walkforward" && (
              <p className="field-hint mt">
                {periods?.unseen ? "Días sin usar antes del periodo no visto: " : "Datos sin usar al final del periodo: "}
                {plan.windows[plan.windows.length - 1]!.oosTo < period.to
                  ? `${spanLabel(plan.windows[plan.windows.length - 1]!.oosTo, period.to)} (desde ${formatDayMt5(plan.windows[plan.windows.length - 1]!.oosTo)}). No entran en ninguna ventana.`
                  : "ninguno."}
              </p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function ManualWindows({ study, update, period }: Pick<Props, "study" | "update" | "period">) {
  const rows = study.validation.wf.manual;
  const regenerate = () =>
    update((s) => {
      const asDuration = { ...s, validation: { ...s.validation, wf: { ...s.validation.wf, definition: "duration" as const } } };
      s.validation.wf.manual = toManual(planWindows(asDuration, period).windows);
    });

  return (
    <div className="mt">
      <div className="inline-pair">
        <button type="button" className="ghost-btn" onClick={regenerate}>
          Rellenar desde la plantilla por duración
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() =>
            update((s) => {
              const list = s.validation.wf.manual;
              const last = list[list.length - 1];
              if (!last) {
                list.push({ isFrom: "", isTo: "", oosFrom: "", oosTo: "" });
                return;
              }
              const shift = parseDay(last.oosTo) - parseDay(last.oosFrom);
              const move = (d: string) => (Number.isFinite(shift) ? formatDay(parseDay(d) + shift) : "");
              list.push({
                isFrom: s.validation.wf.mode === "anchored" ? last.isFrom : move(last.isFrom),
                isTo: move(last.isTo),
                oosFrom: move(last.oosFrom),
                oosTo: move(last.oosTo),
              });
            })
          }
        >
          Añadir ventana
        </button>
      </div>
      <div className="table-wrap mt">
        <table className="manual-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>IS desde</th>
              <th>IS hasta (no incluido)</th>
              <th>OOS desde</th>
              <th>OOS hasta (no incluido)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                {(["isFrom", "isTo", "oosFrom", "oosTo"] as const).map((k) => (
                  <td key={k}>
                    <input
                      className="input"
                      type="date"
                      value={r[k]}
                      aria-label={`Ventana ${i + 1}: ${k}`}
                      onChange={(e) => update((s) => void (s.validation.wf.manual[i]![k] = e.target.value))}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => update((s) => void s.validation.wf.manual.splice(i, 1))}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
