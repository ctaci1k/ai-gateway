# Плани виконання (execution plans)

Тут лежать **виконавчі плани** — атомарні, відстежувані, придатні для відновлення сесії. Відрізняються від [../09-roadmap.md](../09-roadmap.md) (стратегічний рівень) тим, що це **покрокові інструкції для агента-виконавця**.

**Щоб ВИКОНУВАТИ:** дай агенту [EXECUTE.md](EXECUTE.md) — безперервний runbook з єдиним якорем відновлення (GLOBAL STATE). Команда-кікоф — у кінці того файлу.
**Щоб ЗРОЗУМІТИ:** [000-deep-refactor-program.md](000-deep-refactor-program.md) — майстер-карта (інвентар антипатернів + цільова структура + порядок).

## Як працюють плани (протокол)

- Один файл = одне завдання: `NNN-<slug>.md`.
- Frontmatter: `plan`, `status: todo|in-progress|done`, `updated: YYYY-MM-DD`.
- Блок **«СТАН»** читається **першим** у новій сесії → продовжуй із пункту «Наступний крок».
- Працюй **атомарними кроками**. Після КОЖНОГО завершеного кроку одразу: `[x]`, онови «СТАН», онови `updated`.
- Прогрес — лише у файлі, ніколи «в голові»/чаті.
- Деталізація — **rolling-wave**: найближчі плани покрокові; пізніші — мета/обсяг/DoD, кроки фіналізуються перед стартом.

## Індекс планів (порядок виконання — за фазами EXECUTE)

| № | План | Фаза | Статус |
|---|------|------|--------|
| 000 | [Deep-refactor program](000-deep-refactor-program.md) — майстер-карта | — | todo |
| 005 | [Tooling & quality gates](005-tooling-and-quality-gates.md) (deps/env/lint/tests/CI) | PH0 + PH11 | todo |
| 002 | [Backend core hardening](002-backend-core-hardening.md) (помилки/CORS/конфіг/логи) | PH1 | todo |
| 003 | [Backend structural](003-backend-structural-refactor.md) (async/схеми/роутери/dedupe) | PH2 | todo |
| 010 | [Prompt management](010-prompt-management.md) (YAML + версіонування) | PH3 | todo |
| 007 | [Persistence / DB](007-persistence-database.md) (SQLAlchemy+Alembic) | PH4 | todo |
| 001 | [Frontend foundation](001-frontend-foundation-refactor.md) (тема/i18n/state) | PH5 | todo |
| 004 | [TypeScript migration](004-typescript-migration.md) | PH6 | todo |
| 006 | [Design integration](006-design-integration.md) (pixel-match) | PH7 | todo |
| 008 | [Accounts / auth](008-accounts-auth.md) (ізоляція per-user) | PH8 | todo |
| 009 | [Chat storage](009-chat-storage.md) (≤3) | PH9 | todo |
| 011 | [RAG](011-rag.md) (upload→embed→retrieve + UI) | PH10 | todo |
| 012 | [Deployment](012-deployment.md) (Docker/Nginx/SSL) | PH12 | todo |

## Порядок програми

**Канонічний лінійний порядок (PH0→PH12) + правила паралелізму субагентів — у [EXECUTE.md](EXECUTE.md).** Стисло:

```
Backend-фундамент:  PH0 tooling → PH1 hardening → PH2 structural → PH3 prompts → PH4 БД
Frontend+дизайн:    PH5 foundation → PH6 TS → PH7 design
Фічі поверх:        PH8 auth → PH9 chats(≤3) → PH10 RAG
Фіналізація:        PH11 quality/CI → PH12 deploy-артефакти
```

Порядок підібраний так, щоб **не плодити переробок (= борг)**: фічі будуються на готових фундаментах і дизайні.

## Обсяг і межі

- **Обсяг = ПОВНИЙ** (D-8): рефактор + усі фічі (БД, auth, чати, RAG, деплой). Нічого не відкладається.
- **001 = система** (токени/i18n/state, без зміни верстки) · **006 = візуал** (pixel-match) · фічі (008–011) будуються на 006.
- **Єдина зовнішня залежність (не борг):** реальне підняття VPS/DNS/SSL — твоя інфра; агент дає всі артефакти + owner-handoff ([012](012-deployment.md)).
