---
plan: 031-true-model-name
status: done
updated: 2026-06-03
---

# PH32 — Правдиве ім'я моделі скрізь (BYOK-aware): звіти, адмін, банер Compare, картки

> **Корінь проблеми.** `selected_model` (і `chats.model`) зберігають **id слота**
> (`groq`/`cerebras`/`sambanova`/`byok-judge`/custom), а FE-мапа
> `utils/models.RESPONDER_LABELS` жорстко перетворює слот→назву
> (`groq`→«Llama 3.3 70B»). Тому коли користувач підключає **свій ключ із іншою
> моделлю** на вбудований слот (напр. свій ключ на слоті «groq» ходить `gpt-4o`),
> низка поверхонь показує **неправдиву** назву слота, а не реальну модель.
>
> **Уражені поверхні (звірено з кодом 2026-06-03):**
> 1. **Банер переможця Compare** — `components/selector/SelectorBanner.tsx:57`
>    `responderLabel(slot)`, **без** BYOK-перевірки (живий UI у КОЖНОМУ результаті).
> 2. **Звіти Compare-ходів** — `reportUtils.modelLabel`→`responderLabel(slot)` у
>    By-model/Breakdown/Activity (відомий розрив PH31).
> 3. **Звіти «За чатами»** — `ByChatTab` `modelLabel(Chat.model=слот)`.
> 4. **Адмін-аудит** — `AdminPanel.tsx:422` сирий `ev.selected_model` (слот).
> 5. **Картки Compare (replay)** — `CompareColumn`/`CompareFailedCard` читають
>    `byokModelId(slot)` з **поточних** ключів → у відтворених історичних ходах
>    показують поточну BYOK-модель, а не ту, що реально відповідала тоді.
>
> **Принцип розв'язання (big-corp, без люків).** Чітко розділити два поняття
> **скрізь**: `slot` (маршрутна ідентичність) vs **`model`** (реальна модель, що
> відповіла — справжній api-id або BYOK `model_id`). Кожен **запис ходу стає
> самоописним**: несе реальну модель + ознаку джерела ключа, тож і звіти, і живий
> UI, і **replay** показують правду без звертання до поточних ключів.

## Рішення архітектора (ухвалені — новий чат їх НЕ переграє)

1. **`selected_model` лишається = СЛОТ** (стабільний групувальник; квоти/
   персоналізація/навчання судді на нього не зважають — це display-поле ledger).
   Реальну модель несе **нова денормалізована колонка** (як `key_fingerprint` у
   PH31). Це повторює перевірений патерн D-21 — мінімальний вибух.
2. **Нова колонка `usage_events.model_name`** (String(128), nullable) = реальна
   модель **обраного/відповідального** слота ходу. Compare:
   `all_responses[selected_model]["model"]`. Single:
   модель зі стріму (`provider.model_name`). **NULL** для історичних рядків →
   FE робить безпечний фолбек.
3. **Single ledger вирівнюється під Compare:** `selected_model` для Single стає
   **слотом** (`request.provider`), а реальна модель іде в `model_name`. Це
   **узгоджує** ledger із вже наявним interaction-record (він уже пише
   `selected_model=request.provider`). Свідомо: **без backfill** старих рядків
   (id слота недетермінований із api-id заднім числом) — старі Single-рядки
   показуються сирим api-id (правдиво); межа задокументована.
4. **Кожна відповідь у `all_responses` несе `is_byok: bool`** (а провайдер, що
   впав — `model` + `is_byok`). Джерело: `isinstance(provider, TransientProvider)`
   у `_safe_generate`. Це робить **збережений хід самоописним** → replay Compare
   (банер + картки) показує правду без поточних ключів.
5. **Єдиний FE-хелпер `modelDisplay({ slot, model, isByok })`** (у
   `utils/models.ts`): `isByok ? (model || responderLabel(slot)) :
   responderLabel(slot)`. Built-in → дружня назва слота; BYOK → реальна модель;
   фолбек на лейбл слота для legacy-рядків без `model`. Усі історичні/звітні
   поверхні переходять на нього; **композерні/active-model поверхні**
   (`MainHead`/`SingleModelPicker`/`ModelSwitcher`/`sidebarStatus`) **свідомо
   лишаються на поточних ключах** (вони відображають, ЧИМ ти збираєшся слати
   зараз — це коректно, не люк).
