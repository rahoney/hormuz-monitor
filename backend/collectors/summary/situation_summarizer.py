"""Gemini를 이용해 호르무즈 상황 요약을 생성한다."""
from datetime import datetime, timezone, timedelta
from typing import Any

from dotenv import load_dotenv

from db.select import fetch
from utils.gemini_client import GeminiError, generate_text, summary_models
from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

# 미국 동부 기준 pre-market~after-hours: UTC 08:00~01:00 (weekday)
# UTC 01:00~08:00 구간(심야)에는 시장 데이터 미포함
_MARKET_EXCLUDED_UTC_HOURS = set(range(1, 8))

_EN_SOURCES = {"BBC Middle East", "Anadolu Agency", "NYT Middle East",
               "CNBC Energy", "CNBC World", "CNBC Asia"}
_MIN_KO_SUMMARY_CHARS = 150
_KO_REQUIRED_LABELS = (
    "- 핵심 상황:",
    "- 군사·외교 움직임:",
    "- 시장 반응:",
    "- 전망 및 관찰 포인트:",
)
_EN_REQUIRED_LABELS = (
    "- Core situation:",
    "- Military and diplomatic moves:",
    "- Market reaction:",
    "- Outlook and watch points:",
)

_KO_SECTION_TITLES = ("핵심 상황", "군사·외교 움직임", "시장 반응", "전망 및 관찰 포인트")
_EN_SECTION_TITLES = ("Core situation", "Military and diplomatic moves", "Market reaction", "Outlook and watch points")
_ALLOWED_HIGHLIGHT_TONES = {"risk", "market", "watch"}


def _is_market_session() -> bool:
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:  # 토·일
        return False
    return now.hour not in _MARKET_EXCLUDED_UTC_HOURS


def _fetch_recent_events(hours: int = 24) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    rows = fetch(
        "events",
        columns="title,source_name,published_at",
        filters={"published_at": f"gte.{since}"},
        order="published_at.desc",
        limit=20,
    )
    return [r for r in rows if r.get("source_name") in _EN_SOURCES]


def _fetch_trump_posts(hours: int = 24) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).date().isoformat()
    return fetch(
        "trump_posts",
        columns="content,post_date",
        filters={"post_date": f"gte.{since}"},
        order="post_date.desc",
        limit=10,
    )


def _fetch_oil() -> dict[str, float | None]:
    result: dict[str, float | None] = {"WTI": None, "BRENT": None}
    for sym in ("WTI", "BRENT"):
        rows = fetch("oil_price_series", columns="price_usd",
                     filters={"symbol": f"eq.{sym}"},
                     order="price_date.desc", limit=1)
        if rows:
            result[sym] = rows[0].get("price_usd")
    return result


def _fetch_gasoline() -> float | None:
    rows = fetch(
        "gasoline_prices",
        columns="price_usd",
        filters={"area_code": "eq.US", "area_type": "eq.national"},
        order="price_date.desc",
        limit=1,
    )
    if not rows:
        # area_type 컬럼 없는 경우 fallback
        rows = fetch("gasoline_prices", columns="price_usd,area_type",
                     order="price_date.desc", limit=5)
        national = [r for r in rows if r.get("area_type") == "national"]
        rows = national[:1]
    return rows[0].get("price_usd") if rows else None


def _fetch_market() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for sym in ("SP500", "NASDAQ", "VIX"):
        rows = fetch("market_snapshots", columns="price,change_pct",
                     filters={"symbol": f"eq.{sym}"},
                     order="snapshot_date.desc", limit=1)
        if rows:
            result[sym] = rows[0]
    return result


