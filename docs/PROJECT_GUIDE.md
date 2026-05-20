# Hormuz Monitor 프로젝트 운영 가이드

이 문서는 나중에 시간이 지난 뒤에도 프로젝트 구조, 데이터 흐름, 장애 지점, 수리 방법을 빠르게 복구하기 위한 내부 문서다. 공개 README가 아니라 운영자용 문서이며, 실제 API 키나 비밀번호는 절대 기록하지 않는다.

마지막 점검 기준: 2026-05-20

## 1. 서비스 개요

Hormuz Monitor는 미국-이란 전쟁과 호르무즈 해협 봉쇄 상황을 모니터링하는 한/영 대시보드다.

운영 도메인과 인프라:

- 서비스 도메인: `www.hrmz.today`
- 프론트엔드: Vercel, Next.js
- 백엔드 API/크론: Render, FastAPI, Python cron jobs
- DB: Supabase PostgreSQL
- 도메인 구매: Spaceship
- 보안/프록시: Cloudflare DDoS/WAF
- 트래픽 분석: Google Analytics
- 언어: 한국어/영어, 브라우저/지역/선택 언어에 따라 표시

핵심 화면 구성:

- 상황 요약
- 호르무즈 위험 지수
- 주간 평균 통행량
- 해협 지도 1, 2
- 통행 흐름
- 유가
- 미국 시중 휘발유가
- 시장 현황
- 관련 이슈
- 트럼프 소셜 미디어
- 소개/출처/문의/관련 이슈 별도 페이지

## 2. 저장소 구조

```text
hormuz-monitor/
  README.md
  render.yaml
  database/
    schema_final.sql
  backend/
    api/
    collectors/
    db/
    jobs/
    services/
    utils/
    requirements.txt
  frontend/
    src/app/
    src/components/
    src/i18n/
    src/lib/
    src/types/
    package.json
  docs/
    PROJECT_GUIDE.md
```

주의:

- `.env`, `.env.local`, `tmp_test/.env` 같은 환경 파일은 절대 GitHub에 올리면 안 된다.
- `docs/PROJECT_GUIDE.md`는 내부 운영 문서다.
- README는 공개/외부용으로 재구성할 때 이 문서를 기반으로 요약해서 작성한다.

## 3. 기술 스택

프론트엔드:

- Next.js `16.2.4`
- React `19.2.4`
- TypeScript
- next-intl
- Supabase JS
- lightweight-charts
- Recharts
- MapLibre GL
- TradingView embed/widget
- Tailwind CSS

백엔드:

- Python
- FastAPI
- Uvicorn
- httpx
- feedparser
- yfinance
- websockets
- pandas_market_calendars
- python-dotenv
- Supabase REST API

AI:

- Google Generative Language API
- 상황 요약/번역: Gemini Flash 계열 우선
- 기사 요약 팝업: `models/gemini-3.1-flash-lite`, `models/gemini-2.5-flash`, `models/gemini-3-flash-preview` 순서로 사용

## 4. 배포 구조

### 4.1 Frontend

프론트엔드는 Vercel에서 배포된다.

주요 경로:

- 대시보드: `frontend/src/app/[locale]/page.tsx`
- 전역 레이아웃: `frontend/src/app/[locale]/layout.tsx`
- 헤더/모바일 메뉴: `frontend/src/components/layout/Header.tsx`
- 모바일 섹션 이동 바: `frontend/src/components/navigation/MobileSectionNav.tsx`
- 데스크톱 섹션 이동 select: `frontend/src/components/navigation/SectionJumpSelect.tsx`
- 대시보드 데이터 캐시: `frontend/src/lib/api/dashboard-cache.ts`
- 대시보드 Supabase 쿼리: `frontend/src/lib/api/dashboard.ts`
- 기사 요약 API 클라이언트: `frontend/src/lib/api/eventArticleSummary.ts`

Vercel에 필요한 주요 환경변수:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=https://hormuz-api-v0ee.onrender.com
```

`NEXT_PUBLIC_API_BASE_URL`이 없으면 브라우저가 기본값 `http://127.0.0.1:8000`으로 요청하려고 하므로 운영 환경에서 기사 요약 팝업이 실패한다. 값을 수정한 뒤에는 Vercel 재배포가 필요하다.

주의:

- 변수 이름은 반드시 `NEXT_PUBLIC_API_BASE_URL`이어야 한다.
- `NEXT_PUBLIC_BASE_URL`은 이 코드에서 읽지 않는 잘못된 이름이다.
- Vercel에서 환경변수를 추가하거나 수정한 뒤에는 Production 재배포가 필요하다.

OG/공유 이미지:

- OG 원본 이미지는 프론트 정적 파일 `frontend/public/og-image.png`가 담당한다.
- 운영 공개 URL은 `https://www.hrmz.today/og-image.png`다. 이 이미지는 카카오톡, 검색엔진, SNS 미리보기 봇이 접근해야 하므로 공개 상태가 정상이다.
- `frontend/src/app/layout.tsx`와 `frontend/src/app/[locale]/layout.tsx`의 OG/Twitter 메타 이미지는 상대경로가 아니라 `https://www.hrmz.today/og-image.png` 절대 URL을 사용한다.
- `metadataBase`나 공유 캐시가 꼬이면 카카오톡 같은 크롤러가 잘못된 host에서 이미지를 찾을 수 있으므로 절대 URL을 유지한다.

SEO/검색 노출:

- 공통 SEO 헬퍼: `frontend/src/lib/seo.ts`
- 프론트 robots: `frontend/src/app/robots.ts`
- 프론트 sitemap: `frontend/src/app/sitemap.ts`
- sitemap 포함 페이지:
  - `https://www.hrmz.today/ko`
  - `https://www.hrmz.today/en`
  - `https://www.hrmz.today/ko/events`
  - `https://www.hrmz.today/en/events`
  - `https://www.hrmz.today/ko/about`
  - `https://www.hrmz.today/en/about`
  - `https://www.hrmz.today/ko/sources`
  - `https://www.hrmz.today/en/sources`
- 문의 페이지 `/ko/contact`, `/en/contact`는 sitemap에서 제외하고 `noindex, nofollow` 메타를 붙인다.
- 각 페이지는 `generateMetadata()`에서 언어별 title/description/canonical/hreflang/OG/Twitter 메타를 생성한다.
- SEO 키워드는 별도 `keywords` 메타에 과하게 나열하지 않고, title/description/본문 문맥에 자연스럽게 반영한다.
- Google Search Console이나 Naver Search Advisor 소유권 인증 값은 운영자가 받은 뒤 코드에 추가하거나 DNS 방식으로 처리한다.
- about/source 페이지의 출처 목록은 실제 수집 코드와 어긋나지 않게 주기적으로 점검한다.