6. **Групування звітів** додає `model_name` як третій вимір там, де воно є рядком
   моделі: `by_model`/`breakdown` групують за `(selected_model, key_fingerprint,
   model_name)`. Та сама модель/ключ із різними реальними моделями (рідкісна зміна
   `model_id` на тому ж ключі) → різні рядки. Built-in: `model_name` стабільний →
   не фрагментує (зміна env-моделі = інша модель = легітимно інший рядок).
7. **Мінімальний вибух і повнота.** Одна колонка + одна міграція; `is_byok` —
   адитивне поле наявних dict-ів (persist у chat_messages «безкоштовно»). Квоти/
   orchestrator-логіка вибору/`access`-фільтр/`selected_model`-семантика — **не
   чіпати**. Жодного нового env/owner-action.

## Ground truth (звірено з кодом 2026-06-03 — новий чат має перезвірити)

- **`db/models.py::UsageEvent`** — має `selected_model` (slot), `key_fingerprint`
  (PH31). Остання міграція — `0009_usage_key_fingerprint` (нова = **0010**),
  патерн `batch_alter_table`, nullable.
- **`services/provider_service.py`** — `_safe_generate(slot, provider, message)`
  повертає dict із `model: provider.model_name` (успіх) / `model: None`
  (невдача). `execute_many` складає `all_responses[slot] = {response, model,
  execution_time, total_tokens, provider, success}` і `failed_providers = [{
  provider, error, reason}]` + `execution_metadata`. `TransientProvider` — у тому
  ж модулі (`model_name == model_id`).
- **`routes/chat.py`** — Compare: `selected_model = result["selected_model"]`
  (слот-переможець; реальна модель є в `result["all_responses"][slot]["model"]`).
  Single (`chat_stream.generate`): `model_name` зі стріму; ledger пише
  `selected_model=model_name or request.provider` (← змінити на `request.provider`)
  + має `key_fp` (PH31). Хелпер `_selected_key_fingerprint` уже є.
- **`memory/preferences_logic.build_interaction_record`** — зберігає `all_responses`
  і `failed_providers` **як є** (тож `is_byok`/`model` пройдуть у
  `chat_messages.payload` без зміни схеми) + `selected_model`.
- **`schemas/chat_response.py`** — `ProviderResponse{response,model,execution_time,
  provider,success}`, `FailedProvider{provider,error,reason}`,
  `ExecutionMetadataItem{provider,success,execution_time,model,error}`,
  `ChatResponse{...all_responses,failed_providers,selected_model_data...}`.
- **`memory/usage_report_repository.py`** — `by_model` (group `(selected_model,
  key_fingerprint)`), `breakdown` (вузол `(model,key_fingerprint)`), `by_chat`
  (LEFT JOIN chats, `Chat.model`), `events`/`iter_events_for_csv`. **Усі вже
  тягнуть `key_fingerprint` (PH31).**
- **`schemas/reports.py`** — `ModelUsage`/`BreakdownModel`/`UsageEventDetail`/
  `ChatUsage` (усі мають `key_fingerprint` крім `ChatUsage`; `ChatUsage` має
  `model`=slot).
- **`schemas/admin.py::UsageEventRecord`** — `selected_model: str | None`;
  `services/admin_service.user_usage` віддає рядки; `routes/admin.py` passthrough.
- **FE:** `utils/models.ts` (`RESPONDER_LABELS`, `responderLabel`),
  `components/reports/reportUtils.ts` (`modelLabel`), таби
  `By{Model,Chat}Tab`/`BreakdownTab`/`ActivityLogTab`, `SelectorBanner`,
  `compare/{CompareColumn,CompareFailedCard,CompareTurn,CompareModal}`,
  `features/compare/rows.ts` (`toCompareRows`), `components/admin/AdminPanel.tsx`,
  `types/api.ts` (`ProviderResponse`/`CompareRow`/`ModelUsage`/`BreakdownModel`/
  `ChatUsage`/`ReportEvent`/admin `UsageEventRecord`). Композерні поверхні
  (`MainHead`/`SingleModelPicker`/`store/sidebarStatus`) — лишити на `byokModelId`.

---

## Кроки (атомарні; гейти після кожного)

### Блок A — Backend: реальна модель у ledger
- [x] **A1. Колонка + міграція.** `db/models.py::UsageEvent` +
  `model_name: Mapped[str] = mapped_column(String(128), nullable=True)`. Alembic
  `0010_usage_model_name` (`batch_alter_table`, add nullable). Перевірено
  застосування на чистій БД (один head; колонка присутня).
- [x] **A2. Писар.** `UsageRepository.record(...)` приймає
  `model_name: str | None = None` і пише в рядок.
