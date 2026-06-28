#!/usr/bin/env node
// Daily scan: collect trending/popular repos → codex assesses each for EG AI
// GROUP OS adoption fit (cached per repo) → append history snapshot → rebuild
// index.json → commit & push (Vercel auto-deploys).
//
// Flags:
//   --limit N      cap codex analyses this run (testing/backfill throttle)
//   --no-codex     skip codex (collect + history only)
//   --no-commit    don't git commit/push
//   --concurrency  parallel codex calls (default 3)

import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeTrending, searchRepos } from "../lib/github.mjs";

const execFileP = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const ANALYSIS = join(DATA, "analysis");
const HISTORY = join(DATA, "history");

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const LIMIT = parseInt(opt("--limit", "0"), 10) || Infinity;
const NO_CODEX = flag("--no-codex");
const NO_COMMIT = flag("--no-commit");
const NO_NOTIFY = flag("--no-notify");
const DIGEST = flag("--digest"); // send all current high candidates w/ 적용방안, then exit
const CONCURRENCY = parseInt(opt("--concurrency", "3"), 10);

// Telegram alert for new high-fit candidates (dev 개발총괄). Override via env.
const NOTIFY_CHAT = process.env.NOTIFY_CHAT_ID || "-1003728541746";
const TG_SEND = "/Users/clawdbot/bin/tg-send";

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["relevance", "category", "summary", "fit", "integration", "overlaps"],
  properties: {
    relevance: { type: "string", enum: ["high", "medium", "low", "none"] },
    category: { type: "string" },
    summary: { type: "string" },
    fit: { type: "string" },
    integration: { type: "string" },
    overlaps: { type: "string" },
  },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}
function ensureDirs() {
  for (const d of [DATA, ANALYSIS, HISTORY]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
}
function cacheKey(fullName) {
  return fullName.replace("/", "__") + ".json";
}
function readJson(p, fallback) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}
// Fallback: pull the last single-line JSON object codex printed to stdout.
function extractJson(s) {
  const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("{") && lines[i].endsWith("}")) {
      try {
        return JSON.parse(lines[i]);
      } catch {}
    }
  }
  return null;
}

// ---------- collect ----------
async function collect() {
  const seen = new Map(); // fullName -> {repo, sources:Set, rank}
  const add = (repo, source, rank) => {
    const cur = seen.get(repo.fullName);
    if (cur) {
      cur.sources.add(source);
      cur.rank = Math.min(cur.rank, rank);
    } else {
      seen.set(repo.fullName, { repo, sources: new Set([source]), rank });
    }
  };
  const trendingDay = await scrapeTrending("day", "").catch(() => []);
  trendingDay.forEach((r, i) => add(r, "trending-day", i + 1));
  const trendingWeek = await scrapeTrending("week", "").catch(() => []);
  trendingWeek.forEach((r, i) => add(r, "trending-week", i + 1));
  const popular = await searchRepos("stars:>10000", 1).catch(() => ({ repos: [] }));
  popular.repos.slice(0, 20).forEach((r, i) => add(r, "popular", i + 1));
  return [...seen.values()];
}

// ---------- codex assessment ----------
const PROFILE = readFileSync(join(DATA, "eg-os-profile.md"), "utf8");
let SCHEMA_FILE;

async function assess(repo) {
  // Metadata only — description + signals are enough for an adoption-fit triage,
  // and avoids huge/non-English READMEs that make codex slow/unreliable.
  const prompt = [
    PROFILE,
    "\n---\n아래 GitHub repo를 위 EG AI GROUP OS 프로파일 기준으로 평가하라. 모든 필드는 한국어로, 간결하게.",
    `repo: ${repo.fullName}`,
    `설명: ${repo.description || "(없음)"}`,
    `언어: ${repo.language || "-"}   stars: ${repo.stars}   topics: ${(repo.topics || []).join(", ") || "-"}`,
    "\nrubric의 relevance 등급 정의를 엄격히 적용. integration은 none이면 '-'. 스키마에 맞는 JSON만 출력.",
  ].join("\n");

  // Use /private/tmp (not os.tmpdir() → /var/folders, which the read-only
  // Seatbelt sandbox blocks, making codex emit nothing and exit 0).
  const dir = mkdtempSync("/private/tmp/ghscan-");
  const promptFile = join(dir, "prompt.txt");
  const outFile = join(dir, "out.json");
  writeFileSync(promptFile, prompt);

  // Spawn codex through a shell with stdin redirected from a file. Spawning
  // codex directly via node (pipe stdin, no controlling tty) makes it hang and
  // emit nothing; the shell form matches the working interactive invocation.
  // web_search off: per-repo search was slow (~25s/23k tokens) and the README
  // isn't needed — description+signals are enough for an adoption-fit triage.
  const cmd =
    `codex exec --skip-git-repo-check -s read-only -c tools.web_search=false ` +
    `--output-schema ${SCHEMA_FILE} -o ${outFile} - < ${promptFile}`;
  const { stdout } = await execFileP("bash", ["-c", cmd], {
    cwd: ROOT,
    timeout: 120000,
    maxBuffer: 1 << 24,
  });
  const parsed = readJson(outFile, null) || extractJson(stdout || "");
  if (!parsed) {
    if (process.env.SCAN_DEBUG) {
      writeFileSync(join(ANALYSIS, ".fail-" + cacheKey(repo.fullName) + ".log"), String(stdout || "").slice(-4000));
    }
    throw new Error("codex returned no parseable output");
  }
  return parsed;
}