대시보드 섹션 이동:

- 데스크톱에서는 우측 상단 고정 select로 섹션 이동을 제공한다.
- 모바일에서는 헤더 아래에 sticky 가로 섹션 바를 표시한다.
- 모바일 섹션 바는 횡스크롤 가능하며, 현재 보이는 섹션을 `IntersectionObserver`로 감지해 활성 버튼을 중앙으로 이동한다.
- 햄버거 메뉴는 대시보드/관련 이슈/소개 같은 상위 메뉴만 담당하고, 대시보드 섹션 목록은 모바일 섹션 바가 담당한다.

### 4.2 Backend API

Render web service:

- 이름: `hormuz-api`
- 설정 파일: `render.yaml`
- rootDir: `backend`
- startCommand: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
- 헬스체크: `GET /health`
- 기사 요약: `POST /events/{event_id}/summary?locale=ko|en`
- 잘못 들어온 `/og-image.png` 요청은 프론트 OG 이미지로 308 redirect한다.
- 백엔드 `/robots.txt`는 `Disallow: /`를 반환한다. API 도메인은 검색 색인 대상이 아니기 때문이다.
- 백엔드 `/` 요청은 프론트 서비스 URL로 308 redirect한다.

백엔드 API 주요 파일:

- `backend/api/main.py`
- `backend/services/event_article_summary_service.py`
- `backend/utils/gemini_client.py`
- `backend/db/client.py`
- `backend/db/select.py`
- `backend/db/upsert.py`

Render `hormuz-api`에 필요한 주요 환경변수:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
GOOGLE_GEMINI_API_KEY=
ARTICLE_SUMMARY_MODELS=models/gemini-3.1-flash-lite,models/gemini-2.5-flash,models/gemini-3-flash-preview
CORS_ORIGINS=
```

`CORS_ORIGINS`는 코드상 기본값이 `*`다. 필요하면 운영 도메인으로 제한할 수 있다.

## 5. Render 크론 작업

현재 `render.yaml` 기준 크론 구성:

| Render 서비스 | 주기 | 실행 명령 | 역할 |
| --- | --- | --- | --- |
| `hormuz-market-ingest` | 5분마다 | `python -m jobs.market_ingest` | 시장 스냅샷, 5분봉, 조건부 일봉 수집 |
| `hormuz-shipping-ingest` | 매시 7,27,47분 | `python -m jobs.shipping_ingest` | AISStream 수집, 최근일 통행 추정, `strait_metrics`/위험 지수 재계산 |
| `hormuz-events-ingest` | 매시 정각 | `python -m jobs.events_ingest` | RSS/news 이벤트 수집 |
| `hormuz-situation-summary` | 매시 10분 | `python -m jobs.situation_summary_ingest` | 상황 요약 생성 + 트럼프 번역 |
| `hormuz-trump-ingest` | 2시간마다 정각 | `python -m jobs.trump_ingest` | 트럼프 소셜 수집 |
| `hormuz-daily-maintenance` | 매일 06:00 UTC | `python -m jobs.daily_maintenance` | PortWatch, 유가/휘발유, 데이터 정리 |

이전 병합 전 크론 중 Render에서 제거/중지해야 하는 것:

- `hormuz-oil-ingest`
- `hormuz-portwatch-ingest`
- `hormuz-data-cleanup`
- `hormuz-trump-translate`
- `hormuz-summary-rebuild`
- 별도 `hormuz-gasoline-ingest`가 남아 있다면 중지

병합 이유:

- `daily_maintenance`가 `portwatch_ingest`, `oil_ingest`, `data_cleanup`을 순차 실행한다.
- `situation_summary_ingest`가 상황 요약 생성 후 `trump_translate`까지 실행한다.
- `shipping_ingest`가 AISStream 수집, 최근일 통행 추정, `summary_rebuild`를 순차 실행한다.
- 크론 개수를 줄여 Render Pipeline Minutes 사용량을 줄이는 목적이다.

AISStream 429/TLS 연결 장애 대응:

- AISStream WebSocket 접속이 `HTTP 429`로 제한되면 20초, 60초 backoff로 재시도한다.
- 재시도 후에도 429면 해당 회차 live AIS 수집만 건너뛰고 빈 목록으로 처리한다.
- `ssl.SSLCertVerificationError: certificate has expired`, 타임아웃, 소켓 오류처럼 AISStream 외부 연결 계층에서 실패해도 같은 방식으로 재시도 후 해당 회차 live AIS 수집만 건너뛴다.
- TLS 인증서 만료는 접속 대상인 `stream.aisstream.io`가 제시한 인증서 문제이므로 근본 해결은 AISStream 운영자가 해야 한다. 인증서 검증을 끄는 방식은 사용하지 않는다.
- 이 경우에도 최근일 통행 추정과 `strait_metrics`/risk score 재계산은 계속 진행한다.
- 19분 단위 `*/19`는 매시간 `:57 -> :00` 구간에 3분 간격이 생기므로 사용하지 않는다.

주의:

- 병합된 새 크론 서비스에는 기존 개별 크론의 환경변수가 자동 복사되지 않는다.
- `hormuz-daily-maintenance`에는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EIA_API_KEY`를 직접 넣어야 한다.
- 이 값이 없으면 import 단계에서 `환경변수 누락: SUPABASE_URL` 같은 오류로 즉시 종료된다.

## 6. 프론트엔드 캐시 정책

프론트 대시보드 데이터는 `frontend/src/lib/api/dashboard-cache.ts`에서 Next.js `unstable_cache`로 섹션별 TTL을 둔다.

현재 TTL:

| 캐시 그룹 | TTL | 대상 |
| --- | ---: | --- |
| `summary` | 93초 | 상황 요약 |
| `market` | 103초 | 시장 스냅샷, 5분봉, 일봉 |
| `shipping` | 425초 | 최신 해협 지표, 통행 시계열 |
| `riskAndTransitSummary` | 513초 | 위험 지수, 주간 평균 통행량 |
| `events` | 1636초 | 관련 이슈 |
| `trump` | 3477초 | 트럼프 소셜 |
| `daily` | 7269초 | 유가, 휘발유 |

