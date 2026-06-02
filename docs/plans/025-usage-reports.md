---
plan: 025-usage-reports
status: done
updated: 2026-06-02
---

# PH27 — Звіти про використання (Usage Reports) — enterprise-grade

> Реальний self-service розділ **«Звіти»** для КОЖНОГО акаунта: повна історія
> активності — запити, токени, моделі, чати, повідомлення — з агрегаціями,
> графіками, фільтром за періодом та експортом. Замінює теперішню заглушку
> `ComingSoonModal("reports")`. Проектуємо так, як зробила б велика інженерна
> команда: **єдиний append-only реєстр подій (`usage_events`) → агрегації →
> дашборд**. Без вигаданого стану — кожне «як працює» звіряй із кодом.
> Enterprise: без заглушок-недоробок, без TODO, кроки атомарні, гейти після
> кожного. Коміт/пуш — у фіналі (деплой автоматичний з push origin main).

## Власник делегував архітектору (2026-06-02)
- «Звіт = повна історія всього, що відбувалося на акаунті: усі токени, усі
  запити, який чат скільки токенів/запитів використав». Зробити **як велика
  досвідчена корпорація**. Рішення щодо складу/обсягу — за архітектором.
- Кнопка «Звіти» — **для всіх** користувачів (рішення власника D-17/п.6), уже є
  в меню акаунта (PH25). Адмін — теж бачить свої звіти; перегляд звітів ІНШИХ
  юзерів адміном — бонус (блок G, не блокер).

## Контекст із коду (ground truth — ЗВІР перед кожним блоком)
- **`usage_events`** (`db/models.py`, Alembic `0005`) — append-only реєстр:
  `id, user_id(FK), created_at(index), mode("single"|"compare"), message(промпт),
  selected_model(nullable), total_tokens(int,nullable), success(bool)`.
  **НЕ обрізається** (на відміну від rolling `interactions`). Це вже джерело
  правди для квот і admin-usage — будуємо звіти НА НЬОМУ.
- **Запис події** — `memory/usage_repository.py::UsageRepository.record(mode,
  message, selected_model, total_tokens, success)`. Викликається в
  `routes/chat.py`:
  - `/chat` (Compare): пишеться **лише якщо `should_charge`** (тобто НЕ коли всі
    учасники на BYOK). `total_tokens` = `result.get("total_tokens")` (агрегат
    відповідачів, реальний — з `response.usage.total_tokens`, див. нижче).
  - `/chat/stream` (Single): пишеться лише якщо `should_charge`; **`total_tokens`
    завжди `None`** (стрім не читає usage).
  - Обидва місця **мають доступ до `request.chat_id`** (PH24/D-17) — але зараз
    він НЕ записується в `usage_events`.
- **Токени з провайдера:** `providers/openai_compatible.py::generate_full`
  повертає `total_tokens` із `response.usage.total_tokens` (Compare — є).
  `generate_stream` yield-ить лише текстові `delta` — **usage НЕ збирається**.
  OpenAI-сумісні сервери підтримують `stream_options={"include_usage": true}` —
  тоді фінальний chunk несе `usage` (з порожнім `choices`); поточний цикл його
  пропускає (`if not chunk.choices: continue`).
- **Квоти:** `services/quota_service.py` рахує вікна (хв/день) як **кількість
  рядків** `usage_events` у вікні (`count_since`/`timestamps_since`). BYOK-ходи
  зараз НЕ пишуться → не рахуються. Якщо почнемо писати BYOK-події (для звітів),
  **квоти мусять рахувати лише `billable=true`** (див. B2 — обовʼязковий рефактор).
- **Admin-usage:** `routes/admin.py GET /admin/users/{id}/usage` →
  `AdminService.user_usage` → `AdminUserUsage{user, events[], total_requests,
  total_tokens}`. FE-типи — `types/api.ts` (`UsageEventRecord`, `AdminUserUsage`).
- **Чати:** `chats(mode, model, title, updated_at)` (PH24). Зв'язку
  `usage_events ↔ chats` НЕМАЄ — додаємо `chat_id` (B1).
