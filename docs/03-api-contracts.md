# 03 — Контракти API (бекенд)

Базовий URL (dev): `http://127.0.0.1:8000` (фронтенд бере з `NEXT_PUBLIC_API_URL`).
Усі ендпоінти — **реальні, з коду** (`routes/{chat,preferences,providers,memory}.py`, тонкі роутери). Кожен має `response_model` (`schemas/chat_response.py`, `schemas/common.py`) — відповіді типовані. Статуси узгоджені з [08-current-state.md](08-current-state.md).

## Формат помилок (D-5, реалізовано в PH1)

Усі помилки повертають **коректний HTTP-статус** і уніфіковане тіло:

```jsonc
{ "error": { "code": "string", "message": "string" } }
```

Коди/статуси (`core/errors.py`):

| Статус | `code` | Коли |
|--------|--------|------|
| 400 | `validation_error` | бізнес-валідація (напр. відсутній `selected_model`) |
| 422 | `validation_error` | помилка схеми запиту (Pydantic) |
| 403 | `forbidden` | CSRF відсутній/невірний; доступ не-адміна до `/admin/*` |
| 403 | `invalid_registration_code` | реєстрація без/із невірним кодом (PH15, D-10) |
| 404 | `not_found` | невідомий шлях |
| 429 | `rate_limited` | перевищено per-IP ліміт запитів (middleware, заголовок `Retry-After`) |
| 429 | `quota_exceeded` | перевищено per-user квоту запитів (PH15, D-10) |
| 502 | `provider_error` | збій апстрім-провайдера |
| 504 | `upstream_timeout` | таймаут апстріму |
| 500 | `internal_error` | неочікувана помилка |

> Збої окремих провайдерів у `/chat` **не** є помилкою рівня запиту — вони ізолюються в `failed_providers` зі статусом 200 (часткова успішність). 500 повертається лише при неочікуваному збої оркестрації.

Rate limiting: in-memory, **per-IP**, лише для мутуючих методів (POST/PUT/PATCH/DELETE). Налаштування — `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` (`.env`).

## Автентифікація (PH8)

Сесійна, через **httpOnly cookie** (`session`, SameSite=Lax, Secure у prod) + **server-side sessions** (таблиця `sessions`). Паролі — **argon2**. Захист **CSRF**: double-submit — на мутаціях обов'язковий заголовок `X-CSRF-Token`, що дорівнює cookie `csrf_token` (видається при login/register, читається фронтендом). Фронтенд шле всі запити з `credentials: "include"`.

Ендпоінти:
- `POST /auth/register` `{username (≥3), password (≥8), registration_code}` → `200 {user:{id,username}, csrf_token}` (+ cookies). `403 invalid_registration_code` без/із невірним кодом (PH15, D-10); `409 conflict` якщо зайнято; `400 validation_error` на коротких полях. Акаунт з `ADMIN_USERNAME` стає адміном (безліміт); інші — дефолтні ліміти.
- `POST /auth/login` `{username, password}` → `200 {user, csrf_token}` (+ cookies). `401 unauthorized` на невірних даних.
- `POST /auth/logout` (потрібні session+CSRF) → `200 {message}` (чистить cookies).
- `GET /auth/me` (потрібна session) → `200 {id, username, is_admin, max_requests_per_minute, max_requests_per_day, used_this_minute, used_today, remaining_today, remaining_this_minute, minute_resets_in_seconds, day_resets_at}` або `401`. Ліміти `null` для безлімітних (адмін); per-dimension `remaining_*`/reset поля `null` для безлімітної осі (PH15/PH17, D-10/D-12). **Вікна (PH17/PH18, D-12/D-13):** хвилина — **фіксоване** 60с-вікно, що «відкривається» першим запитом і **скидається повністю** до ліміту на 60-й секунді (не поштучно); `minute_resets_in_seconds` рахує до повного скиду (`null` поки немає активного вікна або безліміт). День — календарний за Europe/Warsaw, скид о 00:00 польського часу; `day_resets_at` — ISO-8601 UTC наступного скиду (`null` коли безліміт).

