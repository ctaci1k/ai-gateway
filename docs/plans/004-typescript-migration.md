---
plan: 004-typescript-migration
status: done
updated: 2026-05-29
---

# Frontend TypeScript migration (поступова)

> Реалізує рішення **D-7**: фіксуємо поточну структуру, мігруємо на TS **поступово** (нові файли `.ts/.tsx`, без великого переписування). Після [001](001-frontend-foundation-refactor.md). Деталізація кроків фіналізується перед стартом.

## СТАН (читається першим)
- Останній виконаний крок: **7** — усі кроки виконані; план `done`.
- Наступний крок: — (PH6 завершено; далі PH7 / план 006 — design integration).
- Заблоковано: ні.
- Змінені файли: `tsconfig.json` (новий, `jsconfig.json` видалено), `types/{api.ts,Message.ts}` (декоративні видалено), `services/*.ts`, `store/*.tsx`, `features/**/use*.ts` + `*.tsx`, `layouts/*.tsx`, `app/{layout,page}.tsx`, усі `components/**/*.tsx`. Весь FE-код — TS; `.js/.jsx` у джерелах не лишилось.
- Відкриті питання/рішення: D-7 виконано повністю (повна міграція, а не лише поступова) — strict увімкнено.

> Примітка: міграцію виконано **повністю** (не лише «поступово»), бо обсяг невеликий і D-8 вимагає нуль боргу. `strict: true` + `next build`/`tsc --noEmit` зелені.

## Навіщо
- F10: змішані `.js/.jsx/.ts`; типи **декоративні** (`Provider` = `{provider, model}`) і не відповідають реальним даним `/chat`.
- F9: `@/` alias не вживається.

## Кроки (rolling-wave — уточнити перед стартом)
- [x] 1. `tsconfig.json` (`allowJs: true`, `strict` поступово), шляхи `@/*`.
- [x] 2. **Реальні доменні типи** з [../04-data-models.md](../04-data-models.md): `Message`, `Provider`, `ChatResponse`/`AllResponses`, `SelectorMetadata`, `Preferences` (замість декоративних).
- [x] 3. `services/*` → `.ts` (типовані запити/відповіді, обробка помилок, base URL з `.env`).
- [x] 4. `store/*` → `.tsx` (типовані контексти; `useI18n`/`useTheme`).
- [x] 5. `hooks/*` (`useChat`/`useCompare`) → `.ts`.
- [x] 6. Компоненти → `.tsx` хвилями (sidebar → chat → compare → selector).
- [x] 7. «Храповик» строгості: вмикати `noImplicitAny`/`strict` після кожної хвилі.

## Перевірка (Definition of Done)
- [x] Немає неявного `any` у мігрованих файлах; `next build` зелений.
- [x] Типи відповідають контрактам [../04-data-models.md](../04-data-models.md).
- [x] Імпорти через `@/`; план `status: done`.

## Нотатки
- Не блокувати фічі заради 100% TS — мігрувати разом із дотиком до файлу + цільові хвилі.
