import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestCsvFile } from "@hypsometra/data";
import { datasetStoreDir } from "@/lib/paths";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const symbol = String(form.get("symbol") ?? "").trim();
    const timeframe = String(form.get("timeframe") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!symbol || !timeframe) {
      return NextResponse.json(
        { error: "symbol and timeframe are required" },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const tmp = join(tmpdir(), `hypsometra-upload-${randomUUID()}.csv`);
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(tmp, buf);

    const result = ingestCsvFile({
      filePath: tmp,
      symbol,
      timeframe,
      storeDir: datasetStoreDir(),
    });

    return NextResponse.json({
      reused: result.reused,
      meta: result.meta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
