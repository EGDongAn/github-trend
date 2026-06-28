import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads the committed scan index (data/index.json). Returns empty shape if the
// scan hasn't run yet, so the UI degrades gracefully.
export function GET() {
  const dir = join(process.cwd(), "data");
  let data = { repos: [], days: 0, generatedAt: null };
  try {
    data = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  } catch {}
  let notifyLog = [];
  try {
    notifyLog = JSON.parse(readFileSync(join(dir, "notify-log.json"), "utf8"));
  } catch {}
  return NextResponse.json({ ...data, notifyLog });
}
