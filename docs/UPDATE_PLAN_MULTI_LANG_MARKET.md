# 호르무즈 모니터 글로벌 확장 및 기능 고도화 실행 계획서 (Master Update Plan)

이 문서는 Hormuz Monitor 프로젝트를 14개 언어로 글로벌 확장하고, 5개 신규 시장 지표를 추가하며, 호르무즈 위험 지수 기능(2개월 전 비교 및 1년 데이터 보관)을 고도화하기 위한 디테일한 작업 가이드라인 및 진행 상태 추적 문서다. 

작업이 중단되더라도 언제든지 `[ ]` 체크박스 현황을 확인하고 이어서 안전하게 개발을 재개할 수 있도록 작성되었다.

---

## 1. 사전 결정 및 충돌 예방 가이드라인 (Pre-Alignment Decisions)

작업 시작 전 다음 규칙을 엄격히 준수하여 코드 충돌, 인프라 부하, AI 토큰 낭비를 방지한다.

### 1.1 언어 코드 표준화 (ISO-639-1 / IETF BCP 47)
프로젝트 전반(Next.js routing, i18n JSON, DB locale 컬럼, API 파라미터)에서 아래 표의 **표준 Locale 코드**를 고정하여 사용한다.

| 번호 | 언어명 (한글) | Native Name | Locale Code | 방향 (Direction) |
| :-: | :--- | :--- | :-: | :-: |
| 1 | 한국어 | 한국어 | `ko` | LTR |
| 2 | 영어 | English | `en` | LTR (기본값) |
| 3 | 현대 표준 아랍어 | العربية | `ar` | **RTL** |
| 4 | 페르시아어 | فارسی | `fa` | **RTL** |
| 5 | 일본어 | 日本語 | `ja` | LTR |
| 6 | 스페인어 | Español | `es` | LTR |
| 7 | 터키어 | Türkçe | `tr` | LTR |
| 8 | 독일어 | Deutsch | `de` | LTR |
| 9 | 프랑스어 | Français | `fr` | LTR |
| 10 | 브라질 포르투갈어 | Português (Brasil) | `pt-BR` | LTR |
| 11 | 이탈리아어 | Italiano | `it` | LTR |
| 12 | 중국어 간체 | 简体中文 | `zh-CN` | LTR |
| 13 | 중국어 번체 | 繁體中文 | `zh-TW` | LTR |
| 14 | 러시아어 | Русский | `ru` | LTR |

### 1.2 접속 언어 자동 감지 및 Fallback 규칙
1. **감지 순서**: 접속자의 브라우저/기기 설정 언어 (`navigator.language` / HTTP `Accept-Language`) $\rightarrow$ URL locale prefix.
2. **매칭 규칙**:
   - 기기 언어가 14개 지원 목록에 포함되면 해당 `/locale` 경로로 자동 라우팅.
   - 예: 브라우저 언어가 `ja-JP` $\rightarrow$ `/ja`, `pt-BR` $\rightarrow$ `/pt-BR`, `ar-SA` $\rightarrow$ `/ar`.
3. **Fallback 정책 (필수)**:
   - 기기 언어가 14개 지원 목록에 **없는 언어**(예: 힌디어 `hi`, 태국어 `th`, 베트남어 `vi` 등)인 경우 **무조건 기본값인 영어(`/en`)로 리다이렉트/표시**.
   - `next-intl` 라우팅 설정에서 `defaultLocale: "en"` 및 fallback matcher를 적용한다.

### 1.3 UI 언어 선택 메뉴 (내림목록 드롭다운)
- 기존 Header/Footer/Mobile Menu의 2개 버튼(`KO | EN`)을 제거한다.
- 14개 언어를 지원하는 **통합 언어 셀렉트 드롭다운(Dropdown Menu)** 컴포넌트(`LanguageSelect.tsx`)를 구현한다.
- 드롭다운 항목에는 각 언어의 **Native Name**(예: `العربية`, `فارسی`, `Español`)을 표시하여 사용자가 쉽게 자기 언어를 찾을 수 있게 한다.

