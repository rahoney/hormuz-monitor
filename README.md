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

## Project Overview

Hormuz Monitor is a bilingual dashboard for monitoring disruption risk around the Strait of Hormuz during the U.S.-Iran conflict. It combines shipping movement, oil and fuel prices, market indicators, news events, and political signals into a single operational view.

The service is designed for quick situational awareness rather than long-form reporting. It is available in Korean and English, with localized dashboard text, summaries, and sharing content.

## Key Features

- Situation summary generated from recent news, Trump social posts, oil prices, fuel prices, and market indicators
- Hormuz Risk Index combining vessel movement, geopolitical tension, Brent crude, and VIX
- PortWatch-based 7-day average vessel transit metrics
- AIS-based 24-hour inland entry and offshore exit estimates
- Strait map embeds for vessel monitoring
- Transit flow, oil price, gasoline price, and market snapshot sections
- Related issue feed with article summary popup
- Trump social media feed with Korean translation
- Mobile dashboard section navigation with horizontal sticky jump bar
- Korean and English localization

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, next-intl |
| Charts and Maps | lightweight-charts, Recharts, MapLibre GL, TradingView widget |
| Backend | Python, FastAPI, Uvicorn |
| Data Collection | Render Cron Jobs, yfinance, feedparser, AISStream, EIA, PortWatch |
| Database | Supabase PostgreSQL |
| AI | Google Generative Language API, Gemini, Gemma |
| Hosting | Vercel, Render |
| Domain and Edge | Spaceship, Cloudflare |
| Analytics | Google Analytics |

## Service Architecture

```text
Users
  |
  v
Cloudflare
  |
  v
Vercel / Next.js Frontend
  |
  |-- Supabase public reads for dashboard data
  |-- Render FastAPI for on-demand article summaries
  |
  v
Supabase PostgreSQL
  ^
  |
Render Cron Jobs
  |-- Market data collection
  |-- Shipping and AIS collection
  |-- PortWatch transit ingestion
  |-- Oil and gasoline ingestion
  |-- News and social ingestion
  |-- Situation summary and risk score generation
```

Primary data sources include IMF PortWatch, AISStream, EIA, Yahoo Finance, RSS news feeds, Trump social posts, TradingView widgets, and Google Generative Language API.
