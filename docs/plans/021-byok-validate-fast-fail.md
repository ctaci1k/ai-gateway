---
plan: 021-byok-validate-fast-fail
status: done
updated: 2026-05-31
---

# PH21 — BYOK: швидка валідація ключа (fix 500 на повільному/rate-limited ендпоінті)

> Баг: при додаванні свого ключа (напр. OpenRouter free) валідація «висить» ~40с
> і фронт отримує **500**. Бекенд-only фікс. Коміт/пуш — лише на прохання власника.

## Причина (звірено з логом + кодом, 2026-05-31)
- `.env.local`: `NEXT_PUBLIC_API_URL=/api` → браузер б'є `/api/keys/validate` →
  **Next dev rewrite-проксі** (`next.config`) → backend `:8000`.
- `TransientProvider.__init__` (`services/provider_service.py:42`) будує
  `OpenAI(api_key, base_url)` **без `max_retries`/`timeout`** → SDK-дефолти
  (2 ретраї + довгий timeout). На **429** (OpenRouter free rate-limit) SDK робить
  backoff-ретраї (лог: «Retrying … in 10s … in 30s») → `/keys/validate` тривав
  **41с** (лог: `duration_ms: 41489`).
- Next-проксі відвалюється по таймауту (~30с) і повертає **500** браузеру →
  `ApiError` у `services/apiClient.ts::toApiError`. (Бекенд при цьому зрештою
  повертав 200 з `ok:false`, але запізно.)

## Виправлення
- Прибрати backoff-ретраї для BYOK (головний винуватець) і обмежити час
  валідації, щоб `/keys/validate` повертав чистий `ok:false` за ~1–3с → жодного
  500. Реальні BYOK-чати лишаються з достатнім timeout (не ламаємо довгі
  відповіді), але без нескінченних ретраїв.

## Кроки (атомарні; гейти після кожного)
- [x] **0. Діагностика.** Знайдено причину (лог + код). ✅
- [x] **1. TransientProvider: без ретраїв + явний timeout.** `__init__` →
  `OpenAI(..., max_retries=0, timeout=BYOK_REQUEST_TIMEOUT_SECONDS=60)`.
- [x] **2. `validate_credentials`: швидкий ping.** Через
  `self.client.with_options(timeout=VALIDATE_TIMEOUT_SECONDS=12)`.
- [x] **3. Паралельна валідація.** `routes/keys.py::validate_keys` →
  `asyncio.gather`.
- [x] **4. Гейти BE + live.** BE 128 passed + ruff/black; live: невалідний ключ
  проти OpenRouter → `ok:false` за **0.54с** (HTTP 200), без 500.
- [x] **5. Доки.** `docs/08` (нотатка PH21). `status: done`.

## Перевірка (DoD)
- [ ] `/keys/validate` повертає 200 з per-slot результатом за ≤~15с навіть на
      rate-limited/повільному ендпоінті (без 500).
- [ ] Робочий ключ → `ok:true`; невалідний/rate-limited → `ok:false` з чистим
      повідомленням; ключ ніколи не логується/не повертається.
- [ ] Зелено BE (pytest/ruff/black); наявні тести BYOK не зламані; docs/08 оновлено.

## СТАН
- Останній виконаний крок: **5** — фікс + доки; план завершено (`status: done`).
- Наступний крок: — (немає).
- Заблоковано: **ні**.
- Змінені файли: `backend/services/provider_service.py`, `backend/providers/openai_compatible.py`, `backend/routes/keys.py`; `docs/08`.