### 1.4 Render 크론 작업 (Cron Jobs) 절대 동결 규칙
- **CRITICAL**: Render 서비스/크론 개수를 더 이상 늘리지 않는다 (기존 6개 크론 유지).
- 신규 5개 시장 지표 수집 $\rightarrow$ 기존 `hormuz-market-ingest` 잡에 수집 심볼만 추가.
- 위험 지수 1년 보관 data cleanup $\rightarrow$ 기존 `hormuz-daily-maintenance` 잡 내부 retention 파라미터만 수정.

### 1.5 Git 브랜치 전략, 커밋/푸시 및 머지 규칙 (Git Workflow & Release Rules)
1. **브랜치 생성 기준**:
   - 모든 작업은 반드시 `develop` 브랜치로부터 작업 브랜치(예: `feature/global-expansion`, `feature/market-5-symbols` 등)를 생성하여 진행한다.
   - `main` 브랜치에서 직접 작업을 시작하거나 직접 커밋하는 행위를 엄격히 금지한다.
2. **커밋 메시지 작성 표준**:
   - 커밋 제목과 설명글은 **반드시 한국어(한글)**로 작성한다.
   - 한 번에 커밋하지 않고, **기능별 또는 논리적 그룹별**로 명확히 분리하여 커밋한다 (예: `기능: 14개 언어 선택 셀렉트 드롭다운 컴포넌트 추가`, `기능: yfinance 수집기에 5개 신규 심볼 추가`).
   - 커밋 설명글에는 수정 이유, 세부 변경 내용, 영향 범위를 상세히 기록한다.
3. **푸시(Push) 및 `develop` 머지 정책**:
   - 진행 중인 작업 브랜치로의 `git push`는 코드 백업 및 이력 관리를 위해 **자주 수행해도 무방**하다.
   - `develop` 브랜치로의 머지(Merge): 해당 기능 작업 및 검증이 **완전히 마무리되어 정상 작동을 확인했을 때만** `develop`에 merge를 진행한다. 미완성 상태의 코드는 절대로 `develop`에 merge하지 않는다.
4. **`main` 브랜치 머지 엄금 및 운영자 직접 수행 규칙 (CRITICAL)**:
   - **AI 에이전트는 어떠한 경우에도 `main` 브랜치로의 merge를 직접 실행하지 않는다.**
   - `main` 브랜치로의 최종 merge는 모든 개발 단계가 마감되고 전체 검토를 마친 후, **사용자(운영자)가 재차 검토를 거쳐 직접 수행**한다.

### 1.6 임시 테스트 샌드박스 디렉토리 (`tmp_test/`) 사용 규칙
- **경로**: `Hormuz_Mornitor/tmp_test/`
- **용도**: 신규 5개 시장 심볼 `yfinance` 수집 시뮬레이션, i18n JSON 파일 파싱 검증, 14개 라우트 렌더링 등 임시 실험용 코드 및 데이터 파일 공간.
- **운영 원칙**: `tmp_test/` 디렉토리 내의 파일은 언제든지 삭제 가능한 임시 공간이며, 실험 및 검증 용도로 자유롭게 파일 생성 및 테스트를 진행한다.

### 1.7 에이전트 자산 통합 관리 (`agent/` 디렉토리)
프로젝트 루트 하위에 `agent/` 디렉토리를 신설하여 작업에 필요한 서브에이전트, 커스텀 스킬, 자동화 검증 훅 스크립트를 통합 관리한다.
- `agent/subagents/`: 서브에이전트 역할 및 시스템 프롬프트 정의
- `agent/skills/`: 다국어/RTL/Supabase/시장지표 전용 커스텀 스킬 문서 (`.md`)
- `agent/hooks/`: SSG 14개 locale 빌드 및 RTL 구문 자동 검사 훅 스크립트
- `agent/README.md`: 에이전트 자산 활용 안내서

---

## 2. 전체 작업 단계 및 진행 상태 체크리스트 (Progress Tracking Checklist)

터미널 작업 중단 및 재개 시 아래 체크박스의 `[ ]` / `[x]` 상태를 보고 작업 위치를 파악한다.

- [x] **Phase 1: Supabase DB 마이그레이션 및 권한 설정**
  - [x] 1.1 `situation_summary_translations` 캐시 테이블 생성 SQL 실행
  - [x] 1.2 Data API Grant 및 RLS 정책 적용 (`anon`, `authenticated`, `service_role`)
  - [x] 1.3 `database/schema_final.sql` 파일에 신규 DDL 내역 동기화

