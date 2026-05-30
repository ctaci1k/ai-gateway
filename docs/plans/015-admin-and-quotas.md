---
plan: 015-admin-and-quotas
status: done
updated: 2026-05-30
---

# PH15 — Адмінпанель + ліміти акаунтів + код реєстрації + банер обмеженого акаунта

> Власник дає доступ працедавцям до застосунку й хоче: спостерігати їхні запити та витрату токенів, обмежувати їх (щоб не «забити» безкоштовні API-ключі), створювати акаунти самому. Рішення власника зафіксовані нижче.

## СТАН (читається першим у новій сесії)
- **✅ ПЛАН ЗАВЕРШЕНО (status: done, 2026-05-30):** виконано всі кроки **1–14** + DoD. BE-гейти зелені (ruff/black, pytest **101 passed**). FE-гейти зелені (**tsc · eslint · prettier · vitest 12 · next build**; i18n паритет uk/pl/en — 155 ключів). Доки оновлені: `03-api-contracts` (admin/register-code/quota), `04-data-models` (usage_events + поля User), `08-current-state` (секція PH15), `10-open-decisions` (D-10 позначено реалізованим). **Live-перевірка пройдена:** 403 без коду реєстрації; 3-й /chat при ліміті 2/день → 429 quota_exceeded; адмін безлімітний + бачить аудит токенів; не-адмін → 403 на /admin/*. Коміт/пуш — лише за прямим проханням власника (не робив).
- Останній виконаний крок: **13** — FE адмінпанель + (10) сервіси/стор + (11) банер + (12) реєстрація. Деталі:
  - **10:** `services/adminApi.ts` (listUsers/getUserUsage/createUser/updateUser); типи в `types/api.ts` (CurrentUser, AdminUserSummary, UsageEventRecord, AdminUserUsage, Create/UpdateUserPayload); `authApi.fetchMe()` → CurrentUser; `RegisterCredentials` (+registration_code); `AuthContext` зберігає CurrentUser, після login/register гідрує через fetchMe, додано `refresh()`.
  - **11:** `components/account/LimitBanner.tsx` (показ лише не-адмін з max_requests_per_day≠null; `limit.title`/`limit.text` з {perDay}/{remaining}); у Sidebar над AuthorCard. CSS `.limit-banner` (токени --danger).
  - **12:** `AuthScreen` — поле коду реєстрації (лише register), локалізована помилка `auth.invalidCode` за кодом `invalid_registration_code`.
  - **13:** `store/AdminViewContext.tsx` (isOpen/open/close, провайдер у layout), кнопка в Sidebar (лише `user.is_admin`), `components/admin/AdminPanel.tsx` (таблиця користувачів, inline-редагування лімітів, форма створення, розгортання аудиту з токенами; стани loading/empty/error, a11y, i18n); рендериться в `page.tsx` при isOpen&&is_admin. CSS `.admin-*` на токенах.
- Крок 9 — BE-тести `tests/test_admin_quotas.py` (9, через HTTP). Крок 8 — Admin API.
- Крок 6 — реєстрація за кодом: `RegisterRequest.registration_code`; роут `/auth/register` валідує (`_verify_registration_code`, порожній код → вимкнено, невідповідність → `403 invalid_registration_code`); `AuthService.register` ставить `is_admin` + ліміти (адмін null/null, інші 5/30). conftest: `REGISTRATION_CODE=test-reg-code` + високі дефолти 1000/100000.
- Крок 5 — enforcement квоти: `UsageRepository.count_since(since)`; `services/quota_service.py` (`QuotaService.check`, dep `enforce_quota`); `Depends(enforce_quota)` на `/chat` і `/chat/stream`. Compare = 1 запит.
- Крок 4: append-only `UsageRepository(user_id).record(...)` (`backend/memory/usage_repository.py`); `/chat` пише після `add_message` (`mode="compare"/"single"`, `success=bool(result["all_responses"])`); `/chat/stream` пише в кінці генератора (`mode="single"`, `total_tokens=None`, `success=completed and bool(full_text)`).
- Кроки 1–3 (раніше): БД-модель (`User`+поля, `UsageEvent`, міграція `0005_quotas_usage`, dev-БД стемплено 0004→0005); конфіг (`admin_username`, `registration_code`, дефолти 5/хв,30/день) + `.env.example`; токени з провайдерів (`generate_full()` + агрегація `execute_many`/orchestrator → `total_tokens`).
- **Увага (Python 3.14):** нульабельні Mapped-колонки оголошуй як `Mapped[int]/Mapped[str]` + `nullable=True` — `Mapped[X | None]` крешить SQLAlchemy на 3.14.
- **Нагадування про запуск БД:** `init_models()` робить `create_all` на старті (НЕ альтерить наявні таблиці). Для dev-sqlite після нової міграції — `alembic stamp <prev>` потім `alembic upgrade head`. Зараз БД на `0005`.
- Наступний крок: **немає — план завершено.** Можливий фоллоу-ап (поза 015): фіналізувати з власником текст банера `limit.text`; за проханням — коміт/пуш.
- Заблоковано: ні.
- Відкрите питання для власника (НЕ блокує крок 14): фінальний текст банера — поточний робочий варіант у `limit.text`.
- Змінені файли BE (за сесію): `backend/db/models.py`; `backend/migrations/versions/0005_quotas_usage.py` (новий); `backend/core/config.py`; `backend/.env.example`; `backend/providers/base_provider.py`; `backend/providers/openai_compatible.py`; `backend/services/provider_service.py`; `backend/services/orchestrator_service.py`; `backend/memory/usage_repository.py` (новий); `backend/routes/chat.py`; `backend/services/quota_service.py` (новий); `backend/schemas/auth.py`; `backend/services/auth_service.py`; `backend/routes/auth.py`; `backend/core/auth.py`; `backend/services/admin_service.py` (новий); `backend/schemas/admin.py` (новий); `backend/routes/admin.py` (новий); `backend/main.py`; `backend/tests/{conftest,test_auth,test_chats,test_provider_service}.py`; `backend/tests/test_admin_quotas.py` (новий); `docs/10-open-decisions.md` (D-10).
- Змінені файли FE (за сесію): `frontend/types/api.ts`; `frontend/services/authApi.ts`; `frontend/services/adminApi.ts` (новий); `frontend/store/AuthContext.tsx`; `frontend/store/AdminViewContext.tsx` (новий); `frontend/components/account/LimitBanner.tsx` (новий); `frontend/components/admin/AdminPanel.tsx` (новий); `frontend/components/auth/AuthScreen.tsx`; `frontend/components/sidebar/Sidebar.tsx`; `frontend/app/page.tsx`; `frontend/app/layout.tsx`; `frontend/theme/components.css`; `frontend/i18n/messages/{uk,pl,en}.json`.
- Відкриті питання: текст банера обмеженого акаунта — фіналізувати з власником (не блокує; картку автора вже погоджено в плані 014).

## Ухвалені рішення (власник, 2026-05-29) — додати в docs/10 як D-10
- **Модель ліміту = кількість запитів.** Compare (мульти) рахується як **1 запит**, Single = 1 запит.
- **Per-user ліміти у БД:** `max_requests_per_minute`, `max_requests_per_day`. Дефолт для працедавців: **5/хв, 30/день**. **Адмін: null/null = безліміт.**
- **Безліміт → банер обмеження НЕ показується** і enforcement не застосовується.
- **Адмін** — окремий прапорець `is_admin` (доступ до адмінпанелі + безліміт). Адмін-акаунт визначається через `ADMIN_USERNAME` (.env).
- **Реєстрація лише за кодом** `REGISTRATION_CODE` (.env): без валідного коду — відмова. Працедавцям акаунти створює адмін у панелі (там же ліміти).
- **Аудит:** окрема append-only таблиця `usage_events` (не обрізається, на відміну від `interactions`) — для лічби лімітів і перегляду в адмінці; зберігає витрачені токени.

## Кроки (атомарні; бекенд → фронтенд → доки)
- [x] 1. **БД-модель.** `User`: `is_admin: bool=false`, `max_requests_per_minute: int|null`, `max_requests_per_day: int|null`. Нова таблиця `usage_events` (id, user_id FK, created_at index, mode, message, selected_model, total_tokens int|null, success bool). Alembic-міграція `0005`.
- [x] 2. **Конфіг.** `core/config.py`: `admin_username`, `registration_code`, дефолтні ліміти `default_max_requests_per_minute=5`, `default_max_requests_per_day=30`. `.env.example` оновити.
- [x] 3. **Токени.** Дістати usage з відповідей провайдерів: `BaseProvider.generate_full()` → `{text, total_tokens}` (дефолт: текст + None); `OpenAICompatibleProvider` читає `response.usage.total_tokens`; `execute_many`/orchestrator повертають суму токенів ходу. Без зламу наявного контракту.
- [x] 4. **Запис usage.** Після кожного `/chat` і `/chat/stream` — запис `usage_events` (mode, message, selected_model, total_tokens, success). Окремо від rolling `interactions`.
- [x] 5. **Enforcement (квота).** Залежність на `/chat` і `/chat/stream`: рахує запити користувача за останню хвилину та добу з `usage_events`; перевищення → `429 quota_exceeded` з локалізованим тілом. Безлімітні (null) і адмін — без перевірки. Compare = 1 запит.
- [x] 6. **Реєстрація за кодом.** `/auth/register` приймає `registration_code`; без збігу з `REGISTRATION_CODE` → `403 invalid_registration_code`. Акаунт з `ADMIN_USERNAME` → `is_admin=true`, ліміти null; інші — дефолтні ліміти.
- [x] 7. **/auth/me розширити:** `is_admin`, `max_requests_per_minute/day`, `used_today`, `used_this_minute`, `remaining_today` — щоб FE показував банер і гейтив адмінку.
- [x] 8. **Admin API** (усе під перевіркою `is_admin`, мутації — CSRF): `GET /admin/users` (список + ліміти + usage сьогодні), `GET /admin/users/{id}/usage` (події/запити + токени), `POST /admin/users` (створити акаунт + ліміти), `PATCH /admin/users/{id}` (ліміти/скидання). Тонкі роутери + сервіс + схеми.
- [x] 9. **BE-тести:** enforcement (5/хв, 30/день, Compare=1), код реєстрації, ізоляція адмін-ендпоінтів (403 для не-адміна), запис usage/токенів.
- [x] 10. **FE сервіси/стор:** `services/adminApi`, розширити `authApi`/`AuthContext` полями is_admin/ліміти/usage.
- [x] 11. **FE банер обмеженого акаунта** (червона рамка) — над персональною карткою/зверху: «Цей акаунт обмежено: N запитів/день, бо застосунок використовує безкоштовні API-ключі. Залишилось: X.» Лише для лімітованих (не адмін). i18n uk/pl/en, токени дизайну.
- [x] 12. **FE екран реєстрації:** поле «код реєстрації» + помилка невірного коду (i18n).
- [x] 13. **FE адмінпанель:** окремий розділ/сторінка, видима лише адміну (гейт через `useAuth().is_admin`): таблиця користувачів, їхні запити (аудит) + токени, форми створення акаунта й редагування лімітів. Усі стани loading/empty/error, a11y, i18n.
- [x] 14. **Зелено + доки:** BE pytest+ruff+black; FE tsc+eslint+prettier+vitest+build. Оновити `03-api-contracts` (admin, register code, quota 429), `04-data-models` (usage_events, поля User), `08-current-state`, `10-open-decisions` (D-10). Live-перевірка ліміту.

## Перевірка (Definition of Done)
- [x] Лімітований акаунт: понад N/хв або N/день → `429 quota_exceeded` з локалізованим повідомленням; Compare рахується як 1. _(live: 3-й /chat при 2/день → 429; BE-тест per-minute/per-day/compare)_
- [x] Реєстрація без коду неможлива; акаунт `ADMIN_USERNAME` — адмін і безліміт. _(live: 403 без коду; admin → is_admin+null ліміти)_
- [x] Адмін бачить список акаунтів, їхні запити та витрачені токени; може створювати акаунти й міняти ліміти; не-адмін отримує 403 на /admin/*. _(live: усе підтверджено, аудит total_tokens)_
- [x] Банер обмеження видно лише лімітованим; у безлімітних/адміна його немає. _(LimitBanner: гард `is_admin || max_requests_per_day==null`)_
- [x] Зелено BE+FE; доки оновлені; D-10 внесено. _(BE 101 passed + ruff/black; FE tsc/eslint/prettier/vitest 12/build; docs/03,04,08,10 оновлені)_
