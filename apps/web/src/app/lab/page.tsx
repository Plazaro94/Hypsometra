"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DatasetMeta = {
  id: string;
  symbol: string;
  timeframe: string;
  barCount: number;
  from: number;
  to: number;
};

function formatRange(from: number, to: number): string {
  return `${new Date(from).toISOString().slice(0, 10)} → ${new Date(to).toISOString().slice(0, 10)}`;
}

export default function LabPage() {
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("H1");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string>("");

  const [isBars, setIsBars] = useState("40");
  const [oosBars, setOosBars] = useState("20");
  const [fastRange, setFastRange] = useState("3:5:1");
  const [slowRange, setSlowRange] = useState("8:12:2");
  const [mcFast, setMcFast] = useState("3");
  const [mcSlow, setMcSlow] = useState("10");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/datasets");
    const data = (await res.json()) as { datasets: DatasetMeta[] };
    setDatasets(data.datasets ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Elige un CSV");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Ingestando…");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("symbol", symbol);
      form.set("timeframe", timeframe);
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        error?: string;
        meta?: DatasetMeta;
        reused?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setStatus(
        data.reused
          ? `Dataset reutilizado: ${data.meta?.id}`
          : `Dataset creado: ${data.meta?.id}`,
      );
      if (data.meta?.id) setSelected(data.meta.id);
      setFile(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function runWfo() {
    if (!selected) {
      setError("Selecciona un dataset");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Walk-forward en curso…");
    setReport("");
    try {
      const res = await fetch("/api/jobs/wfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: selected,
          is: Number(isBars),
          oos: Number(oosBars),
          step: Number(oosBars),
          wf: "rolling",
          search: "grid",
          fast: fastRange,
          slow: slowRange,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "WFO failed");
      setStatus(
        `WFO listo · ${data.result.folds.length} folds · OOS neto ${Number(data.result.combinedOosNetProfit).toFixed(2)}`,
      );
      setReport(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function runMc() {
    if (!selected) {
      setError("Selecciona un dataset");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Monte Carlo en curso…");
    setReport("");
    try {
      const res = await fetch("/api/jobs/montecarlo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: selected,
          fast: Number(mcFast),
          slow: Number(mcSlow),
          sims: 1000,
          method: "bootstrap",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "MC failed");
      setStatus(
        `MC listo · P(profit) ${(data.result.probProfit * 100).toFixed(1)}% · neto p50 ${Number(data.result.netProfit.p50).toFixed(2)}`,
      );
      setReport(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="nav">
        <Link href="/" className="nav-brand">
          Hypsometra
        </Link>
        <nav className="nav-links">
          <Link href="/">Inicio</Link>
          <span>Lab</span>
        </nav>
      </header>

      <main className="lab">
        <div>
          <h1>Lab</h1>
          <p className="lab-lead">
            Sube un CSV de MT5, elige el dataset y lanza walk-forward o Monte
            Carlo. El motor es el mismo que la CLI.
          </p>
        </div>

        <section className="panel">
          <h2>1. Dataset</h2>
          <form className="form-grid" onSubmit={onUpload}>
            <div
              className="drop"
              data-active={drag || !!file}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
            >
              <label>
                {file
                  ? file.name
                  : "Suelta un CSV aquí o elige archivo"}
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="field">
              <label htmlFor="symbol">Símbolo</label>
              <input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="tf">Timeframe</label>
              <input
                id="tf"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Ingestar
            </button>
          </form>

          {datasets.length > 0 ? (
            <ul className="dataset-list" style={{ marginTop: "1.25rem" }}>
              {datasets.map((d) => (
                <li
                  key={d.id}
                  data-selected={selected === d.id}
                  onClick={() => setSelected(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelected(d.id);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <strong>
                      {d.symbol} · {d.timeframe}
                    </strong>
                    <div className="meta">{d.id}</div>
                  </div>
                  <div className="meta">
                    {d.barCount} bars · {formatRange(d.from, d.to)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status" style={{ marginTop: "1rem" }}>
              Aún no hay datasets. Sube un CSV para empezar.
            </p>
          )}
        </section>

        <section className="panel">
          <h2>2. Walk-forward</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="is">IS bars</label>
              <input
                id="is"
                value={isBars}
                onChange={(e) => setIsBars(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="oos">OOS bars</label>
              <input
                id="oos"
                value={oosBars}
                onChange={(e) => setOosBars(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="fast">Fast from:to:step</label>
              <input
                id="fast"
                value={fastRange}
                onChange={(e) => setFastRange(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="slow">Slow from:to:step</label>
              <input
                id="slow"
                value={slowRange}
                onChange={(e) => setSlowRange(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !selected}
              onClick={() => void runWfo()}
            >
              Lanzar WFO
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>3. Monte Carlo</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="mcfast">Fast (fijo)</label>
              <input
                id="mcfast"
                value={mcFast}
                onChange={(e) => setMcFast(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="mcslow">Slow (fijo)</label>
              <input
                id="mcslow"
                value={mcSlow}
                onChange={(e) => setMcSlow(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !selected}
              onClick={() => void runMc()}
            >
              Lanzar MC
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Resultado</h2>
          {error ? <p className="status status-error">{error}</p> : null}
          {status ? <p className="status status-ok">{status}</p> : null}
          {report ? <pre className="results">{report}</pre> : null}
          {!error && !status && !report ? (
            <p className="status">Los informes aparecerán aquí.</p>
          ) : null}
        </section>

        <p className="footer-note">
          Estrategia v1 del lab: cruce SMA. Los datasets viven en{" "}
          <code>data/datasets/</code> (local). En Vercel el filesystem es
          efímero — el cómputo serio irá a workers.
        </p>
      </main>
    </>
  );
}
