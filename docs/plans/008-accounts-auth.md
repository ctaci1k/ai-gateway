---
plan: 008-accounts-auth
status: done
updated: 2026-05-29
---

# Accounts / Auth — мінімальні, але ПОВНОЦІННІ акаунти

> Реалізує D-2 (мінімальні акаунти) **повноцінно, без костилів**: реальний логін, ізоляція даних per-user. Будується на [007](007-persistence-database.md) (БД) + фронт-фундаменті/дизайні (001/004/006).

## СТАН (читається першим)
- Останній виконаний крок: **9** — усі кроки виконані; план `done`.
- Наступний крок: — (PH8 завершено; далі PH9 / план 009 — збереження чатів ≤3).
- Заблоковано: ні.
- Змінені файли (BE): `requirements.txt` (argon2-cffi), `core/{config,security,auth,errors}.py`, `db/models.py` (User.password_hash + Session), `migrations/versions/0002_auth.py`, `services/auth_service.py`, `routes/auth.py` (+ chat/preferences/memory гарди), `memory/{repository,sql_repository}.py` (per-user), `main.py`, `schemas/auth.py`, `tests/*`, `pyproject.toml` (ignore B008).
- Змінені файли (FE): `services/{apiClient,authApi,chatApi,compareApi,preferencesApi}.ts`, `store/AuthContext.tsx`, `components/auth/AuthScreen.tsx`, `components/sidebar/ProfileCard.tsx`, `app/{layout,page}.tsx`, `theme/components.css`, i18n auth-ключі.
- Відкриті питання/рішення: D-2/D-8 реалізовано; CSRF = double-submit; сесії server-side.

> Реалізовано: argon2-хеш, server-side сесії (таблиця `sessions`, httpOnly+Lax cookie, Secure-конфіг), double-submit CSRF, register/login/logout/me, **per-user ізоляція** (перевірено тестом), гарди 401→403. FE: AuthContext + authApi (credentials+CSRF), AuthScreen, gate у `page.tsx`, профіль+logout. BE 51 тестів; FE tsc/build/eslint зелені; alembic head з нуля створює users/preferences/interactions/sessions.

## Дефолти
- Сесії: **httpOnly + Secure cookie**, серверна сесія; паролі — **bcrypt/argon2** (passlib). CSRF-захист для мутацій.
- «Мінімальні» = простий набір (register/login/logout/me), але **без костилів** (реальне хешування, валідація, ізоляція). Не enterprise-SSO.
- Секрети (`SESSION_SECRET` тощо) — лише з `.env`.

## Навіщо
- Зараз один глобальний стан, без юзерів/ізоляції. Для збереження чатів і персоналізації per-user потрібен реальний акаунт.

## Кроки
- [x] 1. Залежності (passlib/argon2, сесії) + `.env` секрети.
- [x] 2. User-сервіс: реєстрація (хеш), верифікація пароля, отримання профілю.
- [x] 3. Сесійна автентифікація (cookie) + FastAPI-залежність `current_user` + CSRF.
- [x] 4. Ендпоінти: `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me`.
- [x] 5. Ізоляція даних: чати/повідомлення/preferences — **тільки** в межах `current_user` (репозиторії 007).
- [x] 6. FE: auth-store + `services/authApi` (без `fetch` у компонентах), типізовано.
- [x] 7. FE UI: логін/реєстрація/вихід (компоненти дизайну, i18n uk/pl/en, a11y, стани loading/empty/error); профіль у Sidebar (`ProfileCard`/`AccountCard`).
- [x] 8. Гард доступу: захищені дії/в'юхи; коректні 401/403 (формат помилок з 002).
- [x] 9. Тести: auth-флоу, ізоляція даних, негативні кейси.

## Перевірка (Definition of Done)
- [x] Реальний логін/логаут працює; паролі хешовані; cookie httpOnly+Secure; CSRF.
- [x] Дані строго ізольовані per-user (перевірено тестом).
- [x] Секрети лише з `.env`; жодних хардкодів.
- [x] FE: усі стани + a11y + i18n; без `fetch` у компонентах.
- [x] Тести зелені; контракти [../03-api-contracts.md](../03-api-contracts.md) оновлені; план `status: done`.

## Нотатки
- Однокористувацький сценарій теж працює (один акаунт) — але архітектура мульти-юзерна.
