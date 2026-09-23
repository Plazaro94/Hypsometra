"use client";

import { useState } from "react";
import { decodeMt5Text, parseSetFile, parseSymbolSpecJson, parseTesterConfig } from "@hypsometra/mt5";
import { Field, FilePick, Help, Panel } from "@/components/ui";
import {
  TIMEFRAMES,
  applySetFile,
  applyTesterConfig,
  formatDayMt5,
  formatInt,
  specFromMt5,
  type DatasetMeta,
  type StudyConfig,
  type Timeframe,
} from "@/lib/study";
import type { ReactNode } from "react";

interface Props {
  study: StudyConfig;
  replace: (next: StudyConfig) => void;
  dataset: DatasetMeta | undefined;
  onDatasetsChanged: (selectId?: string) => Promise<void>;
}

type Status = { tone: "ok" | "error"; lines: string[] } | null;

/** Apply an import to a copy of the study and return its summary synchronously. */
function applyTo(study: StudyConfig, replace: Props["replace"], fn: (s: StudyConfig) => string[]): string[] {
  const next = structuredClone(study);
  const notes = fn(next);
  replace(next);
  return notes;
}

async function readMt5File(file: File): Promise<string> {
  return decodeMt5Text(new Uint8Array(await file.arrayBuffer()));
}

