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

function printHelp(): void {
  console.log(`Hypsometra CLI

Usage:
  hypsometra dataset add <file.csv> --symbol XAUUSD --timeframe H1 [--store <dir>]
  hypsometra dataset list [--store <dir>]
  hypsometra dataset show <id> [--store <dir>]

Examples:
  hypsometra dataset add ./exports/XAUUSD_H1.csv --symbol XAUUSD --timeframe H1
  hypsometra dataset list
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
    console.log("No datasets. Add one with: hypsometra dataset add <file.csv> --symbol ... --timeframe ...");
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
  console.log(JSON.stringify({ meta, preview: bars.slice(0, 3), barCount: bars.length }, null, 2));
}

export async function run(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return 0;
  }

  const [command, sub, ...rest] = argv;
  if (command !== "dataset") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }

  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      symbol: { type: "string" },
      timeframe: { type: "string" },
      store: { type: "string" },
      help: { type: "boolean", short: "h" },
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