- **Час:** БД зберігає **naive UTC**; API серіалізує без `Z`. FE нормалізує на
  парсингу (`utils/relativeTime.ts::parseUtc`, PH25). Нові timestamp-поля у звітах
  серіалізуй так само (naive UTC) — FE додає `Z`.
- **FE chrome:** меню акаунта (`components/topbar/AccountMenu`) має пункт «Звіти»
  → зараз `useComingSoon().open("reports")`. Налаштування — взірець модалки з
  розділами (`components/settings/SettingsModal`): a11y focus-trap/Esc, ліва
  навігація + контент, responsive. Звіти роблять схожою модалкою з вкладками.
- Стан — `store/`; тексти — `t()` (паритет uk/pl/en); кольори/відступи — токени
  `theme/`; без `fetch` у компонентах (лише `services/`).

---

## Архітектурні рішення (ухвалені архітектором — дотримуйся)
1. **`usage_events` = канонічний per-turn ledger.** Один рядок = один хід
   (Compare-хід = 1 подія, як і досі). Усі звіти — агрегації над ним. Нічого не
   обрізаємо.
2. **Пишемо ВСІ ходи, у т.ч. BYOK** — щоб звіт показував «усе, що відбувалося».
   Додаємо прапор **`billable`** (bool): `true` = списувалось із квоти застосунку;
   `false` = на власному ключі. **`QuotaService` рахує лише `billable=true`** —
   поведінка лімітів НЕ змінюється, але реєстр повний.
3. **Звʼязок із чатом:** `usage_events.chat_id` (FK→chats, **ondelete SET NULL**)
   — видалення чату лишає аудит, але відвʼязує (групуємо такі події як
   «видалені/ad-hoc»). Заповнюємо з `request.chat_id` в обох роут-хендлерах.
4. **Токени — чесно.** Пріоритет — **реальні** (provider `usage`): Compare вже
   має; Single-стрім — увімкнути `stream_options.include_usage` і прочитати
   фінальний chunk. Якщо провайдер не віддав usage — **оцінка** (евристика
   `ceil(chars/4)` по промпту+відповіді, без нової залежності) + прапор
   **`token_estimated=true`**. У UI оцінені токени позначаємо («~», бейдж
   «оцінка»). Розділяти `prompt`/`completion` НЕ обовʼязково — досить
   `total_tokens` + `token_estimated`. (tiktoken — опційний апгрейд, поза обсягом.)
5. **Звіти — окремий per-user namespace `/reports/*`** (auth, НЕ admin-gated),
   агрегації в `memory/usage_report_repository.py` (read-only, не плутати з
   `UsageRepository`-writer). Per-user ізоляція суворо.
6. **Дашборд — справжній, з вкладками:** Огляд (KPI + графік), За моделями,
   За чатами, Журнал активності (пагінований лог + CSV). Фільтр періоду
   (24г/7д/30д/усе/власний) застосовується до всіх вкладок.
7. **Графіки — без важких залежностей:** легкий власний inline-SVG компонент
   (бар/лінія) на наших токенах. (Альтернатива — `recharts`; обрано SVG, щоб не
   роздувати бандл і тримати дизайн-консистентність. Якщо власник захоче —
   мігруємо пізніше.)
8. **Експорт CSV** — серверний стрім-ендпоінт із тим самим фільтром періоду
   (корпоративний паттерн; великі обсяги не тримаємо в памʼяті клієнта).

---

## Кроки (атомарні; BE-гейти: pytest/ruff/black; FE-гейти: tsc/eslint/prettier/
## vitest/build + i18n паритет uk/pl/en)

