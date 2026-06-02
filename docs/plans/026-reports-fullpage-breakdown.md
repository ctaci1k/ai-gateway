---
plan: 026-reports-fullpage-breakdown
status: done
updated: 2026-06-02
---

# PH28 — Звіти: повноекранний розділ + drill-down «Розкладка» + фільтр за ключем (Варіант B)

> Продовження PH27 (D-18). Власник: дашборд у вузькій модалці «дрібний/незручний»;
> рішення архітектора (Варіант B) — **винести Звіти з модалки у повноекранний
> розділ** (як Admin), додати вкладку **«Розкладка»** з акордеон-drill-down
> `ключ доступу → модель → чати` і **глобальний фільтр за ключем доступу**
> (усе / наш / свій). Без вигаданого стану: кожне «як працює» звіряти з кодом.
> Кроки атомарні, гейти після кожного блоку. Коміт/пуш — у фіналі.

## Чому саме так (ухвалені рішення архітектора)
1. **Повний екран, не модалка.** Аналітику порівнюють очима — їй потрібні ширина,
   повітря, повноширинні графіки. Патерн уже є в коді: `AdminViewContext` →
   `app/page.tsx` рендерить `<AdminPanel/>` замість чату. Звіти **дзеркалять**
   цей патерн (`ReportsContext` стає view-тоглом; модалку прибираємо).
2. **Вкладки лишаються** як основна навігація (enterprise-конвенція), Огляд —
   завжди-видима вітрина. **Акордеон — лише в окремій вкладці «Розкладка»**, де є
   справжня ієрархія.
3. **«Ключ доступу» — це фільтр/факт, а не рівень-секція.** Глобальний сегмент
   (усе / наш / свій) зверху, застосовується до всіх вкладок. У drill-down він —
   ВЕРХНІЙ рівень дерева (бо квотне питання головне): `ключ → модель → чати`.
4. **Дані drill-down — один серверний ендпоінт** `/reports/breakdown` повертає
   готове вкладене дерево (per-user обсяги малі), щоб акордеон розкривався
   миттєво без довантажень.

## Контекст із коду (ground truth)
- Перемикання повноекранних розділів: `store/AdminViewContext.tsx` (open/close) +
  `app/page.tsx` (`showAdmin ? <AdminPanel/> : чат`). Admin відкривають із topbar.
- Звіти зараз: `store/ReportsContext.tsx` (модалка open/close + `target`-scaffold),
  `components/reports/ReportsModal.tsx` (рамка `settings-dialog`), вкладки
  `OverviewTab/ByModelTab/ByChatTab/ActivityLogTab`, `MiniChart`, `RepState`,
  `reportUtils`. Монтаж модалки — `layouts/MainLayout.tsx`. Кнопка — `AccountMenu`.
- Бекенд: `routes/reports.py` (`/reports/{summary,by-model,by-chat,timeseries,
  events,events.csv}`, `Depends(current_user)`), агрегації — `memory/
  usage_report_repository.py` (`_scope(start,end)` per-user), схеми — `schemas/
  reports.py`. Ledger `usage_events` має `billable` (true=наш ключ, false=свій).
- i18n — flat-ключі `t()` (паритет uk/pl/en); кольори/відступи — токени `theme/`;
  без `fetch` у компонентах (лише `services/`); стан — `store/`.

---

## Блок A — бекенд: фільтр за ключем + breakdown (атомарно; гейти pytest/ruff/black)
- [x] **A1. Фільтр billable у репозиторії.** `_scope(start,end,billable)` + усі
  методи (`summary/by_model/by_chat/timeseries/events/iter_events_for_csv`)
  пробросюють `billable: bool|None=None`.
- [x] **A2. Метод `breakdown(start,end,billable)`** — вкладене дерево `access_key
  (app|own) → model → chats` з requests/total_tokens на кожному рівні; зібране в
  Python з однієї пласкої вибірки (LEFT JOIN chats); chat_id NULL → ad-hoc bucket;
  сортування за requests спадно; з `billable` — лише одна група.
- [x] **A3. Роути+схеми.** Спільний `access` (`app|own`) → billable на **усіх**
  `/reports/*` (incl. `events.csv`); новий `GET /reports/breakdown`. Схеми
  `Breakdown{Chat,Model,Group,Response}`. `docs/03` оновлено.
