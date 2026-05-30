# 08 — Реальний стан (Ground Truth)

> Цей файл — **факти з коду** станом на зараз. Якщо інші документи описують «як має бути», то цей — «як є насправді». Не вигадувати поза цим.

## ✅ Що реально працює

**Backend**
- FastAPI-застосунок (`backend/main.py`) з CORS і роутером.
- `POST /chat` — Compare: паралельні запити до `groq`/`cerebras`/`sambanova`, збір `all_responses`, метадані виконання.
- `POST /chat/stream` — Single: стрімінг NDJSON від обраної моделі (groq/cerebras/sambanova); підтримує `rag_enabled` (термінальна подія `sources`); після стріму пише хід у rolling-історію (PH13).
- `POST /chat/structured` — структурований (JSON) вивід.
- AI Selector: **Groq-суддя**, нейтральна модель `qwen/qwen3-32b` (не збігається з жодним відповідачем → без self-bias) + rule-based fallback. Перенесено з Gemini у PH13 через ліміт Gemini 20/добу (D-9); Gemini лишається для RAG-embeddings. Причина fallback (`fallback_reason`) і ручний перевибір тепер показуються правдиво й оборотні. Провайдер, що впав, показується окремою карткою з причиною (`failed_providers[].reason`: rate_limited/timeout/empty_response/unavailable).
- Персоналізація: накопичення `user_preferences` + `personalization_profile`, трекінг ручних виборів.
- Допоміжні ендпоінти: `/providers`, `/providers/info`, `/memory`, `/preferences`, `/memory/json`, `DELETE /memory`, `/preferences/manual-selection`.
- Паралелізм через `asyncio.gather` з ізоляцією помилок (`_safe_generate`).

**Frontend**
- Next.js App Router; перемикання Single / Compare через `ChatModeContext`.
- Single: стрімінг через `useChat` → `/chat/stream`.
- Compare: `useCompare` → `/chat` з 3 провайдерами + `selector_enabled`.
- Структура: layouts, components (sidebar/chat/compare/selector), features, services, store, theme, i18n, types.

## 🟡 Частково

- **TypeScript** лише частково (theme/types — `.ts`; решта — `.js/.jsx`).

## ⛔ Чого немає (попри згадки в первісному описі)

- **LiteLLM, httpx.** (Персист БД, акаунти, збережені чати, RAG, Docker/Nginx/SSL-артефакти — **вже реалізовано** в PH4/PH8/PH9/PH10/PH12; деталі нижче.)
- **Ендпоінти** `/all-responses`.
- **Реальний VPS/DNS/SSL-сертифікат** — поза агентом (owner-handoff, `DEPLOY.md`); усі артефакти готові.

## ✅ Усунено в PH0–PH1

- **Залежності зафіксовані** (`backend/requirements.txt` + `requirements-dev.txt` + `pyproject.toml`), `.env.example` (BE+FE), кореневий `README.md`, форматери/лінтери (Ruff/Black/Prettier/ESLint), `.editorconfig`.
- **Конфіг через Pydantic Settings** (`core/config.py`) з `.env`: ключі провайдерів, CORS origins, ліміти, rate-limit, лог-рівень.
- **Уніфіковані помилки** (`core/errors.py`): коректні статус-коди + тіло `{error:{code,message}}` (D-5); фронтенд обробляє через `services/apiClient.js` (`ApiError`).
- **CORS** із явного списку origins (`.env`), без `*`+credentials.
- **Single ефемерний** (D-3): `/chat/stream` нічого не пише в `ChatBuffer`.
- **Хардкод URL** прибрано: фронтенд бере базовий URL з `NEXT_PUBLIC_API_URL`.
- **Надійний селектор** (D-6): structured JSON output Gemini (`response_mime_type`), стійкий парсер `extract_json`, застосовані `SELECTOR_MAX_RETRIES/MIN_CONFIDENCE/TEMPERATURE/MAX_TOKENS`.
- **Rate limiting** (per-IP, mutating-методи) + конфігуровані ліміти запиту (`MAX_MESSAGE_LENGTH`).
- **Структуроване логування** (`core/logging.py`): запити, помилки провайдерів, рішення судді.
- **Базові тести** (`backend/tests/`, pytest): ChatBuffer, rule-based selector, агрегація провайдерів, ретраї/мін-впевненість селектора, `extract_json`, API-кейси (помилки/rate-limit).