// simple concurrency pool
async function pool(items, n, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx).catch((e) => ({ error: e.message }));
    }
  });
  await Promise.all(runners);
  return results;
}

// ---------- main ----------
async function main() {
  ensureDirs();

  // --digest: just re-send current high candidates with 적용방안, no scan.
  if (DIGEST) {
    sendDigest();
    return;
  }

  SCHEMA_FILE = "/private/tmp/ghscan-schema.json";
  writeFileSync(SCHEMA_FILE, JSON.stringify(ANALYSIS_SCHEMA));

  console.log("collecting repos…");
  const collected = await collect();
  console.log(`  ${collected.length} unique repos`);

  // analyze repos missing a cache entry (up to LIMIT)
  const toAnalyze = NO_CODEX
    ? []
    : collected.filter((c) => !existsSync(join(ANALYSIS, cacheKey(c.repo.fullName)))).slice(0, LIMIT);
  console.log(`analyzing ${toAnalyze.length} new repos with codex (concurrency=${CONCURRENCY})…`);

  let done = 0;
  await pool(toAnalyze, CONCURRENCY, async (c) => {
    try {
      const a = await assess(c.repo);
      const rec = {
        fullName: c.repo.fullName,
        analyzedAt: new Date().toISOString(),
        repoMeta: {
          stars: c.repo.stars,
          language: c.repo.language,
          description: c.repo.description,
        },
        ...a,
      };
      writeFileSync(join(ANALYSIS, cacheKey(c.repo.fullName)), JSON.stringify(rec, null, 2));
      console.log(`  [${++done}/${toAnalyze.length}] ${c.repo.fullName} → ${a.relevance}`);
    } catch (e) {
      console.log(`  [skip] ${c.repo.fullName}: ${e.message}`);
    }
  });

  // append today's snapshot
  const date = today();
  const snapshot = {
    date,
    repos: collected.map((c) => ({
      fullName: c.repo.fullName,
      sources: [...c.sources],
      rank: c.rank,
      stars: c.repo.stars,
      starsToday: c.repo.starsToday,
    })),
  };
  writeFileSync(join(HISTORY, `${date}.json`), JSON.stringify(snapshot, null, 2));
  console.log(`history snapshot written: ${date} (${snapshot.repos.length} repos)`);

  rebuildIndex();
  notifyHighCandidates();

  if (!NO_COMMIT) commitAndPush(date);
  console.log("done.");
}

// Build a Telegram message for a batch of high-fit repos, including the codex
// 적용방안(integration) — how to apply each to EG AI GROUP OS.
function buildHighMessage(repos, header) {
  const lines = [header, ""];
  for (const r of repos) {
    const a = r.analysis;
    const cat = a.category ? `  [${a.category}]` : "";
    lines.push(`• ${r.fullName} ⭐${(r.stars / 1000).toFixed(1)}k${cat}`);
    if (a.summary) lines.push(`  ${a.summary.slice(0, 100)}`);
    if (a.fit) lines.push(`  ▸ 적합성: ${a.fit.slice(0, 130)}`);
    if (a.integration && a.integration !== "-")
      lines.push(`  ▸ 적용방안: ${a.integration.slice(0, 180)}`);
    lines.push(`  ${r.url}`, "");
  }
  return lines.join("\n");
}

function sendTg(msg, dryArr = []) {
  execFileSync(TG_SEND, [NOTIFY_CHAT, msg, ...dryArr], { timeout: 30000 });
}

// On-demand: send ALL current high candidates with 적용방안 (chunked to stay
// under Telegram's 4096-char limit). Ignores the notified dedup set.
function sendDigest() {
  const high = readJson(join(DATA, "index.json"), { repos: [] }).repos.filter(
    (r) => r.analysis?.relevance === "high"
  );
  if (!high.length) {
    console.log("no high candidates for digest.");
    return;
  }
  const CHUNK = 5;
  for (let i = 0; i < high.length; i += CHUNK) {
    const chunk = high.slice(i, i + CHUNK);
    const part = high.length > CHUNK ? ` (${Math.floor(i / CHUNK) + 1}/${Math.ceil(high.length / CHUNK)})` : "";
    const msg = buildHighMessage(chunk, `🔎 EG OS 적합 후보 다이제스트${part} — codex 적용방안`);
    sendTg(msg, process.env.SCAN_NOTIFY_DRY ? ["--dry"] : []);
  }
  console.log(`digest sent: ${high.length} high → ${NOTIFY_CHAT}`);
}