def _build_prompt(events: list, trump: list, oil: dict,
                  gasoline: float | None, market: dict) -> str:
    news_block = "\n".join(
        f"- [{r['source_name']}] {r['title']}" for r in events
    ) or "(no recent headlines)"

    trump_block = "\n".join(
        f"- {r['content'][:200]}" for r in trump
    ) or "(no recent posts)"

    wti_str = f"${oil['WTI']:.2f}/bbl" if oil.get("WTI") else "N/A"
    brent_str = f"${oil['BRENT']:.2f}/bbl" if oil.get("BRENT") else "N/A"
    gas_str = f"${gasoline:.3f}/gal" if gasoline else "N/A"

    market_block = ""
    if _is_market_session() and market:
        parts = []
        for sym, label in (("SP500", "S&P500"), ("NASDAQ", "NASDAQ"), ("VIX", "VIX")):
            if sym in market:
                p = market[sym].get("price", "")
                c = market[sym].get("change_pct")
                chg = f" ({c:+.2f}%)" if c is not None else ""
                parts.append(f"{label}: {p}{chg}")
        if parts:
            market_block = "\n[Market Indices (live session)]\n" + " | ".join(parts)

    return f"""You are a concise analyst for the Hormuz Monitor dashboard.

주어진 데이터를 바탕으로 한국어 요약을 먼저 작성하라.
한국어 요약은 내용이 간단하더라도 최소 150자 이상으로 작성하고, 내용이 다양하거나 추가 설명이 필요한 경우에는 700자 이내에서 충분히 작성하라. 이 글자 수 기준은 한국어 요약문에만 적용한다. 150자는 최소 기준일 뿐이며, 가능한 한 짧게 쓰라는 의미가 아니다. 핵심 내용, 배경, 주요 수치, 관련 주체, 영향 또는 전망 등 중요한 정보는 글자 수를 줄이기 위해 과도하게 생략하지 말라.
- FOCUS: US-Iran war/negotiations and Trump's statements are the PRIMARY topic. Oil prices and market indices are SECONDARY.

한국어 요약문은 별도 제목 없이 아래 4개 항목명만 정확히 사용하라. 각 항목은 "- 항목명:" 형식의 1단계 하이픈 불릿으로 시작하고, 본문 내용은 항목명 바로 뒤에 쓰지 말고 반드시 다음 줄부터 2~3문장으로 작성하라. 항목 사이에는 빈 줄 하나만 둔다.
- 핵심 상황:
최근 업데이트에서 확인된 가장 중요한 변화와 현재 긴장 수준을 정리한다.
- 군사·외교 움직임:
미국, 이란, 주변국, 국제기구의 군사 움직임, 외교 접촉, 압박, 협상 관련 내용을 정리한다.
- 시장 반응:
유가, 증시, 변동성, 에너지 공급 우려 등 시장이 어떻게 반응하는지 정리한다.
- 전망 및 관찰 포인트:
현재 근거를 바탕으로 가능한 흐름과 앞으로 확인해야 할 변수를 신중하게 정리하되, 확정되지 않은 사건을 사실처럼 단정하지 않는다.

요약문 본문 안에서는 위 4개 항목의 1단계 하이픈 불릿 외에 다른 Markdown 문법을 사용하지 말라. 특히 ###, ##, #, *, **, 번호 목록, 추가 불릿, 중첩 불릿을 쓰지 말라. "호르무즈 해협 지정학적 상황 요약" 같은 별도 제목을 절대 만들지 말라.

그다음, 작성한 한국어 요약문을 내용 누락, 추가, 변형 없이 영어로 정확히 번역하라. 영어 번역은 한국어 요약문의 의미와 구조를 가능한 한 그대로 유지하되, 영어로 자연스럽게 읽히도록 작성하라. 영어 항목명은 아래 4개만 정확히 사용하라.
- Core situation:
- Military and diplomatic moves:
- Market reaction:
- Outlook and watch points:

마지막으로, 현재 호르무즈 해협의 지정학적 긴장도를 나타내는 SCORE(정수 1~30)를 산출하라.
- 1~7 = Safe (peace agreement, strait open, ceasefire holding, normalization confirmed)
- 8~15 = Caution (negotiations ongoing, talks in progress, ceasefire active but unresolved)
- 16~22 = Warning (diplomatic breakdown, negotiations failed/suspended, escalating threats, sanctions increased)
- 23~30 = Danger (military action imminent or underway, attack/seizure/blockade occurring or just confirmed)

Output ONLY these three sections, nothing else. The summaries can be multi-line:
### KO
[Korean summary using the four fixed bullet labels, with content starting on the next line after each label]
### EN
[English summary using the four fixed bullet labels, with content starting on the next line after each label]
### SCORE
[integer 1-30]

[Recent News Headlines (last 24h)]
{news_block}

[Trump Recent Posts (last 24h)]
{trump_block}

[Oil Prices]
WTI: {wti_str} | Brent: {brent_str}

[US Gasoline (national avg)]
{gas_str}
{market_block}"""


