"use client";

import type { StrategyDefinition } from "@hypsometra/engine/registry";
import { Panel } from "@/components/ui";
import { formatInt, paramDefaults, type ParamAxis, type StudyConfig } from "@/lib/study";

interface Props {
  study: StudyConfig;
  update: (fn: (s: StudyConfig) => void) => void;
  strategy: StrategyDefinition | undefined;
  axes: ParamAxis[];
  combinations: number;
}

const TYPE_LABEL = { int: "entero", double: "decimal", bool: "booleano", enum: "lista" } as const;

export function ParamsTab({ study, update, strategy, axes, combinations }: Props) {
  if (!strategy || strategy.params.length === 0) {
    return (
      <div className="empty-state">
        <div className="panel-kicker">02 · Parámetros</div>
        <h2>{strategy ? `${strategy.name} aún no tiene parámetros` : "Elige un experto"}</h2>
        <p>
          {strategy?.status === "pending-port"
            ? "Los inputs se leerán del .mq5 al portar el EA: mismos nombres, tipos y valores por defecto que en MT5."
            : "Selecciona un experto en Configuración para ver sus inputs."}
        </p>
      </div>
    );
  }

  const optimized = axes.filter((a) => study.params[a.spec.name]?.optimize).length;
  const tooMany = combinations > 100_000_000;
  const heavyComplete = study.optimization.method === "complete" && combinations > 1_000_000;

  return (
    <Panel
      kicker="02 · Parámetros"
      title={`Inputs de ${strategy.name}`}
      intro="Marca qué inputs se optimizan y con qué rango. Los que no se marquen se prueban con su valor fijo."
      actions={
        <div className="inline-pair">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => update((s) => void (s.params = paramDefaults(strategy)))}
          >
            Valores por defecto
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={optimized === 0}
            onClick={() =>
              update((s) => {
                for (const k of Object.keys(s.params)) s.params[k]!.optimize = false;
              })
            }
          >
            Desmarcar todo
          </button>
        </div>
      }
    >
      <div className="table-wrap">
        <table className="params-table">
          <thead>
            <tr>
              <th className="col-check">Opt.</th>
              <th>Variable</th>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Inicio</th>
              <th>Paso</th>
              <th>Fin</th>
              <th className="num">Pasos</th>
            </tr>
          </thead>
          <tbody>
            {axes.map((axis) => {
              const p = axis.spec;
              const s = study.params[p.name];
              if (!s) return null;
              const numeric = p.type === "int" || p.type === "double";
              const set = (key: "value" | "start" | "step" | "stop", v: string) =>
                update((st) => void (st.params[p.name]![key] = v));
              return (
                <tr key={p.name} className={s.optimize ? "sel" : undefined}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      aria-label={`Optimizar ${p.label}`}
                      checked={s.optimize}
                      onChange={(e) => update((st) => void (st.params[p.name]!.optimize = e.target.checked))}
                    />
                  </td>
                  <td>
                    <div className="strong">{p.label}</div>
                    <div className="mono cell-sub">{p.name}</div>
                  </td>
                  <td>
                    <span className="badge">{TYPE_LABEL[p.type]}</span>
                  </td>
                  <td>
                    {p.type === "bool" ? (
                      <select className="input" value={s.value} onChange={(e) => set("value", e.target.value)}>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : p.type === "enum" ? (
                      <select className="input" value={s.value} onChange={(e) => set("value", e.target.value)}>
                        {p.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className="input" inputMode="decimal" value={s.value} onChange={(e) => set("value", e.target.value)} />
                    )}
                  </td>
                  {(["start", "step", "stop"] as const).map((k) => (
                    <td key={k}>
                      {numeric ? (
                        <input
                          className="input"
                          inputMode="decimal"
                          value={s[k]}
                          disabled={!s.optimize}
                          aria-invalid={s.optimize && axis.error ? true : undefined}
                          onChange={(e) => set(k, e.target.value)}
                        />
                      ) : (
                        <span className="muted">{k === "step" ? "—" : s.optimize ? "todos" : "—"}</span>
                      )}
                    </td>
                  ))}
                  <td className="num">
                    {s.optimize ? (axis.error ? <span className="field-error">{axis.error}</span> : formatInt(axis.values)) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="params-foot">
        <div>
          <span className="kpi-label">Inputs optimizados</span>
          <div className="foot-value">{optimized} de {axes.length}</div>
        </div>
        <div>
          <span className="kpi-label">Combinaciones</span>
          <div className="foot-value">{optimized === 0 ? "1 (prueba única)" : formatInt(combinations)}</div>
        </div>
        {tooMany && (
          <p className="inline-note warn">
            Más de 100 millones de combinaciones: como en MT5, solo tiene sentido con algoritmo genético.
          </p>
        )}
        {!tooMany && heavyComplete && (
          <p className="inline-note warn">
            Más de un millón de combinaciones con barrido completo, y en cada ventana walk-forward. Considera el
            algoritmo genético o estrechar los rangos.
          </p>
        )}
      </div>
    </Panel>
  );
}
