import { NextResponse } from "next/server";

const PER_PAGE = 30;
// GitHub Search API only returns the first 1000 results.
const MAX_PAGE = Math.floor(1000 / PER_PAGE); // 33

function ghHeaders() {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// ---------- helpers ----------
function toNum(s) {
  return parseInt(String(s).replace(/,/g, ""), 10) || 0;
}
function stripTags(s) {
  return s.replace(/<[^>]+>/g, "");
}
function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
// Pull the digit run that appears as TEXT after a marker's icon (skips the
// <svg> path data, which is full of numbers).
function numAfter(chunk, marker) {
  const i = chunk.indexOf(marker);
  if (i < 0) return 0;
  const seg = chunk.slice(i);
  const svgEnd = seg.indexOf("</svg>");
  const tail = svgEnd >= 0 ? seg.slice(svgEnd) : seg;
  const m = tail.match(/([\d,]+)/);
  return m ? toNum(m[1]) : 0;
}

// ---------- trending: scrape github.com/trending (real star velocity) ----------
const SINCE = { day: "daily", week: "weekly", month: "monthly" };

async function scrapeTrending(range, language) {
  const since = SINCE[range] || "daily";
  const langPath = language ? "/" + encodeURIComponent(language.toLowerCase()) : "";
  const url = `https://github.com/trending${langPath}?since=${since}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (github-trend app)",
      Accept: "text/html",
    },
    next: { revalidate: 1800 }, // cache 30min — trending updates slowly
  });
  if (!res.ok) throw new Error(`github.com/trending 응답 ${res.status}`);
  return parseTrending(await res.text());
}

function parseTrending(html) {
  const repos = [];
  const rows = html.split('<article class="Box-row">').slice(1);
  for (const row of rows) {
    const chunk = row.split("</article>")[0];
    const full = (chunk.match(/<h2[^>]*>\s*<a[^>]*href="\/([^"?]+)"/) || [])[1];
    if (!full || !full.includes("/")) continue;
    const [owner, name] = full.split("/");

    const descM = chunk.match(/<p[^>]*class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const description = descM ? decodeHtml(stripTags(descM[1]).trim()) : null;

    const language =
      (chunk.match(/<span itemprop="programmingLanguage">([^<]+)<\/span>/) || [])[1] ||
      null;
    const languageColor =
      (chunk.match(/repo-language-color[^"]*"\s+style="background-color:\s*([^;"]+)/) ||
        [])[1] || null;

    const todayM = chunk.match(/([\d,]+)\s+stars?\s+(today|this week|this month)/);

    repos.push({
      id: full,
      name,
      fullName: full,
      owner,
      url: `https://github.com/${full}`,
      avatar: `https://github.com/${owner}.png?size=64`,
      description,
      language,
      languageColor,
      stars: numAfter(chunk, `/${full}/stargazers"`),
      forks:
        numAfter(chunk, `/${full}/forks"`) ||
        numAfter(chunk, `/${full}/network/members"`),
      starsToday: todayM ? toNum(todayM[1]) : 0,
      topics: [],
    });
  }
  return repos;
}

// ---------- popular / search: GitHub Search API (paginated) ----------
function mapRepo(r) {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner?.login,
    url: r.html_url,
    avatar: r.owner?.avatar_url,
    description: r.description,
    language: r.language,
    languageColor: null,
    stars: r.stargazers_count,
    forks: r.forks_count,
    starsToday: 0,
    topics: (r.topics || []).slice(0, 4),
  };
}

async function searchApi(q, page) {
  const url =
    "https://api.github.com/search/repositories?" +
    new URLSearchParams({
      q,
      sort: "stars",
      order: "desc",
      per_page: String(PER_PAGE),
      page: String(page),
    });
  const res = await fetch(url, { headers: ghHeaders(), next: { revalidate: 300 } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub 응답 ${res.status}`);
  }
  const data = await res.json();
  return { repos: (data.items || []).map(mapRepo), total: data.total_count || 0 };
}

// ---------- handler ----------
export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("mode") || "trending";
  const range = sp.get("range") || "day";
  const language = (sp.get("language") || "").trim();
  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));

  try {
    if (mode === "trending") {
      const repos = await scrapeTrending(range, language);
      return NextResponse.json({ repos, mode, page: 1, hasNext: false });
    }

    const parts = [];
    if (mode === "search") {
      if (!q) return NextResponse.json({ repos: [], mode, page, hasNext: false });
      parts.push(q);
    } else {
      parts.push("stars:>10000"); // popular
    }
    if (language) parts.push(`language:${language}`);
    const query = parts.join(" ");

    const { repos, total } = await searchApi(query, page);
    const maxPage = Math.min(MAX_PAGE, Math.ceil(total / PER_PAGE));
    return NextResponse.json({
      repos,
      mode,
      page,
      total,
      hasNext: page < maxPage,
      query,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