- [x] **Phase 2: 14개 다국어 라우팅, UI 드롭다운 및 RTL 환경 구축**
  - [x] 2.1 `frontend/src/i18n/routing.ts` 14개 locale 선언 및 `defaultLocale: "en"` 설정
  - [x] 2.2 `frontend/src/i18n/` 하위에 14개 언어별 번역 JSON 파일 5개씩 생성 (`common`, `dashboard`, `events`, `about`, `sources`)
  - [x] 2.3 `frontend/src/i18n/request.ts` 다국어 동적 메시지 로더 업데이트
  - [x] 2.4 기기 언어 감지 및 미지원 언어의 `/en` Fallback 라우팅 미들웨어 검증
  - [x] 2.5 Header, Footer, 모바일 메뉴용 14개 언어 셀렉트 드롭다운 컴포넌트(`LanguageSelect.tsx`) 구현
  - [x] 2.6 아랍어(`ar`), 페르시아어(`fa`) RTL 지원 설정 (`<html dir="rtl">`, Tailwind CSS Logical Properties 적용)

- [x] **Phase 3: AI 토큰 효율화 및 온디맨드 번역 캐싱 파이프라인**
  - [x] 3.1 `backend/services/situation_translation_service.py` 온디맨드 AI 번역기 개발
  - [x] 3.2 `backend/services/event_article_summary_service.py` 14개 locale 지원 확충
  - [x] 3.3 백엔드 API `/summary/translate` 및 `/events/{id}/summary` 14개 언어 파라미터 처리
  - [x] 3.4 Gemini 프롬프트 최적화 및 `max_output_tokens` 제한을 통한 토큰 절감 적용

- [x] **Phase 4: 신규 시장 지표 5종 수집 및 차트 UI 그룹화**
  - [x] 4.1 `backend/collectors/market/yfinance_collector.py`에 5개 신규 심볼 추가 (`^STOXX`, `^N225`, `^HSI`, `000001.SS`, `^TNX`)
  - [x] 4.2 `pandas_market_calendars` 해외 거래소(`TSE`, `HKEX`, `SSE`) 캘린더 등록
  - [x] 4.3 `frontend/src/lib/api/dashboard.ts` 16개 심볼 조회 쿼리 업데이트
  - [x] 4.4 `MarketCustomChart.tsx` UI 시장 현황 탭 카테고리 그룹화 및 국채금리 단위(`%`) 특수 수치 포맷팅

- [x] **Phase 5: 호르무즈 위험 지수 '2개월 전' 비교 & 1년 데이터 보관 연장**
  - [x] 5.1 `backend/jobs/data_cleanup.py` `risk_score_history` 삭제 기간 40일 $\rightarrow$ 365일(1년)로 변경
  - [x] 5.2 `frontend/src/lib/api/dashboard.ts` `fetchRiskScoreHistory()` 조회 기간 65일 이상으로 연장
  - [x] 5.3 `HormuzRiskGauge.tsx` UI 카드에 '2개월 전(60일 전)' 위험 지수 비교 지표 및 트렌드 표시

- [x] **Phase 6: 최종 빌드 검증, 배포 및 문서화**
  - [x] 6.1 프론트엔드 `npm run build` 14개 locale SSG/ISR static parameters 정상 빌드 검증
  - [x] 6.2 14개 언어 라우팅, 드롭다운, RTL 화면, 차트 렌더링 수동 QA
  - [x] 6.3 `PROJECT_GUIDE.md` 및 `FEATURE_RECIPES.md` 문서에 14개 언어 및 신규 기능 반영
  - [x] 6.4 작업 완료 및 검증 후 작업 브랜치를 `develop` 브랜치에 merge
  - [ ] 6.5 (운영자 직접 수행) 전체 작업 완료 확인 후 `develop` $\rightarrow$ `main` 최종 머지 및 프로덕션 배포

---

## 3. 14개 다국어 시스템 & 라우팅 & UI/RTL 설계

### 3.1 라우팅 & Fallback 정책 (`frontend/src/i18n/routing.ts`)