**Захищені (потрібні session; мутації — ще й CSRF):** `/chat`, `/chat/stream`, `/chat/structured`, `/keys/validate` (PH17), `/chats` (CRUD), `/documents` (CRUD), `/preferences`, `/preferences/manual-selection`, `/memory` (GET/DELETE), `/memory/json`, `/admin/*` (ще й `is_admin`). Дані **ізольовані per-user**. Публічні: `/`, `/providers`, `/providers/info`.

> Порядок гардів: спершу автентифікація (401), потім CSRF (403). Перевірка квоти (`429 quota_exceeded`, PH15) для `/chat` і `/chat/stream` виконується **в тілі хендлера** (PH17) — після auth/CSRF, бо рішення «списувати чи ні» залежить від BYOK-полів запиту.

---

## POST `/chat` — Compare / Selector (головний)

Один запит → кілька моделей → (опційно) суддя.

**Request** (`schemas/chat_schema.py` → `ChatRequest`):

```jsonc
{
  "message": "string (1..4000, обов'язково)",
  "provider": "groq",                  // fallback, якщо providers порожній
  "providers": ["groq", "cerebras", "sambanova"], // або null
  "compare_mode": false,
  "selector_enabled": false,
  "include_execution_metadata": true,
  "include_selector_analysis": true,
  "include_all_responses": true,
  "manual_override": false,
  "manually_selected_model": null,
  "chat_id": null,                     // PH9: коли задано (Compare) — хід персиститься у цей збережений чат
  "rag_enabled": false,                // PH10: відповіді ґрунтуються на завантажених документах користувача
  "byok": {                            // PH17: опційні транзитні ключі користувача (judge + responders)
    "judge": { "api_key": "...", "model_id": "...", "base_url": null },
    "responders": [
      { "slot": "groq", "api_key": "...", "model_id": "my-llama", "base_url": null },
      { "slot": "custom-ab12", "api_key": "...", "model_id": "...", "base_url": "https://.../v1" }
    ]
  }
}
```

**Response (200):**

```jsonc
{
  "response": "best_response текст",
  "selected_model": "groq",
  "selected_model_data": { "response": "...", "model": "...", "execution_time": 1.2, "provider": "groq", "success": true },
  "all_responses": {
    "groq":      { "response": "...", "model": "llama-3.3-70b-versatile", "execution_time": 1.2, "provider": "groq", "success": true },
    "cerebras":  { "...": "..." },
    "sambanova": { "...": "..." }
  },
  "failed_providers": [ { "provider": "x", "error": "...", "reason": "rate_limited" } ],
  "execution_metadata": [ { "provider": "groq", "success": true, "execution_time": 1.2, "model": "...", "error": null } ],
  "execution_summary": { "total_models": 3, "successful_models": 3, "failed_models": 0, "average_execution_time": 1.1 },
  "compare_mode": false,
  "selector_enabled": false,
  "selector_scores": { "groq": 85, "cerebras": 70 },
  "selector_metadata": {
    "selector_provider": "groq", "selector_model": "qwen/qwen3-32b",
    "selector_confidence": 0.9, "fallback_used": false,
    "fallback_reason": null,             // PH13: коли fallback_used=true — конкретна причина
    "selected_model": "groq", "selection_reason": "...", "scores": {...},
    "personalization_enabled": true,
    "preference_weighting": null         // PH16: коли спрацював нудж за ручними виборами — {applied, from, to, ...}
  },
  "selector_reason": "чому обрано цю відповідь",
  "compare_summary": { "total_requested_models": 3, "successful_models": 3, "failed_models": 0, "selected_model": "groq", "selector_enabled": true, "total_compared_responses": 3 },
  "comparison_count": 3,                 // присутнє лише коли compare_mode=true
  "personalization_profile": { /* див. 04-data-models.md */ },
  "personalization_enabled": true,
  "manual_override": false,
  "manually_selected_model": null,
  "rag_enabled": false,                  // PH10
  "rag_sources": [                       // PH10: витягнуті фрагменти (порожньо, якщо rag_enabled=false)
    { "document_id": 1, "filename": "doc.pdf", "chunk_index": 0, "score": 0.82, "snippet": "..." }
  ]
}
```

