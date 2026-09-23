"use client";

import { useState } from "react";
import { STRATEGIES, type StrategyDefinition } from "@hypsometra/engine/registry";
import { formatSessionMinutes } from "@hypsometra/mt5";
import type { DurationUnit } from "@hypsometra/opt/planning";
import { Field, Help, NumInput, Panel, Seg, SourceBadge } from "@/components/ui";
import { ImportPanel } from "@/components/studio/ImportPanel";
import {
  CURRENCIES,
  DAY_MS,
  LEVERAGES,
  TIMEFRAMES,
  TIMEFRAME_LABEL,
  TIMEFRAME_MINUTES,
  formatDay,
  formatDayMt5,
  formatInt,
  rangeLabel,
  spanLabel,
  type DatasetMeta,
  type Periods,
  type PeriodPreset,
  type StudyConfig,
  type StudySpec,
  type Timeframe,
} from "@/lib/study";

interface Props {
  study: StudyConfig;
  update: (fn: (s: StudyConfig) => void) => void;
  replace: (next: StudyConfig) => void;
  strategy: StrategyDefinition | undefined;
  onStrategyChange: (id: string) => void;
  datasets: DatasetMeta[];
  dataset: DatasetMeta | undefined;
  onDatasetChange: (id: string | null) => void;
  onDatasetsChanged: (selectId?: string) => Promise<void>;
  periods: Periods | null;
  periodIssues: string[];
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const UNITS: Array<{ value: DurationUnit; label: string }> = [
  { value: "weeks", label: "semanas" },
  { value: "months", label: "meses" },
  { value: "years", label: "años" },
];

export function ConfigTab(props: Props) {
  const { study, update, strategy, dataset, periods } = props;
  const dataTf = (dataset?.timeframe.toUpperCase() ?? "M1") as Timeframe;
  const tfTooFine =
    dataset !== undefined &&
    TIMEFRAME_MINUTES[dataTf] !== undefined &&
    TIMEFRAME_MINUTES[study.chartTimeframe] < TIMEFRAME_MINUTES[dataTf];
  const custom = study.period.preset === "custom";

  return (
    <>
      <ImportPanel study={study} replace={props.replace} dataset={dataset} onDatasetsChanged={props.onDatasetsChanged} />

      <Panel kicker="Experto y datos" title="Qué se prueba y sobre qué precios">
        <div className="form-grid cols-2">
          <Field label="Experto" hint={strategy?.description}>
            {(id) => (
              <select id={id} value={study.strategyId} onChange={(e) => props.onStrategyChange(e.target.value)}>
                {STRATEGIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === "pending-port" ? " — pendiente de portar" : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label="Datos de mercado"
            hint={
              dataset
                ? `${dataset.symbol} · ${dataset.timeframe} · ${formatInt(dataset.barCount)} velas · ${formatDayMt5(dataset.from)} → ${formatDayMt5(dataset.to)}`
                : "Importa un CSV M1 (tarjeta D) o elige uno ya importado."
            }
          >
            {(id) => (
              <select id={id} value={study.datasetId ?? ""} onChange={(e) => props.onDatasetChange(e.target.value || null)}>
                <option value="">— Sin datos —</option>
                {props.datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.symbol} {d.timeframe} · {formatDayMt5(d.from)} → {formatDayMt5(d.to)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {strategy?.status === "pending-port" && (
          <p className="inline-note warn">
            La lógica de <strong>{strategy.name}</strong> aún no está portada. Puedes preparar el estudio, pero no ejecutarlo
            hasta superar la prueba de paridad con MT5.
          </p>
        )}
        {study.inputs?.expertName && strategy && study.inputs.expertName.toLowerCase() !== strategy.name.toLowerCase() && (
          <p className="inline-note warn">
            Los inputs importados son de <strong>{study.inputs.expertName}</strong>, pero el experto elegido es {strategy.name}.
          </p>
        )}
      </Panel>

      <Panel kicker="Mercado" title="Símbolo, periodo y modelado">
        <div className="form-grid cols-4">
          <Field label="Símbolo" hint={dataset ? "Tomado de los datos." : undefined}>
            {(id) => (
              <input
                id={id}
                value={study.symbol}
                disabled={dataset !== undefined}
                onChange={(e) => update((s) => void (s.symbol = e.target.value.toUpperCase()))}
              />
            )}
          </Field>
          <Field
            label="Temporalidad del gráfico"
            error={tfTooFine ? `Los datos son ${dataTf}: no se puede construir ${study.chartTimeframe}.` : null}
            hint="Se construye a partir de las velas M1."
          >
            {(id) => (
              <select id={id} value={study.chartTimeframe} onChange={(e) => update((s) => void (s.chartTimeframe = e.target.value as Timeframe))}>
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {TIMEFRAME_LABEL[tf]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Modelado" hint="Como MT5: 4 precios por vela M1.">
            {(id) => (
              <select id={id} value={study.modeling} onChange={(e) => update((s) => void (s.modeling = e.target.value as StudyConfig["modeling"]))}>
                <option value="ohlc_m1">OHLC en M1</option>
                <option value="open_prices">Solo precios de apertura</option>
              </select>
            )}
          </Field>
          <Field label="Retrasos" hint={study.delay.mode === "random" ? "Emula deslizamientos y recotizaciones." : undefined}>
            {(id) => (
              <div className="inline-pair">
                <select id={id} value={study.delay.mode} onChange={(e) => update((s) => void (s.delay.mode = e.target.value as StudyConfig["delay"]["mode"]))}>
                  <option value="none">Sin retraso</option>
                  <option value="fixed">Retraso fijo</option>
                  <option value="random">Retraso aleatorio</option>
                </select>
                {study.delay.mode === "fixed" && (
                  <span className="unit-input">
                    <NumInput value={study.delay.ms} min={0} integer onChange={(n) => update((s) => void (s.delay.ms = n))} />
                    <span>ms</span>
                  </span>
                )}
              </div>
            )}
          </Field>
        </div>

        <div className="period-row">
          <div className="field">
            <span className="field-label">Intervalo total</span>
            <Seg<PeriodPreset>
              label="Intervalo"
              value={study.period.preset}
              onChange={(v) => update((s) => void (s.period.preset = v))}
              options={[
                { value: "all", label: "Todo el histórico", disabled: !dataset },
                { value: "last5y", label: "Últimos 5 años", disabled: !dataset },
                { value: "last3y", label: "Últimos 3 años", disabled: !dataset },
                { value: "custom", label: "Personalizado" },
              ]}
            />
          </div>
          <Field label="Desde">
            {(id) => (
              <input
                id={id}
                type="date"
                disabled={!custom}
                value={custom || !periods ? study.period.from : formatDay(periods.total.from)}
                onChange={(e) => update((s) => void (s.period.from = e.target.value))}
              />
            )}
          </Field>
          <Field label="Hasta (incluido)">
            {(id) => (
              <input
                id={id}
                type="date"
                disabled={!custom}
                value={custom || !periods ? study.period.to : formatDay(periods.total.to - DAY_MS)}
                onChange={(e) => update((s) => void (s.period.to = e.target.value))}
              />
            )}
          </Field>
          <div className="field">
            <span className="field-label">Duración</span>
            <span className="readout mono">{periods ? spanLabel(periods.total.from, periods.total.to) : "—"}</span>
          </div>
        </div>

        <UnseenBlock study={study} update={update} periods={periods} />

        {props.periodIssues.length > 0 && (
          <div className="error-box">
            {props.periodIssues.map((i) => (
              <div key={i}>{i}</div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid-2">
        <Panel kicker="Cuenta" title="Simulación de cuenta">
          <div className="form-grid cols-3">
            <Field label="Depósito inicial">
              {(id) => <NumInput id={id} value={study.account.deposit} min={1} onChange={(n) => update((s) => void (s.account.deposit = n))} />}
            </Field>
            <Field label="Divisa">
              {(id) => (
                <select id={id} value={study.account.currency} onChange={(e) => update((s) => void (s.account.currency = e.target.value))}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Apalancamiento">
              {(id) => (
                <select id={id} value={study.account.leverage} onChange={(e) => update((s) => void (s.account.leverage = Number(e.target.value)))}>
                  {[...new Set([...LEVERAGES, study.account.leverage])].sort((a, b) => a - b).map((l) => (
                    <option key={l} value={l}>
                      1:{l}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Help>
            <p>Usa los mismos valores que pondrías en el probador de MT5. El apalancamiento de tu cuenta real aparece en <strong>Caja de herramientas → Operaciones</strong> o en los datos de la cuenta que te dio el bróker.</p>
            <p>Si importas la configuración del probador (tarjeta A), estos tres campos se rellenan solos.</p>
          </Help>
        </Panel>

        <SpecPanel study={study} update={update} />
      </div>
    </>
  );
}

function UnseenBlock({ study, update, periods }: Pick<Props, "study" | "update" | "periods">) {
  const u = study.unseen;
  return (
    <div className={`unseen-block${u.enabled ? " on" : ""}`}>
      <div className="unseen-head">
        <label className="field checkbox">
          <input type="checkbox" checked={u.enabled} onChange={(e) => update((s) => void (s.unseen.enabled = e.target.checked))} />
          Reservar un periodo no visto
        </label>
        <span className="field-hint">
          Un tramo final que no se usa ni para optimizar ni para validar. Se abre una sola vez, con la configuración ya
          elegida: es la prueba final de «go / no go».
        </span>
      </div>
      {u.enabled && (
        <div className="unseen-body">
          <Seg
            label="Cómo se define"
            value={u.mode}
            onChange={(m) => update((s) => void (s.unseen.mode = m))}
            options={[
              { value: "duration", label: "Últimos…" },
              { value: "date", label: "Desde una fecha" },
            ]}
          />
          {u.mode === "duration" ? (
            <div className="unit-input">
              <NumInput value={u.duration.value} min={1} integer onChange={(n) => update((s) => void (s.unseen.duration.value = n))} />
              <select
                className="input"
                aria-label="Unidad del periodo no visto"
                value={u.duration.unit}
                onChange={(e) => update((s) => void (s.unseen.duration.unit = e.target.value as DurationUnit))}
              >
                {UNITS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input className="input date-input" type="date" aria-label="Inicio del periodo no visto" value={u.from} onChange={(e) => update((s) => void (s.unseen.from = e.target.value))} />
          )}
          {periods?.unseen && (
            <div className="unseen-summary mono">
              <span><span className="legend-bar research" />Investigación {rangeLabel(periods.research)} · {spanLabel(periods.research.from, periods.research.to)}</span>
              <span><span className="legend-bar unseen" />No visto {rangeLabel(periods.unseen)} · {spanLabel(periods.unseen.from, periods.unseen.to)} · bloqueado</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpecPanel({ study, update }: Pick<Props, "study" | "update">) {
  const spec = study.spec;
  const [editing, setEditing] = useState(false);
  const set = <K extends keyof StudySpec>(k: K, v: StudySpec[K]) =>
    update((s) => {
      s.spec[k] = v;
      if (s.spec.source.kind !== "manual" && k !== "spread" && k !== "commissionPerLot") {
        s.spec.source = { kind: "manual", label: s.spec.source.label };
      }
    });
  const numField = (label: string, k: "digits" | "tickSize" | "tickValue" | "contractSize" | "volumeMin" | "volumeMax" | "volumeStep" | "swapLong" | "swapShort", hint?: string) => (
    <Field label={label} hint={hint}>
      {(id) =>
        editing ? (
          <NumInput id={id} value={spec[k]} integer={k === "digits"} onChange={(n) => set(k, n)} />
        ) : (
          <span id={id} className="readout mono">{spec[k]}</span>
        )
      }
    </Field>
  );

  return (
    <Panel
      kicker="Símbolo"
      title={`Especificación de ${spec.symbol}`}
      actions={
        <div className="inline-pair">
          <SourceBadge kind={spec.source.kind} label={spec.source.label} />
          <button type="button" className="ghost-btn" onClick={() => setEditing((e) => !e)}>
            {editing ? "Listo" : "Editar"}
          </button>
        </div>
      }
    >
      {spec.source.kind === "default" && (
        <p className="inline-note warn">
          Son valores de ejemplo. Importa la especificación de tu bróker (tarjeta C): el tamaño de contrato y el valor del tick
          cambian de un bróker a otro y alteran todos los resultados.
        </p>
      )}
      <div className="form-grid cols-3 mt">
        {numField("Tamaño de contrato", "contractSize")}
        {numField("Dígitos", "digits")}
        {numField("Tamaño del tick", "tickSize")}
        {numField(`Valor del tick (${study.account.currency})`, "tickValue", "Por lote, por cada tick.")}
        {numField("Lote mínimo", "volumeMin")}
        {numField("Paso de lote", "volumeStep")}
        {numField("Swap largo", "swapLong", spec.swapModeLabel)}
        {numField("Swap corto", "swapShort", `Triple: ${WEEKDAYS[spec.swap3Day] ?? "—"}`)}
        <Field label="Margen">
          {(id) => (
            <span id={id} className="readout mono">
              {spec.calcModeLabel} · {spec.marginRateBuy ? `${(spec.marginRateBuy * 100).toFixed(1)} %` : "según apalancamiento"}
            </span>
          )}
        </Field>
      </div>

      {spec.sessions && (
        <div className="sessions">
          <span className="field-label">Sesiones de trading (hora del servidor)</span>
          <div className="sessions-row">
            {spec.sessions.map((day, i) => (
              <span key={i} className={day.length ? "session" : "session closed"}>
                <strong>{WEEKDAYS[i]}</strong>
                {day.length ? day.map((x) => `${formatSessionMinutes(x.open)}–${formatSessionMinutes(x.close)}`).join(", ") : "cerrado"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="form-grid cols-2 mt">
        <div className="field">
          <span className="field-label">Spread</span>
          <Seg
            label="Spread"
            value={spec.spread.mode}
            onChange={(m) => set("spread", { ...spec.spread, mode: m })}
            options={[
              { value: "data", label: "Del CSV, vela a vela" },
              { value: "fixed", label: "Fijo" },
            ]}
          />
          {spec.spread.mode === "fixed" ? (
            <span className="unit-input mt-s">
              <NumInput value={spec.spread.points} min={0} onChange={(n) => set("spread", { ...spec.spread, points: n })} />
              <span>puntos</span>
            </span>
          ) : (
            <span className="field-hint">Como el probador de MT5: el spread histórico de cada vela (columna &lt;SPREAD&gt;).</span>
          )}
        </div>
        <Field label={`Comisión por lote, ida y vuelta (${study.account.currency})`}>
          {(id) => <NumInput id={id} value={spec.commissionPerLot} min={0} onChange={(n) => set("commissionPerLot", n)} />}
        </Field>
      </div>
      <Help title="¿Dónde veo la comisión?">
        <p>La comisión no viene en la especificación del símbolo: la cobra el bróker por cuenta.</p>
        <ul>
          <li>En MT5: <strong>Caja de herramientas → Historial</strong>, columna <strong>Comisión</strong> de una operación de 1 lote (suma apertura y cierre).</li>
          <li>O en la página de condiciones de tu tipo de cuenta en la web del bróker.</li>
        </ul>
      </Help>
    </Panel>
  );
}