- [x] **A3. Запис у чаті.** `routes/chat.py`:
  - **Compare `chat()`:** `winner = result["all_responses"].get(
    result["selected_model"]) or {}`; `model_name = winner.get("model")`;
    `record(..., model_name=model_name)`.
  - **Single `chat_stream()`:** `record(..., selected_model=request.provider,
    model_name=model_name)` (selected_model ← слот; реальна модель → `model_name`).
- [x] **A4. BE-гейти (1).** `tests/test_byok.py`: Single → `selected_model` =
  слот, `model_name` = реальна; Compare → winning slot + real model; BYOK-override
  на built-in слоті → `model_name` = реальна модель, slot лишається. Гейти зелені:
  190 passed, ruff/black.

### Блок B — Backend: `is_byok` per-response (самоописний хід)
- [x] **B1. Провайдер.** `_safe_generate`: `is_byok = isinstance(provider,
  TransientProvider)`; повертає `is_byok` у обох гілках і `model:
  provider.model_name` **також на невдачі** (раніше `None`). `execute_many`:
  прокинуто `is_byok` у кожен `all_responses[slot]`, у `failed_providers[*]`
  (+`model`) і в `execution_metadata[*]`.
- [x] **B2. Схеми відповіді.** `schemas/chat_response.py`: `ProviderResponse +
  is_byok: bool = False`; `FailedProvider + model: str | None = None,
  is_byok: bool = False`; `ExecutionMetadataItem + is_byok: bool = False`. Поля
  адитивні; orchestrator передає dict-и наскрізь (не звужує), `ChatResponse`
  коерсить, `build_interaction_record` несе як є.
- [x] **B3. BE-гейти (2).** `test_provider_service.py`: `all_responses[slot].is_byok`
  true для BYOK-слота, false для built-in; failed-провайдер несе `model`+`is_byok`;
  `execution_metadata[*].is_byok`; replay-record (`build_interaction_record`)
  зберігає `is_byok`/`model`. Гейти зелені: 192 passed, ruff/black.

### Блок C — Backend: звіти + адмін несуть `model_name`
- [x] **C1. `by_model`** — `group_by(selected_model, key_fingerprint, model_name)`;
  повертає `model_name`. Сортування — як було.
- [x] **C2. `breakdown`** — ключ вузла моделі = `(model, key_fingerprint,
  model_name)`; `BreakdownModel` несе `model_name`.
- [x] **C3. `by_chat`** — додано `func.max(UsageEvent.model_name)` як
  репрезентативну реальну модель чату; `ChatUsage` несе `model_name`.
- [x] **C4. `events` + `iter_events_for_csv`** — `model_name` у вибірці,
  `UsageEventDetail`, CSV (новий стовпець після `model`).
- [x] **C5. Схеми + роути звітів.** `schemas/reports.py`: `model_name: str | None`
  у `ModelUsage`/`BreakdownModel`/`ChatUsage`/`UsageEventDetail`.
  `routes/reports.py`: CSV-заголовок+значення.
- [x] **C6. Адмін-аудит.** `schemas/admin.py::UsageEventOut + model_name:
  str | None`; `admin_service.user_usage` додає `model_name` у рядок (ORM-вибірка
  `select(UsageEvent)` уже несе колонку).
- [x] **C7. BE-гейти (3).** Тести: by_model/breakdown розділяють за реальною
  моделлю + несуть model_name; by_chat несе model_name; events/CSV несуть; CSV-
  стовпець `model_name` після `model`; admin-аудит несе model_name. Гейти зелені:
  196 passed, ruff/black.

### Блок D — Frontend: єдиний хелпер + усі поверхні
- [x] **D1. Хелпер + типи.** `utils/models.ts` +
  `modelDisplay(slot, model, isByok): string` (позиційний, як на усіх call-site).
  `types/api.ts`: `ProviderResponse + is_byok?`; `CompareRow + is_byok?`;
  `FailedProvider + model?: string | null; is_byok?`;
  `ModelUsage`/`BreakdownModel`/`ChatUsage`/`ReportEvent` + `model_name: string |
  null`; admin `UsageEventRecord + model_name: string | null`.
- [x] **D2. Звіти.** `reportUtils` + `reportModel(row) = modelDisplay(row.model,
  row.model_name, !!row.key_fingerprint)`. `ByModelTab`/`BreakdownTab`/
  `ActivityLogTab` → `reportModel(...)`. `ByChatTab` → `c.model_name ??
  modelLabel(c.model)` (чат-рівень; ключ-атрибуція лишається у модельних табах —
  свідома межа, не люк).