## ✅ PH15 — адмінпанель + ліміти акаунтів + код реєстрації (D-10)

- **Per-user квоти запитів:** `User` отримав `is_admin`, `max_requests_per_minute`, `max_requests_per_day` (nullable=безліміт); append-only таблиця `usage_events` (Alembic `0005`). `QuotaService` рахує rolling-вікна (хвилина/доба) з `usage_events`; гард `enforce_quota` на `/chat` і `/chat/stream` → **429** `quota_exceeded` при перевищенні. **Compare рахується як 1 запит.** Адмін і безлімітні (`null`) — без перевірки. Після кожного ходу пишеться `usage_events` (mode, message, selected_model, total_tokens, success) — токени дістаються з `response.usage.total_tokens` відповідачів (`OpenAICompatibleProvider.generate_full`); стрім-SDK не звітує usage → `total_tokens=null`.
- **Реєстрація лише за кодом:** `/auth/register` потребує `registration_code` (== `REGISTRATION_CODE`), інакше **403** `invalid_registration_code` (порожній конфіг → реєстрація вимкнена). Акаунт із `ADMIN_USERNAME` → `is_admin=true` + безліміт; інші — дефолтні ліміти (`DEFAULT_MAX_REQUESTS_PER_MINUTE/_PER_DAY`, 5/30).
- **Admin API** (`/admin/*`, гард `require_admin` → 401/403; мутації +CSRF): `GET /admin/users`, `GET /admin/users/{id}/usage` (події+токени), `POST /admin/users` (створення без коду реєстрації), `PATCH /admin/users/{id}` (ліміти/роль, exclude_unset). `/auth/me` розширено: `is_admin`, ліміти, `used_this_minute`, `used_today`, `remaining_today`.
- **Frontend:** `services/adminApi`; `AuthContext` зберігає `CurrentUser` (is_admin/ліміти/usage), гідрує через `/auth/me`, має `refresh()`; `LimitBanner` (червона рамка, лише для лімітованих не-адмінів); поле «код реєстрації» + локалізована помилка в `AuthScreen`; **адмінпанель** (`AdminPanel` + `AdminViewContext`, видима лише адміну): таблиця користувачів, inline-редагування лімітів, створення акаунтів, розгортання аудиту з токенами; стани loading/empty/error, a11y, i18n паритет uk/pl/en.
- **Тести:** BE `tests/test_admin_quotas.py` (9 кейсів: код реєстрації, адмін-флаг/безліміт, ізоляція `/admin/*`, enforcement хв/доба, Compare=1, аудит токенів) — усього **101 BE**; FE — tsc/eslint/prettier/vitest(12)/build зелені.

## ✅ PH14 — фінальний UX-поліш

- **Нейтральні мітки судді (D-9):** прибрано хардкод «Gemini» з UI; `selector.title` → «AI-суддя/AI Judge/Sędzia AI», реальна модель судді показується дружньою назвою з `selector_metadata.selector_model` через `utils/judge.judgeModelName` (напр. «Qwen») у `SelectorBanner` та `ManualSelectionButton`. Мертвий ключ `banner.judgeUnavailable` видалено (код використовує лише `banner.reason.*`).
- **Топбар:** прибрано годинник + статус-крапку (і `IconClock`). Доданий **режимо-залежний контекст** (`components/chat/TopbarModeContext.tsx`) у спільному слоті `MainLayout`: Single → `ModelSwitcher` + примітка `single.note` (перенесені зі сторінки); Compare → пояснення режиму `topbar.compareInfo` з назвою судді (FE-константа `JUDGE_MODEL`, дзеркалить backend `SELECTOR_MODEL`).
- **Скрол:** `.msgs` — єдиний скрол-контейнер чатів (`.responses` більше не має власного `overflow`/`flex:1`, тож Compare-тред скролиться як стрічка); `.composer-popover` (документи) обмежено по висоті з власним `overflow-y` + `overscroll-behavior:contain`; `.msgs` отримав `scrollbar-gutter:stable` + `scroll-behavior:smooth`.
- **Композер:** звужено (`max-width`) і відцентровано, трохи піднято від низу — кнопка «надіслати» більше не в крайньому правому куті.
- **Прибрано System Log** (`SystemLog.tsx`, мертві `syslog.*` + `status.online`, мертвий CSS); на його місці — **персональна картка автора** (`AuthorCard`, `author.*`, i18n uk/pl/en).
- Гейти FE зелені: tsc/eslint/prettier/vitest (12)/next build; i18n паритет uk/pl/en.

