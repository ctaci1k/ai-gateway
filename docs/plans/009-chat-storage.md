---
plan: 009-chat-storage
status: done
updated: 2026-05-29
---

# Chat storage — збережені чати (до 3)

> Реалізує збереження чатів (D-3, [09-roadmap](../09-roadmap.md) Фаза 2/4) **повноцінно**. Додає ендпоінти, яких бракувало (`/new-chat`, `/delete-chat` тощо). Будується на [007](007-persistence-database.md) + [008](008-accounts-auth.md) + дизайні (006).

## СТАН (читається першим)
- Останній виконаний крок: **6** — усі кроки + DoD виконані; фаза PH9 завершена.
- Наступний крок: — (перехід до PH10, план [011](011-rag.md)).
- Заблоковано: ні.
- Змінені файли: BE — `db/models.py` (`Chat`/`ChatMessage`), `migrations/versions/0003_chats.py`, `core/config.py` (`SAVED_CHATS_LIMIT`), `memory/chats_repository.py`, `schemas/chats.py`, `routes/chats.py`, `main.py`, `schemas/chat_schema.py` (`chat_id`), `routes/chat.py` (персист у чат), `tests/test_chats.py`. FE — `services/chatsApi.ts`, `store/ChatsContext.tsx`, `app/layout.tsx`, `components/sidebar/{ChatList,NewChatButton}.tsx`, `components/icons/Icons.tsx` (`IconEdit`), `services/compareApi.ts`, `features/compare/{useCompare.ts,ComparePage.tsx}`, `types/api.ts`, `i18n/messages/{en,uk,pl}.json`, `theme/components.css`. Docs — `03`, `04`, `08`.
- Відкриті питання/рішення: D-3 ([../10-open-decisions.md](../10-open-decisions.md)).

## Навіщо
- Є UI-компоненти (`ChatList`, `NewChatButton`) **без бекенду**. Реалізуємо реальне сховище.

## Дефолти / правила
- Ліміт **до 3 чатів** на користувача (тестова версія) — забезпечити на бекенді.
- Зберігаються **Compare-чати** (з повідомленнями/відповідями). **Single — ефемерний** (D-3), не зберігається.

## Кроки
- [x] 1. Схеми + ендпоінти: `create` (≤3 enforce), `list`, `get`, `rename`, `delete` (per-user, репозиторії 007).
- [x] 2. Персист повідомлень/Compare-сесій у межах чату (`chat_id` у `POST /chat`).
- [x] 3. FE: `services/chatsApi` (типізовано); active-chat у `store/` (`ChatsContext`).
- [x] 4. FE UI: `ChatList` (реальні дані), `NewChatButton`, перемикання/перейменування/видалення (компоненти дизайну, i18n, a11y, стани).
- [x] 5. Інтеграція з історією: відкриття чату підвантажує його повідомлення (останній хід → Compare).
- [x] 6. Тести: CRUD, ліміт ≤3, ізоляція per-user, Single не зберігається.

## Перевірка (Definition of Done)
- [x] Створення/перемикання/перейменування/видалення працює; ліміт ≤3 enforced на бекенді.
- [x] Чати персистяться per-user; Single ефемерний.
- [x] FE: усі стани + i18n + a11y; без `fetch` у компонентах.
- [x] Тести зелені; контракти оновлені; план `status: done`.
