---
plan: 030-reports-key-attribution
status: done
updated: 2026-06-03
---

# PH31 — Звіти: атрибуція моделі до джерела ключа (вбудована vs свій ключ + маска `перші4••••останні4`)

> Власник: у звітах біля **ID моделі** треба писати, ЧИМ вона викликана. Якщо це
> наша (вбудована) модель — пишемо «Вбудована». Якщо користувач підключив **свій
> ключ** (нехай навіть та сама модель) — пишемо модель + **маску ключа**: перші
> 4 символи + `••••` + останні 4 (напр. `gsk_••••OTzu`). Якщо одна й та сама
> модель зустрічається і як вбудована, і як «своя» — їх треба **розділити** на
> окремі рядки (як і дві різні «свої» моделі/ключі). Шифрування — **справжнє**
> (вже є, AES-256-GCM); маска — лише зовнішній вигляд.

## Рішення архітектора (ухвалені — новий чат їх НЕ переграє)

1. **Маска ключа = display-only, шифрування лишається справжнім.** У БД ключ і далі
   зберігається зашифровано (AES-256-GCM envelope, `byok_credentials`). Маска
   `f"{key[:4]}••••{key[-4:]}"` рахується **з плейнтексту в момент запису ходу**
   (плейнтекст у цей момент уже є у `ByokConfig`, розшифрованому з БД) і
   **денормалізовано** пишеться в нову колонку `usage_events.key_fingerprint`.
   Денормалізація навмисна: звіт показує, яким ключем користувались **на той
   момент**, навіть якщо ключ згодом видалили/змінили. Плейнтекст **ніколи** в
   логах/відповідях; first4 — публічний префікс (gsk_/sk-…), last4 — нетаємний,
   обидва бачить **лише власник** (per-user ізоляція звітів).
2. **`key_fingerprint` NULL = вбудована (app-ключ); set = свій ключ.** Атрибуція
   за **обраною** (winning/обраною суддею) моделлю ходу: рахуємо ключ саме того
   слота, що став `selected_model`. Compare = слот-переможець; Single =
   `request.provider`.
3. **Розділення за `(model, key_fingerprint)`.** Усі агрегати «за моделлю»
   (`by_model`, `breakdown` на рівні моделі, журнал подій) групуються за парою
   `(selected_model, key_fingerprint)`. Та сама модель: вбудована (NULL) і своя
   (маска) → **різні рядки**; дві різні «свої» (різні маски) → теж різні.
4. **`selected_model` НЕ змінюємо.** Лишаємо як є (Compare = слот, Single =
   model_id BYOK / слот). Маска — окремий розрізнювач; та сама назва моделі з
   різними ключами легітимно дає різні рядки. **Свідомо поза обсягом:** правдиве
   ім'я моделі для BYOK-override на вбудованому слоті (коли свій ключ на іншу
   модель) — окремий майбутній план; зараз показуємо назву слота + маску.
5. **Фільтр доступу (app|own) у тулбарі лишається billable-based** (вартісний
   погляд, PH28). Атрибуція ключа — **додатковий** вимір на рівні моделі, не
   ламає наявний `access`/`billable`. `breakdown` лишає верхній рівень
   `access_key` (billable), а маску додає у вузол моделі.
6. **Мінімальний «вибух».** Один новий стовпець + одна міграція; запис у
   `routes/chat.py` (обидва шляхи); агрегації/схеми/роути звітів + FE-таби
   (ByModel/Breakdown/ActivityLog) + i18n. Квоти/orchestrator/інші роути — **не
   чіпати**. Жодного нового env/owner-action.

## Ground truth (звірено з кодом 2026-06-03 — новий чат має перезвірити)

- **`db/models.py::UsageEvent`** — `selected_model` (String(64), nullable),
  `billable`, `token_estimated`, `chat_id` (FK→chats SET NULL). Остання міграція —
  `migrations/versions/0008_byok_credentials.py` (отже нова = `0009`). Патерн
  міграції — `batch_alter_table` (SQLite+PG).