## ✅ PH13 — доведення UX чатів

- **Інтерактивні збережені чати (Compare):** клік по чату → **тред усіх ходів** у головній області (`CompareTurn`); сабміт у активному чаті додає хід (`chat_id`), персиститься й підвантажується (`reloadActive`); поки активний чат порожній — створення нового блокується з повідомленням (`canCreate`/`notice`, A3); підписи «Збереження чатів з порівнянням» / «Новий чат з порівнянням». Секція збережених чатів — лише в Compare.
- **Single уточнено (уточнення D-3):** перемикач моделі (`ModelSwitcher`, groq/cerebras/sambanova через `ComposerContext`); кнопка «Очистити» прибирає лише **візуальний** тред; ходи пишуться в **rolling-історію** БД після стріму (`/chat/stream`, `compare_mode=false`); помітна примітка-зірочка; окремих single-чатів немає.
- **RAG вбудовано в чати (не окремий режим):** компактний менеджер документів у композері (`ComposerTools`, кнопка «Документи») для Single і Compare; **RAG вмикається автоматично, поки є хоч один документ** (без ручного тумблера — `rag_enabled = documents.length > 0`); `/chat/stream` підтримує `rag_enabled` з поверненням джерел подією `sources`; видалено `RagPage`/`useRag`/`ragApi` та rag-режим у `ChatModeSelector`. Помилки завантаження мають типізовані коди (`unsupported_type`/`no_text`/…) → локалізовані повідомлення в UI; клієнтська перевірка типу + підказка про підтримувані формати (PDF/TXT/MD).
- **Прозорість судді:** `fallback_reason` (judge_unavailable / invalid_response / low_confidence) збирається в `response_selector.py` → `SelectorFallback` → `selector_metadata` → `SelectorBanner` показує конкретну причину (i18n uk/pl/en). Збережений чат показує збережений стан того ходу (D3).
- **Третя модель (Cerebras gpt-oss-120b):** явний `RESPONDER_MAX_TOKENS` (дефолт 1024) у `generate`/`generate_stream`; порожній content → `ProviderError` (у Compare → failed_provider, без порожньої картки).
- Тести: BE `test_responders.py`, `test_chat_stream.py`, нові кейси `test_response_selector.py` (усього 90 BE); FE vitest 12 (нові `SelectorBanner`/`ModelSwitcher`).

## ✅ PH12 — деплой-артефакти

- **Dockerfiles**: `backend` (multi-stage, non-root, healthcheck, авто-`alembic upgrade head`), `frontend` (Next standalone → slim non-root runtime).
- **`docker-compose.yml`**: Postgres + backend + frontend + nginx; volumes `pgdata`/`chroma` (ChromaDB — embedded у backend); healthchecks + `restart: unless-stopped`.
- **nginx** reverse proxy (`/`→FE, `/api/`→BE, gzip, security headers) + TLS-шаблон (`nginx.tls.conf.example`, HSTS).
- **`.env.production.example`**, `.gitignore` для `.env.production`, **`DEPLOY.md`** (локальний запуск однією командою + owner-handoff: VPS/DNS/секрети/TLS/renew/чеклист).
- Реальний запуск на VPS — зовнішня залежність власника (не борг).

## ✅ PH11 — якість/CI

