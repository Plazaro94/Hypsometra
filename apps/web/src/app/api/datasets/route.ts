import { NextResponse } from "next/server";
import { LocalDatasetStore } from "@hypsometra/data";
import { datasetStoreDir } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET() {
  const store = new LocalDatasetStore(datasetStoreDir());
  return NextResponse.json({ datasets: store.list() });
}
