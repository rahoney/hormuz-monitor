# Hormuz Monitor

[![Language: 한국어](https://img.shields.io/badge/Language-한국어-blue)](README.md)
[![Language: English](https://img.shields.io/badge/Language-English-green)](README.en.md)

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=111111)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white)

## Project Overview

Hormuz Monitor is a real-time dashboard designed to quickly check geopolitical tension and supply chain risks around the Strait of Hormuz. It aggregates vessel traffic, energy prices, market indicators, related news, and political statements into a single interface for comprehensive situation awareness.

The service supports both Korean and English, automatically localizing dashboard labels, summaries, and shared content based on user language preferences and environment settings.

Live Website: [https://www.hrmz.today](https://www.hrmz.today)

<a href="https://www.hrmz.today">
  <img src="assets/readme/hormuz-monitor-og.png" alt="Hormuz Monitor Service Screen" width="260" />
</a>

## Key Screens

### Multilingual Mobile Dashboard

<table>
  <tr>
    <td width="50%">
      <img src="assets/readme/hormuz-monitor-mobile-ko.jpeg" alt="Korean mobile dashboard" />
    </td>
    <td width="50%">
      <img src="assets/readme/hormuz-monitor-mobile-en.jpeg" alt="English mobile dashboard" />
    </td>
  </tr>
</table>

Supports Korean and English, featuring a sticky top section navigation bar on mobile for quick access to key dashboard modules.

### AI Situation Summary & Risk Index

AI synthesizes US-Iran conflict developments, Strait of Hormuz tensions, and energy/market impacts into concise situation updates. The Risk Index combines vessel transit, geopolitical tension scores, crude oil prices, and market volatility to present the current risk level.

### Vessel Traffic, Energy & Market Indicators

<img src="assets/readme/hormuz-monitor-dashboard.jpeg" alt="Hormuz Monitor Dashboard Key Indicators" />

Includes a MarineTraffic-powered real-time map, vessel flow metrics, ship breakdown, and crude oil trends. Provides 5-minute and daily candlestick charts for WTI, Brent, Natural Gas, US Gasoline retail prices, Gold futures, Dollar Index, Gasoline futures, Heating Oil futures, VIX, and major US and Korean stock indices.

### Related News & Political Statements

<img src="assets/readme/hormuz-monitor-related-issues.jpeg" alt="Related Issues Screen" />

Aggregates related news articles with AI-generated summaries upon clicking. Provides Korean translations for English articles, as well as translated Trump Truth Social posts.

## Key Features

- Situation summary related to the Strait of Hormuz
- Risk Index incorporating vessel transit, geopolitical tension, energy prices, and market volatility
- 7-day average transit volume and 24-hour estimated AIS direction statistics
- Monitoring of Strait map, vessel flow, oil prices, gasoline prices, and market conditions
- Related news article feed with summary modal
- Political statement monitoring and translations
- Sticky top navigation menu tailored for mobile screens
- Multilingual support for Korean and English

## Tech Stack

| Domain | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI |
| Database | Supabase PostgreSQL |
| Infrastructure | Vercel, Render, Cloudflare |
| AI | Google Generative Language API |
| Analytics | Google Analytics |

## Architecture at a Glance

```text
User
  |
  v
Cloudflare
  |
  v
Vercel Frontend
  |
  |-- Fetch dashboard data
  |-- Call article summary API
  |
  v
Supabase PostgreSQL
  ^
  |
Render Backend / Scheduled Jobs
  |-- Collect market & energy indicators
  |-- Process vessel transit data
  |-- Collect related news & political statements
  |-- Generate situation summary & Risk Index
  |-- Clean up expired temporary data
```