// Alert dev 개발총괄 about high-fit candidates not yet notified (deduped via
// data/notified.json, committed so it persists across runs).
function notifyHighCandidates() {
  if (NO_NOTIFY) return;
  const notifiedPath = join(DATA, "notified.json");
  const notified = new Set(readJson(notifiedPath, []));
  const fresh = readJson(join(DATA, "index.json"), { repos: [] }).repos.filter(
    (r) => r.analysis?.relevance === "high" && !notified.has(r.fullName)
  );
  if (!fresh.length) {
    console.log("no new high candidates to notify.");
    return;
  }

  const shown = fresh.slice(0, 8);
  let msg = buildHighMessage(shown, `🔎 EG OS 신규 적합 후보 ${fresh.length}건 (codex: high)`);
  if (fresh.length > 8) msg += `\n…외 ${fresh.length - 8}건 (Scout 앱에서 확인)`;

  const dry = process.env.SCAN_NOTIFY_DRY ? ["--dry"] : [];
  try {
    sendTg(msg, dry);
    console.log(`notified ${fresh.length} new high candidates → ${NOTIFY_CHAT}${dry.length ? " (dry)" : ""}`);
    if (!dry.length) {
      fresh.forEach((r) => notified.add(r.fullName));
      writeFileSync(notifiedPath, JSON.stringify([...notified], null, 2));
    }
  } catch (e) {
    console.log("tg-send failed:", e.message);
  }
}

// ---------- aggregate index ----------
function rebuildIndex() {
  const days = readdirSync(HISTORY).filter((f) => f.endsWith(".json")).sort();
  const agg = new Map(); // fullName -> aggregate
  for (const f of days) {
    const snap = readJson(join(HISTORY, f), null);
    if (!snap) continue;
    for (const r of snap.repos) {
      let a = agg.get(r.fullName);
      if (!a) {
        a = {
          fullName: r.fullName,
          appearances: 0,
          sources: new Set(),
          firstSeen: snap.date,
          lastSeen: snap.date,
          starHistory: [],
        };
        agg.set(r.fullName, a);
      }
      a.appearances += 1;
      r.sources.forEach((s) => a.sources.add(s));
      a.lastSeen = snap.date;
      a.starHistory.push({ date: snap.date, stars: r.stars });
    }
  }

  const repos = [...agg.values()].map((a) => {
    const [owner, name] = a.fullName.split("/");
    const analysis = readJson(join(ANALYSIS, cacheKey(a.fullName)), null);
    const latestStars = a.starHistory.at(-1)?.stars ?? 0;
    return {
      fullName: a.fullName,
      owner,
      name,
      url: `https://github.com/${a.fullName}`,
      avatar: `https://github.com/${owner}.png?size=64`,
      description: analysis?.repoMeta?.description ?? null,
      language: analysis?.repoMeta?.language ?? null,
      stars: latestStars,
      appearances: a.appearances,
      sources: [...a.sources],
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      starHistory: a.starHistory,
      analysis: analysis
        ? {
            relevance: analysis.relevance,
            category: analysis.category,
            summary: analysis.summary,
            fit: analysis.fit,
            integration: analysis.integration,
            overlaps: analysis.overlaps,
          }
        : null,
    };
  });

  const order = { high: 0, medium: 1, low: 2, none: 3, null: 4 };
  repos.sort((x, y) => {
    const rx = order[x.analysis?.relevance ?? "null"];
    const ry = order[y.analysis?.relevance ?? "null"];
    if (rx !== ry) return rx - ry;
    return y.appearances - x.appearances || y.stars - x.stars;
  });

  writeFileSync(
    join(DATA, "index.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), days: days.length, repos }, null, 2)
  );
  console.log(`index.json rebuilt: ${repos.length} repos across ${days.length} day(s)`);
}

function commitAndPush(date) {
  try {
    execFileSync("git", ["add", "data"], { cwd: ROOT });
    const changed = execFileSync("git", ["status", "--porcelain", "data"], { cwd: ROOT }).toString().trim();
    if (!changed) {
      console.log("no data changes to commit.");
      return;
    }
    execFileSync(
      "git",
      ["-c", "user.name=EGDongAn", "-c", "user.email=miso.kr@gmail.com", "commit", "-q", "-m", `data: scan ${date}`],
      { cwd: ROOT }
    );
    execFileSync("git", ["push", "-q", "origin", "main"], { cwd: ROOT });
    console.log("committed & pushed.");
  } catch (e) {
    console.log("git step failed:", e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