- [x] **D3. Банер переможця.** `CompareTurn` обчислює `winner =
  interaction.all_responses[winnerSlot]`; передає `winnerModel=winner?.model`,
  `winnerIsByok=winner?.is_byok` у `SelectorBanner`; банер показує
  `modelDisplay(slot, winnerModel, winnerIsByok)` (live persist+reload і replay
  ідуть однаковим шляхом через CompareTurn).
- [x] **D4. Картки Compare.** `features/compare/rows.ts` мапить `is_byok`.
  `CompareColumn` — `name = modelDisplay(provider, model, isByok)` замість
  `byokModelId(...)` (прибрано `useKeys`). `CompareFailedCard` —
  `modelDisplay(failed.provider, failed.model, !!failed.is_byok)`; own-key
  rate-limit тепер із `failed.is_byok` (прибрано `byokModelId/isOwnKey`). Поточні-
  ключі залежності прибрано з цих **історичних** карток.
- [x] **D5. Адмін.** `AdminPanel` — стовпець моделі: `ev.model_name ??
  (ev.selected_model ? responderLabel(ev.selected_model) : "—")`.
- [x] **D6. FE-гейти.** `tsc && eslint && prettier --check && vitest(35) && build`
  зелені; нових текстів нема → i18n паритет збережено. Додано vitest
  `utils/models.test.ts` (built-in/own/legacy-фолбек/null) + `SelectorBanner`
  BYOK-переможець і built-in переможець.

### Блок E — Доки + деплой
- [x] **E1. Доки.** `docs/04` — `usage_events.model_name` + Alembic `0010`;
  `docs/03` — `model_name` у `/reports/*` + `/admin/users/{id}/usage` + `is_byok`
  у `all_responses`/`failed_providers`/`execution_metadata` `ChatResponse`;
  `docs/05` — `is_byok` у контракті відповіді провайдера (самоописний хід);
  `docs/06` — `modelDisplay`/`reportModel` + BYOK-aware банер/картки + свідома
  межа композерних поверхонь; `docs/08` — секція **PH32**; `docs/10` — рішення
  **D-22**.
- [x] **E2. Деплой.** `status: done`; коміт + `git push origin main` (Alembic
  `0010` на старті). **Нового owner-action нема** (без нового env).

## Definition of Done
- [x] Якщо свій ключ на вбудованому слоті ходить іншою моделлю — **усі** історичні/
      звітні поверхні (банер переможця Compare, картки Compare у replay, By-model/
      Breakdown/Activity/By-chat, адмін-аудит) показують **реальну** модель; built-in
      показує дружню назву слота.
- [x] `usage_events.model_name` денормалізовано в момент запису; `selected_model`
      = слот (Compare і Single); квоти/`access`/orchestrator не змінені.
- [x] Кожен `all_responses[slot]` та failed-провайдер несуть `is_byok` (+`model`);
      replay самоописний (не залежить від поточних ключів).
- [x] Композерні/active-model поверхні свідомо лишаються на поточних ключах.
- [x] Гейти зелені: BE pytest(196)/ruff/black, FE tsc/eslint/prettier/vitest(35)/
      build; i18n паритет; D-22 у `docs/10`; задеплоєно (Alembic `0010`).

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **E2** — усі блоки A→E виконані; гейти зелені (BE 196
  pytest + ruff/black; FE tsc/eslint/prettier/vitest 35/build); доки оновлені
  (03/04/05/06/08/10, D-22); готово до коміту+пушу.
- Наступний крок: **жодного** — план завершено (`status: done`).
- Змінені файли (ключові): BE `db/models.py`, `migrations/versions/0010_usage_model_name.py`,
  `memory/{usage_repository,usage_report_repository}.py`, `routes/{chat,reports}.py`,
  `services/{provider_service,admin_service}.py`, `schemas/{chat_response,reports,admin}.py`;
  FE `utils/models.ts`, `components/reports/{reportUtils,ByModelTab,ByChatTab,BreakdownTab,ActivityLogTab}.tsx`,
  `components/selector/SelectorBanner.tsx`, `components/compare/{CompareTurn,CompareColumn,CompareFailedCard,CompareModal}.tsx`,
  `features/compare/rows.ts`, `components/admin/AdminPanel.tsx`, `types/api.ts`;
  тести BE `test_{byok,provider_service,reports,admin_quotas}.py`, FE `utils/models.test.ts`,
  `SelectorBanner.test.tsx`; доки 03/04/05/06/08/10.
- Заблоковано: **ні**. Owner-action: нема (без нового env).
