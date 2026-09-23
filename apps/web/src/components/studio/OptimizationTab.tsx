"use client";

import { Field, NumInput, Panel, Seg } from "@/components/ui";
import { CRITERIA, formatInt, type Criterion, type RunPlan, type StudyConfig } from "@/lib/study";

export interface ReadinessItem {
  label: string;
  ok: boolean;
  detail: string;
  /** Recommended but not required to run. */
  optional?: boolean;
}

interface Props {
  study: StudyConfig;
  update: (fn: (s: StudyConfig) => void) => void;
  run: RunPlan;
  readiness: ReadinessItem[];
  maxCores: number;
}

export function OptimizationTab({ study, update, run, readiness, maxCores }: Props) {
  const o = study.optimization;
  const hasOos = study.validation.mode !== "none";

  return (
    <>
      <Panel kicker="04 · Optimización" title="Búsqueda de parámetros">
        <div className="form-grid cols-2">
          <div className="field">
            <span className="field-label">Método</span>
            <Seg
              label="Método"
              value={o.method}
              onChange={(m) => update((s) => void (s.optimization.method = m))}
              options={[
                { value: "complete", label: "Completo (todas las combinaciones)" },
                { value: "genetic", label: "Algoritmo genético" },
              ]}
            />
          </div>
          <Field label="Criterio de optimización" hint="Se maximiza en cada tramo IS. Nunca se usa para juzgar el OOS.">
            {(id) => (
              <select id={id} value={o.criterion} onChange={(e) => update((s) => void (s.optimization.criterion = e.target.value as Criterion))}>
                {CRITERIA.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {o.method === "genetic" && (
          <div className="form-grid cols-4 mt">
            <Field label="Población">
              {(id) => <NumInput id={id} value={o.genetic.population} min={8} integer onChange={(n) => update((s) => void (s.optimization.genetic.population = n))} />}
            </Field>
            <Field label="Generaciones máx.">
              {(id) => <NumInput id={id} value={o.genetic.generations} min={1} integer onChange={(n) => update((s) => void (s.optimization.genetic.generations = n))} />}
            </Field>
            <Field label="Tasa de mutación" hint="Entre 0 y 1.">
              {(id) => <NumInput id={id} value={o.genetic.mutation} min={0} max={1} step={0.05} onChange={(n) => update((s) => void (s.optimization.genetic.mutation = n))} />}
            </Field>
            <Field label="Semilla" hint="Misma semilla, mismo resultado.">
              {(id) => <NumInput id={id} value={o.genetic.seed} integer onChange={(n) => update((s) => void (s.optimization.genetic.seed = n))} />}
            </Field>
          </div>
        )}

        <div className="form-grid cols-2 mt">
          <div className="field">
            <span className="field-label">Pases que pasan al OOS</span>
            <Seg
              label="Pases que pasan al OOS"
              value={o.oosSelection}
              onChange={(m) => update((s) => void (s.optimization.oosSelection = m))}
              options={[
                { value: "best", label: "Mejor pase IS", disabled: !hasOos },
                { value: "top_percent", label: "Top % de pases IS", disabled: !hasOos },
              ]}
            />
            <span className="field-hint">
              {hasOos
                ? "MT5 retesta en forward el 25 % mejor (genético) o el 10 % (completo)."
                : "Sin validación no hay tramo OOS."}
            </span>
          </div>
          {hasOos && o.oosSelection === "top_percent" && (
            <Field label="Porcentaje">
              {(id) => <NumInput id={id} value={o.topPercent} min={1} max={100} onChange={(n) => update((s) => void (s.optimization.topPercent = n))} />}
            </Field>
          )}
          <Field label="Núcleos de CPU" hint={`Este equipo tiene ${maxCores}.`}>
            {(id) => (
              <select id={id} value={Math.min(o.cores, maxCores)} onChange={(e) => update((s) => void (s.optimization.cores = Number(e.target.value)))}>
                {Array.from({ length: maxCores }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </Panel>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Combinaciones</div>
          <div className="kpi-value">{formatInt(run.combinations)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pases por ventana</div>
          <div className="kpi-value">{formatInt(run.passesPerWindow)}</div>
          <div className="kpi-note">{o.method === "genetic" ? "máximo, sin contar caché" : "barrido completo"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ventanas</div>
          <div className="kpi-value">{run.windows}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pases totales</div>
          <div className="kpi-value">{formatInt(run.totalPasses)}</div>
          <div className="kpi-note">≈ {formatInt(run.barsPerPassM1)} velas M1 en el periodo</div>
        </div>
      </div>

      <Panel kicker="Antes de ejecutar" title="Comprobación previa">
        <ul className="checklist">
          {readiness.map((r) => (
            <li key={r.label} className={r.ok ? "ok" : r.optional ? "advice" : "todo"}>
              <span className="check-mark" aria-hidden="true">{r.ok ? "✓" : r.optional ? "!" : "·"}</span>
              <div>
                <div className="check-label">
                  {r.label}
                  {r.optional && !r.ok && <span className="check-optional">recomendado</span>}
                </div>
                <div className="check-detail">{r.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
