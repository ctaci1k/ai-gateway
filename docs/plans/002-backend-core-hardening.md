---
plan: 002-backend-core-hardening
status: done
updated: 2026-05-29
---

# Backend core hardening — антипатерни бекенду

> Виконавча версія Фази 0 з [../09-roadmap.md](../09-roadmap.md), приземлена на дефекти [../08-current-state.md](../08-current-state.md) і рішення [../10-open-decisions.md](../10-open-decisions.md). Можна виконувати **паралельно** з планом 001 (інша поверхня).

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **8** — усі кроки виконані; план `done`.
- Наступний крок: — (фаза PH1 завершена; далі PH2 / план 003).
- Заблоковано: ні
- Змінені файли: `core/{config,errors,logging,middleware}.py`, `main.py`, `routes/chat_route.py`, `schemas/chat_schema.py`, `providers/{base,groq,cerebras,sambanova,gemini}_provider.py`, `selector/response_selector.py`, `services/provider_service.py`, `tests/*`, `frontend/services/{apiClient,chatApi,compareApi}.js`, `frontend/features/{chat/useChat,compare/useCompare}.js`, `docs/03-api-contracts.md`, `docs/08-current-state.md`.
- Відкриті питання/рішення: D-3, D-5, D-6 — застосовані.

## Навіщо (дефекти з коду)
- #1 CORS `allow_origins=["*"]` + `allow_credentials=True` — некоректно/небезпечно (`backend/main.py`).
- #2 Помилки = HTTP 200 `{"error":...}` замість статус-кодів (`routes/chat_route.py`).
- #3 Single (`/chat/stream`) пише в `ChatBuffer`, хоча Single ефемерний (D-3).
- #5 Хардкод URL бекенду у фронтенді (`frontend/services/*.js`).
- #6 Парсинг JSON судді через зрізання ```-огорожі — крихко (`providers/gemini_provider.py`).
- #7 Невживані ключі `selector_config` (retries/min_confidence/temperature/max_tokens).
- #8 Немає валідації лімітів/rate-limit; немає структурованого логування.

## Мета
Стабільне, передбачуване ядро: коректні помилки, безпечний CORS, конфіг через `.env`, надійний селектор, Single без запису, базові логи — **без зміни контрактів даних** (лише формалізація помилок).

## Кроки
- [x] 1. Уніфікувати помилки: коректні статус-коди (400/422/500) + тіло `{ "error": { "code", "message" } }` (D-5); прибрати `try/except → {"error"}` з 200. Оновити обробку у `frontend/services/*`. → `core/errors.py` (хендлери AppError/RequestValidationError/HTTP/Exception); `services/apiClient.js` (`ApiError`, `parseJsonResponse`, `ensureOk`); хуки додали `error`-стан.
- [x] 2. CORS: явний список origins із `.env` (dev/prod), прибрати `*`+credentials конфлікт. → `settings.cors_origins_list` у `main.py`.
- [x] 3. Single ефемерний (D-3): прибрати `chat_buffer.add_message` з `/chat/stream`.
- [x] 4. Конфіг через `.env`/Pydantic Settings: ключі провайдерів, CORS origins, ліміти; фронтенд API base URL → `.env` (`NEXT_PUBLIC_*`). → `core/config.py`; провайдери читають ключі з `get_settings()`; FE `apiClient.API_URL`.
- [x] 5. Надійний селектор (D-6): structured output Gemini (`response_mime_type=application/json`) + стійкий `extract_json` (база провайдерів); застосовані `SELECTOR_MAX_RETRIES`, `SELECTOR_MIN_CONFIDENCE`, `SELECTOR_TEMPERATURE`, `SELECTOR_MAX_TOKENS` у `response_selector.py`/`gemini_provider.py`.
- [x] 6. Валідація/ліміти запитів + базовий rate-limit (#8). → `MAX_MESSAGE_LENGTH` у схемі; `RateLimitMiddleware` (per-IP, mutating).
- [x] 7. Структуроване логування: вхідні запити, помилки провайдерів, рішення судді (model, confidence, fallback). → `core/logging.py` (JSON), `RequestLoggingMiddleware`, `provider_error`/`judge_decision` події.
- [x] 8. Тести (pytest): `ChatBuffer`, selector, агрегація, кілька API-кейсів. → `backend/tests/` (28 тестів, зелені).

## Перевірка (Definition of Done)
- [x] Помилки повертають коректні коди + уніфіковане тіло; фронтенд це обробляє.
- [x] CORS без `*`+credentials; origins з конфігу.
- [x] Single нічого не пише в пам'ять.
- [x] Жодних секретів/URL у коді — усе з `.env` (публічні endpoint-URL провайдерів лишаються константами SDK).
- [x] Селектор стійкий до невалідного JSON; конфіг-ключі застосовані.
- [x] Базові логи присутні; базові тести зелені (28 passed).
- [x] Контракти [../03-api-contracts.md](../03-api-contracts.md) оновлені під новий формат помилок.
- [x] Цей план: `status: done`, усі `[x]`, «СТАН» актуальний.

## Ризики / нотатки
- Зміна формату помилок — **breaking** для фронтенду: крок 1 синхронізувати з `frontend/services/*` і станами error (план 001, крок 13).
- Не вводити БД/мульти-юзер тут — це пізніші фази [../09-roadmap.md](../09-roadmap.md).