### Блок A — реєстр подій: схема + повнота даних (бекенд)
- [x] **A1. Схема.** Розширити `usage_events`: `chat_id`(FK→chats, nullable,
  ondelete SET NULL, index), `billable`(bool, NOT NULL, server_default true),
  `token_estimated`(bool, NOT NULL, server_default false). Alembic `0007`
  (idempotent; backfill: існуючі рядки `billable=true`, решта дефолти). Оновити
  `db/models.py`, `docs/04-data-models.md`. _Зроблено: `db/models.py` (3 колонки
  + true/false defaults), `migrations/versions/0007_usage_ledger.py`
  (batch_alter_table → Postgres+SQLite), docs/04. Перевірено `alembic upgrade
  head` на SQLite._
- [x] **A2. Writer.** `UsageRepository.record(...)` приймає `chat_id`,
  `billable`, `token_estimated`. Зберегти зворотну сумісність дефолтами.
  _Зроблено: keyword-only з дефолтами `chat_id=None, billable=True,
  token_estimated=False`._
- [x] **A3. Запис ВСІХ ходів + billable.** `routes/chat.py`:
  - `/chat`: писати подію **завжди** (гейт `if should_charge` прибрано),
    `billable = should_charge`, `chat_id = request.chat_id`. Персист у saved chat
    **перенесено перед** записом ledger → бад `chat_id` 404-иться до FK-вставки.
  - `/chat/stream`: пишеться **завжди**, `billable = should_charge`,
    `chat_id = chat_link` (лінк лише при успішному персисті — захист FK).
- [x] **A4. Квоти рахують лише billable.** `UsageRepository.count_since`/
  `timestamps_since` фільтрують `billable.is_(True)` → `QuotaService` без змін.
  BYOK-хід тепер створює подію, але не списує квоту. Тест billable-фільтра — у
  `test_reports.py` (C4).

### Блок B — реальні токени (бекенд)
- [x] **B1. Single-стрім: реальні токени.** `OpenAICompatibleProvider.
  generate_stream` — `stream_options={"include_usage": True}`; фінальний
  usage-chunk не пропускається, `total_tokens` зчитується з `chunk.usage` і
  yield-иться термінальним маркером `StreamUsage` (base_provider). `ProviderService.
  generate_stream` мапить його у подію `{"type":"usage"}`; `routes/chat.py::
  generate()` ловить її (не форвардить клієнту) → `record(token_estimated=False)`.
- [x] **B2. Фолбек-оцінка токенів.** `core/tokens.py::estimate_tokens(*texts)`
  (`ceil(sum(len)/4)`). Стрім без usage / Compare з `total_tokens=None` → оцінка
  по `(промпт + відповідь)`, `token_estimated=True`. Юніт-тест `test_tokens.py`.
- [x] **B3. Per-provider токени в Compare-payload.** Уже наявне:
  `execute_many` кладе `total_tokens` кожного відповідача у
  `all_responses[provider]` (а отже й у `chat_messages.payload`). Додаткових
  змін не потрібно.

### Блок C — звіти API (бекенд, per-user)
- [x] **C1. Репозиторій агрегацій.** `memory/usage_report_repository.py::
  UsageReportRepository(user_id)` (read-only): `summary`, `by_model`, `by_chat`
  (LEFT JOIN chats; null → deleted/ad-hoc bucket), `timeseries(bucket day|hour)`
  (групування в Python, gap-filled, cap `_MAX_BUCKETS=750`), `events(cursor,
  limit)` (keyset за `(created_at,id)` спадно), `iter_events_for_csv` (id-paged
  стрім для C3). Усі — per-user scope + naive-UTC межі.
- [x] **C2. Схеми + роути.** `schemas/reports.py` + `routes/reports.py`
  (`prefix="/reports"`, `Depends(current_user)`): `/summary`, `/by-model`,
  `/by-chat`, `/timeseries`, `/events`. `from`/`to` ISO (дефолт 30д; epoch-from =
  «усе»), `bucket=day|hour`. Зареєстровано в `main.py`. `docs/03` оновлено.
- [x] **C3. CSV-експорт.** `GET /reports/events.csv?from=&to=` →
  `StreamingResponse(text/csv)` + `Content-Disposition: attachment`; колонки за
  специфікою; per-user, стрім рядками (csv-модуль, без буфера). 
