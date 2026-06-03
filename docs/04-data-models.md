# 04 — Моделі даних

Структури, що реально використовуються (з коду). Майбутня схема БД позначена 🔮.

---

## ChatRequest (вхід API) — `schemas/chat_schema.py`

| Поле | Тип | Дефолт | Обмеження |
|---|---|---|---|
| `message` | str | — | 1..4000, обов'язкове |
| `provider` | str | `"groq"` | min_length 1 |
| `providers` | list[str] \| None | `null` | — |
| `compare_mode` | bool | `false` | — |
| `selector_enabled` | bool | `false` | — |
| `include_execution_metadata` | bool | `true` | — |
| `include_selector_analysis` | bool | `true` | — |
| `include_all_responses` | bool | `true` | — |
| `manual_override` | bool | `false` | — |
| `manually_selected_model` | str \| None | `null` | — |
| `chat_id` | int \| None | `null` | PH9: персист у збережений чат |
| `rag_enabled` | bool | `false` | PH10 |
| `byok` | ByokConfig \| None | `null` | PH17 → **DEPRECATED (PH30, D-20)**: приймається, але **ігнорується** (ключі — зі сховища `byok_credentials`, нижче) |

### ByokConfig (PH17 → PH30) — модель ключів

**PH30 (D-20):** джерело ключів — **зашифроване серверне сховище** `byok_credentials` (нижче), **не** тіло запиту. Поле `ChatRequest.byok` лишається опційним, але **ігнорується**. Бекенд розшифровує ключі в `memory/byok_repository.py::load_config()` і будує той самий `ByokConfig` транзитно (in-memory на час запиту). Структура `ByokConfig` (judge + responders) незмінна:

```jsonc
{
  "judge": { "api_key": "str", "model_id": "str", "base_url": "str|null" },   // null base_url → endpoint Groq
  "responders": [
    { "slot": "groq|cerebras|sambanova|custom-*", "api_key": "str", "model_id": "str", "base_url": "str|null" }
  ]
}
```
- Дефолтні слоти беруть фіксований endpoint провайдера (`base_url` опційний); кастомні (4–5-й) **потребують** `base_url` (OpenAI-сумісний).
- FE-дзеркало — `store/KeysContext.tsx` (метадані, write-only). Сховище/валідація — `/keys` CRUD + `POST /keys/models` ([03](03-api-contracts.md)).

### byok_credentials (PH30, D-20) — зашифроване сховище ключів

`db/models.py::ByokCredential`, Alembic `0008_byok_credentials`. Один рядок = один слот юзера; **UNIQUE(`user_id`,`slot`)**; per-user ізоляція через FK `user_id` (ondelete CASCADE, index).

| Колонка | Тип | Нотатка |
|---|---|---|
| `id` | int PK | |
| `user_id` | FK→users CASCADE, index | власник |
| `slot` | String(64) | `groq`/`cerebras`/`sambanova` / `byok-judge` / `custom-*` |
| `base_url` | String, nullable | override ендпоінта (NULL = вбудований) |
| `model_id` | String(256) | |
| `key_ciphertext` | LargeBinary | AES-256-GCM шифротекст ключа |
| `key_nonce` | LargeBinary | 96-біт nonce запису |
| `key_last4` | String(8) | останні 4 символи ключа (для write-only маски; **не секрет**) |
| `key_version` | int, default 1 | версія envelope (під ротацію KEK) |
| `custom` | bool | доданий слот (vs override вбудованого) |
| `created_at`/`updated_at` | DateTime | |

**Envelope (`core/secret_box.py`):** AES-256-GCM, KEK з env `BYOK_ENCRYPTION_KEY` (base64, 32 байти), випадковий nonce на запис, **AAD = `f"{user_id}:{slot}"`** (підміна рядка в БД провалює GCM-тег). **Плейнтекст ключа й KEK ніколи не в БД/логах.** `GET /keys` віддає лише метадані (`last4`) — повний ключ не повертається.

### Семантика квотних вікон (PH17, D-12) — `services/quota_service.py`

Без нових таблиць (рахуються з `usage_events`). **Хвилина:** ковзне 60-с вікно «від першого запиту»; `used = count(events за останні 60с)`, `remaining_this_minute = max(0, limit − used)`, `minute_resets_in_seconds = ceil(60 − (now − earliest_in_window))` (`null` поки запитів нема). **День:** календарний за `Europe/Warsaw` (DST-aware, `zoneinfo`), `day_start = 00:00 Warsaw → UTC`, скид `day_resets_at` = наступне 00:00 Warsaw. Enforcement використовує **ті самі** вікна, що й `/auth/me`.

---

## all_responses (результат відповідачів)

Словник `provider_name → response_data`:

