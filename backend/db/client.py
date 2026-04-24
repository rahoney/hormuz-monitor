import httpx
from utils.env import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

_BASE = f"{SUPABASE_URL}/rest/v1"
_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


def get_client() -> httpx.Client:
    return httpx.Client(base_url=_BASE, headers=_HEADERS, timeout=30.0)


def get_async_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=_BASE, headers=_HEADERS, timeout=30.0)
