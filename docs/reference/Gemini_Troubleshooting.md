# Gemini Troubleshooting

## Retry and Fallback Policy

If Gemini returns `503 UNAVAILABLE`, `429 RESOURCE_EXHAUSTED`, `500 INTERNAL`,
`504 DEADLINE_EXCEEDED`, or a network timeout, the backend retries the same model
with exponential backoff and then falls back to the next configured model.

The retry/fallback implementation lives in `backend/utils/gemini_client.py`.

## Default Model Order

Situation summary:

```text
gemini-3.1-flash-lite-preview
gemini-3-flash-preview
gemini-2.5-flash
gemma-3-27b-it
```

Trump post translation:

```text
gemini-3.1-flash-lite-preview
gemini-2.5-flash
gemma-3-27b-it
```

The order can be overridden with backend environment variables:

```env
GEMINI_SUMMARY_MODELS=gemini-3.1-flash-lite-preview,gemini-3-flash-preview,gemini-2.5-flash,gemma-3-27b-it
GEMINI_TRANSLATION_MODELS=gemini-3.1-flash-lite-preview,gemini-2.5-flash,gemma-3-27b-it
```

## Notes From April 2026 Testing

- `gemini-3-flash-preview` works through REST `generateContent`.
- `gemini-3-flash-preview` is not a Live API WebSocket model.
- `gemini-3.1-flash-live-preview` can complete Live API setup, but it is not a
  drop-in replacement for REST summary or translation jobs.
- Very small `maxOutputTokens` can produce empty `gemini-3-flash-preview`
  responses because thinking tokens may consume the output budget.
- Gemma models can add explanations unless prompts and post-processing are strict.
- `gemma-3-27b-it` behaved better than `gemma-4-31b-it` for translation tests.

## Operational Checks

When summaries or translations stop updating:

1. Check `source_runs` for `situation_summary` or `trump_translate` failures.
2. Check `source_errors` for Gemini HTTP status codes and timeout messages.
3. Confirm AI Studio rate limits for the active primary and fallback models.
4. If `gemini-3.1-flash-lite-preview` is returning `503`, keep the REST fallback
   order above unless a replacement model has been tested with the same prompts.