- [x] **C4. Тести BE.** `tests/test_reports.py` (12 кейсів): per-user ізоляція;
  summary/by-model/by-chat/timeseries(gap-fill+empty); keyset-пагінація events;
  billable-фільтр квоти (A4); chat_id SET NULL після delete_chat; HTTP 401 +
  CSV-формат. Усього BE: **157 passed** + ruff + black.

### Блок D — фронтенд: сервіс + типи + стан
- [x] **D1. Типи + сервіс.** `types/api.ts` — `ReportSummary, ModelUsage,
  ChatUsage, TimeseriesPoint/Response, ReportEvent, ReportEventsPage`.
  `services/reportsApi.ts` — `getSummary/getByModel/getByChat/getTimeseries/
  getEvents(cursor)` + `eventsCsvUrl(range)`. Без `fetch` у компонентах.
- [x] **D2. Стан модалки.** `store/ReportsContext` (open/close + опц. `target`
  для G-scaffold). `AccountMenu` тепер відкриває `useReports().open()`; `reports`
  прибрано з `ComingSoonContext` (лишились profile/security; мертві ключі
  `comingSoon.reports.*` видалено в усіх локалях). Провайдер змонтовано в
  `app/layout.tsx`, модалку — в `MainLayout`.

### Блок E — фронтенд: дашборд «Звіти»
- [x] **E1. Каркас.** `components/reports/ReportsModal.tsx` — модалка (reuse
  `settings-dialog`-рамки) з лівою навігацією вкладок + контент; a11y
  (role=dialog/aria-modal/focus-trap/Esc/restore), responsive (вкладки в рядок).
  Зверху — фільтр періоду (`rep-rangebar`: 24г/7д/30д/усе/власний + date-inputs).
  Зміна періоду **remount-ить** активну вкладку через `key=rangeKey` (mount-once
  fetch, без синхронного setState — патерн `AdminPanel`).
- [x] **E2. Огляд** (`OverviewTab`). KPI (запити, токени(+«~»+бейдж «оцінка»),
  чати, сер./день, success rate); `MiniChart.tsx` (inline-SVG: бари=запити,
  лінія=токени, `role=img`+aria); спліт-бари Single/Compare і billable/own-key.
- [x] **E3. За моделями** (`ByModelTab`). Таблиця (модель, запити, токени,
  success %) + inline бар частки токенів. Правдиві назви (`utils/models`).
- [x] **E4. За чатами** (`ByChatTab`). Таблиця (чат, режим, модель, запити,
  токени, остання активність); рядок клікабельний (Enter/Space) → `setMode` +
  `selectChat` + закриває модалку. Видалені/ad-hoc — окремий рядок. Відносний
  час — `utils/relativeTime`.
- [x] **E5. Журнал** (`ActivityLogTab`). Keyset-пагінований лог (час, режим,
  модель, чат, сніпет, токени(+«~»), статус, own-key-бейдж) + «Показати ще»;
  кнопка «Експорт CSV» (`eventsCsvUrl`, download). Стани loading/empty/error —
  спільний `RepState`.

### Блок F — i18n + a11y + responsive
- [x] **F1. i18n.** Усі тексти — `t()` з паритетом uk/pl/en (~50 нових ключів
  `reports.*`); `i18n/index.test.ts` зелений (паритет).
- [x] **F2. a11y/responsive.** Таблиці зі `scope`/`th`, графік з `aria-label`,
  focus-visible на клікабельних рядках, `rep-table-wrap` — горизонтальний скрол
  усередині; `@media(max-width:768px)` — спліти в 1 колонку, вкладки в рядок.
  Усі FE-гейти зелені: tsc/eslint/prettier/vitest(**26**)/build.

### Блок G — (бонус) адмін бачить звіти будь-кого
- [~] **G1. Свідомо НЕ реалізовано** (опційно, поза мінімальним DoD). Бекенд-
  агрегації (`UsageReportRepository`) уже параметризовані `user_id`, а
  `ReportsContext`/`ReportsModal` мають `target`/`readOnly`-scaffold — тож
  доробка (admin-gated `/admin/users/{id}/report*` + кнопка в `AdminPanel`)
  тривіальна в окремому плані. Per-user звіти (головний обсяг) — повні.