의도:

- 모든 사용자가 클릭할 때마다 Supabase를 직접 때리는 구조를 줄인다.
- 갱신 시점이 한꺼번에 겹치지 않도록 서로 다른 TTL을 사용한다.
- 데이터 원천 자체가 5분~1일 단위로 갱신되므로 초 단위 최신성보다 페이지 즉시 표시가 중요하다.

주의:

- `frontend/src/lib/supabase.ts`는 fetch에 `cache: "no-store"`를 걸고 있다. Supabase 직접 fetch는 캐시하지 않고, 상위 함수 결과를 `unstable_cache`로 캐시한다.
- TTL을 너무 길게 하면 DB에는 새 데이터가 있어도 화면 반영이 늦어진다.
- 상황 요약은 첫 화면에 보이므로 너무 긴 TTL은 체감 품질을 해친다.

## 7. Supabase Data API 권한

Supabase는 2026-05-30부터 신규 프로젝트에서 `public` schema 테이블을 Data API에 자동 노출하지 않고, 2026-10-30부터 기존 프로젝트에도 명시적 GRANT를 요구한다.

우리 서비스는 프론트에서 `supabase-js`, 백엔드에서 `/rest/v1`을 사용하므로 Data API 영향권이다.

권한 원칙:

- 프론트가 anon key로 직접 읽는 공개 테이블에는 `anon`, `authenticated`에 `SELECT`만 부여한다.
- 백엔드 전용 테이블에는 `anon`, `authenticated` 권한을 부여하지 않는다.
- Render 백엔드는 `service_role`로 Data API read/write를 수행하므로 모든 운영 테이블에 `service_role` `SELECT, INSERT, UPDATE, DELETE`를 부여한다.
- `bigserial` insert를 위해 `service_role`에 public schema sequence `USAGE, SELECT`를 부여한다.
- RLS는 계속 켜둔다. GRANT는 Data API 접근 권한이고, 실제 공개 read 범위는 RLS policy와 함께 결정된다.

공개 read 테이블:

- `strait_metrics`
- `chokepoint_transits`
- `oil_price_series`
- `gasoline_prices`
- `market_snapshots`
- `market_intraday`
- `market_ohlcv`
- `events`
- `event_timeline_markers`
- `trump_posts`
- `situation_summaries`
- `risk_score_history`

백엔드 전용 테이블:

- `vessels_normalized`
- `event_article_summaries`
- `source_runs`
- `source_errors`

현재 반영 상태:

- `database/schema_final.sql` 하단에 명시적 GRANT 블록을 추가했다.
- 운영 Supabase DB에도 같은 GRANT SQL을 2026-05-14에 SQL Editor로 적용했다.
- 새 테이블을 추가할 때는 `CREATE TABLE`, index, RLS policy와 함께 GRANT도 같은 migration/provisioning 흐름에 포함해야 한다.

## 8. 데이터 흐름

### 8.1 상황 요약

흐름:

1. `hormuz-events-ingest`가 RSS/news 이벤트를 `events`에 저장한다.
2. `hormuz-trump-ingest`가 트럼프 포스트를 `trump_posts`에 저장한다.
3. `hormuz-situation-summary`가 `collectors/summary/situation_summarizer.py`를 실행한다.
4. Gemini가 한국어 요약, 영어 번역, 지정학 점수 `geo_score`를 생성한다.
5. 백엔드는 생성된 텍스트 요약을 후처리해 고정 4개 항목 구조로 정규화한다.
6. 텍스트 요약에서 structured JSON을 부가 생성하고, 성공하면 `summary_ko_structured`, `summary_en_structured`에도 저장한다.
7. 결과는 `situation_summaries`에 저장된다.
8. 프론트는 `fetchLatestSummary()`로 최신 1건을 가져온다.

상황 요약에 쓰는 데이터:

- 최근 24시간 뉴스 헤드라인
- 최근 24시간 트럼프 포스트 최대 10개
- WTI, Brent 최신 가격
- 미국 전국 휘발유 평균
- 장중이면 S&P500, NASDAQ, VIX

뉴스 소스 필터:

- BBC Middle East
- Anadolu Agency
- NYT Middle East
- CNBC Energy
- CNBC World
- CNBC Asia

지정학 점수 기준:

- 1~7: Safe
- 8~15: Caution
- 16~22: Warning
- 23~30: Danger

프롬프트 원칙:

- US-Iran war/negotiations and Trump's statements are the PRIMARY topic.
- Oil prices and market indices are SECONDARY.
- 한국어/영어 요약은 4개 항목으로 고정한다.
- 항목명과 본문은 줄바꿈한다.
- 항목별 본문은 2~3문장 기준이다.
- 본문에서 `###`, `##`, `**`, 추가 불릿, 번호 목록 같은 불필요한 Markdown 문법은 저장 전 제거/검증한다.

고정 항목:

| 한국어 | 영어 |
| --- | --- |
| 핵심 상황 | Core situation |
| 군사·외교 움직임 | Military and diplomatic moves |
| 시장 반응 | Market reaction |
| 전망 및 관찰 포인트 | Outlook and watch points |

저장 방어:

- Gemini API가 HTTP 성공을 반환해도 `finishReason`이 `STOP`이 아니면 실패로 보고 다음 모델로 넘어간다.
- 한국어 요약이 150자 미만이면 실패로 본다.
- 영어 번역이 비어 있거나 `SCORE`가 없으면 실패로 본다.
- `max_output_tokens`는 3072로 둔다. 2개 언어 요약과 SCORE까지 모두 받아야 하므로 `MAX_TOKENS`로 잘린 응답은 실패 처리한다.
- 모델 원문이 약간 어긋나도 저장 전에 후처리한다. 예: `### 핵심 상황`, `**핵심 상황:**`, `핵심 상황: 본문` 등을 `- 핵심 상황:\n본문` 형태로 보정한다.
- 모든 모델이 실패하면 새 row를 저장하지 않는다. 이 경우 화면에는 기존 정상 요약이 계속 남는 것이 맞다.

구조화 요약과 하이라이트:

- 기존 `summary_ko`, `summary_en` 텍스트는 계속 기본값으로 저장한다.
- `summary_ko_structured`, `summary_en_structured`는 JSONB 부가 컬럼이다.
- structured JSON은 텍스트 요약이 성공한 뒤 백엔드가 만든다.
- 현재 구현은 AI가 JSON 전체를 직접 만들지 않는다. 백엔드가 텍스트 요약을 4개 섹션으로 파싱하고 고정 JSON 껍데기를 만든다.
- 하이라이트는 섹션 본문에서 의미 있는 구절 후보를 규칙 기반으로 추출한다.
- 하이라이트 `tone` 허용값은 `risk`, `market`, `watch`다.
- `highlight.text`가 해당 `body` 안에 실제 존재하지 않으면 저장하지 않는다.
- structured 생성이 실패해도 크론 실패로 보지 않는다. 기본 텍스트 요약과 `geo_score`가 성공하면 정상 저장한다.

structured JSON 예시:

```json
{
  "version": 1,
  "sections": [
    {
      "title": "핵심 상황",
      "body": "트럼프는 호르무즈 해협에서 고립된 선박들을 구출하겠다는 계획을 공개했습니다.",
      "highlights": [
        {
          "text": "고립된 선박들을 구출하겠다는 계획",
          "tone": "risk"
        }
      ]
    }
  ]
}
```

프론트 렌더링:

- 관련 파일: `frontend/src/components/cards/SituationSummaryCard.tsx`
- structured JSON이 있으면 새 렌더러를 사용한다.
- structured JSON이 없거나 검증에 실패하면 기존 `ReactMarkdown` 기반 텍스트 렌더링으로 fallback한다.
- 항목명은 본문 위에 별도 줄로 표시한다.
- 하이라이트는 `<mark>`로 렌더링한다.
- 하이라이트 글자는 굵게 하지 않고, 배경색만 사용한다.
- `risk`는 분홍 계열, `market`은 노랑 계열, `watch`는 하늘색 계열의 약한 배경색을 쓴다.
- 공유 버튼은 기존 일반 텍스트 `summary_ko`/`summary_en`을 계속 사용한다.

### 8.2 호르무즈 위험 지수

위험 지수 계산 파일:

- `backend/services/risk_score_service.py`
- 저장 트리거: `backend/jobs/summary_rebuild.py`

점수 구성:

| 구성 요소 | 비중 |
| --- | ---: |
| 통행량/선박 점수 | 40 |
| 지정학 점수 | 30 |
| 브렌트유 점수 | 20 |
| VIX 점수 | 10 |

통행량 점수:

- 방향 데이터는 최근 24시간 AIS 누적 추정값인 `inland_entry_count`와 `offshore_exit_count`를 사용한다.
- 내해 진입은 최대 15점, 외해 출항은 최대 25점이다.
- 각 방향 기준값은 35척이다.
- 방향 데이터가 없으면 총 통행량 `vessels / 70` 기준으로 40점 안에서 계산한다. 현재 운영 기준에서는 AIS가 0척이면 `0 / 0`으로 보고 봉쇄 신호로 반영한다.
- 선박 데이터 자체가 없으면 기본 20점이다.

브렌트유 점수:

- Brent 가격이 80달러 이하이면 0점.
- Brent 가격이 120달러 이상이면 20점.
- 그 사이는 선형 환산한다.
- 7일 변화율 점수도 계산하며, 가격 점수와 변화율 점수 중 큰 값을 사용한다.

VIX 점수:

- VIX 15 이하이면 0점.
- VIX 35 이상이면 10점.
- 그 사이는 선형 환산한다.
- 데이터가 없으면 기본 5점이다.

지정학 점수:

- `situation_summaries.geo_score` 원점수 1~30을 사용한다.
- 위험 지수 반영 점수는 `((geo_raw - 1) / 29) * 30`이다.
- `geo_score`가 없으면 선박+시장 기반 fallback을 사용한다.

### 8.3 주간 평균 통행량

관련 파일:

- `backend/services/transit_summary_service.py`
- `frontend/src/lib/api/dashboard.ts`

흐름:

1. `chokepoint_transits`에서 `portid = chokepoint6` 최신 7일을 가져온다.
2. 선종별 평균을 계산한다.
3. 총 통행량과 선종별 카드는 PortWatch 최신 7일 평균을 그대로 표시한다.
4. 내해 진입과 외해 출항은 PortWatch 총량에서 역산하지 않는다.
5. 내해 진입과 외해 출항은 최근 24시간 `vessels_normalized` AIS 데이터를 MMSI별로 묶어 방향 판정한 누적값을 표시한다.
6. 화면에는 방향 카드 하단에 `24시간 AIS 추정` / `24h AIS estimate`를 표시한다.

주의:

- PortWatch는 방향을 직접 제공하지 않는다.
- `내해 진입 = 총 통행량 - 외해 출항` 방식은 사용하지 않는다.
- AIS 핵심 박스에서 24시간 동안 선박이 없으면 내해 진입 0척, 외해 출항 0척으로 표시한다.
- 이 0척은 PortWatch 총량이 0이라는 의미가 아니라, 핵심 통과 구간에서 AIS 방향 관측이 0이라는 의미다.

### 8.4 AISStream 선박 수집과 방향 판정

수집 파일:

- `backend/collectors/shipping/aisstream_collector.py`
- `backend/collectors/shipping/aisstream_estimator.py`
- `backend/jobs/shipping_ingest.py`

현재 수집 박스:

```python
[[25.75, 55.75], [27.1, 57.45]]
```

좌표 형식:

```text
[[minLat, minLon], [maxLat, maxLon]]
```

현재 구역 판정:

- `inland_gate`: `55.75 <= lng <= 56.15`, `25.75 <= lat <= 27.1`
- `offshore_gate`: `56.15 <= lng <= 57.45`, `25.75 <= lat <= 26.0`
- `strait_core`: `56.15 <= lng <= 57.45`, `26.0 <= lat <= 27.1`
- 그 외: `outside_box`

방향 판정:

- COG 80~180도: `offshore_exit`
- COG 240~340도: `inland_entry`
- COG 10도 미만 또는 350도 초과: `stationary`
- 그 외: `unknown`

방향 추정:

1. 주간 평균 카드와 위험 지수에는 최근 24시간 `vessels_normalized`를 읽는다.
2. MMSI 단위로 묶는다.
3. 속도 1노트 미만은 제외한다.
4. `inland_gate` 또는 `offshore_gate` 통과 기록이 있으면 마지막 관문을 기준으로 방향을 정한다.
5. 관문 기록이 없으면 COG 방향의 다수결로 fallback한다.
6. 내해 진입과 외해 출항은 이 최근 24시간 누적값을 사용한다.
7. 별도로 `estimate_recent_transits()`는 최근 일자 AIS 추정치를 `strait_metrics`와, PortWatch 최신일 이후라면 `chokepoint_transits`에 `source = aisstream_estimate`로 저장할 수 있다.

