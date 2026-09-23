"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStrategy, STRATEGIES } from "@hypsometra/engine/registry";
import { BrandMark } from "@/components/ui";
import { ConfigTab } from "@/components/studio/ConfigTab";
import { ParamsTab } from "@/components/studio/ParamsTab";
import { ValidationTab } from "@/components/studio/ValidationTab";
import { OptimizationTab, type ReadinessItem } from "@/components/studio/OptimizationTab";
import {
  combinationCount,
  defaultStudy,
  formatDayMt5,
  loadStudy,
  paramAxis,
  paramDefs,
  periodIssues as computePeriodIssues,
  planRun,
  planWindows,
  rangeLabel,
  registryDefaults,
  resolvePeriods,
  saveStudy,
  spanLabel,
  type DatasetMeta,
  type StudyConfig,
} from "@/lib/study";

type Tab = "config" | "params" | "validation" | "optimization";

const STUDY_TABS: Array<{ id: Tab; n: string; label: string }> = [
  { id: "config", n: "01", label: "Configuración" },
  { id: "params", n: "02", label: "Parámetros" },
  { id: "validation", n: "03", label: "Validación" },
  { id: "optimization", n: "04", label: "Optimización" },
];

const RESULT_TABS = [
  { n: "05", label: "Resultados IS" },
  { n: "06", label: "Resultados OOS" },
  { n: "07", label: "Gráfico y operaciones" },
  { n: "08", label: "Monte Carlo" },
];

const MODELING_LABEL = { ohlc_m1: "OHLC en M1", open_prices: "Precios de apertura" } as const;
const THEME_KEY = "hypsometra.theme";