**Поведінка:**
- `providers` порожній → використовується `[provider]`.
- `selector_enabled=false` → `best_response` = перша успішна відповідь (без суддівства).
- `manual_override=true` + `manually_selected_model` → трекається сигнал персоналізації.
- `chat_id` задано (PH9) → крім rolling-історії, хід **зберігається** у вказаний збережений чат. Чужий/невідомий `chat_id` → **404** `not_found`. Single (`/chat/stream`) пише лише в **rolling-історію**, не у збережені чати (уточнення D-3, PH13).
- `rag_enabled=true` (PH10) → бекенд робить similarity-search по документах користувача, інʼєктує контекст у промпт відповідачів (суддя оцінює оригінальне питання), і повертає `rag_sources`. Якщо документів/збігів немає — відповідь без контексту, `rag_sources: []`.
- `fallback_reason` (PH13) → коли `fallback_used=true`, містить причину, чому суддя не вирішив: `judge_unavailable` (таймаут/rate-limit/мережа), `invalid_response` (невалідна/неприйнятна відповідь судді) або `low_confidence` (впевненість нижче порога). Коли суддя вирішив — `null`.
- **Квота (PH15/PH17/PH18, D-10/D-12/D-13):** перевищення `max_requests_per_minute` (**фіксоване** вікно «від 1-го запиту», 60с, повний скид до ліміту на 60-й секунді) / `max_requests_per_day` (календарний день Europe/Warsaw) → **429** `quota_exceeded`. Compare-запит рахується як **1**. Адмін і безлімітні (`null`) — без перевірки. Enforcement і `/auth/me` читають **те саме** реконструйоване вікно.
- **BYOK (PH17, D-12):** опційні `byok.judge` / `byok.responders[]` будують **транзитні** провайдери на ключах користувача (не чіпають синглтони; merge з реєстром для незаданих слотів; 3–5 відповідачів). Дефолтні слоти (`groq`/`cerebras`/`sambanova`) беруть фіксований endpoint провайдера — `base_url` опційний; кастомні слоти **потребують** `base_url` (OpenAI-сумісний). **Квота при BYOK:** Compare рахується як 1, **крім** випадку, коли **всі** учасники (усі відповідачі + суддя) на своїх ключах → безліміт (не enforced, не пишеться `usage_events`). Якщо турн списується — після ходу пишеться `usage_events`. Ключі **транзитні**: ніколи не зберігаються в БД і не логуються (NQ5).

---

## POST `/chat/stream` — Single (стрімінг)

**Request:** `{ "message": "...", "provider": "groq", "rag_enabled": false, "byok": null, "chat_id": null }`
- `provider` — обрана модель Single (`groq` / `cerebras` / `sambanova`, або BYOK-слот/слот судді — NQ6). Модель фіксується при створенні Single-чату (PH24/D-17); UI обирає її в picker-екрані.
- `chat_id` (PH24/D-17) — коли задано, Single-хід **зберігається** у вказаний збережений Single-чат (`chat_messages`), дзеркалить `/chat`. Чужий/стейл id не валить стрім (хід уже віддано) — лише логується й пропускається персист. Без `chat_id` — лише rolling-історія.
- `byok` (PH17) — ті самі транзитні overrides, що й у `/chat`. **Квота:** Single списується, лише якщо обрана модель — на **дефолтному** ключі; на своєму (BYOK) ключі — **безкоштовно** (не enforced, не пишеться `usage_events`).
- `rag_enabled=true` (PH13/C3) → бекенд робить retrieve по документах користувача та інʼєктує контекст у промпт стріму; джерела повертаються **термінальною подією** `sources` (див. нижче). UI вмикає це **автоматично, коли в користувача є документи** (без ручного тумблера) — `rag_enabled = (документів > 0)`.

**Response:** `StreamingResponse`, `media_type: application/x-ndjson`, **NDJSON** (один JSON на рядок):

```
{"type":"token","content":"Пр","provider":"groq","model":"llama-3.3-70b-versatile"}
{"type":"token","content":"ивіт","provider":"groq","model":"..."}
{"type":"sources","sources":[ { "document_id":1, "filename":"doc.pdf", "chunk_index":0, "score":0.82, "snippet":"..." } ]}  // лише коли rag_enabled=true (PH13)
{"type":"error","content":"...","reason":"rate_limited"}   // у разі помилки (статус уже відправлено, тому помилка — термінальна подія потоку)
```