- **Масовий формат** (Black/Prettier) на всьому репо; `design-reference` винесено з Prettier (reference-артефакт).
- **pre-commit** (`.pre-commit-config.yaml`): local/system хуки ruff+black (backend), prettier+eslint (frontend).
- **Тести FE** — `vitest` + Testing Library (i18n parity, рендер `PromptInput`/`ChatModeSelector`), 7 тестів; `npm run test`.
- **CI** (`.github/workflows/ci.yml`): backend (ruff/black/pytest) + frontend (prettier/eslint/tsc/vitest/next build) на push+PR у `main`.

## ✅ PH6–PH10

- **PH6:** повна TypeScript-міграція фронтенду (strict; tsc/build/eslint зелені).
- **PH7:** pixel-match дизайн — візуальна система у `theme/components.css` (токени), icon-set, sidebar/topbar/chat/compare-картки, реальні дані `/chat`, ручний вибір → персоналізація, адаптив/a11y.
- **PH8:** акаунти/auth — argon2, server-side сесії (`sessions`), httpOnly cookie + double-submit CSRF, `/auth/{register,login,logout,me}`, **per-user ізоляція** даних (репозиторії за `user_id`); FE AuthScreen + gate у `page.tsx` + logout у Sidebar.
- **PH9:** збережені Compare-чати — таблиці `chats`/`chat_messages` (Alembic `0003`), `SavedChatRepository` (per-user, ліміт ≤3), CRUD `/chats` (list/create/get/rename/delete, CSRF на мутаціях), `chat_id` у `POST /chat` персистить хід у чат; FE `services/chatsApi` + `store/ChatsContext` (active-chat) + `ChatList`/`NewChatButton` (реальні дані, перемикання/перейменування/видалення, стани, i18n, a11y); відкриття чату підвантажує останній хід у Compare. Single лишається ефемерним (D-3).
- **PH10:** RAG — `documents` (Alembic `0004`) + ChromaDB vector store (`core/rag/`: parser PDF/TXT, chunker, `EmbeddingClient`→Gemini `gemini-embedding-001`, store), `RagService` (ingest→chunk→embed→store; retrieve similarity + per-user `where`), CRUD `/documents` (upload/list/delete, ліміти типу/розміру/кількості), `rag_enabled` у `POST /chat` інʼєктує контекст у відповідачів і повертає `rag_sources`; FE `services/{documentsApi,ragApi}` + `store/RagContext` + RAG-режим у `ChatModeSelector` + `RagPage` (upload/список/видалення документів, відповідь+джерела, стани, i18n, a11y).

## ✅ Усунено в PH2–PH5

- **PH5 (frontend foundation):** робоча токен-система (`theme/tokens.css`, dark+light, один источник) + Tailwind v4 `@theme`; функціональний i18n (`i18n/index.ts`, `useI18n().t`, словники uk/pl/en у паритеті, робочий `LanguageSwitcher`); `ThemeContext`/`LanguageContext` з персистом; шрифти Plus Jakarta Sans + JetBrains Mono; стани empty/error у Chat/Compare; видалено `page-old.js` і дрейф `theme/*.ts`; імпорти через `@/`. Хардкоду кольорів/тексту в компонентах немає; `next build` зелений.



- **PH2:** true-async провайдери (`to_thread`), типовані `response_model`, тонкі роутери (`routes/{chat,preferences,providers,memory}.py`), dedupe (`OpenAICompatibleProvider`, `extract_json`, один `ALLOWED_MODELS`), repository seam.
- **PH3:** промпти винесено у `prompts/prompts.yaml` (версіоновано), завантажувач `core/prompts.py`.
- **PH4:** **персист БД** — `SqlChatRepository` (async SQLAlchemy 2.x) замінив in-memory `ChatBuffer`; моделі `users/preferences/interactions`; Alembic-міграції; дані переживають рестарт; готовність до Postgres через `DATABASE_URL`.

## 🐞 Відомі дефекти / технічний борг (залишок)

Критичного боргу немає. Заплановане (не борг, а майбутні фази): деплой-артефакти (PH12).

> Примітка: `google-generativeai` має upstream-попередження про депрекацію (рекомендують `google-genai`). Це канон-SDK за документацією; міграція — поза обсягом.
> Пріоритезація виправлень — у [09-roadmap.md](09-roadmap.md); відкриті рішення — у [10-open-decisions.md](10-open-decisions.md).