```jsonc
{
  "groq": {
    "response": "текст відповіді",
    "model": "llama-3.3-70b-versatile",
    "execution_time": 1.23,
    "provider": "groq",
    "success": true
  }
}
```

`failed_providers`: `[ { "provider": "x", "error": "...", "reason": "rate_limited|timeout|empty_response|unavailable" } ]` (PH13: `reason` — код для локалізованої картки у Compare)
`execution_metadata`: `[ { "provider", "success", "execution_time", "model", "error" } ]`
`execution_summary`: `{ "total_models", "successful_models", "failed_models", "average_execution_time" }`

---

## Результат селектора — `selector/response_selector.py`

```jsonc
{
  "selected_model": "groq",            // ∈ ALLOWED_MODELS = [groq, cerebras, sambanova]
  "best_response": "текст",
  "confidence": 0.9,
  "reason": "пояснення вибору",
  "scores": { "groq": 85, "cerebras": 70 },
  "fallback_used": false,
  "selector_provider": "gemini",
  "selector_model": "gemini-2.5-flash-lite",
  "personalization_used": true
}
```

Fallback (rule-based, `selector/ai_selector.py`) додатково має `detailed_scores` з розбивкою:
`length_score, structure_score, readability_score, explanation_score, style_score, total_score`.

---

## Стан / історія — `memory/repository.py` (seam) + `memory/sql_repository.py` (PH4)

> **PH4:** in-memory `ChatBuffer` **замінено** на персистентний `SqlChatRepository` (async SQLAlchemy). Дані **переживають рестарт**. Доступ — через інтерфейс `ChatRepository`. Логіка уподобань — у `memory/preferences_logic.py` (чисті функції). Sliding window зберігся як ліміт історії (`HISTORY_LIMIT`, дефолт 10) на рівні запиту.

Структура одного запису історії (поле `interactions.payload`, JSON) та `user_preferences` — незмінні (нижче).

### Запис повідомлення (елемент історії)

```jsonc
{
  "user_message": "...",
  "best_response": "...",
  "selected_model": "groq",
  "all_responses": { ... },
  "failed_providers": [ ... ],
  "selector_used": true,
  "execution_metadata": [ ... ],
  "execution_summary": { ... },
  "selector_scores": { ... },
  "selector_reason": "...",
  "selector_metadata": { ... },
  "selector_provider": "gemini",
  "selector_model": "gemini-2.5-flash-lite",
  "selector_confidence": 0.9,
  "selector_fallback_used": false,
  "compare_mode": true,
  "compare_summary": { "total_models", "failed_models", "selected_model" },
  "manual_override": false,
  "manually_selected_model": null
}
```

### user_preferences (профіль)

```jsonc
{
  "preferred_models": { "groq": 3, "cerebras": 1 },
  "manual_model_selections": { "cerebras": 2 },
  "response_style_preferences": {},
  "response_interactions": {
    "viewed_responses": 0,
    "manual_selections": 0,
    "selector_agreements": 0,
    "selector_disagreements": 0
  },
  "selector_usage_count": 0,
  "compare_mode_usage_count": 0,
  "total_messages": 0,
  "favorite_response_style": null
}
```

`get_personalization_profile()` віддає підмножину: `preferred_models`, `manual_model_selections`, `response_style_preferences`, `favorite_response_style`, `response_interactions`.

---

## ✅ Схема БД (реалізовано в PH4 — `db/models.py`, Alembic `migrations/`)

Async SQLAlchemy 2.x; dev — SQLite (`sqlite+aiosqlite`), prod — Postgres (`postgresql+asyncpg`), через `DATABASE_URL`. Міграції — Alembic (`alembic upgrade head` з нуля).