정상/비정상 구분:

- 현재 해협 봉쇄 상황에서는 `0척 수집`이 실제 정상일 수 있다.
- 정상 코드라면 Render 로그상 AIS 수집이 약 4분 동안 대기한다.
- AISStream TLS 인증서 만료, 타임아웃, 소켓 오류는 외부 연결 장애로 보고 재시도 후 빈 목록으로 처리한다. 이 경우 사용자 대시보드 표시는 변경하지 않고 Render 로그 경고로만 확인한다.
- 7초 내외로 끝나며 `0척`이면 예전 코드가 배포되어 있을 가능성이 있다.
- Render에서 GitHub merge만으로 부족하면 `Builds > Manual Build`를 실행해야 새 코드가 반영될 수 있다.

### 8.5 PortWatch 통행량

관련 파일:

- `backend/collectors/shipping/portwatch_collector.py`
- `backend/jobs/portwatch_ingest.py`
- `backend/jobs/daily_maintenance.py`

역할:

- IMF PortWatch의 `chokepoint6` 데이터를 가져온다.
- `chokepoint_transits`에 일별 통행량과 선종별 수치를 저장한다.
- 현재는 `daily_maintenance` 안에서 하루 1회 실행한다.

주의:

- PortWatch는 원천 데이터 자체가 늦을 수 있다.
- Render가 main 브랜치를 보고 있으면 develop 수정 후 main merge와 manual build 여부를 확인해야 한다.

### 7.6 유가와 휘발유

관련 파일:

- `backend/collectors/oil/eia_collector.py`
- `backend/collectors/oil/gasoline_collector.py`
- `backend/collectors/oil/yfinance_futures_collector.py`
- `backend/jobs/oil_ingest.py`
- `backend/jobs/daily_maintenance.py`

유가:

- EIA spot 데이터를 기본으로 저장한다.
- EIA spot이 늦게 공개되는 경우를 대비해 Yahoo Finance futures를 보조로 사용한다.
- 같은 `symbol + price_date`에 EIA 데이터가 있으면 EIA를 우선한다.
- WTI, BRENT, NATURAL_GAS를 저장한다.

휘발유:

- EIA gasoline 데이터를 저장한다.
- 전국 평균은 `area_type = national` 또는 코드 fallback으로 찾는다.
- `gasoline_prices`에 저장된다.

주의:

- EIA 원천 데이터는 며칠 이상 늦을 수 있다.
- 유가 차트가 오래 멈춘 것처럼 보이면 EIA 최신일, Yahoo futures fallback 저장 여부, `daily_maintenance` 로그를 함께 확인한다.

### 7.7 시장 현황

관련 파일:

- `backend/collectors/market/yfinance_collector.py`
- `backend/jobs/market_ingest.py`
- `frontend/src/components/cards/MarketCustomChart.tsx`
- `frontend/src/lib/api/dashboard.ts`

수집 대상:

- VIX
- NASDAQ
- S&P500
- KOSPI
- KOSDAQ
- ES futures
- NQ futures
- Gold futures
- USD index
- Gasoline futures
- Heating oil futures

저장 테이블:

- `market_snapshots`: 최신 스냅샷
- `market_intraday`: 5분봉
- `market_ohlcv`: 일봉

프론트 표시:

- 5분봉: 최근 10일
- 일봉: 최근 90일
- 일봉에는 MA20, MA60 이평선 표시
- 5분봉에는 이평선을 표시하지 않는다.
- 차트는 전체 데이터를 한 화면에 억지로 압축하지 않고 최신 일부 구간을 먼저 보여준다.
- 5분봉은 모바일 약 180개, 데스크톱 약 320개 포인트를 먼저 보여준다.
- 일봉은 모바일 약 28개, 데스크톱 약 35개 봉을 먼저 보여준다.
- 사용자는 왼쪽으로 이동해 과거 데이터를 볼 수 있다.
- 데이터 범위 바깥으로는 이동하지 못하게 제한한다.
- x축 5분봉은 시:분 중심, 일봉은 월-일 중심으로 표시한다.

운영 메모:

- 2026-04-30에 `market_ohlcv` 일봉 데이터를 1회 백필했다.
- 백필 후 주요 심볼은 83~101개 일봉을 보유한다.
- 이후에는 `hormuz-market-ingest`가 신규 일봉을 이어서 갱신한다.

### 7.8 유가 실시간 위젯

관련 파일:

- `frontend/src/components/charts/TradingViewChart.tsx`
- `frontend/src/i18n/*/dashboard.json`

역할:

- WTI, Brent, 천연가스의 실시간성 차트를 TradingView 위젯으로 표시한다.
- 영어 섹션명은 `Oil Prices (Real-time)`으로 표시하며, 화면 제목에는 `TradingView` 문구를 붙이지 않는다.

주의:

- TradingView 위젯은 iframe 기반이라 내부 데이터 범위를 앱 코드가 완전히 제어하기 어렵다.
- 현재는 위젯이 제공하는 time scale API가 동작할 경우 오른쪽 빈 영역 `rightOffset`만 0으로 되돌리는 보정을 둔다.
- 시장 현황처럼 완전히 통제하려면 Yahoo Finance 선물 데이터 등을 자체 수집해 `lightweight-charts`로 직접 그려야 한다. 현재는 무료 데이터 안정성과 작업 범위를 고려해 보류한다.

### 7.9 관련 이슈와 기사 요약 팝업

관련 파일:

- `backend/api/main.py`
- `backend/services/event_article_summary_service.py`
- `frontend/src/components/cards/EventArticleSummaryModal.tsx`
- `frontend/src/lib/api/eventArticleSummary.ts`
- `database/event_article_summaries.sql`

흐름:

1. 사용자가 관련 이슈 기사를 클릭한다.
2. 프론트가 `POST /events/{event_id}/summary?locale=ko|en`을 호출한다.
3. 백엔드가 `event_article_summaries`에서 캐시를 먼저 확인한다.
4. 없으면 `events` 테이블의 제목/요약/소스 정보를 바탕으로 AI가 3~5문장 요약을 만든다.
5. 결과를 DB에 저장하고 팝업에 표시한다.
6. 팝업 하단에는 원문 바로가기 링크를 제공한다.

중요:

