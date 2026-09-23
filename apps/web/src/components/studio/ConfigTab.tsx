"use client";

import { useState } from "react";
import { STRATEGIES, type StrategyDefinition } from "@hypsometra/engine/registry";
import { Field, NumInput, Panel, Seg } from "@/components/ui";
import {
  CURRENCIES,
  LEVERAGES,
  SYMBOL_PRESETS,
  TIMEFRAMES,
  TIMEFRAME_MINUTES,
  formatDay,
  formatDayMt5,
  formatInt,
  spanLabel,
  type DatasetMeta,
  type PeriodPreset,
  type StudyConfig,
  type Timeframe,
} from "@/lib/study";

interface Props {
  study: StudyConfig;
  update: (fn: (s: StudyConfig) => void) => void;
  strategy: StrategyDefinition | undefined;
  onStrategyChange: (id: string) => void;
  datasets: DatasetMeta[];
  dataset: DatasetMeta | undefined;
  onDatasetChange: (id: string | null) => void;
  onDatasetsChanged: (selectId?: string) => Promise<void>;
  period: { from: number; to: number } | null;
  periodIssues: string[];
}

export function ConfigTab(props: Props) {
  const { study, update, strategy, dataset, period } = props;
  const dataTf = (dataset?.timeframe.toUpperCase() ?? "M1") as Timeframe;
  const tfTooFine =
    dataset !== undefined &&
    TIMEFRAME_MINUTES[study.chartTimeframe] !== undefined &&
    TIMEFRAME_MINUTES[dataTf] !== undefined &&
    TIMEFRAME_MINUTES[study.chartTimeframe] < TIMEFRAME_MINUTES[dataTf];

  return (
    <>
      <Panel kicker="01 · Configuración" title="Experto y datos">
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
                ? `${dataset.symbol} · ${dataset.timeframe} · ${formatInt(dataset.barCount)} barras · ${formatDayMt5(dataset.from)} → ${formatDayMt5(dataset.to)}`
                : "Importa un CSV exportado de MT5 (recomendado: OHLC M1)."
            }
          >
            {(id) => (
              <select
                id={id}
                value={study.datasetId ?? ""}
                onChange={(e) => props.onDatasetChange(e.target.value || null)}
              >
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
            La lógica de <strong>{strategy.name}</strong> aún no está portada. Puedes preparar el estudio, pero no
            ejecutarlo hasta superar la prueba de paridad con MT5.
          </p>
        )}

        <DatasetImport onImported={props.onDatasetsChanged} defaultSymbol={study.symbol} />
      </Panel>

      <Panel kicker="Mercado" title="Símbolo, periodo y modelado">
        <div className="form-grid cols-4">
          <Field label="Símbolo" hint={dataset ? "Tomado del dataset." : undefined}>
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
              <select
                id={id}
                value={study.chartTimeframe}
                onChange={(e) => update((s) => void (s.chartTimeframe = e.target.value as Timeframe))}
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Modelado" hint="Igual que MT5: 4 precios por vela M1.">
            {(id) => (
              <select
                id={id}
                value={study.modeling}
                onChange={(e) => update((s) => void (s.modeling = e.target.value as StudyConfig["modeling"]))}
              >
                <option value="ohlc_m1">OHLC en M1</option>
                <option value="open_prices">Solo precios de apertura</option>
              </select>
            )}
          </Field>

          <Field
            label="Retrasos"
            hint={study.delay.mode === "random" ? "Emula deslizamientos y recotizaciones." : undefined}
          >
            {(id) => (
              <div className="inline-pair">
                <select
                  id={id}
                  value={study.delay.mode}
                  onChange={(e) => update((s) => void (s.delay.mode = e.target.value as StudyConfig["delay"]["mode"]))}
                >
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
            <span className="field-label">Intervalo</span>
            <Seg<PeriodPreset>
              label="Intervalo"
              value={study.period.preset}
              onChange={(v) => update((s) => void (s.period.preset = v))}
              options={[
                { value: "all", label: "Todo el histórico", disabled: !dataset },
                { value: "last5y", label: "Últimos 5 años", disabled: !dataset },
                { value: "last3y", label: "Últimos 3 años", disabled: !dataset },
                { value: "last1y", label: "Último año", disabled: !dataset },
                { value: "custom", label: "Personalizado" },
              ]}
            />
          </div>
          <Field label="Desde">
            {(id) => (
              <input
                id={id}
                type="date"
                disabled={study.period.preset !== "custom"}
                value={study.period.preset === "custom" || !period ? study.period.from : formatDay(period.from)}
                onChange={(e) => update((s) => void (s.period.from = e.target.value))}
              />
            )}
          </Field>
          <Field label="Hasta (incluido)">
            {(id) => (
              <input
                id={id}
                type="date"
                disabled={study.period.preset !== "custom"}
                value={study.period.preset === "custom" || !period ? study.period.to : formatDay(period.to - 86_400_000)}
                onChange={(e) => update((s) => void (s.period.to = e.target.value))}
              />
            )}
          </Field>
          <div className="field">
            <span className="field-label">Duración</span>
            <span className="readout mono">{period ? spanLabel(period.from, period.to) : "—"}</span>
          </div>
        </div>
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
              {(id) => (
                <NumInput id={id} value={study.account.deposit} min={1} onChange={(n) => update((s) => void (s.account.deposit = n))} />
              )}
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
                <select
                  id={id}
                  value={study.account.leverage}
                  onChange={(e) => update((s) => void (s.account.leverage = Number(e.target.value)))}
                >
                  {LEVERAGES.map((l) => (
                    <option key={l} value={l}>
                      1:{l}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Panel>

        <Panel
          kicker="Símbolo"
          title="Especificación del contrato"
          actions={
            <Seg<string>
              label="Plantilla"
              value={Object.entries(SYMBOL_PRESETS).find(([, v]) => JSON.stringify(v) === JSON.stringify(study.symbolSpec))?.[0] ?? ""}
              onChange={(k) => update((s) => void (s.symbolSpec = { ...SYMBOL_PRESETS[k]! }))}
              options={Object.keys(SYMBOL_PRESETS).map((k) => ({ value: k, label: k }))}
            />
          }
        >
          <div className="form-grid cols-3">
            <Field label="Tamaño de contrato">
              {(id) => (
                <NumInput id={id} value={study.symbolSpec.contractSize} min={0} onChange={(n) => update((s) => void (s.symbolSpec.contractSize = n))} />
              )}
            </Field>
            <Field label="Dígitos" hint={`Punto = ${(10 ** -study.symbolSpec.digits).toFixed(study.symbolSpec.digits)}`}>
              {(id) => (
                <NumInput id={id} value={study.symbolSpec.digits} min={0} max={8} integer onChange={(n) => update((s) => void (s.symbolSpec.digits = n))} />
              )}
            </Field>
            <Field label="Spread (puntos)">
              {(id) => (
                <NumInput id={id} value={study.symbolSpec.spreadPoints} min={0} onChange={(n) => update((s) => void (s.symbolSpec.spreadPoints = n))} />
              )}
            </Field>
            <Field label={`Comisión / lote (${study.account.currency})`} hint="Ida y vuelta.">
              {(id) => (
                <NumInput id={id} value={study.symbolSpec.commissionPerLot} min={0} onChange={(n) => update((s) => void (s.symbolSpec.commissionPerLot = n))} />
              )}
            </Field>
            <Field label="Swap largo (puntos)">
              {(id) => (
                <NumInput id={id} value={study.symbolSpec.swapLong} onChange={(n) => update((s) => void (s.symbolSpec.swapLong = n))} />
              )}
            </Field>
            <Field label="Swap corto (puntos)">
              {(id) => (
                <NumInput id={id} value={study.symbolSpec.swapShort} onChange={(n) => update((s) => void (s.symbolSpec.swapShort = n))} />
              )}
            </Field>
          </div>
          <p className="field-hint spec-hint">
            Cópialos de MT5: Observación del mercado → clic derecho en el símbolo → Especificación.
          </p>
        </Panel>
      </div>
    </>
  );
}

function DatasetImport(props: { onImported: (selectId?: string) => Promise<void>; defaultSymbol: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [symbol, setSymbol] = useState(props.defaultSymbol);
  const [timeframe, setTimeframe] = useState<Timeframe>("M1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="ghost-btn import-toggle" onClick={() => setOpen(true)}>
        Importar CSV…
      </button>
    );
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("symbol", symbol);
      form.set("timeframe", timeframe);
      const res = await fetch("/api/datasets/upload", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; meta?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? "No se pudo importar el archivo.");
      await props.onImported(data.meta?.id);
      setOpen(false);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-box">
      <div className="form-grid cols-4">
        <Field label="Archivo" hint={file ? `${(file.size / 1_048_576).toFixed(1)} MB` : "CSV o TXT exportado de MT5."}>
          {(id) => <input id={id} type="file" accept=".csv,.txt,.tsv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
        </Field>
        <Field label="Símbolo">
          {(id) => <input id={id} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />}
        </Field>
        <Field label="Temporalidad del archivo">
          {(id) => (
            <select id={id} value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)}>
              {TIMEFRAMES.map((tf) => (
                <option key={tf}>{tf}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="field import-actions">
          <span className="field-label">&nbsp;</span>
          <div className="inline-pair">
            <button type="button" className="primary-btn" disabled={!file || busy || !symbol} onClick={() => void submit()}>
              {busy ? "Importando…" : "Importar"}
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