```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: [
    "en", "ko", "ar", "fa", "ja", "es", "tr",
    "de", "fr", "pt-BR", "it", "zh-CN", "zh-TW", "ru"
  ],
  defaultLocale: "en",
  localePrefix: "always",
});
```

### 3.2 RTL (Right-to-Left) 레이아웃 대응 (아랍어 `ar`, 페르시아어 `fa`)
1. **Root Layout 설정**: `getLocale()`이 `ar` 또는 `fa`일 경우 `<html dir="rtl">`을 주입한다.
2. **Tailwind CSS Logical Properties 전환**:
   - `ml-4` $\rightarrow$ `ms-4` (margin-inline-start)
   - `mr-4` $\rightarrow$ `me-4` (margin-inline-end)
   - `pl-4` $\rightarrow$ `ps-4` (padding-inline-start)
   - `pr-4` $\rightarrow$ `pe-4` (padding-inline-end)
   - `text-left` $\rightarrow$ `text-start`, `text-right` $\rightarrow$ `text-end`
3. **아이콘 및 차트 예외 처리**: 방향성 아이콘(화살표 등)이나 시계열 차트 x축은 필요 시 `rtl:rotate-180` 또는 LTR 고정 처리를 둔다.

---

## 4. AI 토큰 효율화 및 온디맨드 번역 캐싱 구조

### 4.1 토큰 비용 폭증 방지 전략 (핵심)
- **크론 사전 생성 금지**: 1시간마다 크론 잡에서 14개 언어로 Gemini를 각각 호출하여 상황 요약을 만드는 방식은 Gemini API 쿼터를 고갈시키고 Render 타임아웃을 유발한다.
- **온디맨드 번역 + Supabase 캐싱 (On-Demand Translation with DB Cache)**:
  1. 크론은 기존처럼 한국어/영어(또는 영어 1개) 기준 상황 요약만 생성한다.
  2. 사용자가 `ja`, `ar`, `es` 등 12개 신규 언어로 대시보드에 접속하면, 프론트엔드/API가 `situation_summary_translations` 캐시 테이블을 조회한다.
  3. **캐시 Hit**: DB에 저장된 번역 텍스트와 structured JSON을 즉시 반환 (AI 비용 0원, 0.05초 응답).
  4. **캐시 Miss**: 백엔드가 Gemini API를 호출하여 해당 언어로 1회 번역 및 structured JSON 정규화 후 DB에 캐시 저장 (이후 접속자는 AI 호출 0회).

---

## 5. 시장 지표 5종 확장 및 차트/UI 설계

### 5.1 신규 추가 5개 지표 정의

| 지표명 | yfinance Ticker | Exchange | 구분 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **STOXX Europe 600** | `^STOXX` | `STOXX` | 유럽 대표 지수 | 캘린더 등록 필요 |
| **Nikkei 225** | `^N225` | `TSE` (도쿄) | 아시아 대표 지수 | `mcal.get_calendar('XTKS')` |
| **Hang Seng Index** | `^HSI` | `HKEX` (홍콩) | 아시아 대표 지수 | `mcal.get_calendar('XHKG')` |
| **Shanghai Composite** | `000001.SS` | `SSE` (상하이) | 아시아 대표 지수 | `mcal.get_calendar('XSHG')` |
| **US 10-Yr Treasury** | `^TNX` | `CME` | 미 국채 수익률 | 단위 `%`, 차트 표기 특수화 |

### 5.2 UI 그룹화 카테고리 설계
16개 심볼을 4개 탭/그룹으로 분류하여 대시보드 스위치 UI를 개선한다.
1. **미국 주요 지수**: S&P500, NASDAQ, VIX
2. **글로벌 주요 지수**: KOSPI, KOSDAQ, Nikkei 225, Hang Seng, Shanghai Composite, STOXX Europe 600
3. **원자재 및 선물**: WTI, Brent, ES 선물, NQ 선물, 금 선물, 휘발유 선물, 난방유 선물, 달러 인덱스
4. **채권 금리**: 미국 10년물 국채금리 (`^TNX`)

---

## 6. 호르무즈 위험 지수 '2개월 전' 비교 & 1년 데이터 보관 연장

### 6.1 `data_cleanup.py` 보관 기간 수정

