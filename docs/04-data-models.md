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
- `preferences` — `user_id` (PK/FK→users, CASCADE), `data` (JSON: повний `user_preferences`).
- `interactions` — `id` (PK), `user_id` (FK, index), `created_at` (index), `payload` (JSON: запис історії). Sliding window — `HISTORY_LIMIT`.
- `users.password_hash` + `sessions` (`id` PK, `user_id` FK index, `created_at`, `expires_at` index) — акаунти/сесії (PH8).
- `chats` (PH9) — `id` (PK), `user_id` (FK→users, CASCADE, index), `title`, `created_at`, `updated_at`. Ліміт **до 3** на користувача (`SAVED_CHATS_LIMIT`).
- `chat_messages` (PH9) — `id` (PK), `chat_id` (FK→chats, CASCADE, index), `created_at` (index), `payload` (JSON: запис ходу — та сама форма, що `interactions.payload`). Збережені **Compare**-ходи; Single — ефемерний (D-3).
- `documents` (PH10) — `id` (PK), `user_id` (FK→users, CASCADE, index), `filename`, `content_type`, `chunk_count`, `created_at`. Метадані завантажених RAG-документів; **chunks+embeddings** живуть у ChromaDB (поза SQL), тегнуті `user_id`+`document_id` для ізоляції. Ліміт `RAG_MAX_DOCUMENTS`.
- `usage_events` (PH15, D-10) — `id` (PK), `user_id` (FK→users, CASCADE, index), `created_at` (index), `mode` (`"compare"`/`"single"`), `message`, `selected_model` (nullable), `total_tokens` (int, nullable), `success` (bool). **Append-only** аудит кожного запиту (на відміну від rolling `interactions`, **не обрізається**): джерело правди для enforcement квоти (лічба за вікна хвилина/доба) і admin-перегляду; зберігає витрачені токени. Міграція Alembic `0005_quotas_usage` (додає поля `users` + цю таблицю).

> 🔮 Майбутні таблиці поза поточним обсягом — немає (PH0–PH15 покривають дані). Рішення про БД/персист — [10-open-decisions.md](10-open-decisions.md) (D-1, D-2, D-3, D-8, D-10).

## ✅ Vector store (PH10 — ChromaDB)

Персистентний (`CHROMA_PATH`), колекція `rag_chunks`, метрика cosine. Кожен chunk: `id = "{user_id}:{document_id}:{index}"`, `embedding` (Gemini `gemini-embedding-001`), `document` (текст chunk), `metadata {user_id, document_id, filename, chunk_index}`. Retrieval — `query_embeddings` + `where={"user_id": …}` (per-user ізоляція). Embeddings абстраговані через `EmbeddingClient` (легко замінити провайдера).
