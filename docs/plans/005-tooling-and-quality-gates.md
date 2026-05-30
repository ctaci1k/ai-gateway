---
plan: 005-tooling-and-quality-gates
status: done
updated: 2026-05-29
---

# Tooling & quality gates — залежності, конфіг, формат, лінт, тести, CI

> Усуває C1–C6, B14/F12 (формат), C7 (env). **005a** (фундамент) робимо рано/паралельно, **005b** (масовий формат, тести, CI) — у контрольованих точках, щоб не конфліктувати з правками.

## СТАН (читається першим)
- Останній виконаний крок: **8 (005b)** — CI (GitHub Actions). Усі кроки 005a+005b + DoD виконані; фаза PH11 завершена.
- Наступний крок: — (перехід до PH12, план [012](012-deployment.md)).
- Заблоковано: ні.
- Змінені файли (005b): `frontend/.prettierignore` (design-reference), масовий `prettier --write`, `frontend/package.json` + `package-lock.json` (vitest/RTL + test-скрипти), `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`, `frontend/tsconfig.json` (exclude тестів), FE-тести (`i18n/index.test.ts`, `components/chat/PromptInput.test.tsx`, `components/sidebar/ChatModeSelector.test.tsx`), `backend/requirements-dev.txt` (pre-commit), `.pre-commit-config.yaml`, `.github/workflows/ci.yml`.
- Відкриті питання/рішення: —

## Навіщо (приземлено)
- **C1:** немає `requirements.txt`/`pyproject` — залежності не відтворювані (лише `venv`).
- **C2:** немає `.env.example` — конфіг/секрети недокументовані (FE+BE).
- **C3:** немає кореневого README.
- **C4:** немає тестів (FE/BE).
- **C5:** немає форматерів/лінтерів (Ruff/Black; Prettier; ESLint є частково).
- **C6:** немає CI.

## Кроки

### 005a — Фундамент (рано, паралельно)
- [x] 1. Зафіксувати залежності бекенду: `requirements.txt` або `pyproject.toml` (з поточного `venv`). → `requirements.txt` + `requirements-dev.txt` (pinned до venv).
- [x] 2. `.env.example` для backend (ключі провайдерів, CORS, ліміти) і frontend (`NEXT_PUBLIC_API_URL`); звірити з `.gitignore`. → обидва створено; `.gitignore` (root+frontend) виправлено, щоб `.env.example` трекались, а `.env`/`*.local` ні (перевірено `git check-ignore`).
- [x] 3. Кореневий `README.md` (запуск FE+BE, посилання на `docs/`).
- [x] 4. Конфіги якості: Python — Ruff + Black (`backend/pyproject.toml`); Frontend — Prettier (`.prettierrc`/`.prettierignore`) + ESLint узгоджено через `eslint-config-prettier`; `.editorconfig`. Усі тулзи встановлено й перевірено (ruff/black/prettier/eslint запускаються).

### 005b — Гейти (контрольовані точки)
- [x] 5. Масовий авто-формат (Black/Prettier) — виконано; `design-reference` винесено з prettier (reference-артефакт). Усе репо проходить формат.
- [x] 6. `pre-commit` (format+lint): `.pre-commit-config.yaml` (local/system хуки: ruff+black для backend, prettier+eslint для frontend), `pre-commit` у `requirements-dev.txt`; перевірено `pre-commit run --all-files`.
- [x] 7. Тести-базлайн: BE `pytest` (76 — selector/агрегація/repo/auth/chats/RAG/API); FE — `vitest`+RTL (i18n parity, рендер `PromptInput`/`ChatModeSelector`), 7 тестів.
- [x] 8. CI (GitHub Actions, `.github/workflows/ci.yml`): backend (ruff/black/pytest) + frontend (prettier/eslint/tsc/vitest/next build) на push+PR у `main`.

## Перевірка (Definition of Done)
- [x] `pip install -r` / lockfile відтворює бекенд; `.env.example` повний.
- [x] Формат/лінт проходять на всьому репо; `pre-commit` працює.
- [x] Тести зелені локально (BE 76, FE 7); CI запускається на push+PR.
- [x] Кореневий README актуальний; план `status: done`.

## Нотатки
- 005a НЕ змінює логіку — безпечно робити першим.
- Масовий формат (005b-5) робити, коли структурні плани не «в польоті», щоб уникнути конфліктів діффів.