- **`routes/chat.py`** — `byok = await ByokRepository(user.id).load_config()`
  (розшифрований `ByokConfig` із `judge`+`responders[]`, кожен має `api_key`).
  Compare: `_resolve_…` через `selected_model=result["selected_model"]` (= слот),
  `UsageRepository(user.id).record(..., selected_model=…, billable=should_charge)`.
  Single (`chat_stream.generate`): `byok_provider,is_byok=_resolve_single_provider(
  request.provider, byok)`; `record(..., selected_model=model_name or
  request.provider, billable=should_charge)`. У ОБОХ місцях `byok` + обраний
  слот доступні в момент `record(...)`.
- **`memory/usage_repository.py::UsageRepository.record(...)`** — писар ledger
  (kwargs). Додати параметр `key_fingerprint: str | None = None`.
- **`memory/usage_report_repository.py::UsageReportRepository`** —
  `by_model` (group_by `selected_model`), `breakdown` (Python-дерево
  `app|own → model → chats`), `events`/`iter_events_for_csv` (LEFT JOIN chats).
- **`schemas/reports.py`** — `ModelUsage{model,requests,total_tokens,successful}`,
  `BreakdownModel{model,requests,total_tokens,chats}`, `UsageEventDetail{…}`.
- **FE:** `services/reportsApi.ts` (типи), `components/reports/`
  (`ByModelTab`/`BreakdownTab`/`ActivityLogTab`/`reportUtils.ts`). `reportUtils.
  modelLabel(model)` → `utils/models.responderLabel` (слот→дружня назва; BYOK→raw).
  i18n `reports.*` (плоскі dot-ключі, паритет uk/pl/en).

---

## Кроки (атомарні; гейти після кожного)

### Блок A — Backend: колонка + запис маски
- [x] **A1. Маска-хелпер + модель + міграція.** `memory/byok_repository.py` —
  чиста функція `key_fingerprint(plaintext) -> str` = `f"{k[:4]}••••{k[-4:]}"` для
  `len>=8`, `••••last2` для 3–7, `••••` для ≤2, `""` для порожнього. `db/models.py::
  UsageEvent.key_fingerprint` (`String(32)`, nullable). Alembic
  `0009_usage_key_fingerprint` (`batch_alter_table`, add nullable). Перевірено:
  міграція застосовується на чистій SQLite, один head, колонка присутня.
- [x] **A2. Писар.** `UsageRepository.record(...)` приймає
  `key_fingerprint: str | None = None` і пише в рядок.
- [x] **A3. Запис у чаті.** `routes/chat.py`: хелпер
  `_selected_key_fingerprint(byok, selected_slot) -> str | None` (Compare:
  `byok.responders` за слотом; Single: judge-слот або responder за
  `request.provider`). Прокинуто у `record(... key_fingerprint=…)` в `chat()` і
  `chat_stream()`. Ключ не логується — пишеться лише маска.
- [x] **A4. BE-гейти (частина 1).** `tests/test_byok.py` (+3 тести): маска
  плейнтексту (long/short/empty), атрибуція за слотом (responder/judge/built-in),
  HTTP Single: свій ключ → `user••••1234`, вбудований → `None`, плейнтекст не в
  ledger. `pytest -q` 184 passed; ruff/black зелені.

### Блок B — Backend: агрегації звітів за `(model, key)`
- [x] **B1. `by_model`** — `group_by(selected_model, key_fingerprint)`; кожен
  рядок повертає `key_fingerprint`. Сортування — як було (requests desc).
- [x] **B2. `breakdown`** — вузол моделі ключований парою `(model,
  key_fingerprint)`, несе `key_fingerprint`. Та сама модель built-in vs own →
  різні вузли. Верхній рівень `access_key` (billable) — без змін.
- [x] **B3. `events` + `iter_events_for_csv`** — `key_fingerprint` у вибірці,
  у `UsageEventDetail` і в CSV-рядку (новий стовпець після `model`).
- [x] **B4. Схеми + роути.** `schemas/reports.py`: `key_fingerprint: str | None`
  у `ModelUsage`/`BreakdownModel`/`UsageEventDetail`. `routes/reports.py` —
  CSV-заголовок `key_fingerprint` + значення (роути by-model/breakdown/events
  прокидають поле через dict→pydantic).
- [x] **B5. BE-гейти (частина 2).** Тести: `by_model` розділяє ту саму модель на
  built-in (NULL) і дві own (маски); `breakdown` — окремі вузли app/own; журнал +
  CSV-iterator несуть маску; CSV-заголовок має стовпець. `pytest -q` 187 passed;
  ruff/black зелені.

