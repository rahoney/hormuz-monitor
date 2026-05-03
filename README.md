# Hormuz Monitor

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=111111)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white)

## 프로젝트 소개

Hormuz Monitor는 호르무즈 해협 주변의 긴장 상황과 공급망 리스크를 빠르게 확인하기 위한 대시보드입니다. 선박 흐름, 에너지 가격, 시장 지표, 관련 이슈, 정치적 발언을 한 화면에 모아 현재 상황을 파악할 수 있도록 구성했습니다.

서비스는 한국어와 영어를 지원하며, 접속 환경과 선택 언어에 따라 대시보드 문구, 요약, 공유 콘텐츠가 현지화됩니다.

## 주요 기능

- 호르무즈 해협 관련 상황 요약
- 선박 흐름, 지정학 긴장도, 에너지 가격, 시장 변동성을 반영한 위험 지수
- 7일 평균 통행량과 24시간 AIS 추정 방향 통계
- 해협 지도, 통행 흐름, 유가, 휘발유 가격, 시장 현황 모니터링
- 관련 이슈 기사 목록과 요약 팝업
- 주요 정치 발언 모니터링과 번역
- 모바일 환경을 위한 고정형 섹션 이동 메뉴
- 한국어 및 영어 다국어 지원

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| Database | Supabase PostgreSQL |
| Infrastructure | Vercel, Render, Cloudflare |
| AI | Google Generative Language API |
| Analytics | Google Analytics |

## 서비스 구조 한눈에 보기

```text
사용자
  |
  v
Cloudflare
  |
  v
Vercel Frontend
  |
  |-- 대시보드 데이터 조회
  |-- 기사 요약 API 호출
  |
  v
Supabase PostgreSQL
  ^
  |
Render Backend / Scheduled Jobs
  |-- 시장 및 에너지 지표 수집
  |-- 선박 통행 데이터 처리
  |-- 관련 이슈와 정치 발언 수집
  |-- 상황 요약과 위험 지수 생성
  |-- 오래된 임시 데이터 정리
```
