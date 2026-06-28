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

const RELEVANCE = {
  high: { label: "높음", color: "#3fb950" },
  medium: { label: "보통", color: "#d29922" },
  low: { label: "낮음", color: "#8b949e" },
  none: { label: "무관", color: "#484f58" },
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

// tiny sparkline of star history
function Sparkline({ points }) {
  if (!points || points.length < 2) return null;
  const vals = points.map((p) => p.stars);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 80;
  const h = 22;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.stars - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = vals.at(-1) >= vals[0];
  return (
    <svg width={w} height={h} className="spark">
      <path d={d} fill="none" stroke={up ? "#3fb950" : "#f85149"} strokeWidth="1.5" />
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState("scout");
  const [range, setRange] = useState("day");
  const [language, setLanguage] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [repos, setRepos] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // scout state
  const [scout, setScout] = useState({ repos: [], days: 0, generatedAt: null });
  const [relFilter, setRelFilter] = useState("all");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  const mode = debounced ? "search" : tab;

  useEffect(() => {
    setPage(1);
  }, [mode, tab, range, language, debounced]);

  // load scout index (used by both Scout and 이력 tabs)
  useEffect(() => {
    if (mode !== "scout" && mode !== "log") return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetch("/api/scout")
      .then((r) => r.json())
      .then((d) => alive && setScout(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mode]);

  // load trending/popular/search
  useEffect(() => {
    if (mode === "scout" || mode === "log") return;
    const ctrl = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ mode, range, language, q: debounced, page: String(page) });
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
      : mode === "log"
        ? `텔레그램 알림 발송 이력 — dev 개발총괄로 보낸 high 후보 (${(scout.notifyLog || []).length}건)`
        : mode === "scout"
        ? `EG AI GROUP OS 적합성 스카우팅 — codex 분석 · ${scout.days || 0}일치 데이터`
        : mode === "trending"
          ? "github.com/trending 실시간 — 별 증가량 기준 지금 뜨는 프로젝트"
          : "역대 누적 별 기준 가장 유명한 레포";

  const showPager = mode === "popular" || mode === "search";

  const scoutList =
    relFilter === "all" ? scout.repos : scout.repos.filter((r) => r.analysis?.relevance === relFilter);

  function selectTab(t) {
    setSearch("");
    setTab(t);
  }

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
          <button className={tab === "scout" && !debounced ? "tab on" : "tab"} onClick={() => selectTab("scout")}>
            🔎 Scout
          </button>
          <button className={tab === "trending" && !debounced ? "tab on" : "tab"} onClick={() => selectTab("trending")}>
            🔥 Trending
          </button>
          <button className={tab === "popular" && !debounced ? "tab on" : "tab"} onClick={() => selectTab("popular")}>
            ⭐ Popular
          </button>
          <button className={tab === "log" && !debounced ? "tab on" : "tab"} onClick={() => selectTab("log")}>
            📨 이력
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
              <button key={r.key} className={range === r.key ? "seg-btn on" : "seg-btn"} onClick={() => setRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        {mode === "scout" && (
          <div className="seg">
            {[
              { k: "all", l: "전체" },
              { k: "high", l: "높음" },
              { k: "medium", l: "보통" },
            ].map((r) => (
              <button key={r.k} className={relFilter === r.k ? "seg-btn on" : "seg-btn"} onClick={() => setRelFilter(r.k)}>
                {r.l}
              </button>
            ))}
          </div>
        )}
        {mode !== "scout" && mode !== "log" && (
          <select className="lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l === "" ? "모든 언어" : l}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="msg err">⚠️ {error}</div>}
      {loading && <div className="msg">불러오는 중…</div>}

      {!loading && !error && mode === "log" && (
        <div className="timeline">
          {(() => {
            const byDate = {};
            (scout.notifyLog || []).forEach((e) => {
              (byDate[e.date] ||= []).push(e);
            });
            const dates = Object.keys(byDate).sort().reverse();
            if (!dates.length) return <div className="msg">아직 발송 이력이 없습니다.</div>;
            return dates.map((d) => (
              <section key={d} className="tl-day">
                <div className="tl-date">
                  {d} · {byDate[d].length}건 발송
                </div>
                <ul className="tl-list">
                  {byDate[d].map((e, i) => (
                    <li key={e.fullName + i} className="tl-item">
                      <a href={e.url} target="_blank" rel="noreferrer">
                        <div className="tl-head">
                          <span className="tl-repo">{e.fullName}</span>
                          {e.category && <span className="tl-cat">{e.category}</span>}
                        </div>
                        {e.summary && <p className="tl-sum">{e.summary}</p>}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ));
          })()}
        </div>
      )}

      {!loading && !error && mode === "scout" && (
        <ul className="grid">
          {scoutList.map((r) => {
            const rel = r.analysis
              ? RELEVANCE[r.analysis.relevance] || RELEVANCE.none
              : { label: "대기", color: "#30363d" };
            return (
              <li key={r.fullName} className="card scout">
                <a className="card-link" href={r.url} target="_blank" rel="noreferrer">
                  <div className="card-head">
                    {r.avatar && <img className="avatar" src={r.avatar} alt="" />}
                    <div className="names">
                      <div className="owner">{r.owner}</div>
                      <div className="repo">{r.name}</div>
                    </div>
                    <span className="rel-badge" style={{ background: rel.color }}>
                      {rel.label}
                    </span>
                  </div>

                  {r.analysis ? (
                    <>
                      {r.analysis.category && <div className="cat">{r.analysis.category}</div>}
                      <p className="desc">{r.analysis.summary}</p>
                      <div className="assess">
                        <div className="assess-row">
                          <span className="k">적용</span>
                          <span className="v">{r.analysis.fit}</span>
                        </div>
                        {r.analysis.integration && r.analysis.integration !== "-" && (
                          <div className="assess-row">
                            <span className="k">방안</span>
                            <span className="v">{r.analysis.integration}</span>
                          </div>
                        )}
                        {r.analysis.overlaps && r.analysis.overlaps !== "없음" && (
                          <div className="assess-row">
                            <span className="k">중복</span>
                            <span className="v">{r.analysis.overlaps}</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="desc dim">분석 대기 중…</p>
                  )}

                  <div className="meta">
                    {r.language && (
                      <span className="meta-item">
                        <span className="dot" style={{ background: LANG_COLOR[r.language] || "#888" }} />
                        {r.language}
                      </span>
                    )}
                    <span className="meta-item">
                      <StarIcon /> {fmt(r.stars)}
                    </span>
                    <span className="meta-item" title="trending/popular 노출 일수">
                      👁 {r.appearances}일
                    </span>
                    <Sparkline points={r.starHistory} />
                  </div>
                </a>
              </li>
            );
          })}
          {scoutList.length === 0 && (
            <div className="msg">
              {scout.days === 0 ? "아직 스캔 데이터가 없습니다. 일일 스캔이 돌면 채워집니다." : "해당 등급 결과 없음."}
            </div>
          )}
        </ul>
      )}

      {!loading && !error && mode !== "scout" && (
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
                        <span className="dot" style={{ background: r.languageColor || LANG_COLOR[r.language] || "#888" }} />
                        {r.language}
                      </span>
                    )}
                    <span className="meta-item">
                      <StarIcon /> {fmt(r.stars)}
                    </span>
                    <span className="meta-item">
                      <ForkIcon /> {fmt(r.forks)}
                    </span>
                    {r.starsToday > 0 && <span className="meta-item velocity">▲ {fmt(r.starsToday)}</span>}
                  </div>
                </a>
              </li>
            ))}
            {repos.length === 0 && <div className="msg">결과가 없습니다.</div>}
          </ul>

          {showPager && repos.length > 0 && (
            <div className="pager">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← 이전
              </button>
              <span className="page-num">{page} 페이지</span>
              <button className="page-btn" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                다음 →
              </button>
            </div>
          )}
        </>
      )}

      <footer className="foot">
        Scout: codex 적합성 분석(일일) · Trending: github.com/trending · Popular/검색: GitHub Search API
      </footer>
    </main>
  );
}