> **`reason` у стрім-помилці (PH18/8, D-13):** класифікований код збою (`rate_limited`/`timeout`/`empty_response`/`unavailable`, той самий, що в `failed_providers[].reason` для Compare). Дає UI відрізнити rate-limit на **власному** ключі BYOK (треба перевірити акаунт провайдера) від нашого `quota_exceeded`.

> **Single тепер зберігається (PH24/D-17, переписує D-3).** Після стріму хід завжди пишеться в **rolling-історію** (`interactions`, для персоналізації) і — якщо переданий `chat_id` — у **збережений Single-чат** (`chat_messages`). Іменований Single-чат створюється явно через `POST /chats` (`mode:"single"`, `model`), назва = 1-ше повідомлення. Без `chat_id` збережений чат не створюється. Порожній вивід не пишеться.

---

## POST `/keys/validate` — валідація BYOK-ключів (PH17, D-12)

Потрібні session + CSRF. Перевіряє кожен заповнений `(base_url + api_key + model_id)` **одним живим тест-викликом** і повертає пер-слотовий результат. **Нічого не зберігає**; ключі не потрапляють у логи (логуються лише `slot` + тип помилки).

**Request** (`schemas/keys.py`):
```jsonc
{
  "entries": [
    { "slot": "groq", "api_key": "...", "model_id": "ok-model", "base_url": null, "is_judge": false },
    { "slot": "byok-judge", "api_key": "...", "model_id": "...", "is_judge": true }
  ]
}
```
**Response (200):** `{ "results": [ { "slot": "groq", "ok": true, "error": null }, { "slot": "byok-judge", "ok": false, "error": "..." } ] }`
- `is_judge=true` → слот судді (дефолтний endpoint — Groq, якщо `base_url` не задано).
- `error` — людська причина зі **зрізаним** ключем (секрет ніколи не повертається).

---

## POST `/chat/structured` — структурований вивід

**Request:** `{ "message": "...", "provider": "groq" }`
**Response:** `{ "structured_response": { ... } }` (модель повертає JSON).

---

## POST `/preferences/manual-selection` — сигнал персоналізації

**Request:** `{ "selected_model": "cerebras", "selector_model": "groq" }`
**Response:** `{ "success": true, "personalization_profile": { ... } }`
Помилка валідації (відсутній `selected_model`): **400** `{ "error": { "code": "validation_error", "message": "selected_model required" } }`.

---

## GET `/providers`
`{ "providers": ["groq", "cerebras", "sambanova"] }`

## GET `/providers/info`
`{ "providers": [ { "provider": "groq", "model": "llama-3.3-70b-versatile", "display_name": "Llama 3.3 70B", "supports_streaming": true, "supports_structured_output": true, "supports_tool_calling": false, "supports_vision": false, "supports_selector_execution": true, "max_context_window": 128000 }, ... ] }`
> `display_name` (PH16/D-11) — правдива людська назва моделі з реєстру (`config/models_config.py`): Groq → «Llama 3.3 70B», Cerebras → «GLM-4.7», SambaNova → «DeepSeek V3.1».

## GET `/memory`
`{ "memory": [ /* список повідомлень ChatBuffer */ ] }`

## GET `/preferences`
`{ "preferences": { /* user_preferences */ }, "personalization_profile": { ... } }`

## GET `/memory/json`
Повертає серіалізований JSON буфера (`messages` + `user_preferences`).

## DELETE `/memory`
`{ "message": "Memory cleared" }`

## GET `/`
`{ "message": "AI Gateway Backend Running" }`

---

## Збережені чати (PH9; **PH24/D-17**) — `/chats` (CRUD)

Збережені чати **обох режимів** (`mode`: `"single"`/`"compare"`), ізольовані per-user; ліміт — **25** на користувача (`SAVED_CHATS_LIMIT`), **спільний** на Single+Compare. Мутації потребують CSRF. UI: клік по чату відкриває **тред усіх ходів** у відповідному режимі; сабміт у активному чаті додає хід і персиститься; назва = 1-ше повідомлення.

