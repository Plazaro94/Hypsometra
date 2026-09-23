import { NextResponse } from "next/server";
import { createSmaCrossStrategy, runBacktest } from "@hypsometra/engine";
import { CsvLocalSource, LocalDatasetStore } from "@hypsometra/data";
import { monteCarlo, type MonteCarloMethod } from "@hypsometra/opt";
import { datasetStoreDir } from "@/lib/paths";
import { defaultBacktestConfig } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      datasetId?: string;
      fast?: number;
      slow?: number;
      sims?: number;
      method?: MonteCarloMethod;
    };

    const datasetId = body.datasetId;
    const fast = Number(body.fast);
    const slow = Number(body.slow);
    if (!datasetId || !Number.isFinite(fast) || !Number.isFinite(slow)) {
      return NextResponse.json(
        { error: "datasetId, fast and slow are required" },
        { status: 400 },
      );
    }

    const storeDir = datasetStoreDir();
    const meta = new LocalDatasetStore(storeDir).readMeta(datasetId);
    if (!meta) {
      return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });
    }

    const bars = await new CsvLocalSource(storeDir).load({ datasetId });
    const config = defaultBacktestConfig(meta.symbol);
    const backtest = runBacktest({
      bars,
      config,
      strategy: createSmaCrossStrategy({
        fastPeriod: Math.floor(fast),
        slowPeriod: Math.floor(slow),
      }),
    });

    if (backtest.trades.length === 0) {
      return NextResponse.json(
        { error: "Backtest produced zero trades" },
        { status: 400 },
      );
    }

    const result = monteCarlo({
      tradePnls: backtest.trades.map((t) => t.netProfit),
      initialBalance: config.account.initialBalance,
      simulations: Math.floor(body.sims ?? 1000),
      method: body.method ?? "bootstrap",
      seed: 42,
    });

    return NextResponse.json({
      dataset: meta,
      params: { fast: Math.floor(fast), slow: Math.floor(slow) },
      backtestMetrics: backtest.metrics,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Monte Carlo failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