- [x] **A4. Тести BE.** `test_access_filter_summary_and_events` + `test_breakdown_
  tree_shape` (+filtered). Гейти: BE **159 passed** + ruff/black. Локальний backend
  перезапущено (нові роути 401).

## Блок B — фронтенд: повноекранний розділ (гейти tsc/eslint/prettier/vitest/build)
- [x] **B1. View-тогл.** `app/page.tsx` рендерить `<ReportsPage/>` коли
  `useReports().isOpen` (пріоритет reports > admin > chat). Взаємовиключність на
  call-sites: `AccountMenu` (open reports → `closeAdmin`), `Topbar` (open admin →
  `closeReports`). `<ReportsModal/>` прибрано з `MainLayout`, файл видалено.
- [x] **B2. `ReportsPage`** (повна ширина): шапка (тайтл + «Назад»), тулбар
  (період + сегмент ключа), вкладки Огляд/Розкладка/За моделями/За чатами/Журнал;
  стан періоду+ключа в сторінці; remount контенту по `key=${rangeKey}|${access}`.
  Вкладки переюзано.
- [x] **B3. CSS повного екрана.** Секція «USAGE REPORTS» переписана: `.rep-page`
  (max-width 1180, повітря), `.rep-toolbar`/`.rep-access`/`.rep-tabs`/`.rep-tab`,
  акордеон `.rep-acc*`/`.rep-leaf*`; адаптив 768/430. Мертві модальні класи
  (`.rep-dialog/.rep-rangebar/.rep-grid/.rep-nav/.rep-content/.rep-title`) прибрано.

## Блок C — фронтенд: «Розкладка» (акордеон) + фільтр ключа
- [x] **C1. Сервіс+типи.** `access?: "app"|"own"` вкладено в `ReportRange` (тече в
  усі виклики + CSV-лінк через `rangeQuery`); `getBreakdown(range)`; типи
  `Breakdown{Chat,Model,Group,Response}` + `ReportAccess` у `types/api.ts`.
- [x] **C2. `BreakdownTab`** — акордеон `ключ → модель → чати` (Set-стан розгортань;
  групи розгорнуті, моделі згорнуті); a11y `aria-expanded`/`aria-controls`/Enter/
  Space/focus-visible/обертання шеврона; листок-чат → `setMode`+`selectChat`+
  `close`, ad-hoc некликабельний; `RepState`.
- [x] **C3. Сегмент ключа доступу** у тулбарі (`role=group`/`aria-pressed`, усе/
  наш/свій) → `ReportRange.access` → всі вкладки + CSV.

## Блок D — i18n + a11y + доки + гейти + деплой
- [x] **D1. i18n.** `reports.tab.breakdown`, `reports.access.{label,all,app,own}`,
  `reports.breakdown.legend`, `reports.back` — паритет uk/pl/en; `i18n/index.test`
  зелений.
- [x] **D2. a11y/responsive + гейти.** Акордеон/сегмент/таблиці — клавіатура+aria;
  768/430 адаптив. BE pytest(**159**)/ruff/black; FE tsc/eslint/prettier/
  vitest(**26**)/build — усі зелені.
- [x] **D3. Доки+деплой.** `docs/03` (`access`+`/reports/breakdown`), `docs/06`
  (повноекранний розділ + Розкладка), `docs/08` (PH28), `docs/10` (нотатка під
  D-18). `status: done`. Коміт + `git push origin main`.

## Definition of Done
- [x] Звіти — **повноекранний розділ** (не модалка); вкладки Огляд/Розкладка/За
      моделями/За чатами/Журнал.
- [x] **Розкладка** — акордеон `ключ доступу → модель → чати` з лічбою запитів/
      токенів на кожному рівні; клавіатура+aria; клік по чату відкриває чат.
- [x] **Фільтр ключа доступу** (усе/наш/свій) застосовується до всіх вкладок і CSV.
- [x] Per-user ізоляція; BE+FE гейти зелені; i18n паритет; docs оновлені;
      деплой — D3.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **D3** — усі блоки A–D виконано, доки оновлено, гейти
  зелені (BE 159, FE vitest 26/build). Лишається коміт+пуш (виконується).
- Наступний крок: деплой — `git push origin main` → Actions + `/api/reports/
  breakdown` → 401.
- Заблоковано: **ні**.
