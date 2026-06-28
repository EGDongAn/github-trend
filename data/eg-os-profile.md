# EG AI GROUP OS — 시스템 프로파일 (codex 평가 rubric)

이 문서는 codex가 GitHub repo의 **도입 적합성**을 판정하는 기준이다. "이 repo가
우리 시스템에 필요한가 / 어떻게 적용하나 / 이미 가진 것과 겹치나"를 평가한다.

## EG AI GROUP OS란
macOS(Mac mini) 위에서 돌아가는 1인 운영 AI 그룹 자동화 스택. AI 에이전트들이
코드를 읽고/수정/실행하고, 텔레그램으로 지시받고, 작업을 위임하고, 비밀을 격리 관리하며,
크론으로 자가 운영한다. 핵심 가치: **로컬 우선, 비용 절감(로컬 LLM/codex exec),
보안 격리, 자동화, 멀티에이전트 오케스트레이션.**

## 현재 스택 (이미 보유 — 중복이면 "대체/업그레이드"인지 따질 것)
- **실행 엔진**: Claude Code (CLI, 스킬 200+, hooks, MCP, cron)
- **멀티세션 관제**: cmux (tmux 기반 작업실/관제실)
- **텔레그램 게이트웨이**: Hermes (48개 그룹 양방향), tg-proxy(알림 발송)
- **작업 위임/칸반**: Paperclip (paperclipai, 임베디드 PG, 이슈→에이전트 워커)
- **비밀 관리**: vault sidecar (Vaultwarden 기반, bearer/proxy 격리)
- **외부 감시/워크플로**: n8n (Docker), 워치독 LaunchAgent
- **로컬 LLM**: Ollama (qwen3/gemma), Open WebUI, mlx-lm
- **개인 AI 비서**: OpenClaw OSS
- **CI/배포**: GitHub Actions, Vercel
- **MCP**: playwright, google-drive, context7, brave 등

## 평가 시 우선순위 (높을수록 매력적)
1. **에이전트 오케스트레이션/멀티에이전트 프레임워크** (Paperclip/cmux 보강·대체)
2. **로컬 LLM 추론/서빙/RAG** (비용 절감, 로컬 우선과 일치)
3. **코딩 에이전트·개발 자동화 도구** (Claude Code/codex 워크플로 강화)
4. **MCP 서버/도구**, 워크플로 자동화, 옵저버빌리티
5. **보안/시크릿/격리**, 셀프호스팅 인프라
6. 텔레그램/디스코드 봇 프레임워크, 스케줄링

## 감점/제외
- 우리 스택과 무관한 일반 앱(게임, 프론트엔드 UI 라이브러리, 특정 언어 튜토리얼 등)
- 클라우드 종속이 강하고 셀프호스팅 불가 (로컬 우선 위배)
- 이미 보유한 것과 동일하고 이점 없음 (단순 중복)

## relevance 등급 정의
- **high**: 지금 스택의 명확한 공백을 메우거나, 기존 도구를 확실히 업그레이드. 도입 검토 가치 큼.
- **medium**: 유용할 수 있으나 공백이 모호하거나 부분 중복. 지켜볼 후보.
- **low**: 약하게 관련. 당장 도입 이유 없음.
- **none**: 우리 시스템과 무관.
