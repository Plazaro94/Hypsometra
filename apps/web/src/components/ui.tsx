"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

export function Panel(props: {
  kicker?: string;
  title?: string;
  intro?: ReactNode;
  actions?: ReactNode;
  tone?: "warn" | "info";
  children?: ReactNode;
}) {
  const cls = props.tone === "warn" ? "panel warn-panel" : props.tone === "info" ? "panel info-panel" : "panel";
  return (
    <section className={cls}>
      {(props.kicker || props.title || props.actions) && (
        <div className="panel-head">
          <div>
            {props.kicker && <div className="panel-kicker">{props.kicker}</div>}
            {props.title && <h2>{props.title}</h2>}
          </div>
          {props.actions}
        </div>
      )}
      {props.intro && <p className="panel-intro">{props.intro}</p>}
      {props.children}
    </section>
  );
}

export function Seg<T extends string>(props: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean; title?: string }>;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          className="seg-btn"
          aria-checked={props.value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field(props: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`field${props.error ? " invalid" : ""}${props.className ? ` ${props.className}` : ""}`}>
      <label className="field-label" htmlFor={id}>
        {props.label}
      </label>
      {props.children(id)}
      {props.error ? <span className="field-error">{props.error}</span> : props.hint ? <span className="field-hint">{props.hint}</span> : null}
    </div>
  );
}

/** Number input that tolerates intermediate states ("", "-", "0.") while typing. */
export function NumInput(props: {
  id?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  integer?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(props.value));
  useEffect(() => {
    if (Number(text) !== props.value) setText(String(props.value));
    // Only resync when the external value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  return (
    <input
      id={props.id}
      type="number"
      inputMode="decimal"
      value={text}
      min={props.min}
      max={props.max}
      step={props.step ?? "any"}
      disabled={props.disabled}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) {
          props.onChange(props.integer ? Math.trunc(n) : n);
        }
      }}
    />
  );
}

/** File picker with Spanish labels (the native control follows the browser language). */
export function FilePick(props: { accept: string; onFile: (f: File) => void; label?: string }) {
  const [name, setName] = useState<string | null>(null);
  return (
    <label className="file-pick">
      <input
        type="file"
        className="file-input"
        accept={props.accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            setName(f.name);
            props.onFile(f);
          }
        }}
      />
      <span className="ghost-btn">{props.label ?? "Elegir archivo…"}</span>
      <span className="file-name">{name ?? "Ningún archivo"}</span>
    </label>
  );
}

/** Short, collapsible "how do I get this?" guidance for anything that is not a simple choice. */
export function Help(props: { title?: string; children: ReactNode }) {
  return (
    <details className="help">
      <summary>{props.title ?? "¿Cómo lo obtengo?"}</summary>
      <div className="help-body">{props.children}</div>
    </details>
  );
}

/** Where a block of values came from (imported file, tester, defaults…). */
export function SourceBadge(props: { kind: "default" | "file" | "tester" | "manual"; label: string }) {
  const cls = props.kind === "default" ? "badge warn" : props.kind === "manual" ? "badge" : "badge ok";
  const prefix = props.kind === "default" ? "" : props.kind === "manual" ? "Editado · " : "Importado · ";
  return (
    <span className={cls} title={props.label}>
      {prefix}
      {props.label}
    </span>
  );
}

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M3 24c4-1 6-6 10-6s5 3 9 3 5-4 7-5" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 20c3-1 4-5 7-5s4 2 7 2 4-3 5-4" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 15.5c2-.6 2.6-3.5 4.6-3.5s2.6 1.4 4.6 1.4 2.4-2 3.3-2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
