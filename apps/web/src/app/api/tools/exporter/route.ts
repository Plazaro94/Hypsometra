import { readFileSync } from "node:fs";
import { join } from "node:path";
import { monorepoRoot } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET() {
  const source = readFileSync(join(monorepoRoot(), "tools", "mt5", "HypsometraExporter.mq5"));
  return new Response(source, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="HypsometraExporter.mq5"',
    },
  });
}