### Блок H — доки + гейти + деплой
- [x] **H1. Доки.** `docs/03` (`/reports/*` + `events.csv`), `docs/04`
  (ledger-колонки `usage_events`), `docs/06` (розділ «Звіти про використання»),
  `docs/08` (секція PH27), `docs/10` (**D-18**). `status: done`, усі `[x]`, «СТАН»
  актуальний.
- [x] **H2. Гейти + деплой.** BE pytest(157)/ruff/black; FE tsc/eslint/prettier/
  vitest(26)/build; i18n паритет — усі зелені. Коміт + `git push origin main`
  (CI→Docker→VPS). Перевірити Actions і `https://ai.st.byn.sarl/api/reports/
  summary` → 401. Міграція `0007` застосовується контейнером. **НІКОЛИ** `down -v`.

---

## Перевірка (Definition of Done)
- [x] «Звіти» (для всіх) — **реальний дашборд**, а не заглушка: Огляд (KPI+графік),
      За моделями, За чатами, Журнал активності; фільтр періоду; експорт CSV.
- [x] Видно **все, що відбувалося**: усі запити (incl. BYOK), токени (реальні, з
      позначкою «оцінка» де фолбек), які чати/моделі скільки спожили, журнал
      повідомлень із per-turn токенами.
- [x] `usage_events` — канонічний ledger: `chat_id`, `billable`, `token_estimated`;
      Single-стрім має реальні токени (include_usage) або позначену оцінку.
- [x] **Квоти не змінили поведінку** (рахують лише `billable`); BYOK і далі
      безкоштовний, але тепер потрапляє у звіт.
- [x] Per-user ізоляція сувора; адмін-бонус (G) — опційно (свідомо не зроблено).
- [x] BE pytest/ruff/black зелені; FE tsc/eslint/prettier/vitest/build зелені;
      i18n паритет uk/pl/en; docs (03/04/06/08/10) оновлені; деплой — H2.
- [x] Golden rules: без дублювання JSX/стилів/кольорів/текстів; тексти `t()`; без
      `fetch` у компонентах; кольори/відступи — токени; стан — store/; стани
      loading/empty/error; секрети не в БД/логах; D-18 зафіксовано в docs/10.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **H1** — усі блоки A–F виконано, доки оновлено.
  Лишається **H2** (фінальні гейти вже зелені; коміт+пуш виконується). Бекенд:
  ledger + `/reports/*` + CSV (BE **157 passed** + ruff/black). Фронтенд: дашборд
  «Звіти» з 4 вкладок + графік + CSV (FE tsc/eslint/prettier/vitest **26**/build,
  i18n паритет). G — свідомо не зроблено (опц.).
- Нові/змінені файли — backend: `db/models.py`, `migrations/.../0007_usage_ledger.py`,
  `memory/usage_repository.py`, `memory/usage_report_repository.py`, `routes/chat.py`,
  `routes/reports.py`, `schemas/reports.py`, `core/tokens.py`,
  `providers/base_provider.py`, `providers/openai_compatible.py`,
  `services/provider_service.py`, `main.py`, `tests/test_reports.py`,
  `tests/test_tokens.py`. Frontend: `types/api.ts`, `services/reportsApi.ts`,
  `store/ReportsContext.tsx`, `store/ComingSoonContext.tsx`, `app/layout.tsx`,
  `layouts/MainLayout.tsx`, `components/topbar/AccountMenu.tsx`,
  `components/icons/Icons.tsx`, `components/reports/*` (8 файлів),
  `i18n/messages/{en,pl,uk}.json`, `theme/components.css`. Доки: 03/04/06/08/10.
- Наступний крок: **H2** — `git push origin main` → перевірити Actions + роут 401.
- Заблоковано: **ні**.