def _parse_summary_sections(text: str, labels: tuple[str, ...], titles: tuple[str, ...]) -> list[dict[str, Any]] | None:
    sections: list[dict[str, Any]] = []
    for idx, label in enumerate(labels):
        start = text.find(label)
        if start < 0:
            return None
        body_start = start + len(label)
        next_start = text.find(labels[idx + 1], body_start) if idx + 1 < len(labels) else len(text)
        body = text[body_start:next_start].strip()
        if not body:
            return None
        sections.append({"title": titles[idx], "body": body, "highlights": []})
    return sections


def _first_existing_match(body: str, patterns: tuple[str, ...]) -> str | None:
    import re

    for pattern in patterns:
        match = re.search(pattern, body, flags=re.IGNORECASE)
        if match:
            value = match.group(0).strip(" ,.;:()[]")
            if 4 <= len(value) <= 80 and value in body:
                return value
    return None


def _highlight_candidates(body: str, locale: str, section_title: str) -> list[dict[str, str]]:
    if locale == "ko":
        risk_patterns = (
            r"고립된 선박[^\n.。!?]{0,36}구출[^\n.。!?]{0,18}",
            r"(?:미국의\s*)?직접 개입 가능성",
            r"압박과 경고성 발언",
            r"군사(?:적)?\s*(?:충돌|행동|대응)(?:\s*가능성)?",
            r"확전(?:\s*(?:위험|가능성|방지))?",
            r"(?:봉쇄|공격|나포|위협)[^\n.。!?]{0,24}",
        )
        market_patterns = (
            r"유가[^\n.。!?]{0,44}(?:상회|상승|급등|하락|혼조)",
            r"공급 차질 우려",
            r"(?:브렌트|WTI|휘발유|VIX|증시|변동성)[^\n.。!?]{0,30}",
            r"(?:배럴당|달러)[^\n.。!?]{0,24}",
        )
        watch_patterns = (
            r"(?:실제 실행 조치|선박 통행 회복 여부|공식 발표|통행 데이터)",
            r"[^,\n.。!?]{0,18}(?:주시|확인|관찰)[^,\n.。!?]{0,18}",
            r"[^,\n.。!?]{0,18}(?:핵심 변수|관찰 포인트|변수)[^,\n.。!?]{0,18}",
        )
    else:
        risk_patterns = (
            r"rescu(?:e|ing)[^\n.?!]{0,48}(?:vessels|ships)[^\n.?!]{0,24}",
            r"(?:direct|military)\s+intervention(?:\s+risk|\s+possibility)?",
            r"pressure and warning(?:s| statements)?",
            r"military\s+(?:action|clash|response)(?:\s+risk|\s+possibility)?",
            r"(?:blockade|attack|seizure|threat)[^\n.?!]{0,32}",
        )
        market_patterns = (
            r"oil prices?[^\n.?!]{0,48}(?:above|rise|surge|fall|mixed)",
            r"supply disruption concerns?",
            r"(?:Brent|WTI|gasoline|VIX|stocks?|volatility)[^\n.?!]{0,36}",
            r"(?:per barrel|dollars?)[^\n.?!]{0,28}",
        )
        watch_patterns = (
            r"(?:actual implementation steps|vessel traffic recovery|official statements?|traffic data)",
            r"[^,\n.?!]{0,22}(?:watch|monitor|confirm|verify)[^,\n.?!]{0,22}",
            r"[^,\n.?!]{0,22}(?:key variable|watch point|variable)[^,\n.?!]{0,22}",
        )

    ordered: list[tuple[str, tuple[str, ...]]]
    if section_title in {"시장 반응", "Market reaction"}:
        ordered = [("market", market_patterns), ("risk", risk_patterns), ("watch", watch_patterns)]
    elif section_title in {"전망 및 관찰 포인트", "Outlook and watch points"}:
        ordered = [("watch", watch_patterns), ("risk", risk_patterns), ("market", market_patterns)]
    else:
        ordered = [("risk", risk_patterns), ("watch", watch_patterns), ("market", market_patterns)]

    highlights: list[dict[str, str]] = []
    used: set[str] = set()
    for tone, patterns in ordered:
        text = _first_existing_match(body, patterns)
        if text and text not in used:
            highlights.append({"text": text, "tone": tone})
            used.add(text)
        if len(highlights) >= 2:
            break
    return highlights


