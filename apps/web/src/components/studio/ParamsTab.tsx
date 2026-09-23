"use client";

import { Fragment } from "react";
import type { StrategyDefinition } from "@hypsometra/engine/registry";
import { encodeUtf16le } from "@hypsometra/mt5";
import { Help, Panel, SourceBadge } from "@/components/ui";
import {
  formatInt,
  registryDefaults,
  studyToSet,
  type ParamAxis,
  type ParamDef,
  type ParamSetting,
  type StudyConfig,
} from "@/lib/study";

interface Props {
  study: StudyConfig;
  update: (fn: (s: StudyConfig) => void) => void;
  strategy: StrategyDefinition | undefined;
  defs: ParamDef[];
  axes: ParamAxis[];
  combinations: number;
}

const KIND_LABEL = { int: "entero", double: "decimal", bool: "booleano", enum: "lista", string: "texto" } as const;

function ValueInput(props: { def: ParamDef; value: string; disabled?: boolean; onChange: (v: string) => void; label: string }) {
  const { def } = props;
  if (def.kind === "bool") {
    return (
      <select className="input" aria-label={props.label} value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (def.kind === "enum" && def.options) {
    return (
      <select className="input" aria-label={props.label} value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)}>
        {!def.options.some((o) => o.value === props.value) && <option value={props.value}>{props.value}</option>}
        {def.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="input"
      aria-label={props.label}
      inputMode={def.kind === "string" ? "text" : "decimal"}
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function ParamsTab({ study, update, strategy, defs, axes, combinations }: Props) {
  if (defs.length === 0) {
    return (
      <div className="empty-state">
        <div className="panel-kicker">02 · Parámetros</div>
        <h2>{strategy ? `No hay inputs cargados para ${strategy.name}` : "Elige un experto"}</h2>
        <p>
          Importa el <strong>.set</strong> del EA en Configuración (tarjeta B): se cargan todos sus inputs, rangos y casillas de
          optimización tal como están en MT5.
        </p>
      </div>
    );
  }

  const optimized = axes.filter((a) => a.def.optimizable && study.params[a.def.name]?.optimize).length;
  const tooMany = combinations > 100_000_000;
  const heavyComplete = study.optimization.method === "complete" && combinations > 1_000_000;
  const expertName = study.inputs?.expertName ?? strategy?.name ?? null;

  const downloadSet = () => {
    const text = studyToSet(study, defs, expertName);
    const blob = new Blob([encodeUtf16le(text) as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${expertName ?? "hypsometra"}.set`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const set = (name: string, key: keyof ParamSetting, v: string | boolean) =>
    update((s) => {
      const p = s.params[name];
      if (p) (p[key] as string | boolean) = v;
    });

  let lastGroup: string | null | undefined;

  return (
    <Panel
      kicker="02 · Parámetros"
      title={`Inputs de ${expertName ?? "el experto"}`}
      intro="Marca qué inputs se optimizan y con qué rango. Los que no se marquen se prueban con su valor fijo, como en MT5."
      actions={
        <div className="inline-pair">
          {study.sources.set && <SourceBadge kind="file" label={study.sources.set.label} />}
          <button type="button" className="ghost-btn" onClick={downloadSet}>
            Exportar .set
          </button>
          {!study.inputs && (
            <button type="button" className="ghost-btn" onClick={() => update((s) => void (s.params = registryDefaults(strategy)))}>
              Valores por defecto
            </button>
          )}
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
              const def = axis.def;
              const s = study.params[def.name];
              if (!s) return null;
              const numeric = def.kind === "int" || def.kind === "double";
              const rangeable = def.optimizable && (numeric || def.kind === "enum" || def.kind === "bool");
              const groupRow = def.group !== lastGroup && def.group ? (
                <tr className="group-row">
                  <td colSpan={8}>{def.group}</td>
                </tr>
              ) : null;
              lastGroup = def.group;
              return (
                <Fragment key={def.name}>
                  {groupRow}
                  <tr className={s.optimize && def.optimizable ? "sel" : undefined}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        aria-label={`Optimizar ${def.label}`}
                        title={def.optimizable ? undefined : "MT5 no permite optimizar este input (sinput o texto)."}
                        disabled={!def.optimizable || def.kind === "string"}
                        checked={s.optimize && def.optimizable}
                        onChange={(e) => set(def.name, "optimize", e.target.checked)}
                      />
                    </td>
                    <td>
                      <div className="strong mono">{def.label}</div>
                    </td>
                    <td>
                      <span className="badge">{KIND_LABEL[def.kind]}</span>
                    </td>
                    <td>
                      <ValueInput def={def} label={`${def.label}: valor`} value={s.value} onChange={(v) => set(def.name, "value", v)} />
                    </td>
                    {(["start", "step", "stop"] as const).map((k) => (
                      <td key={k}>
                        {!rangeable ? (
                          <span className="muted">—</span>
                        ) : numeric ? (
                          <input
                            className="input"
                            inputMode="decimal"
                            aria-label={`${def.label}: ${k}`}
                            value={s[k]}
                            disabled={!s.optimize}
                            aria-invalid={s.optimize && axis.error ? true : undefined}
                            onChange={(e) => set(def.name, k, e.target.value)}
                          />
                        ) : k === "step" ? (
                          <span className="muted">—</span>
                        ) : (
                          <ValueInput def={def} label={`${def.label}: ${k}`} value={s[k]} disabled={!s.optimize} onChange={(v) => set(def.name, k, v)} />
                        )}
                      </td>
                    ))}
                    <td className="num">
                      {s.optimize && def.optimizable ? axis.error ? <span className="field-error">{axis.error}</span> : formatInt(axis.values) : "—"}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="params-foot">
        <div>
          <span className="kpi-label">Inputs optimizados</span>
          <div className="foot-value">
            {optimized} de {axes.filter((a) => a.def.optimizable).length}
          </div>
        </div>
        <div>
          <span className="kpi-label">Combinaciones</span>
          <div className="foot-value">{optimized === 0 ? "1 (prueba única)" : formatInt(combinations)}</div>
        </div>
        {tooMany && <p className="inline-note warn">Más de 100 millones de combinaciones: como en MT5, solo tiene sentido con algoritmo genético.</p>}
        {!tooMany && heavyComplete && (
          <p className="inline-note warn">
            Más de un millón de combinaciones con barrido completo, y en cada ventana walk-forward. Considera el algoritmo
            genético o estrechar los rangos.
          </p>
        )}
      </div>
      <Help title="¿Qué significan los tipos?">
        <ul>
          <li><strong>entero / decimal</strong>: se optimiza de inicio a fin con el paso indicado.</li>
          <li><strong>lista</strong>: opciones fijas del EA (por ejemplo una temporalidad). Se prueban las opciones entre inicio y fin.</li>
          <li><strong>booleano</strong>: se prueban true y false.</li>
          <li><strong>texto</strong> y los inputs sin casilla no se pueden optimizar, igual que en MT5.</li>
        </ul>
        <p>Los nombres de las opciones de cada lista (qué significa 0, 1, 2…) se leerán del código del EA al portarlo.</p>
      </Help>
    </Panel>
  );
}
