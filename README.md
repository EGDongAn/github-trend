# GitHub Trending — 뜨는 앱 / 유명한 앱 찾기

GitHub에서 **지금 떠오르는 프로젝트**와 **역대 인기 레포**를 찾아주는 웹앱입니다.
Next.js(App Router)로 만들었고, GitHub Search API를 서버 라우트에서 프록시합니다.

## 기능

- **🔥 Trending** — 최근 생성된 레포 중 별을 많이 받은 순 (오늘 / 이번 주 / 이번 달)
  - GitHub은 공식 trending API가 없어, `created:>날짜 sort:stars`로 *새로 뜨는 프로젝트*를 보여줍니다.
- **⭐ Popular** — 역대 누적 별 기준 가장 유명한 레포
- 12개 언어 필터, 별·포크·토픽·언어색 표시, 카드 클릭 시 GitHub로 이동

## 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## GitHub 토큰 (선택)

인증 없으면 Search API가 분당 10회로 제한됩니다. 토큰을 넣으면 분당 30회로 늘어납니다.

```bash
# .env.local
GITHUB_TOKEN=ghp_xxx
```

토큰은 서버 라우트(`app/api/repos/route.js`)에서만 사용되며 브라우저에 노출되지 않습니다.

## 구조

```
app/page.jsx            탭/필터 UI (client component)
app/api/repos/route.js  GitHub Search API 프록시 (server route)
app/globals.css         GitHub 다크 테마
```

## 스택

Next.js 16 · React 19