Форми (`schemas/chats.py`):
- `ChatSummary`: `{ id, title, mode, model, created_at, updated_at, message_count }` (`mode` ∈ {single,compare}; `model` — слот Single або null).
- `ChatDetail`: `ChatSummary` + `messages: [{ id, created_at, payload }]` (payload = запис ходу, форма як `interactions.payload`, [04](04-data-models.md)).

Ендпоінти:
- `GET /chats?mode=single|compare` → `200 { "chats": [ChatSummary, ...] }` (сортування: за `updated_at` спадно). `mode` опційний — фільтрує за режимом; без нього — усі.
- `POST /chats` `{ "title"?: string, "mode"?: "single"|"compare", "model"?: string|null }` → `200 ChatDetail` (новий чат, `messages: []`). `mode` default `"compare"`; `model` зберігається лише для Single. Порожній `title` → дефолтна назва. **409 conflict** якщо досягнуто ліміту (25).
- `GET /chats/{id}` → `200 ChatDetail`. **404 not_found** якщо чужий/невідомий.
- `PATCH /chats/{id}` `{ "title": string (1..255) }` → `200 ChatSummary`. **404** як вище; **422** на порожньому `title`.
- `DELETE /chats/{id}` → `200 { "message": "Chat deleted" }` (каскадно видаляє повідомлення). **404** як вище.

Наповнення чату — через `POST /chat` з `chat_id` (Compare) або `POST /chat/stream` з `chat_id` (Single) (див. вище).

---

## Промпт судді (per-user) — `/preferences/judge-prompt` (PH24/D-17, E2)

Потрібні session; PUT — ще й CSRF. Per-user override системного промпта судді (зберігається у `Preference.data['judge_prompt_override']`).
- `GET /preferences/judge-prompt` → `200 { "override": string|null, "default": string }`. `override` = власний промпт або null (вбудований); `default` = вбудований шаблон (read-only, для показу/скидання).
- `PUT /preferences/judge-prompt` `{ "override": string|null }` → `200 { override, default }`. null/порожнє → скид до типового. Непорожній override **мусить** зберегти плейсхолдери `$user_message`, `$responses_block`, `$allowed_models_inline`, `$scores_example` — інакше **400 validation_error**; задовгий (>8000) → **400**. Застосовується бекендом при суддівстві Compare (`build_selector_prompt`).

---

## RAG-документи (PH10) — `/documents`

Завантажені документи (PDF/TXT/MD) для RAG, ізольовані per-user; ліміт `RAG_MAX_DOCUMENTS` (дефолт 10), розмір `RAG_MAX_FILE_BYTES` (дефолт 5 МБ). Chunks+embeddings — у ChromaDB (per-user). Мутації потребують CSRF.

- `GET /documents` → `200 { "documents": [{ id, filename, content_type, chunk_count, created_at }] }`.
- `POST /documents` (multipart/form-data, поле `file`) → `200 DocumentSummary`. **400** з конкретним `code` (PH13, для локалізованих повідомлень у UI): `empty_file`, `unsupported_type`, `unreadable_pdf`, `no_text`, `file_too_large`; **409 conflict** (ліміт документів). Підтримуються лише текстові: PDF/TXT/MD.
- `DELETE /documents/{id}` → `200 { "message": "Document deleted" }` (видаляє рядок + вектори). **404 not_found** якщо чужий/невідомий.

RAG більше не окремий режим/сторінка (PH13/C4): керування документами та тумблер RAG доступні з композера в Single і Compare. Питання до документів — через `POST /chat` (Compare) або `POST /chat/stream` (Single) з `rag_enabled: true` (див. вище).

---

## Адмінпанель + квоти (PH15) — `/admin/*` (D-10)

Усі ендпоінти під гардом `is_admin` (не-адмін → **403** `forbidden`, неавтентифікований → **401**); мутації — ще й CSRF. Схеми — `schemas/admin.py`.

`AdminUserSummary`: `{ id, username, is_admin, max_requests_per_minute|null, max_requests_per_day|null, used_this_minute, used_today, remaining_today|null, created_at }`.

