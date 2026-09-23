#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CsvLocalSource,
  LocalDatasetStore,
  defaultStoreDir,
  ingestCsvFile,
} from "@hypsometra/data";
import { cmdOptimize, cmdWfo, cmdMonteCarlo, type JobFlags } from "./jobs.js";

function printHelp(): void {
  console.log(`Hypsometra CLI

Datasets:
  hypsometra dataset add <file.csv> --symbol XAUUSD --timeframe H1 [--store <dir>]
  hypsometra dataset list [--store <dir>]
  hypsometra dataset show <id> [--store <dir>]

Jobs (SMA cross v1 strategy):
  hypsometra optimize --dataset <id> --fast 3:5:1 --slow 8:12:2 [--search grid|genetic] [--out report.json]
  hypsometra wfo --dataset <id> --is 40 --oos 20 --fast 3:5:1 --slow 10:14:2 [--wf rolling|anchored] [--out wfo.json]
  hypsometra montecarlo --dataset <id> --fast 10 --slow 30 [--method shuffle|bootstrap] [--sims 1000] [--out mc.json]

Examples:
  hypsometra dataset add ./XAUUSD_H1.csv --symbol XAUUSD --timeframe H1
  hypsometra wfo --dataset xauusd_h1_abc12345 --is 500 --oos 100 --fast 5:15:5 --slow 20:60:10 --out wfo.json
  hypsometra montecarlo --dataset xauusd_h1_abc12345 --fast 10 --slow 40 --method bootstrap --sims 2000 --out mc.json
`);
}

function storeFromArgs(values: { store?: string }): string {
  return values.store ? values.store : defaultStoreDir();
}

function formatRange(from: number, to: number): string {
  return `${new Date(from).toISOString().slice(0, 10)} → ${new Date(to).toISOString().slice(0, 10)}`;
}

async function cmdDatasetAdd(
  file: string,
  values: { symbol?: string; timeframe?: string; store?: string },
): Promise<void> {
  if (!values.symbol || !values.timeframe) {
    throw new Error("--symbol and --timeframe are required");
  }
  const result = ingestCsvFile({
    filePath: file,
    symbol: values.symbol,
    timeframe: values.timeframe,
    storeDir: storeFromArgs(values),
  });
  const { meta, reused } = result;
  console.log(reused ? "Reused existing dataset:" : "Ingested dataset:");
  console.log(`  id:         ${meta.id}`);
  console.log(`  symbol:     ${meta.symbol}`);
  console.log(`  timeframe:  ${meta.timeframe}`);
  console.log(`  bars:       ${meta.barCount}`);
  console.log(`  range:      ${formatRange(meta.from, meta.to)}`);
  console.log(`  store:      ${storeFromArgs(values)}`);
}

function cmdDatasetList(values: { store?: string }): void {
  const store = new LocalDatasetStore(storeFromArgs(values));
  const list = store.list();
  if (list.length === 0) {
    console.log(
      "No datasets. Add one with: hypsometra dataset add <file.csv> --symbol ... --timeframe ...",
    );
    return;
  }
  for (const m of list) {
    console.log(
      `${m.id}  ${m.symbol} ${m.timeframe}  ${m.barCount} bars  ${formatRange(m.from, m.to)}`,
    );
  }
}

async function cmdDatasetShow(
  id: string,
  values: { store?: string },
): Promise<void> {
  const storeDir = storeFromArgs(values);
  const store = new LocalDatasetStore(storeDir);
  const meta = store.readMeta(id);
  if (!meta) {
    throw new Error(`Unknown dataset: ${id}`);
  }
  const bars = await new CsvLocalSource(storeDir).load({ datasetId: id });
  console.log(
    JSON.stringify(
      { meta, preview: bars.slice(0, 3), barCount: bars.length },
      null,
      2,
    ),
  );
}

const sharedOptions = {
  store: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

const jobOptions = {
  ...sharedOptions,
  dataset: { type: "string" },
  search: { type: "string" },
  criterion: { type: "string" },
  fast: { type: "string" },
  slow: { type: "string" },
  balance: { type: "string" },
  point: { type: "string" },
  tickValue: { type: "string" },
  spread: { type: "string" },
  commission: { type: "string" },
  out: { type: "string" },
  population: { type: "string" },
  generations: { type: "string" },
  seed: { type: "string" },
  wf: { type: "string" },
  is: { type: "string" },
  oos: { type: "string" },
  step: { type: "string" },
  sims: { type: "string" },
  method: { type: "string" },
  dropRate: { type: "string" },
} as const;

async function runDataset(sub: string | undefined, rest: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      ...sharedOptions,
      symbol: { type: "string" },
      timeframe: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return 0;
  }

  if (sub === "add") {
    const file = positionals[0];
    if (!file) throw new Error("dataset add requires a CSV path");
    await cmdDatasetAdd(file, values);
    return 0;
  }
  if (sub === "list") {
    cmdDatasetList(values);
    return 0;
  }
  if (sub === "show") {
    const id = positionals[0];
    if (!id) throw new Error("dataset show requires a dataset id");
    await cmdDatasetShow(id, values);
    return 0;
  }

  console.error(`Unknown dataset subcommand: ${sub ?? "(none)"}`);
  printHelp();
  return 1;
}

export async function run(argv: string[]): Promise<number> {
  if (
    argv.length === 0 ||
    argv[0] === "help" ||
    argv[0] === "--help" ||
    argv[0] === "-h"
  ) {
    printHelp();
    return 0;
  }

  const [command, ...rest] = argv;

  if (command === "dataset") {
    const [sub, ...tail] = rest;
    return runDataset(sub, tail);
  }

  if (command === "optimize" || command === "wfo" || command === "montecarlo") {
    const { values } = parseArgs({
      args: rest,
      options: jobOptions,
      allowPositionals: false,
    });
    if (values.help) {
      printHelp();
      return 0;
    }
    const flags = values as JobFlags;
    if (command === "optimize") await cmdOptimize(flags);
    else if (command === "wfo") await cmdWfo(flags);
    else await cmdMonteCarlo(flags);
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

const self = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry === self) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    },
  );
}
