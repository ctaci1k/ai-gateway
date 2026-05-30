---
plan: 007-persistence-database
status: done
updated: 2026-05-29
---

# Persistence layer — реальна БД замість in-memory

> Закриває B11 (глобальний in-memory стан) **повноцінно**, без костилів. Будується на репозиторій-seam із [003](003-backend-structural-refactor.md). Реалізує персист для [09-roadmap](../09-roadmap.md) Фаз 4–5.

## СТАН (читається першим)
- Останній виконаний крок: **9** — усі кроки виконані; план `done`.
- Наступний крок: — (PH4 завершено; далі PH5 / план 001 — frontend foundation).
- Заблоковано: ні (003 завершено).
- Змінені файли: `requirements.txt`/`.env.example` (DB), `core/config.py` (DATABASE_URL/HISTORY_LIMIT), `core/db.py`, `db/models.py`, `memory/{repository,sql_repository,preferences_logic}.py` (chat_buffer.py видалено), `routes/{chat,preferences,memory}.py` (await repo), `main.py` (lifespan), `alembic.ini`, `migrations/*`, `tests/*`, `docs/04`, `docs/08`.
- Відкриті питання/рішення: chats/messages → PH9 (де використовуються), щоб не плодити невживані таблиці.

## Дефолти (щоб не вгадувати під час виконання)
- ORM: **SQLAlchemy 2.x (async)**; міграції: **Alembic**.
- БД: **SQLite (dev)** з конфігом, готовим під **PostgreSQL (prod)** — рядок підключення з `.env` (`DATABASE_URL`).
- Жодного «другого джерела стану»: in-memory повністю замінюється репозиторіями.

## Навіщо
- `memory/chat_buffer.py` — глобальний `deque(maxlen=10)`, зникає при рестарті, без мульти-юзера. Це борг → усуваємо повноцінно.

## Кроки
- [x] 1. Залежності: SQLAlchemy[asyncio], Alembic, aiosqlite (dev) + asyncpg (prod), greenlet → `requirements.txt`/`.env.example` (`DATABASE_URL`).
- [x] 2. `core/db.py`: async engine + `async_sessionmaker` + `session_scope`; lifespan у `main.py` (`init_models`/`dispose_engine`).
- [x] 3. Моделі `db/models.py`: `users`, `preferences`, `interactions` (chats/messages → PH9, де використовуються).
- [x] 4. Alembic (`alembic.ini`, `migrations/env.py` із sync-URL, `versions/0001_initial.py`); `alembic upgrade head` з нуля — перевірено.
- [x] 5. `SqlChatRepository` під інтерфейс `ChatRepository` (async); логіка уподобань — у `preferences_logic.py`.
- [x] 6. Роутери підключені до репозиторію (await); sliding window → `HISTORY_LIMIT` запитом.
- [x] 7. Глобальний in-memory `ChatBuffer` прибрано (файл видалено).
- [x] 8. Тести: `test_repository.py` (add/get, sliding window, **персист між інстансами**, clear, manual), `test_preferences_logic.py`; e2e-смоук (рестарт зберігає дані).
- [x] 9. Оновлено [../04-data-models.md](../04-data-models.md) (схема — ✅).

## Перевірка (Definition of Done)
- [x] Дані переживають рестарт (e2e-смоук); немає глобального in-memory стану.
- [x] Міграції відтворювані (`alembic upgrade head` з нуля створює users/preferences/interactions).
- [x] Готовність до Postgres (лише `DATABASE_URL`; asyncpg у залежностях).
- [x] Тести зелені (43 passed); контракти даних оновлені; план `status: done`.

## Нотатки
- Single-чат лишається ефемерним (D-3) — не персистимо.
- Персоналізація (`preferences`) тепер персиститься per-user (готує ґрунт для 008).