- `GET /admin/users` → `200 { "users": [AdminUserSummary, ...] }` (сортування за `id`; usage — rolling-вікна, як у `/auth/me`).
- `GET /admin/users/{id}/usage` → `200 { user: AdminUserSummary, events: [{ id, created_at, mode, message, selected_model|null, total_tokens|null, success }], total_requests, total_tokens }` (останні ≤500 подій). **404** якщо невідомий.
- `POST /admin/users` `{ username, password, is_admin?=false, max_requests_per_minute?=null, max_requests_per_day?=null }` → `200 AdminUserSummary`. Код реєстрації **не** потрібен (акаунт створює адмін). Для не-адміна незадані ліміти → дефолти конфіга; адмін → безліміт. `400` на коротких полях, `409 conflict` якщо username зайнято.
- `PATCH /admin/users/{id}` `{ is_admin?, max_requests_per_minute?, max_requests_per_day? }` → `200 AdminUserSummary`. Семантика exclude_unset: лише надіслані поля застосовуються; надісланий `null` ліміт = безліміт. **404** якщо невідомий.

Квота моделюється як **кількість запитів** (Compare = 1). Дефолти не-адміну — `DEFAULT_MAX_REQUESTS_PER_MINUTE`/`_PER_DAY` (5/30). Аудит — append-only `usage_events` (не обрізається, на відміну від rolling `interactions`).

---

## Звіти про використання (PH27, D-18) — `/reports/*` (per-user)

Self-service дашборд історії активності акаунта. Усі ендпоінти **під `current_user`** (неавтентифікований → **401**) і **суворо per-user** (`UsageReportRepository(user.id)` — користувач бачить лише свої події). **НЕ** admin-gated (Звіти — для всіх, D-17/п.6). Схеми — `schemas/reports.py`; агрегації — `memory/usage_report_repository.py` (read-only) над канонічним ledger `usage_events` (A1/D-18).

**Спільні query-параметри вікна:** `from`/`to` — ISO-datetime (із суфіксом `Z` чи без; серіалізація — naive UTC). Якщо `from` не передано → дефолт **останні 30 днів**; для «усе» FE шле epoch-`from` (напр. `1970-01-01T00:00:00`). `to` за умовчанням = «зараз». Невалідний datetime → **422** (`validation_error`).

- `GET /reports/summary` → `200 ReportSummary` `{ total_requests, total_tokens, tokens_estimated (bool — чи є серед порахованих оцінені токени), by_mode {single,compare}, billable_vs_own {billable,own_key}, distinct_chats, success_rate (0..1), first_event|null, last_event|null }`.
- `GET /reports/by-model` → `200 { models: [{ model|null, requests, total_tokens, successful }] }` (за спаданням запитів).
- `GET /reports/by-chat` → `200 { chats: [{ chat_id|null, title|null, mode|null, model|null, requests, total_tokens, last_event|null }] }`. `chat_id=null` — група «видалені/ad-hoc» (чат видалено → `chat_id` SET NULL, або хід без чату). LEFT JOIN `chats`.
- `GET /reports/timeseries?bucket=day|hour` → `200 { bucket, points: [{ bucket (datetime), requests, tokens }] }`. Групування — у Python (портативно SQLite/Postgres), gap-filled, за зростанням; bucket у naive UTC (FE підписує локаллю).
- `GET /reports/events?cursor=&limit=` → `200 { events: [{ id, created_at, mode, model|null, total_tokens|null, token_estimated, success, billable, message, chat_id|null, chat_title|null }], next_cursor|null }`. Keyset-пагінація за `(created_at,id)` спадно; `limit` 1..200 (дефолт 50); `cursor` = `"<iso>|<id>"`.
- `GET /reports/events.csv` → `200 text/csv` (`Content-Disposition: attachment`), стрім рядками з того самого вікна; колонки: `created_at, mode, model, chat_title, billable, total_tokens, token_estimated, success, message`. CSV-екранування — стандартним `csv`-модулем; великі обсяги не тримаються в памʼяті (keyset-сторінки).

**Бонус (G, опц.):** адмін-перегляд звітів іншого юзера — окремий admin-gated surface, не входить у мінімальний DoD.

---

## Заплановані ендпоінти (⛔ ще не існують)

Згадані в первісному описі, але **в коді відсутні**: `/all-responses`. Збережені чати реалізовано як `/chats` (PH9), завантаження документів — як `/documents` (PH10), а не `/upload-document`.