- 현재 구현은 원문 전문을 크롤링하지 않는다.
- 이벤트 테이블에 저장된 제목/요약/출처/URL 기반으로 요약한다.
- 한국어 사용자에게는 한국어 요약, 영어 사용자에게는 영어 요약을 제공한다.
- Gemma 3 27B는 Gemini API JSON mode를 지원하지 않는다. `responseMimeType: application/json`을 넣으면 400 오류가 난다.
- Gemma 3 27B가 `v1beta generateContent`에서 404를 반환할 수 있다. 이 경우 쿼터 문제가 아니라 해당 프로젝트/API 버전에서 모델을 사용할 수 없다는 뜻이므로 Gemini Flash 계열 fallback이 필요하다.
- `ARTICLE_SUMMARY_MODELS` 환경변수가 Render에 있으면 코드 기본 모델 목록을 덮어쓴다. 값이 Gemma 하나만 있으면 fallback이 동작하지 않는다.
- 현재 권장값은 `models/gemma-3-27b-it,models/gemini-3.1-flash-lite-preview,models/gemini-2.5-flash`다.
- 기사 요약 생성 실패 시 `backend/api/main.py`가 Render `hormuz-api` 로그에 `기사 요약 생성 실패(event_id=..., locale=...): ...` 형식으로 실제 GeminiError를 남긴다.
- 로딩 중에는 `기사 내용을 요약하고 있습니다...` / `Summarizing the article...` 문구와 수평 indeterminate bar를 표시한다.

현재 정리 정책:

- `data_cleanup.py`는 `event_article_summaries`도 `_RETENTION_DAYS = 10` 기준으로 삭제한다.
- 원래 의도한 2일 보관 정책으로 바꾸려면 cleanup 로직을 별도로 조정해야 한다.

### 7.10 트럼프 소셜 미디어

관련 파일:

- `backend/collectors/social/trump_collector.py`
- `backend/collectors/social/trump_translator.py`
- `backend/jobs/trump_ingest.py`
- `backend/jobs/situation_summary_ingest.py`
- `frontend/src/components/cards/TrumpPostsFeed.tsx`

흐름:

1. `hormuz-trump-ingest`가 트럼프 포스트를 수집한다.
2. `hormuz-situation-summary` 실행 후 `translate_pending()`이 미번역 포스트를 번역한다.
3. 프론트는 `content_ko`가 있으면 한국어 사용자에게 번역문을 보여준다.

주의:

- 긴 URL은 CSS 줄바꿈 처리로 칸을 벗어나지 않도록 수정되어 있다.
- 번역할 대상이 없으면 번역 작업은 빠르게 종료된다.
- 원문이 1,500자를 넘는 매우 긴 포스트는 전문 번역 대신 `[긴 글 요약 번역]` prefix와 함께 약 800자 요약 번역으로 저장한다.
- 일반 포스트 전문 번역은 `max_output_tokens=2048`, 긴 글 요약 번역은 `max_output_tokens=1024`를 사용한다.
- 트럼프 번역 기본 모델 목록은 Gemini Flash 계열만 사용한다. Gemma 3 27B는 현재 `v1beta generateContent`에서 404가 날 수 있어 기본 번역 fallback에서 제외했다.
- `situation_summary_ingest`에 병합된 번역 단계가 실패해도 상황 요약 저장이 성공했다면 통합 잡 전체를 실패로 종료하지 않는다. 실패는 `job_errors`와 Render 로그에 남긴다.
- 별도 `trump_translate` 잡을 직접 실행하는 경우에는 번역 실패 시 해당 잡이 실패로 종료될 수 있다.

## 8. 데이터베이스

주요 스키마 파일:

- `database/schema_final.sql`
- `database/security_hardening_2026_04_25.sql`
- `database/event_article_summaries.sql`

주요 테이블:

| 테이블 | 역할 |
| --- | --- |
| `vessels_normalized` | AISStream 원시/정규화 선박 위치 |
| `strait_metrics` | 일별 해협 통행 상태와 방향 추정 |
| `chokepoint_transits` | PortWatch 통행량, PortWatch 최신일 이후 AIS 추정 통행량 |
| `oil_price_series` | WTI, Brent, 천연가스 |
| `gasoline_prices` | 미국 휘발유 가격 |
| `market_snapshots` | 시장 최신 스냅샷 |
| `market_intraday` | 5분봉 시장 데이터 |
| `market_ohlcv` | 일봉 OHLCV |
| `events` | 관련 이슈/news 이벤트 |
| `event_article_summaries` | 기사 요약 팝업 캐시 |
| `event_timeline_markers` | 이벤트 타임라인/차트 마커 |
| `trump_posts` | 트럼프 소셜 포스트 |
| `situation_summaries` | 상황 요약, structured 하이라이트 JSON, 지정학 점수 |
| `risk_score_history` | 호르무즈 위험 지수 이력 |
| `source_runs` | 수집 작업 실행 기록 |
| `source_errors` | 수집 작업 오류 기록 |

`situation_summaries` 주요 컬럼:

| 컬럼 | 역할 |
| --- | --- |
| `summary_ko` | 한국어 기본 텍스트 요약 |
| `summary_en` | 영어 기본 텍스트 요약 |
| `summary_ko_structured` | 한국어 structured JSONB 요약과 하이라이트 |
| `summary_en_structured` | 영어 structured JSONB 요약과 하이라이트 |
| `geo_score` | 지정학 긴장도 원점수 1~30 |
| `generated_at` | 생성 시각 |

structured 컬럼 추가 SQL:

```sql
alter table situation_summaries
  add column if not exists summary_ko_structured jsonb,
  add column if not exists summary_en_structured jsonb;
```

RLS:

- public read가 필요한 대시보드 데이터는 Supabase anon key로 읽는다.
- 원시/내부 로그성 데이터는 `security_hardening`에서 public 접근을 제한한다.
- 백엔드/크론은 `SUPABASE_SERVICE_ROLE_KEY`로 읽고 쓴다.

## 9. 환경변수와 API 키

실제 값은 문서에 기록하지 않는다.

### 9.1 Vercel

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=
```

주의:

- `NEXT_PUBLIC_API_BASE_URL`의 운영 값은 Render API 주소다. 예: `https://hormuz-api-v0ee.onrender.com`
- 변수 이름을 `NEXT_PUBLIC_BASE_URL`로 만들면 프론트가 읽지 못하고 `127.0.0.1:8000` fallback을 사용한다.
- Sensitive 변수는 edit 화면에서 기존 value가 비어 보일 수 있다. 이름과 환경 범위, 재배포 여부를 확인한다.