### Блок C — Frontend: показ джерела ключа
- [x] **C1. Типи + утиліта.** `types/api.ts` — `key_fingerprint: string | null` у
  `ModelUsage`/`BreakdownModel`/`ReportEvent`. `reportUtils.ts` —
  `keySource(fp): {builtin, mask}` (NULL → built-in; інакше маска); i18n-текст
  бейджа рендериться в компоненті (тексти через `t()`).
- [x] **C2. Таби.** Спільний `components/reports/KeyBadge.tsx` (без дублювання
  JSX). `ByModelTab` — новий стовпець «Ключ»; `BreakdownTab` — бейдж у вузлі
  моделі + `modId` включає fp (унікальність); `ActivityLogTab` — стовпець ключа.
  Ключі рядків розширено парою `(model|fp)`.
- [x] **C3. i18n + CSS.** Нові ключі `reports.col.key`, `reports.builtinModel` —
  паритет uk/pl/en; для «свого ключа» перевикористано наявний
  `reports.billing.ownKey` (без дублю тексту). CSS `.rep-keybadge`
  (`--builtin`/`--own`, mono-маска) на токенах, a11y `title`+`aria-label`.
- [x] **C4. FE-гейти.** tsc/eslint/prettier зелені; vitest 29 passed; build
  зелений; i18n паритет (index.test.ts) ок.

### Блок D — Доки + деплой
- [x] **D1. Доки.** `docs/04` — стовпець `usage_events.key_fingerprint` + Alembic
  `0009`; `docs/03` — поле `key_fingerprint` у `/reports/{by-model,breakdown,
  events,events.csv}`; `docs/06` — атрибуція ключа (`KeyBadge`/`keySource`);
  `docs/08` — секція PH31; `docs/10` — рішення **D-21**.
- [x] **D2. Деплой.** `status: done`; коміт `209ba0f` + `git push origin main`
  (Alembic `0009` застосується на старті). **Нового owner-action нема** (без нового env).

## Definition of Done
- [x] У звітах кожен рядок моделі позначено: **«Вбудована»** (app-ключ) або
      **модель + маска `перші4••••останні4`** (свій ключ).
- [x] Та сама модель як вбудована і як своя (і різні свої ключі) — **розділені**
      рядки в `by_model`/`breakdown`/журналі/CSV.
- [x] `key_fingerprint` рахується з плейнтексту в момент запису, денормалізовано в
      `usage_events`; **плейнтекст ніколи в логах/відповідях**; шифрування БД не
      змінене.
- [x] Квоти/`access`-фільтр/інші роути працюють як раніше (тести зелені).
- [x] Гейти зелені: BE pytest(187)/ruff/black, FE tsc/eslint/prettier/vitest(29)/
      build; i18n паритет; D-21 у `docs/10`. Лишилось: задеплоїти (D2, Alembic 0009).

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **D1** — доки оновлено: `docs/04` (колонка +0009),
  `docs/03` (`key_fingerprint` у by-model/breakdown/events/CSV), `docs/06`
  (`KeyBadge`/`keySource`), `docs/08` (секція PH31), `docs/10` (рішення **D-21**).
- Змінені файли (Блок A+B): backend `db/models.py`, `memory/byok_repository.py`,
  `memory/usage_repository.py`, `memory/usage_report_repository.py`,
  `routes/chat.py`, `routes/reports.py`, `schemas/reports.py`,
  `migrations/versions/0009_usage_key_fingerprint.py`, `tests/test_byok.py`,
  `tests/test_reports.py`. Блок C: frontend `types/api.ts`,
  `components/reports/{KeyBadge.tsx,reportUtils.ts,ByModelTab,BreakdownTab,
  ActivityLogTab}.tsx`, `i18n/messages/{en,pl,uk}.json`, `theme/components.css`.
  Блок D: `docs/{03,04,06,08,10}` + цей план.
- Наступний крок: **— план завершено (status: done).** Коміт `209ba0f`
  запушено в `main`; CI/CD задеплоїть (Alembic `0009` на старті). Owner-action: нема.
- Порядок блоків: A ✅ → B ✅ → C ✅ → D1 ✅ → D2 ✅.
- Заблоковано: **ні**. Owner-action: нема.
