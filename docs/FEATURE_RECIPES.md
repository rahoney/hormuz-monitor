# 기능 재사용 설계서

이 문서는 Hormuz Monitor에서 구현한 기능 패턴을 다른 프로젝트에 재사용하기 위한 내부 레시피 문서다. `PROJECT_GUIDE.md`가 현재 서비스를 운영/복구하기 위한 문서라면, 이 문서는 "그때 구현했던 방식"을 다시 가져다 쓰기 위한 설계 노트다.

실제 API 키, 비밀번호, 서비스 role key는 기록하지 않는다. 예시 코드는 축약 형태이며, 정확한 구현은 각 항목의 관련 파일을 확인한다.

## 목차

1. [AI 구조화 요약 + 하이라이트](#1-ai-구조화-요약--하이라이트)
2. [AI 기사 요약 팝업](#2-ai-기사-요약-팝업)
3. [다국어 라우팅과 문구 관리](#3-다국어-라우팅과-문구-관리)
4. [Next.js + Supabase 데이터 캐시](#4-nextjs--supabase-데이터-캐시)
5. [시계열 차트](#5-시계열-차트)
6. [Render cron 데이터 수집](#6-render-cron-데이터-수집)
7. [데이터 수집 fallback](#7-데이터-수집-fallback)
8. [에러에 강한 AI 호출 클라이언트](#8-에러에-강한-ai-호출-클라이언트)
9. [대시보드 섹션 이동 UI](#9-대시보드-섹션-이동-ui)
10. [공유 기능](#10-공유-기능)
11. [외부 위젯 임베드](#11-외부-위젯-임베드)
12. [위험 지수/종합 점수 산식](#12-위험-지수종합-점수-산식)
13. [프론트-백엔드 API 연결](#13-프론트-백엔드-api-연결)
14. [DB 캐시 테이블과 보관 정책](#14-db-캐시-테이블과-보관-정책)
15. [AI 작업 로딩 UI](#15-ai-작업-로딩-ui)
16. [후원 링크와 GitHub 버튼](#16-후원-링크와-github-버튼)
17. [공개 README와 내부 문서 분리](#17-공개-readme와-내부-문서-분리)
18. [검색 노출 SEO 기본 세트](#18-검색-노출-seo-기본-세트)
19. [서드파티 분석 태그 및 Next.js CSP 연동](#19-서드파티-분석-태그-및-nextjs-csp-연동)

## 1. AI 구조화 요약 + 하이라이트

언제 쓰는가:

- 긴 텍스트나 여러 데이터 소스를 AI가 요약하되, 화면에서는 일정한 구조로 보여주고 싶을 때.
- 중요한 구절을 색상 하이라이트로 강조하고 싶지만, AI가 HTML/Markdown을 직접 만들게 하고 싶지 않을 때.

핵심 설계:

- AI는 기본 텍스트 요약을 생성한다.
- 백엔드는 텍스트를 고정 섹션으로 정규화한다.
- 백엔드가 structured JSON 껍데기를 만든다.
- 하이라이트는 `body` 안에 실제 존재하는 문구만 저장한다.
- 프론트는 structured JSON이 있으면 새 렌더러를 쓰고, 없으면 기존 텍스트 렌더링으로 fallback한다.

데이터 구조 예시:

```json
{
  "version": 1,
  "sections": [
    {
      "title": "핵심 상황",
      "body": "요약 본문입니다.",
      "highlights": [
        {
          "text": "강조할 구절",
          "tone": "risk"
        }
      ]
    }
  ]
}
```

필요한 DB:

```sql
alter table situation_summaries
  add column if not exists summary_ko_structured jsonb,
  add column if not exists summary_en_structured jsonb;
```

관련 파일:

- `backend/collectors/summary/situation_summarizer.py`
  - `_normalize_summary_body()`
  - `_build_structured_summary()`
  - `_highlight_candidates()`
  - `generate()`
- `backend/jobs/situation_summary_ingest.py`
- `frontend/src/components/cards/SituationSummaryCard.tsx`
- `frontend/src/types/index.ts`
- `frontend/src/lib/api/dashboard.ts`

필요한 라이브러리/환경:

- Backend: `httpx`, `python-dotenv`
- Frontend: React/Next.js
- AI: `GOOGLE_GEMINI_API_KEY`

주의점:

- AI에게 HTML을 직접 만들게 하지 않는다.
- AI에게 JSON 전체를 맡기면 JSON mode 미지원 모델에서 실패하기 쉽다.
- structured JSON 생성 실패는 fatal error로 보지 않는다.
- 기본 텍스트 요약은 항상 fallback으로 유지한다.
- 하이라이트가 본문과 정확히 일치하지 않으면 표시하지 않는다.

다른 프로젝트 적용 순서:

1. 기본 텍스트 요약 생성부터 안정화한다.
2. 텍스트를 고정 섹션으로 파싱한다.
3. structured JSON 컬럼이나 저장소를 추가한다.
4. 프론트에 structured 렌더러를 추가한다.
5. 하이라이트는 처음에는 규칙 기반으로 제한하고, 필요하면 AI 보조 방식으로 확장한다.

## 2. AI 기사 요약 팝업

언제 쓰는가:

- 목록에 있는 외부 콘텐츠를 클릭했을 때, 원문으로 바로 이동하지 않고 요약 팝업을 먼저 보여주고 싶을 때.
- 같은 사용자가 같은 기사를 다시 클릭할 때 AI 비용을 줄이고 싶을 때.

핵심 설계:

- 사용자가 기사 목록 아이템을 클릭한다.
- 프론트가 백엔드 API에 `event_id`와 `locale`을 보낸다.
- 백엔드는 캐시 테이블을 먼저 확인한다.
- 캐시가 없으면 제목/요약/출처 URL을 근거로 AI 요약을 만든다.
- 결과를 DB에 저장하고 모달에 표시한다.
- 하단에는 원문 바로가기 링크를 둔다.
- 로딩 중에는 실제 진행률 대신 수평 indeterminate bar를 보여준다.

관련 파일:

- `backend/api/main.py`
  - `POST /events/{event_id}/summary`
- `backend/services/event_article_summary_service.py`
  - `_prompt()`
  - `_parse_summary()`
  - `get_or_create_summary()`
- `frontend/src/components/cards/EventArticleSummaryModal.tsx`
  - loading state
  - 수평 indeterminate loading bar
- `frontend/src/lib/api/eventArticleSummary.ts`
- `frontend/src/components/cards/RecentEventsList.tsx`
- `frontend/src/components/cards/EventLogClient.tsx`

필요한 DB:

- `event_article_summaries`
- 주요 컬럼: `event_id`, `locale`, `summary`, `model`, `created_at`
- 최종 스키마는 `database/schema_final.sql`에 포함한다.

필요한 라이브러리/환경:

- Backend: FastAPI, Gemini client
- Frontend: React modal state
- Env:
  - `GOOGLE_GEMINI_API_KEY`
  - `NEXT_PUBLIC_API_BASE_URL`

주의점:

- 원문 전문을 무단 크롤링하지 않고, 이미 저장된 제목/요약/출처 정보를 기반으로 요약한다.
- 같은 `event_id + locale`은 DB 캐시를 사용한다.
- Gemma 계열은 JSON mode를 지원하지 않을 수 있다. JSON 응답을 강제하지 말고 텍스트를 파싱한다.
- `ARTICLE_SUMMARY_MODELS`가 운영 환경에 있으면 코드 기본 모델 목록을 덮어쓴다. 단일 모델만 넣으면 fallback이 죽을 수 있다.
- Gemma 3 27B가 404를 반환하면 쿼터 문제가 아니라 모델 availability/API 지원 문제일 수 있다.
- 운영 Vercel에 `NEXT_PUBLIC_API_BASE_URL`이 없으면 브라우저가 로컬 API로 요청할 수 있다.

다른 프로젝트 적용 순서:

1. 리스트 row에 고유 ID를 둔다.
2. 요약 캐시 테이블을 만든다.
3. 백엔드 API를 만든다.
4. 프론트 모달을 붙인다.
5. 원문 링크와 에러 fallback을 제공한다.
6. AI 호출 대기 시간이 길면 수평 indeterminate bar를 추가한다.

## 3. 다국어 라우팅과 문구 관리

언제 쓰는가:

- 같은 기능을 한국어/영어 등 여러 언어로 제공해야 할 때.
- URL 단위로 언어를 명확히 나누고 싶을 때.

핵심 설계:

- URL prefix를 `/ko`, `/en`, `/ar`, `/fa`, `/ja`, `/es`, `/tr`, `/de`, `/fr`, `/pt-BR`, `/it`, `/zh-CN`, `/zh-TW`, `/ru`처럼 14개 언어로 둔다.
- 브라우저 Accept-Language 기반으로 14개 언어를 감지하며, 미지원 기기 언어 접속 시 무조건 영어(`/en`)로 리다이렉트한다 (defaultLocale: "en").
- 아랍어(`ar`)와 페르시아어(`fa`) 접속 시 `<html dir="rtl">` 속성을 주입하고 Tailwind CSS Logical Properties(`ms-`, `pe-`, `text-start`)로 우측에서 좌측으로 읽는 RTL 레이아웃을 자동 구현한다.
- 12개 신규 언어 접속 시 AI 토큰 오버헤드를 막기 위해, 기본 요약(en/ko)을 원천으로 하는 온디맨드 2단계 AI 번역 + DB 캐싱 파이프라인(`situation_summary_translations`, `event_article_summaries`)을 적용한다 (최초 1회 번역 후 DB 무기한 저장, 이후 접속자 0 토큰 소모).

관련 파일:

- `frontend/src/i18n/routing.ts`
- `frontend/middleware.ts`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/app/api/situation-summary/translate/route.ts`
- `frontend/src/app/api/events/[eventId]/summary/route.ts`

필요한 라이브러리:

- `next-intl`

주의점:

- DB의 영어 컬럼이 없으면 한국어 fallback을 둘지 결정해야 한다.
- 공유 링크와 OG metadata도 언어별로 맞춰야 한다.
- 브라우저 언어 자동 감지와 사용자 선택 언어 저장 정책을 구분한다.

다른 프로젝트 적용 순서:

1. URL 언어 prefix를 정한다.
2. 번역 JSON 구조를 만든다.
3. 공통 레이아웃에서 locale을 주입한다.
4. DB 필드가 언어별이면 locale에 따라 선택한다.
5. 공유/메타데이터도 언어별로 확인한다.

## 4. Next.js + Supabase 데이터 캐시

언제 쓰는가:

- 대시보드가 여러 Supabase 쿼리를 한 번에 실행해서 페이지 전환이 느릴 때.
- 데이터는 몇 초~몇 분 늦어도 되지만 페이지는 빨리 열려야 할 때.

핵심 설계:

- Supabase query 함수는 순수하게 유지한다.
- 그 위에 `unstable_cache`를 감싼다.
- 섹션별로 TTL을 다르게 둔다.
- 자주 변하는 시장 데이터와 느리게 변하는 일일 데이터를 분리한다.
- 데이터 캐시와 페이지 캐시를 분리한다.
- 완성된 대시보드 페이지는 ISR로 제공해 첫 방문자에게 데이터 캐시 워밍 비용을 넘기지 않는다.

관련 파일:

- `frontend/src/lib/api/dashboard.ts`
- `frontend/src/lib/api/dashboard-cache.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/app/[locale]/page.tsx`

필요한 라이브러리/환경:

- Next.js App Router
- Supabase JS
- Env:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

주의점:

- TTL이 길면 화면 반영이 늦다.
- TTL이 짧으면 DB 호출이 늘어난다.
- 여러 섹션을 같은 TTL로 맞추면 갱신 순간이 겹칠 수 있다.
- Supabase 직접 fetch에 `no-store`가 있어도 상위 함수 결과를 `unstable_cache`로 캐시할 수 있다.
- `unstable_cache`만 적용하고 페이지에 `force-dynamic`을 두면 첫 캐시 미스 TTFB는 여전히 느릴 수 있다.
- `next-intl` locale 라우트를 ISR/SSG로 만들 때는 `generateStaticParams`와 `setRequestLocale(locale)`를 함께 적용한다.
- production build 출력에서 대상 locale이 `● SSG`인지 반드시 확인한다. 코드만 보고 캐시가 적용됐다고 가정하지 않는다.
- 하이드레이션은 HTML 수신 후 단계이므로 첫 바이트가 늦는 문제와 구분한다.

권장 페이지 구성:

```tsx
export const revalidate = 60;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function Page({params}) {
  const {locale} = await params;
  setRequestLocale(locale);
  // unstable_cache wrapper 호출
}
```

시장 최신값처럼 여러 key의 최신 행이 필요한 경우:

- key마다 REST 요청을 직렬로 보내지 않는다.
- 가능한 범위를 한 번에 조회하고 정렬된 결과에서 key별 첫 행을 선택하거나 DB view/RPC를 사용한다.
- 단일 조회에 limit을 둘 때는 보관 기간과 key 수를 고려해 특정 key가 누락되지 않는지 확인한다.

다른 프로젝트 적용 순서:

1. 데이터 섹션을 갱신 주기별로 나눈다.
2. 섹션별 query 함수를 만든다.
3. `unstable_cache`로 감싼 wrapper를 만든다.
4. 서버 페이지에서 wrapper만 병렬 호출한다.
5. locale/static params를 고정하고 페이지 ISR 주기를 정한다.
6. production build에서 SSG/ISR 판정을 확인한다.
7. 운영 응답 헤더와 연속 TTFB를 측정한다.
8. 실제 체감 속도와 최신성 균형을 보고 TTL을 조정한다.

## 5. 시계열 차트

언제 쓰는가:

- 5분봉, 일봉, 이동평균선 등 시장/센서/로그 데이터를 대시보드로 보여줄 때.
- 데이터 없는 미래/과거 영역으로 차트가 밀리는 것을 막고 싶을 때.

핵심 설계:

- 원천 데이터는 백엔드 크론이 DB에 저장한다.
- 프론트는 필요한 기간만 가져온다.
- 초기 화면은 최신 일부 구간만 보여준다.
- 사용자는 과거로 이동할 수 있지만, 데이터 범위 밖으로는 이동하지 못한다.
- 일봉에는 MA20/MA60 같은 보조선을 추가할 수 있다.

관련 파일:

- `backend/collectors/market/yfinance_collector.py`
- `backend/jobs/market_ingest.py`
- `frontend/src/components/cards/MarketCustomChart.tsx`
- `frontend/src/lib/api/dashboard.ts`

필요한 라이브러리:

- `lightweight-charts`
- 수집용으로는 `yfinance`, `pandas_market_calendars`

주의점:

- 모바일과 데스크톱의 초기 표시 봉 개수를 다르게 둔다.
- x축 포맷은 데이터 주기에 맞춘다. 예: 5분봉은 시:분, 일봉은 월-일.
- 전체 데이터를 한 화면에 억지로 fit하면 이동성이 떨어진다.
- 데이터가 없는 오른쪽 영역으로 이동하지 못하도록 logical range를 clamp한다.

다른 프로젝트 적용 순서:

1. DB에 시계열 테이블을 만든다.
2. 수집 job을 만든다.
3. 프론트 chart component를 만든다.
4. 초기 visible range와 clamp logic을 잡는다.
5. 모바일/데스크톱에서 실제 스크린샷으로 확인한다.

## 6. Render cron 데이터 수집

언제 쓰는가:

- 외부 API/RSS/웹소켓 데이터를 주기적으로 수집해 DB에 저장해야 할 때.
- 서버리스 프론트와 별도로 백엔드 스케줄 작업이 필요할 때.

핵심 설계:

- 수집 로직은 `collectors/`에 둔다.
- 실행 단위는 `jobs/`에 둔다.
- 크론 시작/종료/오류는 `source_runs`, `source_errors`에 남긴다.
- 비슷한 저빈도 작업은 하나의 daily maintenance job으로 묶을 수 있다.

관련 파일:

- `render.yaml`
- `backend/jobs/*.py`
- `backend/collectors/*`
- `backend/db/run_repo.py`
- `backend/db/error_repo.py`
- `backend/jobs/daily_maintenance.py`

필요한 라이브러리/환경:

- Render Cron Job
- Supabase service role key
- 각 외부 API 키

주의점:

- Render 크론 서비스별 환경변수는 자동 공유되지 않을 수 있다.
- GitHub merge 후 Render가 최신 코드를 쓰지 않으면 Manual Build가 필요할 수 있다.
- 크론 개수와 실행 시간이 비용/쿼터에 영향을 준다.
- 같은 원천을 너무 자주 호출하지 않는다.

다른 프로젝트 적용 순서:

1. 수집 함수와 job entrypoint를 분리한다.
2. 실행 기록/오류 기록 테이블을 만든다.
3. Render cron 명령을 `python -m jobs.name` 형태로 둔다.
4. 환경변수 누락 시 빠르게 실패하도록 한다.
5. 정상 로그 예시를 문서화한다.

## 7. 데이터 수집 fallback

언제 쓰는가:

- 1차 데이터 원천이 늦거나 실패할 수 있을 때.
- 동일한 지표를 보조 원천으로라도 계속 표시해야 할 때.

핵심 설계:

- 원천별 우선순위를 정한다.
- 같은 날짜/심볼에 여러 원천 데이터가 있으면 우선순위 높은 데이터를 사용한다.
- 보조 원천은 원천 공백을 메우는 역할로 둔다.
- 화면에서는 필요 이상으로 원천 세부사항을 노출하지 않는다.

관련 파일:

- `backend/collectors/oil/eia_collector.py`
- `backend/collectors/oil/yfinance_futures_collector.py`
- `backend/jobs/oil_ingest.py`
- `backend/collectors/oil/gasoline_collector.py`

필요한 라이브러리/환경:

- `httpx`
- `yfinance`
- 외부 API key

주의점:

- 보조 원천과 1차 원천의 데이터 의미가 완전히 같지 않을 수 있다.
- 같은 날짜 중복 저장 정책을 명확히 한다.
- 원천 데이터가 며칠 늦는 것은 코드 오류가 아닐 수 있다.

다른 프로젝트 적용 순서:

1. 1차/2차 원천 의미 차이를 정리한다.
2. 저장 테이블에 `source` 컬럼을 둔다.
3. upsert conflict key를 정한다.
4. 1차 원천이 있으면 보조 원천을 덮지 않는다.
5. 최신일 진단 쿼리를 준비한다.

## 8. 에러에 강한 AI 호출 클라이언트

언제 쓰는가:

- AI API timeout, 429, 503, 모델별 실패가 서비스 전체 장애로 이어지면 안 될 때.
- 여러 모델 fallback을 운영해야 할 때.

핵심 설계:

- 공통 AI client를 만든다.
- 모델 목록을 env로 override할 수 있게 한다.
- retry 가능한 HTTP 상태만 재시도한다.
- `finishReason`이 정상 종료인지 확인한다.
- 호출 성공 후에도 출력 검증 함수를 통과해야 성공으로 본다.

관련 파일:

- `backend/utils/gemini_client.py`
- `backend/collectors/summary/situation_summarizer.py`
- `backend/services/event_article_summary_service.py`

필요한 라이브러리/환경:

- `httpx`
- `GOOGLE_GEMINI_API_KEY`
- 선택 env:
  - `GEMINI_SUMMARY_MODELS`
  - `GEMINI_TRANSLATION_MODELS`
  - `ARTICLE_SUMMARY_MODELS`

주의점:

- `MAX_TOKENS`는 성공이 아니라 미완성 응답으로 취급한다.
- 입력이 길어질 수 있는 번역 작업은 원문 길이에 따라 전문 번역과 요약 번역 정책을 분리한다.
- 예: 1,500자 이하 전문 번역, 1,500자 초과 약 800자 요약 번역.
- 요약 번역도 너무 짧게 만들면 맥락이 사라지므로 핵심 주장, 대상, 근거 숫자, 정책적 의미, 결론을 포함하도록 프롬프트에 명시한다.
- JSON mode를 지원하지 않는 모델이 있다.
- Gemini/Gemma가 지시를 어길 수 있으므로 항상 후처리/검증한다.
- 검증을 너무 엄격하게 하면 모든 모델이 실패할 수 있다.

다른 프로젝트 적용 순서:

1. 공통 client를 만든다.
2. task별 모델 목록을 둔다.
3. retry/fallback 정책을 정한다.
4. task별 출력 검증 함수를 만든다.
5. 실패 시 기존 데이터 fallback 정책을 둔다.

## 9. 대시보드 섹션 이동 UI

언제 쓰는가:

- 한 페이지에 카드/섹션이 많아서 사용자가 빠르게 이동해야 할 때.
- 모바일에서 긴 대시보드를 탐색하기 어렵게 느낄 때.

핵심 설계:

- 데스크톱은 select 또는 compact nav를 제공한다.
- 모바일은 sticky 가로 스크롤 메뉴를 제공한다.
- `IntersectionObserver`로 현재 섹션을 감지한다.
- 현재 섹션 버튼을 자동으로 중앙에 오게 스크롤한다.

관련 파일:

- `frontend/src/components/navigation/SectionJumpSelect.tsx`
- `frontend/src/components/navigation/MobileSectionNav.tsx`
- `frontend/src/app/[locale]/page.tsx`
- `frontend/src/components/layout/Header.tsx`

필요한 라이브러리:

- 별도 라이브러리 없이 브라우저 API 사용

주의점:

- sticky offset은 헤더 높이와 맞춰야 한다.
- 모바일 가로 스크롤은 마우스 드래그가 아니라 트랙패드/터치/shift wheel 기준으로 체감될 수 있다.
- 섹션 id와 메뉴 id가 어긋나면 이동이 깨진다.

다른 프로젝트 적용 순서:

1. 섹션 id 목록을 서버 페이지에서 정의한다.
2. 데스크톱/모바일 UI를 분리한다.
3. scrollIntoView 또는 hash 이동을 구현한다.
4. IntersectionObserver로 active state를 구현한다.
5. 모바일에서 실제 터치로 확인한다.

## 10. 공유 기능

언제 쓰는가:

- 사용자가 현재 대시보드나 요약을 다른 사람에게 쉽게 공유해야 할 때.
- 언어별 공유 문구가 필요할 때.

핵심 설계:

- Web Share API를 우선 사용한다.
- 미지원 환경에서는 clipboard fallback을 둔다.
- 공유 텍스트는 현재 locale 기준으로 만든다.
- OG metadata는 언어별 페이지에서 설정한다.
- OG 이미지는 공개 정적 파일로 두고 절대 URL을 사용한다.
- 프론트와 백엔드 도메인이 분리되어 있으면 백엔드로 잘못 들어온 OG 이미지 요청은 프론트 이미지로 redirect한다.

관련 파일:

- `frontend/src/components/cards/ShareSummaryButton.tsx`
- `frontend/src/components/cards/SharePageButton.tsx`
- `frontend/src/app/[locale]/layout.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/public/og-image.png`
- `backend/api/main.py`

필요한 라이브러리:

- 별도 라이브러리 없이 Web Share API와 Clipboard API 사용

주의점:

- 구조화 JSON이 있더라도 공유는 일반 텍스트를 쓰는 편이 안전하다.
- 모바일 브라우저와 데스크톱 브라우저의 Web Share API 지원 범위가 다르다.
- 공유 문구에 너무 많은 데이터를 넣으면 읽기 어렵다.
- 카카오톡, Facebook, X 같은 미리보기 봇은 OG 이미지를 직접 가져가므로 `og:image`는 공개 URL이어야 한다.
- `og:image`를 상대경로로만 두면 배포/캐시/도메인 분리 상황에서 잘못된 host로 해석될 수 있으므로 운영에서는 절대 URL을 권장한다.
- API 도메인은 검색 색인 대상이 아니므로 백엔드 `robots.txt`는 `Disallow: /`가 적절하다.

다른 프로젝트 적용 순서:

1. 공유할 제목/본문/URL을 정한다.
2. Web Share API를 시도한다.
3. 실패하면 clipboard에 복사한다.
4. locale별 문구를 번역 파일에서 읽는다.
5. OG metadata에 절대 URL 이미지와 언어별 title/description을 넣는다.
6. 백엔드 API 도메인으로 `/og-image.png` 요청이 들어오면 프론트 이미지로 redirect한다.
7. 카카오톡/Slack/Facebook 등 실제 미리보기 캐시에서 확인한다.

## 11. 외부 위젯 임베드

언제 쓰는가:

- 직접 데이터를 수집하기 어렵거나 비용이 높은 기능을 외부 위젯으로 대체할 때.
- 지도, 실시간 차트처럼 자체 구현 비용이 큰 영역을 빠르게 붙일 때.

핵심 설계:

- iframe/script widget을 별도 컴포넌트로 감싼다.
- 모바일 스크롤을 방해하면 overlay나 높이 조정을 검토한다.
- 위젯 내부 동작은 앱 코드가 완전히 제어할 수 없다는 점을 인정한다.

관련 파일:

- `frontend/src/components/map/StraitMapPanel.tsx`
- `frontend/src/components/charts/TradingViewChart.tsx`

주의점:

- iframe 내부 차트의 pan/zoom/빈 영역 이동은 앱에서 완전히 막기 어렵다.
- 스크롤 방해를 막으려다 위젯 상호작용을 과도하게 죽일 수 있다.
- 무료 위젯은 데이터 지연, 로고, 기능 제한이 있을 수 있다.

다른 프로젝트 적용 순서:

1. 직접 구현과 위젯 사용의 비용을 비교한다.
2. 위젯을 독립 컴포넌트로 만든다.
3. 모바일 스크롤/높이/터치 동작을 확인한다.
4. 제어 불가능한 한계는 UX 문서에 남긴다.

## 12. 위험 지수/종합 점수 산식

언제 쓰는가:

- 여러 지표를 하나의 사용자 친화적인 점수로 합쳐야 할 때.
- 점수 산식이 설명 가능해야 할 때.

핵심 설계:

- 구성 요소별 비중을 정한다.
- 각 원점수를 같은 범위로 정규화한다.
- 데이터가 없을 때 fallback 값을 정한다.
- 최종 점수와 구성 요소 점수를 함께 저장한다.

관련 파일:

- `backend/services/risk_score_service.py`
- `backend/jobs/summary_rebuild.py`
- `frontend/src/components/cards/HormuzRiskGauge.tsx`

주의점:

- 비중은 서비스 메시지와 맞아야 한다.
- 데이터 없음과 실제 0은 의미가 다르다.
- AI 점수는 기준표와 함께 검증/로그를 남기는 것이 좋다.

다른 프로젝트 적용 순서:

1. 점수 목적을 정의한다.
2. 구성 요소와 비중을 정한다.
3. 정규화 함수를 만든다.
4. 데이터 없음 fallback을 정한다.
5. 점수 breakdown을 화면에 보여준다.

## 13. 프론트-백엔드 API 연결

언제 쓰는가:

- 프론트는 Vercel, 백엔드는 Render/Fly/AWS 등 별도 서비스로 운영할 때.
- 브라우저에서 백엔드 API를 직접 호출해야 할 때.

핵심 설계:

- 프론트에서 읽을 API base URL은 `NEXT_PUBLIC_` env로 둔다.
- 운영 API 주소와 로컬 fallback을 분리한다.
- 백엔드는 CORS를 허용한다.
- 배포 후 env 변경은 재배포가 필요하다.

관련 파일:

- `frontend/src/lib/api/eventArticleSummary.ts`
- `backend/api/main.py`
- `frontend/.env.local`

필요한 환경변수:

- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ORIGINS`

주의점:

- `NEXT_PUBLIC_API_BASE_URL`을 잘못 입력하면 운영 페이지가 `127.0.0.1`로 요청할 수 있다.
- Vercel에서 sensitive value는 edit 화면에서 비어 보일 수 있다.
- env를 바꾼 뒤에는 Vercel 재배포가 필요하다.

다른 프로젝트 적용 순서:

1. 백엔드 public URL을 확정한다.
2. 프론트 public env 이름을 정한다.
3. API client에서 fallback을 둔다.
4. CORS origin을 확인한다.
5. 배포 후 브라우저 Network 탭에서 실제 요청 URL을 확인한다.

## 14. DB 캐시 테이블과 보관 정책

언제 쓰는가:

- AI 생성 결과나 외부 API 결과를 매번 새로 만들면 비용/속도 문제가 있을 때.
- 오래된 임시 데이터는 자동으로 지우고 싶을 때.

핵심 설계:

- 캐시 테이블에 unique key를 둔다.
- 같은 요청은 기존 row를 재사용한다.
- cleanup cron이 오래된 row를 삭제한다.
- 테이블별 retention을 다르게 둔다.

관련 파일:

- `backend/services/event_article_summary_service.py`
- `backend/jobs/data_cleanup.py`
- `backend/jobs/daily_maintenance.py`
- `database/schema_final.sql`

주의점:

- 보관 기간이 너무 길면 오래된 AI 결과가 계속 보일 수 있다.
- 보관 기간이 너무 짧으면 AI 호출 비용이 늘어난다.
- 캐시 삭제 정책은 사용자 경험과 비용 사이의 균형이다.

다른 프로젝트 적용 순서:

1. 캐시 key를 정한다.
2. 캐시 테이블을 만든다.
3. get-or-create service를 만든다.
4. cleanup job을 만든다.
5. 오래된 캐시를 강제로 지우는 운영 방법을 문서화한다.

## 15. AI 작업 로딩 UI

언제 쓰는가:

- AI 요약, 번역, 분류처럼 응답 시간이 몇 초 이상 걸릴 수 있는 작업을 기다리게 할 때.
- 실제 진행률을 알 수 없지만 사용자가 "작업 중"임을 분명히 느끼게 하고 싶을 때.

핵심 설계:

- 실제 퍼센트 숫자는 표시하지 않는다.
- 원형 스피너보다 긴 대기에는 수평 indeterminate bar가 더 자연스러울 수 있다.
- 문구는 "준비 중"처럼 기능 개발 중으로 오해될 표현을 피한다.
- 예: `기사 내용을 요약하고 있습니다...`
- 로딩 UI는 결과 영역 안에 표시해 사용자가 현재 팝업에서 작업이 진행 중임을 이해하게 한다.

관련 파일:

- `frontend/src/components/cards/EventArticleSummaryModal.tsx`
- `frontend/src/i18n/ko/events.json`
- `frontend/src/i18n/en/events.json`
- `tmp_test/article_summary_loading_preview.html`

필요한 라이브러리:

- 별도 라이브러리 없이 CSS animation 사용

주의점:

- 실제 진행률이 아닌데 30%, 80% 같은 숫자를 표시하면 신뢰를 해친다.
- AI 호출이 실패할 수 있으므로 로딩 UI와 에러 UI가 명확히 분리되어야 한다.
- 애니메이션은 과하게 두껍거나 빠르면 산만하다. 얇은 1px~4px 수평 바가 적당하다.
- 접근성을 위해 진행 바 자체는 장식이면 `aria-hidden="true"`로 둔다.

다른 프로젝트 적용 순서:

1. 로딩 문구를 구체적인 동작으로 쓴다. 예: `문서를 요약하고 있습니다...`
2. 수평 track과 움직이는 bar를 만든다.
3. 실제 작업 완료/실패 상태와 로딩 상태를 명확히 분리한다.
4. 에러 발생 시 재시도 또는 원문 열기 같은 fallback을 제공한다.
5. 모바일 모달 폭에서도 자연스럽게 보이는지 확인한다.

## 16. 후원 링크와 GitHub 버튼

언제 쓰는가:

- 개인 프로젝트, 오픈소스 프로젝트, 공개 서비스 소개 페이지에 GitHub 저장소와 후원 링크를 붙이고 싶을 때.
- 한국 후원 링크와 글로벌 후원 링크를 동시에 제공하고 싶을 때.
- 같은 버튼 UI를 소개 페이지와 푸터에 반복해서 쓰고 싶을 때.

핵심 설계:

- 후원 URL은 공개 링크이므로 코드에 직접 넣어도 된다.
- 버튼 문구는 다국어 JSON에 둔다.
- GitHub 로고는 외부 이미지를 불러오지 않고 inline SVG 또는 아이콘 라이브러리로 처리한다.
- 소개 페이지에는 GitHub 저장소, GitHub Sponsors, 한국 후원, 글로벌 후원을 모두 배치한다.
- 푸터에는 한국 후원과 글로벌 후원만 작게 배치해 모든 페이지에서 접근할 수 있게 한다.

링크 목록:

```txt
GitHub 저장소: https://github.com/rahoney/hormuz-monitor
GitHub Sponsors: https://github.com/sponsors/rahoney
한국 후원: https://ctee.kr/place/wikihoney
글로벌 후원: https://ko-fi.com/wikihoney
```

GitHub 저장소 버튼 예시:

```tsx
<a
  href="https://github.com/rahoney/hormuz-monitor"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 h-8 rounded border border-blue-700 px-4 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
>
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
  GitHub
</a>
```

GitHub Sponsors 버튼 예시:

```tsx
<a
  href="https://github.com/sponsors/rahoney"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 h-8 rounded border border-blue-700 px-4 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
>
  Sponsor
</a>
```

한국/글로벌 후원 버튼 예시:

```tsx
<div className="flex gap-3 mt-1">
  <a
    href="https://ctee.kr/place/wikihoney"
    target="_blank"
    rel="noopener noreferrer"
    className="rounded border border-blue-700 px-4 py-2 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
  >
    {t("support.kr")}
  </a>
  <a
    href="https://ko-fi.com/wikihoney"
    target="_blank"
    rel="noopener noreferrer"
    className="rounded border border-blue-700 px-4 py-2 text-sm font-bold text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
  >
    {t("support.global")}
  </a>
</div>
```

푸터 compact 후원 링크 예시:

```tsx
<p className="text-sm text-blue-400 flex items-center gap-2 flex-wrap justify-center">
  <span>{t("footer.supportText")}</span>
  <a
    href="https://ctee.kr/place/wikihoney"
    target="_blank"
    rel="noopener noreferrer"
    className="rounded border border-blue-700 px-2.5 py-0.5 text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
  >
    {t("footer.supportKr")}
  </a>
  <a
    href="https://ko-fi.com/wikihoney"
    target="_blank"
    rel="noopener noreferrer"
    className="rounded border border-blue-700 px-2.5 py-0.5 text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
  >
    {t("footer.supportGlobal")}
  </a>
</p>
```

다국어 문구 예시:

```json
{
  "support": {
    "heading": "후원",
    "body1": "이 프로젝트를 응원하고 싶다면 아래 링크를 통해 후원하실 수 있습니다.",
    "body2": "보내주신 후원은 사이트 운영과 기능 개선에 도움이 됩니다.",
    "kr": "한국 후원",
    "global": "Global Support"
  }
}
```

관련 파일:

- `frontend/src/app/[locale]/about/page.tsx`
- `frontend/src/components/layout/Footer.tsx`
- `frontend/src/i18n/ko/about.json`
- `frontend/src/i18n/en/about.json`
- `frontend/src/i18n/ko/common.json`
- `frontend/src/i18n/en/common.json`

필요한 라이브러리:

- 별도 라이브러리 없음
- 프로젝트에 아이콘 라이브러리가 이미 있으면 GitHub 아이콘만 해당 라이브러리로 대체 가능

주의점:

- 새 창 링크에는 항상 `target="_blank"`와 `rel="noopener noreferrer"`를 같이 둔다.
- 후원 링크는 secret이 아니지만 계정 URL이므로 다른 프로젝트에서는 반드시 계정명과 링크를 교체한다.
- 다국어 서비스에서는 버튼 텍스트를 컴포넌트에 직접 박지 않고 i18n JSON에 둔다.
- 모바일에서 버튼이 한 줄에 다 들어가지 않을 수 있으므로 `flex-wrap` 또는 세로 배치를 고려한다.
- GitHub 로고 SVG에는 `aria-hidden="true"`를 둔다. 버튼 텍스트가 이미 의미를 전달하기 때문이다.
- 공개 README에 후원 링크를 넣을지는 프로젝트 성격에 따라 결정한다. 서비스 화면과 README의 목적은 분리해서 판단한다.

다른 프로젝트 적용 순서:

1. 프로젝트에 맞는 GitHub 저장소, Sponsors, 한국 후원, 글로벌 후원 URL을 정한다.
2. 다국어 JSON에 소개 페이지용 문구와 푸터용 짧은 문구를 추가한다.
3. 소개 페이지에 GitHub 저장소 버튼과 Sponsors 버튼을 배치한다.
4. 후원 섹션에 한국/글로벌 후원 버튼을 배치한다.
5. 필요하면 푸터에 compact 후원 링크를 추가한다.
6. 모바일 폭에서 버튼 줄바꿈과 터치 영역이 자연스러운지 확인한다.

## 17. 공개 README와 내부 문서 분리

언제 쓰는가:

- GitHub에는 공개 가능한 정보만 두고, 운영 세부사항은 로컬 문서로 남기고 싶을 때.

핵심 설계:

- README는 프로젝트 소개, 주요 기능, 기술 스택 요약, 서비스 구조 정도만 둔다.
- 운영 가이드는 `docs/PROJECT_GUIDE.md`에 둔다.
- 기능 재사용 레시피는 `docs/FEATURE_RECIPES.md`에 둔다.
- `docs/`는 gitignore로 관리해 공개 저장소에 올리지 않는다.

관련 파일:

- `README.md`
- `docs/PROJECT_GUIDE.md`
- `docs/FEATURE_RECIPES.md`
- `.gitignore`

주의점:

- 공개 README에 데이터 원천, 내부 운영 절차, 민감한 인프라 세부사항을 과하게 쓰지 않는다.
- 내부 문서에도 실제 secret 값은 쓰지 않는다.
- 같은 내용을 여러 문서에 중복해 쓰면 업데이트 누락이 생긴다.

다른 프로젝트 적용 순서:

1. 공개용 README와 내부 운영 문서를 분리한다.
2. 내부 문서 디렉토리를 gitignore 처리한다.
3. README에는 공개 가능한 요약만 둔다.
4. 운영/복구/재사용 지식은 내부 문서에 둔다.

## 18. 검색 노출 SEO 기본 세트

언제 쓰는가:

- Next.js 사이트를 Google Search Console, Naver Search Advisor에 등록할 준비를 할 때.
- 다국어 페이지가 있고, 검색엔진에 언어별 canonical/hreflang을 명확히 알려야 할 때.
- 문의 페이지처럼 색인되면 불필요한 페이지를 제외하고 싶을 때.

핵심 설계:

- 사이트 공통 URL, OG 이미지 URL, metadata 생성 함수를 한 파일에 모은다.
- 각 페이지에서 `generateMetadata()`로 title, description, canonical, hreflang, OG, Twitter 메타를 생성한다.
- `robots.txt`로 검색엔진 및 AI 사용 정책과 sitemap 위치를 제공한다.
- `sitemap.ts`에는 색인시키고 싶은 페이지 URL만 넣는다.
- Root Layout에 `WebSite`와 운영 주체를 설명하는 JSON-LD를 넣고 두 엔터티를 `publisher`로 연결한다.
- 문의/관리/개인정보 입력 페이지는 sitemap에서 제외하고 `noindex`를 붙인다.
- API 전용 도메인은 검색 색인 대상이 아니므로 별도 robots에서 차단한다.

관련 파일:

- `frontend/src/lib/seo.ts`
- `frontend/src/app/robots.txt`
- `frontend/src/app/sitemap.ts`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/[locale]/page.tsx`
- `frontend/src/app/[locale]/events/page.tsx`
- `frontend/src/app/[locale]/about/page.tsx`
- `frontend/src/app/[locale]/sources/page.tsx`
- `frontend/src/app/[locale]/contact/page.tsx`
- `backend/api/main.py`

필요한 라이브러리:

- Next.js Metadata API
- 별도 SEO 라이브러리는 필수 아님

주의점:

- 검색 키워드를 `keywords` 메타에 길게 나열하는 방식은 우선순위가 낮고 과하면 스팸처럼 보일 수 있다.
- 중요한 키워드는 title, description, 본문 제목, 문단 안에 자연스럽게 넣는다.
- OG 이미지는 카카오톡, SNS, 검색 미리보기 봇이 접근해야 하므로 공개 URL이어야 한다.
- sitemap에는 실제로 공개하고 싶은 URL만 넣는다.
- 다국어 사이트는 `/ko`, `/en`처럼 언어별 canonical URL을 분리하고 `alternates.languages`를 둔다.
- Google/Naver 소유권 인증 코드는 서비스별로 발급받은 뒤 추가한다. DNS 인증을 쓰면 코드 변경 없이 처리할 수 있다.
- JSON-LD 문자열은 `JSON.stringify(data).replace(/</g, "\\u003c")` 형태로 직렬화해 스크립트 종료 문자열 삽입 가능성을 막는다.
- `Content-Signal`은 모든 검색엔진이 지원하는 표준 robots 지시어는 아니므로 일반 `Allow`/`Disallow` 정책을 대체하지 않는다.

다른 프로젝트 적용 순서:

1. 운영 도메인과 OG 이미지 URL을 정한다.
2. 공통 SEO 헬퍼를 만든다.
3. 공개 페이지마다 title/description을 작성한다.
4. 색인 제외 페이지에 `noindex`를 붙인다.
5. sitemap과 robots를 만든다.
6. 배포 후 `/robots.txt`, `/sitemap.xml`, `/og-image.png`와 페이지 소스의 `application/ld+json`이 정상 출력되는지 확인한다.
7. Google Search Console, Naver Search Advisor, Bing Webmaster Tools에 사이트를 등록하고 sitemap을 제출한다.

### 트러블슈팅: Bing 검색엔진 지적사항 및 SEO 오류 대응

Bing Webmaster Tools 등록 후 발생하는 대표적인 오류 지적사항과 해결 방안입니다.

1. **HTML 언어 태그 누락 및 Content-Language 경고**
   - Root Layout(`layout.tsx`)에서 `next-intl`의 `getLocale()`을 호출하여 `<html lang={locale}>` 동적 속성을 설정합니다.
   - `generateMetadata()`의 `other` 필드를 통해 `content-language: ko-KR` (또는 `en-US`) 메타 태그를 명시합니다.

2. **제목 70자 초과 경고**
   - Bing은 Title이 70자를 넘으면 검수 경고를 발생시킵니다.
   - 메인 및 하위 페이지 영문 제목을 70자 이내(예: 55~67자)로 축소하되, 브랜드명과 함께 핵심 검색 키워드(예: `Strait of Hormuz`, `US`, `Iran`, `Oil Price`, `Map` 등)를 전면에 배치합니다.

3. **Cloudflare 내부 경로(`/cdn-cgi/*`) 메타 태그 누락 오류**
   - Cloudflare 프록시 환경에서 크롤러가 `/cdn-cgi/` 내부 경로를 수집하면서 메타 태그가 없다고 오인 경고를 보낼 수 있습니다.
   - `robots.txt`에 `Disallow: /cdn-cgi/`를 명시하여 내부 시스템 경로의 크롤링을 차단합니다.

### 트러블슈팅: 네이버 검색결과 파비콘(지구본 아이콘) 노출 문제

네이버 검색결과에 사이트 파비콘 대신 회색 지구본 아이콘이 표시될 때가 있습니다. 네이버가 대표 URL의 파비콘을 아직 수집하지 못했거나 파비콘 경로를 정상 인식하지 못한 경우이므로, 다음 사항들을 점검합니다.

1. **대표 도메인에서 `favicon.ico`가 404 없이 실제로 열리는지 최우선 확인**
   - 브라우저 주소창에 직접 `https://example.com/favicon.ico` (또는 `www` 포함)를 입력했을 때 HTTP 200으로 아이콘이 잘 열리는지 확인합니다.

2. **Next.js App Router 권장 구성 활용**
   - 가장 간단하고 확실한 방법은 프로젝트 디렉토리에 아래와 같이 파일을 두는 것입니다.
     - `src/app/favicon.ico`
     - `src/app/icon.png` (192×192 또는 512×512 정사각형)
     - `public/og-image.png` (공유 미리보기용 이미지)
   - `src/app/favicon.ico`가 존재하면 **`layout.tsx` 등에서의 명시적인 `metadata` 선언은 필수가 아닙니다.** Next.js가 알아서 처리해 주므로, 꼭 필요할 때만 명시적으로 추가합니다.

3. **robots.txt 접근 허용 점검**
   - `/favicon.ico`, `/icon.png` 경로가 `robots.txt`나 보안 규칙(WAF 등)에서 차단되지 않았는지 확인합니다.

4. **이미지 규격 준수**
   - 파일은 정사각형 비율이어야 하며, 최소 16×16px 이상을 권장합니다. 검색결과에서는 작게 축소되어 표시되므로 최대한 단순하고 식별 가능한 디자인이 유리합니다.

5. **검색엔진 수집 지연 대기**
   - 설정을 올바르게 반영(수정/교체)했더라도, 검색엔진의 재수집 주기와 캐시 갱신에 따라 실제 검색결과 반영까지 시간이 걸릴 수 있습니다.

## 19. 서드파티 분석 태그 및 Next.js CSP 연동

언제 쓰는가:

- Microsoft Clarity, Google Analytics, Google AdSense 등 서드파티 스크립트를 안전하게 삽입하고 싶을 때.
- Next.js의 CSP(Content Security Policy) 헤더 설정으로 인해 외부 자바스크립트나 통신이 브라우저에서 차단되는 것을 막고 싶을 때.

핵심 설계:

- `next/script` 컴포넌트를 사용해 레이아웃 단계에서 스크립트를 로드한다 (`strategy="afterInteractive"`).
- `next.config.ts`의 `headers()`에 `Content-Security-Policy-Report-Only` (또는 `Content-Security-Policy`)를 설정한다.
- `script-src`, `connect-src`, `frame-src`, `img-src`에 서드파티 도구의 통신/자원 도메인을 화이트리스트로 명시한다.

데이터/코드 예시 (`frontend/src/app/layout.tsx`):

```tsx
import Script from "next/script";

const clarityId = "xpwhae7dv0";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");
          `}
        </Script>
      </body>
    </html>
  );
}
```

CSP 설정 예시 (`frontend/next.config.ts`):

```typescript
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://pagead2.googlesyndication.com https://tpc.googlesyndication.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://region1.google-analytics.com https://www.clarity.ms https://*.clarity.ms https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net",
  "frame-src https://www.marinetraffic.com https://embed.myshiptracking.com https://docs.google.com https://www.tradingview.com https://s.tradingview.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
].join("; ");
```

관련 파일:

- `frontend/src/app/layout.tsx`
- `frontend/next.config.ts`

주의점:

- 새로운 외부 도구를 붙였는데 브라우저 콘솔에 `Refused to load the script ... because it violates the following Content Security Policy directive` 에러가 뜨면 `next.config.ts` CSP 항목을 확인해야 한다.
- `Content-Security-Policy-Report-Only`를 사용하면 에러로 차단하진 않고 콘솔 경고로만 출력하며 테스트하기 용이하다.
- 스크립트는 `afterInteractive` 또는 `lazyOnload` 전략을 사용하여 첫 페이지 로딩(LCP/TTFB) 속도 저하를 최소화한다.

다른 프로젝트 적용 순서:

1. 사용할 외부 분석/광고 서비스의 측정 ID/클라이언트 키를 확보한다.
2. `next/script`로 `layout.tsx`에 비동기 로드 코드를 작성한다.
3. `next.config.ts` CSP 화이트리스트 도메인에 해당 서비스의 스크립트/통신 URL을 추가한다.
4. 개발자 도구(Console / Network 탭)에서 CSP 경고 및 통신 성공 여부를 최종 확인한다.
