import { NextResponse } from "next/server";
import { createSmaCrossStrategy } from "@hypsometra/engine";
import { CsvLocalSource, LocalDatasetStore } from "@hypsometra/data";
import { walkForward, type ParamMap } from "@hypsometra/opt";
import { datasetStoreDir } from "@/lib/paths";
import { defaultBacktestConfig, parseIntRange } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      datasetId?: string;
      is?: number;
      oos?: number;
      step?: number;
      wf?: "rolling" | "anchored";
      search?: "grid" | "genetic";
      fast?: string;
      slow?: string;
    };

    const datasetId = body.datasetId;
    if (!datasetId) {
      return NextResponse.json({ error: "datasetId required" }, { status: 400 });
    }

    const storeDir = datasetStoreDir();
    const meta = new LocalDatasetStore(storeDir).readMeta(datasetId);
    if (!meta) {
      return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });
    }

    const bars = await new CsvLocalSource(storeDir).load({ datasetId });
    const fast = parseIntRange(body.fast ?? "5:15:5", "fast");
    const slow = parseIntRange(body.slow ?? "20:60:10", "slow");
    const inSampleBars = Number(body.is ?? 40);
    const outOfSampleBars = Number(body.oos ?? 20);
    const stepBars = Number(body.step ?? outOfSampleBars);

    const result = walkForward({
      bars,
      config: defaultBacktestConfig(meta.symbol),
      mode: body.wf ?? "rolling",
      inSampleBars,
      outOfSampleBars,
      stepBars,
      criterion: "netProfit",
      space: [fast, slow],
      createStrategy: (params: ParamMap) =>
        createSmaCrossStrategy({
          fastPeriod: Number(params["fast"]),
          slowPeriod: Number(params["slow"]),
        }),
      search: {
        mode: body.search ?? "grid",
        genetic: { population: 16, generations: 8, seed: 42 },
      },
    });

    return NextResponse.json({ dataset: meta, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "WFO failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