```python
# 기존 40일 삭제 기준 -> 365일(1년) 기준으로 변경
cutoff_365 = (datetime.now(timezone.utc) - timedelta(days=365)).date().isoformat()

targets = [
    ("situation_summaries",     "generated_at", cutoff),
    ("events",                  "published_at", cutoff),
    ("trump_posts",             "post_date",    cutoff_date),
    ("event_article_summaries", "created_at",   cutoff),
    ("risk_score_history",      "score_date",   cutoff_365), # 1년 보관 (약 1.5MB 소요)
    ("market_intraday",         "recorded_at",  cutoff_intraday),
    ("market_ohlcv",            "price_date",   cutoff_ohlcv),
]
```

### 6.2 위험 지수 게이지 카드 UI 60일 전 비교
- `fetchRiskScoreHistory()`로 최근 65일치 기록 조회.
- 현재 위험 지수(Score)와 **60일 전(2개월 전) 동일 날짜의 위험 지수**를 비교하여 변동폭(`+5` / `-12`) 및 추이 아이콘 표시.

---

## 7. Supabase DB 마이그레이션 SQL 스크립트

아래 SQL을 Supabase SQL Editor에서 실행하여 다국어 온디맨드 캐시 테이블을 생성하고 Data API 권한을 부여한다.

```sql
-- 1. situation_summary_translations 테이블 생성
create table if not exists public.situation_summary_translations (
  id bigserial primary key,
  summary_id bigint not null references public.situation_summaries(id) on delete cascade,
  locale text not null,
  summary_text text not null,
  summary_structured jsonb,
  created_at timestamptz not null default now(),
  constraint summary_trans_unique unique (summary_id, locale)
);

-- 인덱스 생성
create index if not exists idx_situation_trans_summary_locale 
  on public.situation_summary_translations(summary_id, locale);

-- 2. RLS 활성화
alter table public.situation_summary_translations enable row level security;

-- 3. RLS Policy (anon public read)
create policy "Allow anon public read on situation_summary_translations"
  on public.situation_summary_translations for select
  using (true);

-- 4. Data API 명시적 GRANT (2026 Supabase 보안 기준)
grant select on public.situation_summary_translations to anon, authenticated;
grant select, insert, update, delete on public.situation_summary_translations to service_role;
grant usage, select on sequence public.situation_summary_translations_id_seq to service_role;
```

---

## 8. Render 크론 작업 및 인프라 운용 규칙

1. **신규 크론 생성 절대 금지**: 기존 `render.yaml` 스케줄 서비스 6개를 그대로 유지한다.
2. **API 도메인 및 프론트엔드 환경변수**:
   - `Vercel`: `NEXT_PUBLIC_API_BASE_URL=https://hormuz-api-v0ee.onrender.com`
   - `Render`: `ARTICLE_SUMMARY_MODELS=models/gemini-3.1-flash-lite,models/gemini-2.5-flash`

---

## 9. 리스크 관리 및 사전에 주의해야 할 체크리스트

1. **React Hydration Mismatch 주의**:
   - 14개 언어 지원 시 접속자의 기기 시각/시간대 및 브라우저 라우팅 판단이 서버/클라이언트 단계에서 불일치하지 않도록, 시각 표시 및 언어 변환은 hydration 완결 후 적용한다.
2. **yfinance 수집 실패 및 휴장일 예외 방어**:
   - 신규 해외 지수(`Nikkei`, `Hang Seng`, `Shanghai`)는 시차가 크고 국경일 휴장이 다르다. `yfinance` 수집 시 `empty` DataFrame 응답이 오더라도 크론 전체가 멈추지 않도록 `try-except`로 단일 심볼 실패를 감싸서 건너뛴다.
3. **Vercel SSG/ISR 빌드 수량 증가**:
   - 14개 locale $\times$ 4개 페이지 = 56개 static page 파라미터가 정적 생성된다. `generateStaticParams`와 `setRequestLocale(locale)`이 빠짐없이 모든 `app/[locale]` 하위 페이지/레이아웃에 적용되었는지 확인한다 (`● SSG`, `Revalidate 1m` 확인 필수).

---
*이 계획서는 기능 개발 진행 중 언제든지 참조할 수 있으며, 각 단계가 완료될 때마다 체크박스 `[ ]`를 `[x]`로 갱신합니다.*