### 9.2 Render web service: hormuz-api

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
GOOGLE_GEMINI_API_KEY=
ARTICLE_SUMMARY_MODELS=models/gemma-3-27b-it,models/gemini-3.1-flash-lite-preview,models/gemini-2.5-flash
CORS_ORIGINS=
```

### 9.3 Render cron jobs

공통:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

작업별:

```env
EIA_API_KEY=
AISSTREAM_API_KEY=
GOOGLE_GEMINI_API_KEY=
```

선택 Gemini override:

```env
GEMINI_SUMMARY_MODELS=
GEMINI_TRANSLATION_MODELS=
ARTICLE_SUMMARY_MODELS=
```

## 10. 로컬 실행

### 10.1 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

빌드 확인:

```bash
cd frontend
npm run build
```

### 10.2 백엔드 API

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.main:app --reload
```

루트에서 실행할 때:

```bash
PYTHONPATH=backend python -m uvicorn backend.api.main:app --reload
```

환경변수는 로컬 `.env` 또는 셸 환경에 있어야 한다. 단, `.env` 파일은 Git에 올리지 않는다.

### 10.3 백엔드 잡 단독 실행

Render와 같은 방식은 `backend` 디렉토리에서 실행한다.

```bash
cd backend
python -m jobs.market_ingest
python -m jobs.shipping_ingest
python -m jobs.summary_rebuild
python -m jobs.events_ingest
python -m jobs.situation_summary_ingest
python -m jobs.trump_ingest
python -m jobs.daily_maintenance
```

## 11. 장애 진단 가이드

### 11.1 대시보드가 느리다

확인 순서:

1. Vercel 함수/빌드 로그에서 서버 렌더 시간이 긴지 확인한다.
2. `frontend/src/lib/api/dashboard-cache.ts` TTL이 적용된 배포인지 확인한다.
3. Supabase 쿼리가 한 섹션에 몰려 있는지 `frontend/src/lib/api/dashboard.ts`를 확인한다.
4. 시장 데이터는 심볼별 병렬 쿼리를 쓰는지 확인한다.
5. 캐시 TTL을 줄이면 최신성은 올라가지만 DB 호출이 늘어난다.
6. 캐시 TTL을 늘리면 페이지는 빨라지지만 새 데이터 반영이 늦어진다.

### 11.2 기사 요약 팝업이 실패한다

확인 순서:

1. Vercel에 `NEXT_PUBLIC_API_BASE_URL`이 있는지 확인한다.
2. 값이 Render API 주소인지 확인한다. 예: `https://hormuz-api-v0ee.onrender.com`
3. Vercel 재배포가 되었는지 확인한다.
4. Render `hormuz-api`에 `GOOGLE_GEMINI_API_KEY`가 있는지 확인한다.
5. Supabase에 `event_article_summaries` 테이블이 있는지 확인한다.
6. Render 로그에서 400 오류가 `JSON mode is not enabled for models/gemma-3-27b-it`이면 JSON mode 설정이 다시 들어간 것이다.
7. Render 로그에서 404 오류가 `models/gemma-3-27b-it is not found for API version v1beta`이면 Gemma가 현재 프로젝트에서 사용 불가한 상태다. `ARTICLE_SUMMARY_MODELS`에서 Gemini Flash 계열을 앞에 두거나 Gemma를 제거한다.
8. Render 로그에 `failed after 1 attempts`만 나오면 `ARTICLE_SUMMARY_MODELS`가 단일 모델로 설정되어 fallback을 덮어쓰는지 확인한다.
9. 오래된 이상한 요약이 계속 나오면 `event_article_summaries` 해당 row를 삭제해 재생성한다.

브라우저 콘솔에서 `POST http://127.0.0.1:8000/events/.../summary`가 보이면 백엔드 문제가 아니라 Vercel 환경변수 이름/Production 범위/재배포 문제다.

### 11.3 상황 요약이 짧게 잘리거나 비어 있다

확인 순서:

1. Render `hormuz-situation-summary` 로그에서 Gemini timeout, 503, fallback 모델 사용 기록을 확인한다.
2. `situation_summaries` 최신 row의 `summary_ko`, `summary_en`, `geo_score`를 확인한다.
3. `summary_ko`가 150자 미만이거나 `summary_en`이 비어 있거나 `geo_score`가 `null`이면 미완성 응답이 저장된 상태다.
4. 현재 코드는 이런 미완성 응답을 저장하지 않도록 검증한다. 같은 문제가 보이면 Render가 최신 빌드인지 확인한다.
5. 이미 저장된 불량 row가 최신이면 삭제하거나, 수정 배포 후 `hormuz-situation-summary`를 수동 실행해 정상 row를 새로 생성한다.

로그 해석:

- `finishReason=MAX_TOKENS`: 모델 응답이 중간에 잘린 것이다. KO/EN/SCORE가 모두 완성되지 않았을 수 있으므로 실패 처리한다.
- `returned invalid situation_summary text`: 모델 응답은 있었지만 후처리/검증 후에도 필수 구조를 만족하지 못한 것이다.
- `structured ko=True en=True`: 기본 요약 저장과 structured JSON 생성이 모두 성공한 상태다.
- `structured ko=False en=False`: 기본 요약은 저장됐지만 structured JSON 생성은 실패한 상태다. 이 경우 화면은 기존 텍스트 fallback으로 표시된다.

structured 하이라이트가 보이지 않을 때:

1. Supabase `situation_summaries` 최신 row에 `summary_ko_structured` 또는 `summary_en_structured` 값이 있는지 확인한다.
2. 값이 없으면 최신 크론이 structured 컬럼 추가 전 코드로 실행됐거나, structured 생성이 실패한 것이다.
3. Render 로그에서 `structured ko=... en=...`를 확인한다.
4. 값이 있는데 화면에 안 보이면 Vercel이 최신 프론트 빌드인지 확인한다.
5. structured JSON 검증 실패 시 프론트는 자동으로 기존 텍스트 렌더링으로 fallback한다.
6. 하이라이트 문구가 아쉽거나 적게 잡히는 것은 현재 규칙 기반 후보 추출의 한계다. 더 정교하게 하려면 AI가 highlight 후보를 별도 생성하게 하는 2단계 작업이 필요하다.

### 11.4 AIS가 계속 0척이다

가능한 원인:

- 실제 봉쇄로 선박이 없는 상태
- 수집 박스에 선박이 지나가지 않는 상태
- AISStream API 키 문제
- AISStream 서버 인증서 만료 또는 외부 WebSocket 연결 장애
- Render에 최신 코드가 배포되지 않은 상태
- WebSocket 연결 문제

확인 순서:

1. Render 로그에서 `선박 데이터 수집 시작`부터 `완료`까지 약 4분 걸렸는지 본다.
2. 7초 정도에 끝나면 예전 timeout 코드일 수 있다.
3. `AISStream connection failed after retries; skipping live AIS collection` 경고가 있으면 외부 AISStream 연결 장애로 보고, 해당 회차 수집 누락은 정상 방어 동작으로 판단한다.
4. `ssl.SSLCertVerificationError: certificate has expired`가 보이면 우리 Render 인증서가 아니라 `stream.aisstream.io` 서버 인증서 만료 문제다. AISStream 쪽 갱신이 근본 해결이며, 인증서 검증 비활성화로 우회하지 않는다.
5. GitHub main merge 여부를 확인한다.
6. Render `Blueprint > Manual Sync`만으로 부족하면 `Builds > Manual Build`를 실행한다.
7. 넓은 박스 테스트를 `tmp_test`에서 별도 스크립트로 실행해 AISStream 자체가 응답하는지 확인한다.

정상 예시:

```text
선박 데이터 수집 시작
완료: 0척 수집, 0건 저장, 0일 추정치 갱신
```

이 로그가 4분 뒤에 나오면 수집기가 대기한 것이므로 0척 자체는 실패가 아닐 수 있다.

### 11.5 통행 흐름/주간 평균이 오래 멈췄다

확인 순서:

1. `hormuz-daily-maintenance` 로그에서 `portwatch` 실행 여부를 본다.
2. `source_runs`에서 `portwatch` 최근 성공 여부를 본다.
3. `chokepoint_transits` 최신 `transit_date`와 `source`를 확인한다.
4. Render가 main 브랜치 최신 빌드인지 확인한다.
5. 총 통행량은 PortWatch 7일 평균이고, 내해/외해 방향값은 최근 24시간 AIS 추정값이다.
6. 방향값이 0/0이면 `hormuz-shipping-ingest` 로그에서 최근 24시간 수집 여부와 4분 대기 여부를 확인한다.

### 11.6 유가/휘발유가 오래 멈췄다

확인 순서:

1. `hormuz-daily-maintenance` 로그에서 `oil_ingest`가 실행되었는지 본다.
2. `oil_price_series` 최신 `price_date`, `symbol`, `source`를 확인한다.
3. EIA 데이터가 원천에서 늦는지 확인한다.
4. EIA가 늦으면 Yahoo futures fallback이 저장되는지 확인한다.
5. 휘발유는 `gasoline_prices` 최신 `price_date`와 national row를 확인한다.

### 11.7 위험 지수가 이상하다

확인 순서:

1. `risk_score_history` 최신 row의 `vessel_score`, `geo_score`, `brent_score`, `vix_score`, `geo_raw`를 확인한다.
2. `situation_summaries.geo_score` 최신값을 확인한다.
3. `chokepoint_transits` 최신 7일 총 통행량을 확인한다.
4. 최근 24시간 `vessels_normalized` 기준 AIS 방향 카운트를 확인한다.
5. 현재 운영 기준에서는 AIS 방향값 0/0을 봉쇄 신호로 보고 방향 기반 통행 점수에 반영한다.

### 11.8 시장 차트가 비거나 밀린다

확인 순서:

1. `market_intraday`에 최근 10일 데이터가 있는지 확인한다.
2. `market_ohlcv`에 최근 90일 데이터가 있는지 확인한다.
3. `hormuz-market-ingest`가 5분마다 성공하는지 확인한다.
4. 일봉은 거래소별 target hour 이후 하루 1번만 갱신된다.
5. 차트 이동 제한은 `MarketCustomChart.tsx`의 `clampLogicalRange()`가 담당한다.

## 12. 데이터 보관 정책

현재 `backend/jobs/data_cleanup.py` 기준:

| 대상 | 보관 기간 |
| --- | ---: |
| `situation_summaries` | 10일 |
| `events` | 10일, 단 `is_manual = false`만 삭제 |
| `trump_posts` | 10일 |
| `event_article_summaries` | 10일 |
| `risk_score_history` | 40일 |
| `market_intraday` | 14일 |
| `market_ohlcv` | 100일 |

주의:

- 기사 요약 팝업은 논의상 2일 보관을 생각했지만, 현재 코드는 10일 보관이다.
- 2일 보관으로 바꾸려면 `event_article_summaries`만 별도 cutoff를 적용해야 한다.

## 13. 수정/배포 체크리스트

코드 수정 전:

- 변경 범위를 명확히 정한다.
- env 파일을 열거나 출력하지 않는다.
- 사용자가 요청하지 않은 리팩터링은 하지 않는다.

로컬 검증:

```bash
cd frontend
npm run build
```

필요 시 백엔드 import/잡 실행 검증:

```bash
cd backend
python -m jobs.summary_rebuild
```

커밋:

- 커밋 메시지는 한국어로 작성한다.
- 예: `기사 요약 팝업과 AIS 저장 안정화`

푸시:

- 사용자의 명시적 허가를 받은 뒤 `develop`에 push한다.
- Render가 main을 보고 있으면 사용자가 develop을 main에 merge한다.
- Render는 경우에 따라 Manual Sync만으로 부족하고 Manual Build가 필요할 수 있다.

배포 후:

- Vercel 배포 상태 확인
- Render service/cron 최신 빌드 확인
- Supabase 최신 row 확인
- 실제 페이지에서 한/영 표시 확인

## 14. 앞으로 정리할 일

우선순위 후보:

1. `event_article_summaries` 보관 기간을 의도대로 2일로 바꿀지 결정.
2. 상황 요약 하이라이트 후보 추출을 규칙 기반에서 AI 보조 방식으로 고도화할지 결정.
3. 운영용 SQL 점검 쿼리 모음 추가.
4. Render 크론별 정상 로그 예시 추가.
5. 장애 대응용 `tmp_test` 스크립트 목록 정리.

README는 공개용으로 이미 간결하게 정리되어 있다. README에는 내부 운영 세부사항과 장애 대응 전체를 넣지 않고, 공개 가능한 프로젝트 소개와 핵심 구조만 유지한다.