- `users` — `id` (PK), `username` (unique, index), `created_at`. **PH15 (D-10):** `is_admin` (bool, default false), `max_requests_per_minute` (int, nullable), `max_requests_per_day` (int, nullable). `null` ліміт = безліміт (адмін). _Примітка Python 3.14: нульабельні колонки оголошено як `Mapped[int]` + `nullable=True` (а не `Mapped[int | None]` — крешить SQLAlchemy)._
- `preferences` — `user_id` (PK/FK→users, CASCADE), `data` (JSON: повний `user_preferences`). **PH24 (D-17):** опційний ключ `judge_prompt_override` (str) — per-user системний промпт судді; null/відсутній = вбудований типовий. Без міграції (generic JSON).
- `interactions` — `id` (PK), `user_id` (FK, index), `created_at` (index), `payload` (JSON: запис історії). Sliding window — `HISTORY_LIMIT`.
- `users.password_hash` + `sessions` (`id` PK, `user_id` FK index, `created_at`, `expires_at` index) — акаунти/сесії (PH8).
- `chats` (PH9; **PH24/D-17**) — `id` (PK), `user_id` (FK→users, CASCADE, index), `title`, **`mode`** (`"single"`/`"compare"`, default `"compare"`, NOT NULL), **`model`** (str, nullable — слот моделі для Single; NULL для Compare), `created_at`, `updated_at`. Ліміт **25** на користувача (`SAVED_CHATS_LIMIT`), **спільний** на Single+Compare. Міграція Alembic `0006_chat_mode_model` (додає `mode`+`model`).
- `chat_messages` (PH9) — `id` (PK), `chat_id` (FK→chats, CASCADE, index), `created_at` (index), `payload` (JSON: запис ходу — та сама форма, що `interactions.payload`). Зберігає **і Compare-, і Single-ходи** (PH24/D-17); для Single `payload.compare_mode=false`, `all_responses` має один слот.
- `documents` (PH10) — `id` (PK), `user_id` (FK→users, CASCADE, index), `filename`, `content_type`, `chunk_count`, `created_at`. Метадані завантажених RAG-документів; **chunks+embeddings** живуть у ChromaDB (поза SQL), тегнуті `user_id`+`document_id` для ізоляції. Ліміт `RAG_MAX_DOCUMENTS`.
- `byok_credentials` (**PH30, D-20**) — зашифроване per-account сховище BYOK-ключів (детальна таблиця вище). `id` (PK), `user_id` (FK→users, CASCADE, index), `slot`, `base_url?`, `model_id`, `key_ciphertext`/`key_nonce` (LargeBinary), `key_last4`, `key_version`, `custom`, `created_at`/`updated_at`; **UNIQUE(`user_id`,`slot`)**. AES-256-GCM envelope (`core/secret_box.py`, KEK з `BYOK_ENCRYPTION_KEY`); плейнтекст ніколи не зберігається. Міграція Alembic `0008_byok_credentials`.
- `usage_events` (PH15, D-10; **PH27/D-18**) — `id` (PK), `user_id` (FK→users, CASCADE, index), `created_at` (index), `mode` (`"compare"`/`"single"`), `message`, `selected_model` (nullable), `total_tokens` (int, nullable), `success` (bool), **`chat_id`** (FK→chats, **ondelete SET NULL**, nullable, index), **`billable`** (bool, NOT NULL, server_default `true`), **`token_estimated`** (bool, NOT NULL, server_default `false`), **`key_fingerprint`** (String(32), nullable; **PH31/D-21**). **Append-only канонічний per-turn ledger** (на відміну від rolling `interactions`, **не обрізається**): джерело правди для enforcement квоти (лічба за вікна хвилина/доба), admin-перегляду і **Звітів (PH27)**. Один рядок = один хід (Compare-хід = 1 подія). **PH27 (D-18):** пишуться **ВСІ** ходи, у т.ч. BYOK; `billable=false` → хід на власному ключі (квота не списувалась). **Квотні вікна рахують лише `billable=true`** — повнота ledger не змінює поведінки лімітів. `chat_id` зв'язує подію зі збереженим чатом (видалення чату лишає аудит, відв'язує → група «видалені/ad-hoc»). `total_tokens` — реальні (provider `usage`) або **оцінка** (`token_estimated=true`, евристика `ceil(chars/4)`, `core/tokens.py`). **PH31 (D-21):** `key_fingerprint` — display-only маска BYOK-ключа моделі-переможця ходу (`перші4••••останні4`, напр. `gsk_••••OTzu`); `NULL` = вбудований (app) ключ. Денормалізується з розшифрованого `ByokConfig` у момент запису (`memory/byok_repository.key_fingerprint`); **плейнтекст ключа тут ніколи не зберігається**. Звіти розділяють ту саму модель за `(selected_model, key_fingerprint)`. Міграції Alembic `0005_quotas_usage` (поля `users` + таблиця), `0007_usage_ledger` (3 колонки ledger) та `0009_usage_key_fingerprint` (колонка маски).

> 🔮 Майбутні таблиці поза поточним обсягом — немає (PH0–PH15 покривають дані). Рішення про БД/персист — [10-open-decisions.md](10-open-decisions.md) (D-1, D-2, D-3, D-8, D-10).

## ✅ Vector store (PH10 — ChromaDB)

Персистентний (`CHROMA_PATH`), колекція `rag_chunks`, метрика cosine. Кожен chunk: `id = "{user_id}:{document_id}:{index}"`, `embedding` (Gemini `gemini-embedding-001`), `document` (текст chunk), `metadata {user_id, document_id, filename, chunk_index}`. Retrieval — `query_embeddings` + `where={"user_id": …}` (per-user ізоляція). Embeddings абстраговані через `EmbeddingClient` (легко замінити провайдера).
