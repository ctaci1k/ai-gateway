# CLAUDE.md — AI Gateway

Контекст проєкту для AI-асистента. **Повна документація — у [docs/](docs/), починай з [docs/README.md](docs/README.md).**

## Що це

**AI Gateway / Router**: один запит користувача → кілька AI-моделей паралельно → AI-суддя (Gemini) обирає найкращу відповідь → персоналізація під користувача. Це **не** звичайний чатбот. Головний режим — **Compare**.

## Два режими

- **Single** — діалог з однією моделлю, стрімінг; за задумом **не зберігається** (але код наразі зберігає — див. D-3).
- **Compare** (головний) — `groq` + `cerebras` + `sambanova` відповідають, `gemini` судить, є rule-based fallback, ручний перевибір моделі навчає персоналізацію.

## Стек (реальний)

- **Backend:** Python 3.12+, FastAPI, Pydantic, asyncio; прямі SDK провайдерів (`groq`, `google-generativeai`, Cerebras, SambaNova). **Стан — у PostgreSQL** (SQLAlchemy async + Alembic-міграції); RAG-вектори — у вбудованому ChromaDB (PersistentClient). Є accounts/auth, квоти, BYOK (ключі — серверно, зашифровано AES-256-GCM envelope, per-account; PH30/D-20).
- **Frontend:** Next.js (App Router) + React + Tailwind; design tokens, i18n (uk/pl/en); частково TypeScript.

## Структура

- `backend/` — `main.py`, `routes/`, `services/` (orchestrator, provider), `providers/`, `selector/`, `memory/`, `schemas/`, `config/`.
- `frontend/` — `app/`, `layouts/`, `components/`, `features/`, `services/`, `store/`, `theme/`, `i18n/`, `types/`.
- `docs/` — структурована документація (джерело правди).

## Правила роботи з цим репозиторієм

1. **Не вигадувати стан.** Перед твердженням про «як працює» — звіряйся з кодом і з [docs/08-current-state.md](docs/08-current-state.md).
2. **Розрізняй шари:** бачення ([docs/00-vision.md](docs/00-vision.md)) ≠ реальний стан ([docs/08-current-state.md](docs/08-current-state.md)) ≠ план ([docs/09-roadmap.md](docs/09-roadmap.md)).
3. **Контракти API/даних:** [docs/03-api-contracts.md](docs/03-api-contracts.md), [docs/04-data-models.md](docs/04-data-models.md).
4. **Ухвалені рішення:** [docs/10-open-decisions.md](docs/10-open-decisions.md) (журнал рішень) — дотримуйся їх; нові розбіжності фіксуй там.
5. **Frontend golden rules:** без дублювання JSX/стилів/кольорів/текстів; без `fetch` у компонентах; тексти лише через `t("key")`; кольори лише через design tokens.

## Відоме (важливо)

- Відповідачі — Groq/Cerebras/SambaNova; **Gemini — суддя**, не відповідач (на відміну від старого опису GPT/Claude/Gemini).
- **Є** (реалізовано): PostgreSQL + accounts/auth, RAG (ChromaDB), квоти, BYOK, тести (pytest+vitest), **Docker + CI/CD** (GitHub Actions → GHCR → VPS), деплой на **https://st.byn.sarl** за aaPanel-проксі + Let's Encrypt. Деталі деплою — [docs/plans/013-cicd-deploy.md](docs/plans/013-cicd-deploy.md).
- Технічний борг — у [docs/08-current-state.md](docs/08-current-state.md).