function StatusLines({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <div className={status.tone === "ok" ? "import-status ok" : "import-status error"}>
      {status.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

export function ImportPanel({ study, replace, dataset, onDatasetsChanged }: Props) {
  return (
    <Panel
      kicker="01 · Configuración"
      title="Importar desde MT5"
      intro="Cuanto más importes, menos hay que escribir y menos errores. Todo es opcional y se puede editar después."
    >
      <div className="import-grid">
        <TesterImport study={study} replace={replace} />
        <SetImport study={study} replace={replace} />
        <SpecImport study={study} replace={replace} />
        <BarsImport study={study} dataset={dataset} onDatasetsChanged={onDatasetsChanged} />
      </div>
    </Panel>
  );
}

function ImportCard(props: {
  step: string;
  title: string;
  what: string;
  done: string | null;
  children: ReactNode;
}) {
  return (
    <section className={`import-card${props.done ? " done" : ""}`}>
      <div className="import-card-head">
        <span className="import-step">{props.done ? "✓" : props.step}</span>
        <div>
          <h3>{props.title}</h3>
          <p>{props.done ?? props.what}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}

type ImportProps = Pick<Props, "study" | "replace">;

function TesterImport({ study, replace }: ImportProps) {
  const imported = study.sources.tester !== null;
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const apply = () => {
    try {
      const cfg = parseTesterConfig(text);
      const notes = applyTo(study, replace, (s) => applyTesterConfig(s, cfg));
      if (cfg.unknownKeys.length) notes.push(`Ignorado: ${cfg.unknownKeys.join(", ")}.`);
      setStatus({ tone: "ok", lines: notes });
      setText("");
    } catch (err) {
      setStatus({ tone: "error", lines: [err instanceof Error ? err.message : "No se pudo leer el texto."] });
    }
  };
  return (
    <ImportCard
      step="A"
      title="Configuración del probador"
      what="Símbolo, temporalidad, fechas, cuenta, modelado e inputs de una vez."
      done={imported ? "Importada. Pega otra para reemplazarla." : null}
    >
      <textarea
        className="input import-paste"
        rows={3}
        placeholder="Pega aquí lo copiado con Ctrl+C en el probador de MT5"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="inline-pair">
        <button type="button" className="primary-btn" disabled={!text.trim()} onClick={apply}>
          Aplicar
        </button>
      </div>
      <Help>
        <p>MT5 puede copiar toda la configuración del probador como texto, igual que copias un texto cualquiera:</p>
        <ol>
          <li>Abre el probador: <strong>Ver → Probador de estrategias</strong> (Ctrl+R).</li>
          <li>Ve a la pestaña <strong>Configuración</strong>: la de Experto, Símbolo, Intervalo, Depósito…</li>
          <li>Haz clic en una zona vacía de esa pestaña (no dentro de una casilla) y pulsa <strong>Ctrl+C</strong>. No verás ningún aviso: el texto queda copiado.</li>
          <li>Vuelve aquí, haz clic en el recuadro y pulsa <strong>Ctrl+V</strong>. Luego, Aplicar.</li>
        </ol>
        <p>Es opcional: si prefieres, rellena esos datos abajo a mano.</p>
      </Help>
      <StatusLines status={status} />
    </ImportCard>
  );
}

function SetImport({ study, replace }: ImportProps) {
  const imported = study.sources.set?.label ?? null;
  const [status, setStatus] = useState<Status>(null);
  const onFile = async (file: File) => {
    try {
      const set = parseSetFile(await readMt5File(file));
      const notes = applyTo(study, replace, (s) => applySetFile(s, set, file.name));
      setStatus({ tone: "ok", lines: notes });
    } catch (err) {
      setStatus({ tone: "error", lines: [err instanceof Error ? err.message : "No se pudo leer el .set."] });
    }
  };
  return (
    <ImportCard
      step="B"
      title="Inputs del EA (.set)"
      what="Valores, rangos y qué optimizar, igual que en la pestaña Parámetros de MT5."
      done={imported ? `Importado: ${imported}` : null}
    >
      <FilePick accept=".set,.txt" onFile={(f) => void onFile(f)} label="Elegir .set…" />
      <Help>
        <p>Dos formas:</p>
        <ul>
          <li>En el probador, pestaña <strong>Parámetros</strong>: clic derecho → <strong>Guardar</strong>.</li>
          <li>MT5 guarda el último usado automáticamente: <strong>Archivo → Abrir carpeta de datos → MQL5 → Profiles → Tester</strong>, archivo <code>Nombre del EA.set</code>.</li>
        </ul>
      </Help>
      <StatusLines status={status} />
    </ImportCard>
  );
}

function SpecImport({ study, replace }: ImportProps) {
  const [status, setStatus] = useState<Status>(null);
  const onFile = async (file: File) => {
    try {
      const specs = parseSymbolSpecJson(await readMt5File(file));
      const spec = specs.find((x) => x.symbol.toUpperCase() === study.symbol.toUpperCase()) ?? specs[0]!;
      applyTo(study, replace, (s) => {
        s.spec = specFromMt5(spec, file.name, s.spec);
        s.symbol = spec.symbol.toUpperCase();
        return [];
      });
      const lines = [
        `${spec.symbol} · ${spec.calcModeLabel} · contrato ${spec.contractSize} · tick ${spec.tickSize} = ${spec.tickValue} ${spec.currencyProfit}.`,
        spec.spreadPoints === null ? "Spread flotante: se tomará vela a vela del CSV." : `Spread fijo: ${spec.spreadPoints} puntos.`,
      ];
      if (specs.length > 1) lines.push(`El archivo tenía ${specs.length} símbolos; se usó ${spec.symbol}.`);
      setStatus({ tone: "ok", lines });
    } catch (err) {
      setStatus({ tone: "error", lines: [err instanceof Error ? err.message : "No se pudo leer la especificación."] });
    }
  };
  const done = study.spec.source.kind === "file" ? `Importada: ${study.spec.source.label}` : null;
  return (
    <ImportCard step="C" title="Especificación del símbolo (.json)" what="Contrato, tick, lotes, margen, swaps y horario de sesiones." done={done}>
      <FilePick accept=".json" onFile={(f) => void onFile(f)} label="Elegir .json…" />
      <Help>
        <ol>
          <li>En MT5: <strong>Ver → Símbolos</strong> (Ctrl+U).</li>
          <li>Selecciona el símbolo y pulsa <strong>Exportar</strong>.</li>
        </ol>
        <p>O usa el exportador de Hypsometra (tarjeta D): genera este archivo junto con los datos.</p>
      </Help>
      <StatusLines status={status} />
    </ImportCard>
  );
}

function BarsImport({ study, dataset, onDatasetsChanged }: Omit<Props, "replace">) {
  const [file, setFile] = useState<File | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("M1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("symbol", study.symbol);
      form.set("timeframe", timeframe);
      const res = await fetch("/api/datasets/upload", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; reused?: boolean; meta?: DatasetMeta };
      if (!res.ok || !data.meta) throw new Error(data.error ?? "No se pudo importar el archivo.");
      await onDatasetsChanged(data.meta.id);
      setStatus({
        tone: "ok",
        lines: [
          `${data.reused ? "Ya estaba importado" : "Importado"}: ${formatInt(data.meta.barCount)} velas ${data.meta.timeframe}, ${formatDayMt5(data.meta.from)} → ${formatDayMt5(data.meta.to)}.`,
        ],
      });
      setFile(null);
    } catch (err) {
      setStatus({ tone: "error", lines: [err instanceof Error ? err.message : "No se pudo importar el archivo."] });
    } finally {
      setBusy(false);
    }
  }

  const done = dataset ? `${dataset.symbol} ${dataset.timeframe} · ${formatInt(dataset.barCount)} velas` : null;
  return (
    <ImportCard step="D" title="Datos de precio (CSV M1)" what="Las velas sobre las que se simula. M1 permite construir cualquier temporalidad." done={done}>
      <div className="inline-pair">
        <FilePick accept=".csv,.txt,.tsv" onFile={setFile} label="Elegir CSV…" />
        <Field label="Temporalidad del archivo" className="compact">
          {(id) => (
            <select id={id} value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)}>
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          )}
        </Field>
        <button type="button" className="primary-btn" disabled={!file || busy} onClick={() => void submit()}>
          {busy ? "Importando…" : `Importar como ${study.symbol}`}
        </button>
      </div>
      <Help>
        <p><strong>Recomendado:</strong> el exportador de Hypsometra lo hace todo en un paso.</p>
        <ol>
          <li><a className="text-btn" href="/api/tools/exporter" download>Descarga HypsometraExporter.mq5</a> y cópialo en <strong>Archivo → Abrir carpeta de datos → MQL5 → Scripts</strong>.</li>
          <li>Ábrelo con MetaEditor y pulsa <strong>Compilar</strong> (F7).</li>
          <li>En MT5, arrástralo desde el Navegador al gráfico del símbolo. Genera el CSV M1, la especificación y la cuenta en <code>MQL5\Files\Hypsometra</code>.</li>
        </ol>
        <p><strong>Manual:</strong> <strong>Ver → Símbolos → Barras</strong>, elige M1 y las fechas, pulsa <strong>Solicitar</strong> y luego <strong>Exportar barras</strong>.</p>
        <p>Si faltan años, en <strong>Herramientas → Opciones → Gráficos</strong> sube «Máx. barras en la ventana» a Unlimited.</p>
      </Help>
      <StatusLines status={status} />
    </ImportCard>
  );
}
