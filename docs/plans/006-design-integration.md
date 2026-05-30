---
plan: 006-design-integration
status: done
updated: 2026-05-29
---

# Design integration — pixel-match макета

> Робить так, щоб UI **точно** виглядав як затверджений макет ([../../frontend/design-reference/ai-gateway/](../../frontend/design-reference/ai-gateway/)). Будується на фундаменті [001](001-frontend-foundation-refactor.md). **Свідомо відкладено** (рішення власника: не спонтанно). Покрокова деталізація — перед стартом.

## СТАН (читається першим)
- Останній виконаний крок: **8** — усі кроки виконані; план `done`.
- Наступний крок: — (PH7 завершено; далі PH8 / план 008 — акаунти/auth).
- Заблоковано: ні.
- Змінені файли: `theme/tokens.css` (+`--accent-rgb`), `theme/components.css` (новий — портована візуальна система), `app/globals.css` (import), `components/icons/Icons.tsx` (новий), усі `components/**`, `layouts/*`, `features/*`, `services/preferencesApi.ts` (новий), i18n-ключі.
- Відкриті питання/рішення: System Log/topbar статичні (живий час уникнено через hydration); saved chats — PH9.

> Реалізовано: візуальна система портована з `design-reference/styles.jsx` у `theme/components.css` (токен-базована, без хардкоду в TSX). Sidebar (acct/mode-items з violet active-bar/New Chat/saved/lang/System Log), topbar, ChatView (бульбашки user/ai + composer + банери), Compare-картки (winner flag, score-bar, stats, CTA). Реальні дані `/chat`; CTA → `/preferences/manual-selection`. Адаптив `≤1180px`, a11y, стани loading/empty/error. `tsc`/`next build`/eslint зелені. Виявлено й виправлено баг prettier-plugin-tailwindcss (зрізав пробіл у умовних класах).

## Навіщо
- F13: поточний UI не відповідає затвердженому макету (темна тема, фіолетовий акцент, єдиний slate-сайдбар, модалка All Model Responses з картками/score-барами).

## Обсяг (з `design-reference/NOTES.md`)
- **Sidebar:** acct-card, project-dropdown, slate-items із violet active-bar, System Log.
- **Topbar:** «AI Gateway v1.0 — Multi-Model Response System», статус/час.
- **ChatView:** банер «Gemini Judge unavailable», «Show All Responses», бульбашки user/ai, composer.
- **Responses modal:** 3 картки (Groq/Cerebras/SambaNova), score-bar, прапор «Best answer», CTA `Selected by Gemini Judge` / `Confirm` / `Change`.
- **Іконки:** набір line-іконок (з `icons.jsx`). `tweaks-panel.jsx` — **НЕ** портувати (риштування).

## Кроки (rolling-wave — уточнити перед стартом)
- [x] 1. Звірити/доповнити `theme/tokens.css` під палітру макета (dark вже = макет).
- [x] 2. Іконки: завести set у `components/` (з `icons.jsx`).
- [x] 3. Sidebar → розкладка макета (на токенах + `t()`).
- [x] 4. Topbar/StatusBanner → макет.
- [x] 5. ChatView (Single) → бульбашки/composer/банер.
- [x] 6. Responses modal → картки/score-bar/winner/CTA, колонки через `map()`.
- [x] 7. Прив'язка до **реальних** даних `/chat` (`all_responses`, `selector_scores`, `selected_model`, `fallback_used`); CTA «Change» → `/preferences/manual-selection`.
- [x] 8. Адаптив (`≤1180px` → 1 колонка), a11y, стани loading/empty/error.

## Перевірка (Definition of Done)
- [x] Відповідає скриншотам (`chatfinal.png`, `modal3.png`) візуально.
- [x] Лише токени + `t()`; колонки через `map()`; без хардкоду.
- [x] Реальні дані `/chat`; ручний вибір пише персоналізацію.
- [x] Адаптив + a11y + усі стани; `next build` зелений; план `status: done`.

## Нотатки
- Не копіювати внутрішню структуру прототипу — відтворити **візуал** у нашій архітектурі.
