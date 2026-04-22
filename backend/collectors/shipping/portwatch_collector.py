"""IMF PortWatch ArcGIS API에서 호르무즈 해협 일별 통행량을 수집한다."""
from datetime import date, datetime, timezone
from typing import Any
import httpx

_BASE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0"
_HORMUZ_ID = "chokepoint6"


def collect(portid: str = _HORMUZ_ID, days: int = 90) -> list[dict[str, Any]]:
    """portid 해협의 최근 days일 통행량 데이터를 반환한다."""
    resp = httpx.get(
        f"{_BASE}/query",
        params={
            "where": f"portid='{portid}'",
            "outFields": "date,portid,portname,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo,capacity,capacity_tanker",
            "orderByFields": "date DESC",
            "resultRecordCount": days,
            "f": "json",
        },
        timeout=30,
    )
    resp.raise_for_status()

    records = []
    for feature in resp.json().get("features", []):
        a = feature["attributes"]
        ts = a.get("date")
        if ts is None:
            continue
        transit_date = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).date().isoformat()
        records.append({
            "portid":          a.get("portid", portid),
            "portname":        a.get("portname", "Strait of Hormuz"),
            "transit_date":    transit_date,
            "n_total":         a.get("n_total") or 0,
            "n_tanker":        a.get("n_tanker") or 0,
            "n_container":     a.get("n_container") or 0,
            "n_dry_bulk":      a.get("n_dry_bulk") or 0,
            "n_general_cargo": a.get("n_general_cargo") or 0,
            "capacity_total":  a.get("capacity"),
            "capacity_tanker": a.get("capacity_tanker"),
            "source":          "portwatch",
        })
    return records
