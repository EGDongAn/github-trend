import { NextResponse } from "next/server";

// Map a "trending" range to the ISO date used in the `created:>DATE` qualifier.
function sinceDate(range) {
  const days = range === "day" ? 1 : range === "month" ? 30 : 7; // default: week
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "popular" ? "popular" : "trending";
  const range = searchParams.get("range") || "week";
  const language = (searchParams.get("language") || "").trim();

  // Build the GitHub search query.
  // - trending: repos CREATED within the range, ranked by stars → genuinely rising projects.
  // - popular:  all-time most-starred repos.
  const parts = [];
  if (tab === "trending") {
    parts.push(`created:>${sinceDate(range)}`);
    parts.push("stars:>10");
  } else {
    parts.push("stars:>10000");
  }
  if (language) parts.push(`language:${language}`);

  const q = parts.join(" ");
  const url =
    "https://api.github.com/search/repositories?" +
    new URLSearchParams({ q, sort: "stars", order: "desc", per_page: "30" });

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  // Optional token boosts the rate limit from 10 → 30 req/min for search.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(url, { headers, next: { revalidate: 300 } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body.message || `GitHub responded ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    const repos = (data.items || []).map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      url: r.html_url,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      owner: r.owner?.login,
      avatar: r.owner?.avatar_url,
      topics: (r.topics || []).slice(0, 4),
      createdAt: r.created_at,
    }));
    return NextResponse.json({ repos, query: q });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach GitHub: " + err.message },
      { status: 502 }
    );
  }
}
