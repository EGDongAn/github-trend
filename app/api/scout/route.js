import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads the committed scan index (data/index.json). Returns empty shape if the
// scan hasn't run yet, so the UI degrades gracefully.
export function GET() {
  try {
    const p = join(process.cwd(), "data", "index.json");
    const data = JSON.parse(readFileSync(p, "utf8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ repos: [], days: 0, generatedAt: null });
  }
}