export function StudioApp() {
  const [study, setStudy] = useState<StudyConfig>(() => defaultStudy(STRATEGIES[0]));
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("config");
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [maxCores, setMaxCores] = useState(4);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadStudy();
    if (saved) setStudy(saved);
    setHydrated(true);
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    setMaxCores(Math.max(1, navigator.hardwareConcurrency || 4));
  }, []);

  useEffect(() => {
    if (hydrated) saveStudy(study);
  }, [study, hydrated]);

  const refreshDatasets = useCallback(async (selectId?: string) => {
    const res = await fetch("/api/datasets");
    const data = (await res.json()) as { datasets?: DatasetMeta[] };
    const list = data.datasets ?? [];
    setDatasets(list);
    if (selectId) {
      const d = list.find((x) => x.id === selectId);
      if (d) selectDataset(d);
    }
    // selectDataset is stable enough for this use; it only reads the list passed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshDatasets();
  }, [refreshDatasets]);

  const update = useCallback((fn: (s: StudyConfig) => void) => {
    setStudy((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  function selectDataset(d: DatasetMeta | undefined) {
    update((s) => {
      s.datasetId = d?.id ?? null;
      if (d) s.symbol = d.symbol.toUpperCase();
    });
  }

  const strategy = getStrategy(study.strategyId);
  const dataset = datasets.find((d) => d.id === study.datasetId);
  const periods = useMemo(() => resolvePeriods(study, dataset), [study, dataset]);
  const research = periods?.research ?? null;
  const pIssues = useMemo(() => computePeriodIssues(study, periods, dataset), [study, periods, dataset]);
  const defs = useMemo(() => paramDefs(study, strategy), [study, strategy]);
  const axes = useMemo(
    () =>
      defs.flatMap((def) => {
        const s = study.params[def.name];
        return s ? [paramAxis(def, s)] : [];
      }),
    [defs, study.params],
  );
  const combinations = combinationCount(axes);
  const plan = useMemo(() => planWindows(study, research), [study, research]);
  const run = planRun(study, combinations, plan, research);
  const specFromBroker = study.spec.source.kind === "file" || study.spec.source.kind === "manual";

  const readiness: ReadinessItem[] = [
    {
      label: "Experto portado y verificado",
      ok: strategy?.status === "ready",
      detail:
        strategy?.status === "ready"
          ? `${strategy.name} está disponible en el motor.`
          : `${strategy?.name ?? "El experto"} necesita portarse desde el .mq5 y superar la prueba de paridad con MT5.`,
    },
    {
      label: "Datos de mercado",
      ok: dataset !== undefined,
      detail: dataset ? `${dataset.symbol} ${dataset.timeframe}, ${formatDayMt5(dataset.from)} → ${formatDayMt5(dataset.to)}.` : "Importa un CSV OHLC M1 en Configuración.",
    },
    {
      label: "Especificación del símbolo del bróker",
      ok: specFromBroker,
      detail: specFromBroker ? `${study.spec.symbol}: ${study.spec.source.label}.` : "Se usan valores de ejemplo. Importa la especificación (tarjeta C).",
    },
    {
      label: "Intervalo dentro de los datos",
      ok: periods !== null && pIssues.length === 0 && dataset !== undefined,
      detail: pIssues[0] ?? (periods ? `${rangeLabel(periods.total)}.` : "Intervalo no válido."),
    },
    {
      label: "Periodo no visto reservado",
      ok: periods?.unseen != null,
      optional: true,
      detail: periods?.unseen
        ? `${rangeLabel(periods.unseen)} (${spanLabel(periods.unseen.from, periods.unseen.to)}), bloqueado para la prueba final.`
        : "Recomendado: reserva un tramo final para la prueba go / no go.",
    },
    {
      label: "Rangos de parámetros",
      ok: axes.length > 0 && !axes.some((a) => a.error),
      detail: axes.some((a) => a.error) ? "Hay rangos inválidos en Parámetros." : axes.length
          ? combinations === 1
            ? "Ningún input marcado: se hará una prueba única con valores fijos."
            : `${combinations.toLocaleString("es-ES")} combinaciones.`
          : "El experto no tiene inputs cargados.",
    },
    {
      label: "Ventanas de validación",
      ok: !plan.error && plan.issues.length === 0 && plan.windows.length > 0,
      detail: plan.error ?? plan.issues[0]?.message ?? `${plan.windows.length} ventana(s) válidas.`,
    },
    {
      label: "Motor OHLC M1",
      ok: false,
      detail: "Fase 2: velas M1 como base, SL/TP minuto a minuto, margen, apalancamiento, swaps y comisiones.",
    },
    {
      label: "Cálculo multinúcleo",
      ok: false,
      detail: "Fase 4: pases en paralelo en procesos locales, fuera del navegador.",
    },
  ];
  const ready = readiness.every((r) => r.ok || r.optional);

  const tabWarn: Record<Tab, boolean> = {
    config: !dataset || pIssues.length > 0 || strategy?.status !== "ready" || !specFromBroker,
    params: axes.some((a) => a.error),
    validation: Boolean(plan.error) || plan.issues.length > 0,
    optimization: false,
  };

  function setThemeValue(t: "dark" | "light") {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      // ignore
    }
  }

  function exportStudy() {
    const blob = new Blob([JSON.stringify(study, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = study.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "estudio";
    a.href = url;
    a.download = `${slug}.hypsometra.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importStudy(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as StudyConfig;
      if (parsed.version !== 2 || typeof parsed.strategyId !== "string") throw new Error();
      setStudy(parsed);
    } catch {
      window.alert("El archivo no es un estudio de Hypsometra válido.");
    }
  }

  const meta = [
    study.symbol,
    study.chartTimeframe,
    MODELING_LABEL[study.modeling],
    periods ? rangeLabel(periods.total) : "periodo sin definir",
    ...(periods?.unseen ? [`no visto desde ${formatDayMt5(periods.unseen.from)}`] : []),
    `${study.account.deposit.toLocaleString("es-ES")} ${study.account.currency}`,
    `1:${study.account.leverage}`,
  ].join(" · ");

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand-link" href="/app">
          <span className="brand-row">
            <BrandMark />
            <span className="brand-name">Hypsometra</span>
          </span>
          <span className="brand-sub">Laboratorio de robustez para EAs</span>
        </a>

        <nav className="sidebar-section" aria-label="Estudio">
          <div className="sidebar-label">Estudio</div>
          {STUDY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`nav-item${tab === t.id ? " active" : ""}`}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              <span>{t.n}</span>
              <span>{t.label}</span>
              {tabWarn[t.id] && <span className="nav-dot" title="Revisa esta sección" />}
            </button>
          ))}
          <div className="sidebar-label sidebar-label-gap">Resultados</div>
          {RESULT_TABS.map((t) => (
            <button key={t.n} type="button" className="nav-item" disabled title="Disponible tras la primera ejecución">
              <span>{t.n}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="theme-row" role="radiogroup" aria-label="Tema">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                className="theme-btn"
                aria-checked={theme === t}
                onClick={() => setThemeValue(t)}
              >
                <span className={`swatch ${t}`} />
                {t === "dark" ? "Oscuro" : "Claro"}
              </button>
            ))}
          </div>
          <div className="version">v0.1 · motor en desarrollo</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <div className="eyebrow">Estudio · {strategy?.name ?? "sin experto"}</div>
            <input
              className="title-input"
              aria-label="Nombre del estudio"
              value={study.name}
              onChange={(e) => update((s) => void (s.name = e.target.value))}
            />
            <p className="topbar-meta">{meta}</p>
          </div>
          <div className="top-actions">
            <button type="button" className="ghost-btn" onClick={exportStudy}>
              Exportar estudio
            </button>
            <button type="button" className="ghost-btn" onClick={() => importRef.current?.click()}>
              Importar
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importStudy(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                if (window.confirm("¿Restablecer el estudio a los valores iniciales?")) {
                  setStudy(defaultStudy(STRATEGIES[0]));
                }
              }}
            >
              Restablecer
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={!ready}
              title={ready ? "Ejecutar el estudio" : "Revisa la comprobación previa en Optimización"}
              onClick={() => setTab("optimization")}
            >
              Ejecutar
            </button>
          </div>
        </header>

        <section className="content" aria-live="polite">
          {tab === "config" && (
            <ConfigTab
              study={study}
              update={update}
              replace={setStudy}
              strategy={strategy}
              onStrategyChange={(id) =>
                update((s) => {
                  s.strategyId = id;
                  s.inputs = null;
                  s.sources.set = null;
                  s.params = registryDefaults(getStrategy(id));
                })
              }
              datasets={datasets}
              dataset={dataset}
              onDatasetChange={(id) => selectDataset(datasets.find((d) => d.id === id))}
              onDatasetsChanged={refreshDatasets}
              periods={periods}
              periodIssues={pIssues}
            />
          )}
          {tab === "params" && (
            <ParamsTab study={study} update={update} strategy={strategy} defs={defs} axes={axes} combinations={combinations} />
          )}
          {tab === "validation" && <ValidationTab study={study} update={update} period={research} periods={periods} plan={plan} />}
          {tab === "optimization" && (
            <OptimizationTab study={study} update={update} run={run} readiness={readiness} maxCores={maxCores} />
          )}
        </section>
      </main>
    </div>
  );
}
