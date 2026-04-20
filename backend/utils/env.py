import os
from dotenv import load_dotenv

load_dotenv()


def require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"환경변수 누락: {key}")
    return val


SUPABASE_URL = require("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = require("SUPABASE_SERVICE_ROLE_KEY")
