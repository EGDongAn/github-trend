import { NextResponse } from "next/server";
import { scrapeTrending, searchRepos, PER_PAGE, MAX_PAGE } from "@/lib/github.mjs";

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("mode") || "trending";
  const range = sp.get("range") || "day";
  const language = (sp.get("language") || "").trim();
  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));

  try {
    if (mode === "trending") {
      const repos = await scrapeTrending(range, language, { revalidate: 1800 });
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

    const { repos, total } = await searchRepos(query, page, { revalidate: 300 });
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
