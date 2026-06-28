"use client";

import { useEffect, useState } from "react";

const LANGUAGES = [
  "",
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "Swift",
  "Kotlin",
  "Ruby",
  "PHP",
];

const RANGES = [
  { key: "day", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
];

// Fallback language → color (used when the API doesn't supply one).
const LANG_COLOR = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Ruby: "#701516",
  PHP: "#4F5D95",
};

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
    </svg>
  );
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export default function Home() {
  const [tab, setTab] = useState("trending");
  const [range, setRange] = useState("day");
  const [language, setLanguage] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [repos, setRepos] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounce the search box so we don't hammer the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  // Search overrides the active tab.
  const mode = debounced ? "search" : tab;

  // Reset to page 1 whenever the result set changes shape.
  useEffect(() => {
    setPage(1);
  }, [mode, tab, range, language, debounced]);

  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        mode,
        range,
        language,
        q: debounced,
        page: String(page),
      });
      try {
        const res = await fetch(`/api/repos?${params}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "불러오기 실패");
        setRepos(data.repos);
        setHasNext(Boolean(data.hasNext));
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => ctrl.abort();
  }, [mode, range, language, debounced, page]);

  const subtitle =
    mode === "search"
      ? `"${debounced}" 검색 결과 — 별 많은 순`
      : mode === "trending"
        ? "github.com/trending 실시간 — 별 증가량 기준 지금 뜨는 프로젝트"
        : "역대 누적 별 기준 가장 유명한 레포";

  const showPager = mode !== "trending";

  return (
    <main className="wrap">
      <header className="head">
        <h1>
          <span className="grad">GitHub</span> 뜨는 앱 찾기
        </h1>
        <p className="sub">{subtitle}</p>
      </header>

      <div className="toolbar">
        <div className="tabs">
          <button
            className={tab === "trending" && !debounced ? "tab on" : "tab"}
            onClick={() => {
              setSearch("");
              setTab("trending");
            }}
          >
            🔥 Trending
          </button>
          <button
            className={tab === "popular" && !debounced ? "tab on" : "tab"}
            onClick={() => {
              setSearch("");
              setTab("popular");
            }}
          >
            ⭐ Popular
          </button>
        </div>
        <div className="search">
          <input
            type="text"
            placeholder="레포 검색… (예: ai agent, todo app)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear" onClick={() => setSearch("")} aria-label="지우기">
              ×
            </button>
          )}
        </div>
      </div>

      <div className="filters">
        {mode === "trending" && (
          <div className="seg">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={range === r.key ? "seg-btn on" : "seg-btn"}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        <select
          className="lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l === "" ? "모든 언어" : l}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="msg err">⚠️ {error}</div>}
      {loading && <div className="msg">불러오는 중…</div>}

      {!loading && !error && (
        <>
          <ul className="grid">
            {repos.map((r, i) => (
              <li key={r.id} className="card">
                <a className="card-link" href={r.url} target="_blank" rel="noreferrer">
                  <div className="rank">#{(page - 1) * 30 + i + 1}</div>
                  <div className="card-head">
                    {r.avatar && <img className="avatar" src={r.avatar} alt="" />}
                    <div className="names">
                      <div className="owner">{r.owner}</div>
                      <div className="repo">{r.name}</div>
                    </div>
                  </div>
                  <p className="desc">{r.description || "설명 없음"}</p>
                  {r.topics.length > 0 && (
                    <div className="topics">
                      {r.topics.map((t) => (
                        <span key={t} className="topic">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="meta">
                    {r.language && (
                      <span className="meta-item">
                        <span
                          className="dot"
                          style={{
                            background:
                              r.languageColor || LANG_COLOR[r.language] || "#888",
                          }}
                        />
                        {r.language}
                      </span>
                    )}
                    <span className="meta-item">
                      <StarIcon /> {fmt(r.stars)}
                    </span>
                    <span className="meta-item">
                      <ForkIcon /> {fmt(r.forks)}
                    </span>
                    {r.starsToday > 0 && (
                      <span className="meta-item velocity">▲ {fmt(r.starsToday)}</span>
                    )}
                  </div>
                </a>
              </li>
            ))}
            {repos.length === 0 && <div className="msg">결과가 없습니다.</div>}
          </ul>

          {showPager && repos.length > 0 && (
            <div className="pager">
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← 이전
              </button>
              <span className="page-num">{page} 페이지</span>
              <button
                className="page-btn"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}

      <footer className="foot">
        Trending: github.com/trending 스크래핑 · Popular/검색: GitHub Search API
      </footer>
    </main>
  );
}
