"""aisstream.io WebSocket에서 호르무즈 해협 선박 데이터를 수집한다.

현재 호르무즈 봉쇄 상태로 실제 AIS 데이터가 0건일 수 있음 — 정상 동작.
"""
import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Any
import websockets
from dotenv import load_dotenv

load_dotenv()

_API_KEY = os.getenv("AISSTREAM_API_KEY", "")

# 호르무즈 해협 핵심 바운딩 박스 [[minLat, minLon], [maxLat, maxLon]]
_BOUNDING_BOX = [[25.75, 55.75], [27.1, 57.45]]

# AIS 선종 코드 → 내부 레이블 매핑
_TYPE_MAP: dict[range, str] = {
    range(80, 90): "tanker",       # 80-89: tanker
}
_LNG_TYPES = {84, 85}             # 84: LNG tanker
_CRUDE_TYPES = {83, 84}           # 83: crude oil tanker

_TIMEOUT_SECONDS = 240


def _safe_float(val: Any) -> float | None:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _safe_int(val: Any) -> int | None:
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _parse_ais_timestamp(value: Any) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    raw = str(value).strip()
    try:
        if raw.endswith(" UTC"):
            raw = raw[:-4]
        parsed = datetime.strptime(raw[:32], "%Y-%m-%d %H:%M:%S.%f %z")
        return parsed.isoformat()
    except ValueError:
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


def _classify_ship(type_code: int | None) -> str:
    if type_code is None:
        return "unknown"
    if type_code in _LNG_TYPES:
        return "lng_tanker"
    if type_code in _CRUDE_TYPES:
        return "crude_tanker"
    for r, label in _TYPE_MAP.items():
        if type_code in r:
            return label
    return "other"


def _zone_status(lat: float, lng: float) -> str:
    if 55.75 <= lng <= 56.15 and 25.75 <= lat <= 27.1:
        return "inland_gate"
    if 56.15 <= lng <= 57.45 and 25.75 <= lat <= 26.0:
        return "offshore_gate"
    if 56.15 <= lng <= 57.45 and 26.0 <= lat <= 27.1:
        return "strait_core"
    return "outside_box"


def _direction_status(cog: float | None, zone: str) -> str:
    if cog is None:
        return "unknown"
    if cog < 10 or cog > 350:
        return "stationary"
    # COG 동쪽~남쪽(80~180) → 오만만/외해 방향
    if 80 <= cog <= 180:
        return "offshore_exit"
    # COG 서쪽~북서쪽(240~340) → 페르시아만/내해 방향
    if 240 <= cog <= 340:
        return "inland_entry"
    return "unknown"


async def _collect_async(max_vessels: int = 200) -> list[dict[str, Any]]:
    if not _API_KEY:
        raise RuntimeError("환경변수 누락: AISSTREAM_API_KEY")

    records: list[dict[str, Any]] = []
    sub = {
        "APIKey": _API_KEY,
        "BoundingBoxes": [_BOUNDING_BOX],
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }
    static: dict[str, dict] = {}

    async with websockets.connect("wss://stream.aisstream.io/v0/stream", open_timeout=15) as ws:
        await ws.send(json.dumps(sub))
        deadline = asyncio.get_event_loop().time() + _TIMEOUT_SECONDS
        while asyncio.get_event_loop().time() < deadline and len(records) < max_vessels:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            except asyncio.TimeoutError:
                continue
            msg = json.loads(raw)
            mtype = msg.get("MessageType", "")

            if mtype == "ShipStaticData":
                mmsi = str(msg.get("MetaData", {}).get("MMSI", ""))
                meta = msg.get("Message", {}).get("ShipStaticData", {})
                static[mmsi] = {
                    "ship_name":      meta.get("Name", "").strip(),
                    "ship_type_code": meta.get("Type"),
                }

            elif mtype == "PositionReport":
                meta = msg.get("MetaData", {})
                pos = msg.get("Message", {}).get("PositionReport", {})
                mmsi = str(meta.get("MMSI", ""))
                lat = _safe_float(pos.get("Latitude"))
                lng = _safe_float(pos.get("Longitude"))
                if lat is None or lng is None:
                    continue

                sdata = static.get(mmsi, {})
                type_code = _safe_int(sdata.get("ship_type_code"))
                zone = _zone_status(lat, lng)
                cog = _safe_float(pos.get("Cog"))

                records.append({
                    "mmsi":             mmsi,
                    "ship_name":        sdata.get("ship_name"),
                    "ship_type_code":   type_code,
                    "ship_type_label":  _classify_ship(type_code),
                    "lat":              lat,
                    "lng":              lng,
                    "speed_knots":      _safe_float(pos.get("Sog")),
                    "course_deg":       cog,
                    "heading_deg":      _safe_float(pos.get("TrueHeading")),
                    "zone_status":      zone,
                    "direction_status": _direction_status(cog, zone),
                    "source":           "aisstream",
                    "raw_timestamp":    _parse_ais_timestamp(meta.get("time_utc")),
                })

    return records


def collect(max_vessels: int = 200) -> list[dict[str, Any]]:
    return asyncio.run(_collect_async(max_vessels))