def _build_structured_summary(text: str, locale: str) -> dict[str, Any] | None:
    labels = _KO_REQUIRED_LABELS if locale == "ko" else _EN_REQUIRED_LABELS
    titles = _KO_SECTION_TITLES if locale == "ko" else _EN_SECTION_TITLES
    sections = _parse_summary_sections(text, labels, titles)
    if not sections:
        return None

    for section in sections:
        highlights = _highlight_candidates(section["body"], locale, section["title"])
        section["highlights"] = [
            item
            for item in highlights
            if item["tone"] in _ALLOWED_HIGHLIGHT_TONES and item["text"] in section["body"]
        ][:2]
    return {"version": 1, "sections": sections}


def generate() -> tuple[str, str, int | None, dict[str, Any] | None, dict[str, Any] | None] | None:
    """(summary_ko, summary_en, geo_score, structured_ko, structured_en) 반환. 실패 시 None."""
    events = _fetch_recent_events()
    trump = _fetch_trump_posts()
    oil = _fetch_oil()
    gasoline = _fetch_gasoline()
    market = _fetch_market() if _is_market_session() else {}

    prompt = _build_prompt(events, trump, oil, gasoline, market)

    def _parse_generated_text(text: str) -> tuple[str, str, int | None]:
        import re

        ko_match = re.search(r'###\s*\*?KO\b\*?:?(.*?)(?=###\s*\*?EN\b|\Z)', text, re.IGNORECASE | re.DOTALL)
        en_match = re.search(r'###\s*\*?EN\b\*?:?(.*?)(?=###\s*\*?SCORE\b|\Z)', text, re.IGNORECASE | re.DOTALL)
        score_match = re.search(r'###\s*\*?SCORE\b\*?:?\s*(\d+)', text, re.IGNORECASE)

        ko = ko_match.group(1).strip() if ko_match else ""
        en = en_match.group(1).strip() if en_match else ""

        geo_score = None
        if score_match:
            try:
                val = int(score_match.group(1))
                geo_score = max(1, min(30, val))
            except ValueError:
                pass

        return ko, en, geo_score

    def _normalize_summary_body(text: str, labels: tuple[str, ...]) -> str:
        import re

        normalized = text.replace("\r\n", "\n").replace("\r", "\n")
        normalized = normalized.replace("**", "").replace("__", "").replace("`", "")

        for label in labels:
            name = label[2:-1]
            pattern = re.compile(
                rf"(?m)^\s*(?:[-*]\s*)?(?:#+\s*)?{re.escape(name)}\s*:?\s*(.*)$"
            )

            def _replace_label(match: re.Match[str]) -> str:
                body = match.group(1).strip()
                return f"{label}\n{body}" if body else label

            normalized = pattern.sub(_replace_label, normalized)

        cleaned_lines: list[str] = []
        for line in normalized.splitlines():
            stripped = line.strip()
            title_like = stripped.lstrip("#").strip()
            if (
                title_like
                and ":" not in title_like
                and not any(title_like.startswith(label) for label in labels)
                and (
                    "상황 요약" in title_like
                    or "지정학적 상황" in title_like
                    or title_like.lower() in {"hormuz geopolitical situation summary", "hormuz situation summary"}
                )
            ):
                continue
            cleaned_lines.append(line.rstrip())

        normalized = "\n".join(cleaned_lines)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

    def _normalize_generated_text(text: str) -> tuple[str, str, int | None]:
        ko, en, geo_score = _parse_generated_text(text)
        return (
            _normalize_summary_body(ko, _KO_REQUIRED_LABELS),
            _normalize_summary_body(en, _EN_REQUIRED_LABELS),
            geo_score,
        )

    def _has_required_labels(text: str, labels: tuple[str, ...]) -> bool:
        return all(label in text for label in labels)

    def _has_disallowed_markdown(text: str) -> bool:
        import re

        return bool(
            "###" in text
            or re.search(r"(?m)^\s{0,3}#{1,6}\s+", text)
            or re.search(r"(?m)^\s*\*\s+", text)
            or re.search(r"(?m)^\s*\d+\.\s+", text)
            or "**" in text
        )

    def _has_only_allowed_bullets(text: str, labels: tuple[str, ...]) -> bool:
        import re

        bullet_lines = re.findall(r"(?m)^\s*-\s+[^:\n]+:", text)
        return bullet_lines == list(labels)

    def _has_label_body_newline(text: str, labels: tuple[str, ...]) -> bool:
        for label in labels:
            start = text.find(label)
            if start < 0:
                return False
            rest = text[start + len(label):]
            if not rest.startswith("\n"):
                return False
            first_body_line = rest.splitlines()[1].strip() if len(rest.splitlines()) > 1 else ""
            if not first_body_line or first_body_line.startswith("-"):
                return False
        return True

    def _valid_generated_text(text: str) -> bool:
        ko, en, geo_score = _normalize_generated_text(text)
        return (
            len(ko) >= _MIN_KO_SUMMARY_CHARS
            and bool(en)
            and geo_score is not None
            and _has_required_labels(ko, _KO_REQUIRED_LABELS)
            and _has_required_labels(en, _EN_REQUIRED_LABELS)
            and not _has_disallowed_markdown(ko)
            and not _has_disallowed_markdown(en)
            and _has_only_allowed_bullets(ko, _KO_REQUIRED_LABELS)
            and _has_only_allowed_bullets(en, _EN_REQUIRED_LABELS)
            and _has_label_body_newline(ko, _KO_REQUIRED_LABELS)
            and _has_label_body_newline(en, _EN_REQUIRED_LABELS)
        )

    try:
        result = generate_text(
            prompt,
            task="situation_summary",
            models=summary_models(),
            max_output_tokens=3072,
            temperature=0.3,
            timeout=30.0,
            validate_text=_valid_generated_text,
        )
        text = result.text
        logger.info("상황 요약 Gemini 모델: %s (%d attempts)", result.model, result.attempts)
    except GeminiError as exc:
        logger.error("상황 요약 Gemini 호출 실패: %s", exc)
        return None

    ko, en, geo_score = _normalize_generated_text(text)
    if not _valid_generated_text(text):
        logger.error(
            "상황 요약 검증 실패: ko=%d자 en=%d자 geo_score=%s labels_ko=%s labels_en=%s markdown_ko=%s markdown_en=%s bullets_ko=%s bullets_en=%s newline_ko=%s newline_en=%s",
            len(ko),
            len(en),
            geo_score,
            _has_required_labels(ko, _KO_REQUIRED_LABELS),
            _has_required_labels(en, _EN_REQUIRED_LABELS),
            _has_disallowed_markdown(ko),
            _has_disallowed_markdown(en),
            _has_only_allowed_bullets(ko, _KO_REQUIRED_LABELS),
            _has_only_allowed_bullets(en, _EN_REQUIRED_LABELS),
            _has_label_body_newline(ko, _KO_REQUIRED_LABELS),
            _has_label_body_newline(en, _EN_REQUIRED_LABELS),
        )
        return None
    return ko, en, geo_score, _build_structured_summary(ko, "ko"), _build_structured_summary(en, "en")
