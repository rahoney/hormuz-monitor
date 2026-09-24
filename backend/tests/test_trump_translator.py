from __future__ import annotations

import unittest
from typing import Any

from collectors.social.trump_translator import _TARGET_LOCALES, _pending_locales


class MockResponse:
    def __init__(self, data: list[dict[str, Any]], status_code: int = 200) -> None:
        self._data = data
        self.status_code = status_code

    def json(self) -> list[dict[str, Any]]:
        return self._data

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class MockClient:
    def __init__(self, table_data: list[dict[str, Any]], page_limit: int = 500) -> None:
        self.table_data = table_data
        self.page_limit = page_limit
        self.calls: list[dict[str, Any]] = []

    def get(self, path: str, params: dict[str, str]) -> MockResponse:
        self.calls.append({"path": path, "params": params})
        if path != "/trump_post_translations":
            return MockResponse([])

        filtered = self.table_data
        post_id_param = params.get("post_id", "")
        if post_id_param.startswith("in.(") and post_id_param.endswith(")"):
            ids = {int(x) for x in post_id_param[4:-1].split(",") if x}
            filtered = [r for r in filtered if r.get("post_id") in ids]

        limit = int(params.get("limit", self.page_limit))
        offset = int(params.get("offset", 0))

        effective_limit = min(limit, self.page_limit)
        page = filtered[offset : offset + effective_limit]
        return MockResponse(page)


class TestTrumpTranslatorPendingLocales(unittest.TestCase):
    def test_pending_locales_pagination_all_present(self) -> None:
        non_ko_locales = [loc for loc in _TARGET_LOCALES if loc != "ko"]
        self.assertEqual(len(non_ko_locales), 12)

        # 100 posts, all have content_ko
        posts = [
            {"id": i, "content": f"Post {i}", "content_ko": f"한국어 {i}"}
            for i in range(1, 101)
        ]

        # 1,200 rows in translations table
        table_data = [
            {"post_id": post["id"], "locale": locale}
            for post in posts
            for locale in non_ko_locales
        ]
        self.assertEqual(len(table_data), 1200)

        client = MockClient(table_data, page_limit=500)
        pending = _pending_locales(client, posts)

        # Must fetch in 3 pages (500, 500, 200)
        self.assertEqual(len(client.calls), 3)
        self.assertEqual(client.calls[0]["params"]["limit"], "500")
        self.assertEqual(client.calls[0]["params"]["offset"], "0")
        self.assertEqual(client.calls[1]["params"]["limit"], "500")
        self.assertEqual(client.calls[1]["params"]["offset"], "500")
        self.assertEqual(client.calls[2]["params"]["limit"], "500")
        self.assertEqual(client.calls[2]["params"]["offset"], "1000")

        # All translations exist, so pending should be empty
        self.assertEqual(pending, {})

    def test_pending_locales_partial_missing(self) -> None:
        non_ko_locales = [loc for loc in _TARGET_LOCALES if loc != "ko"]

        posts = [
            {"id": 1, "content": "Post 1", "content_ko": "한국어 1"},
            {"id": 2, "content": "Post 2", "content_ko": ""},  # missing ko
        ]

        # Post 1 is missing 'ja', Post 2 has all non-ko translations
        table_data = [
            {"post_id": 1, "locale": loc} for loc in non_ko_locales if loc != "ja"
        ] + [{"post_id": 2, "locale": loc} for loc in non_ko_locales]

        client = MockClient(table_data, page_limit=500)
        pending = _pending_locales(client, posts)

        self.assertEqual(
            pending,
            {
                1: {"ja"},
                2: {"ko"},
            },
        )

    def test_pending_locales_duplicate_rows(self) -> None:
        non_ko_locales = [loc for loc in _TARGET_LOCALES if loc != "ko"]

        posts = [{"id": 1, "content": "Post 1", "content_ko": "한국어 1"}]

        # Duplicate rows in DB
        table_data = [{"post_id": 1, "locale": loc} for loc in non_ko_locales] * 2

        client = MockClient(table_data, page_limit=500)
        pending = _pending_locales(client, posts)

        # Duplicates handled gracefully via set, pending should be empty
        self.assertEqual(pending, {})


if __name__ == "__main__":
    unittest.main()
