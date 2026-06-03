---
plan: 029-byok-model-select-and-texts
status: done
updated: 2026-06-03
---

# PH30.2 — BYOK: вибір моделі замість ручного вводу (розумний фолбек за кодом помилки) + ревізія текстів розділу «API-ключі»

> Продовження PH30/PH30.1. Власник: «прибрати можливість писати власні моделі —
> тільки вибирати» + «перечитати тексти, щоб усе було добре після наших змін».
> Обсяг **свідомо вузький**: лише поле моделі (select-only) і тексти розділу
> API-ключів. Більше нічого не чіпаємо.

## Рішення архітектора (ухвалені — узгоджено з власником)

1. **Поле моделі = `<select>` (тільки вибір), без вільного вводу — у нормі.**
   Замість нативного `<input list>`+`<datalist>` (давав вільний ввід) — справжній
   `<select>` зі знайдених моделей. Жива валідація на «Зберегти» лишається.
2. **Запобіжник плану збережено через РОЗУМНИЙ фолбек за типом помилки `/models`,
   а не «будь-яка помилка → ручне поле».** Розрізняємо за HTTP-кодом (OpenAI-SDK
   дає типізовано):
   - **404 (нема `/models`)** → reason `no_models` → ✅ відкрити **ручний ввід**
     (легітимно: провайдер без `/models`, напр. Perplexity).
   - **401/403 (поганий ключ/auth)** → reason `bad_key` → ❌ ручне НЕ відкривати;
     лишити тільки вибір + повідомлення «перевірте ключ». (Auth перевіряється
     раніше за роут, тож поганий ключ завжди дає 401 → ручне не розблоковується.)
   - **429** → reason `rate_limited` → повідомлення «забагато запитів»; ручне ні.
   - **timeout/мережа** → reason `timeout`/`unavailable` → «спробуйте ще»; ручне ні.
   - **200 з порожнім списком** (auth ОК, моделей 0) → ✅ ручний ввід (auth пройшов).
   Тобто ручне розблоковується **лише** на `no_models` або порожньому списку при
   валідному ключі — ніколи на поганому ключі.
3. **Бекенд не змінює контракт `/keys/models`** — лише точніша класифікація
   помилки в `error_reason` (нові коди `no_models`/`bad_key`). `is_chat`-фільтр і
   «показати всі» лишаються.
4. **Тексти — лише розділ API-ключів** (`keys.*`). Привести у відповідність до
   реальної поведінки після PH30/PH30.1 (серверне шифроване сховище, write-only,
   іменовані слоти, select моделі). Паритет uk/pl/en. Жодних інших ключів.

## Ground truth (звірено з кодом 2026-06-03)

- **BE:** `routes/keys.py::list_models` ловить будь-який Exception → `classify_
  provider_failure(str(error))` (загальний, за текстом) → `error_reason`.
  `provider.list_models()` (`providers/openai_compatible.py`) кличе
  `client.models.list()` через `to_thread`. OpenAI-SDK кидає типізовані винятки з
  атрибутом `.status_code` (404/401/403/429…). Класифікатор чату —
  `services/provider_service.py::classify_provider_failure(text)`.
- **FE:** `components/keys/ModelCombobox.tsx` — нативний `<input list>`+`<datalist>`
  (вільний ввід + підказки), кнопка «Завантажити моделі», стани idle/loading/
  loaded/error, chat-фільтр + «показати всі», session-кеш. Сервіс
  `services/keysApi.ts::fetchModels` → `{models:[{id,is_chat}], error_reason}`.
  Тексти — `i18n/messages/{uk,pl,en}.json` ключі `keys.*` (плоскі dot-ключі).

## Кроки (атомарні; гейти після кожного)

### Блок A — Backend: точна класифікація помилки discovery
- [x] **A1. Класифікатор `classify_discovery_failure(error)`** (у
  `services/provider_service.py`, поряд із `classify_provider_failure`): за
  `getattr(error,"status_code",None)` → `404→"no_models"`, `401/403→"bad_key"`,
  `429→"rate_limited"`; за типом винятку — timeout→`"timeout"`,
  connection→`"unavailable"`; інакше фолбек на `classify_provider_failure(str)`.
  `routes/keys.py::list_models` використовує його замість загального. Порожній
  список (200, без винятку) → `models:[]`, `error_reason:None` (як зараз).
- [x] **A2. Тести + BE-гейти.** `tests/test_byok.py`: 404→`no_models`,
  401→`bad_key`, порожній→`error_reason None`. `pytest -q && ruff && black --check`.

### Блок B — Frontend: select-only + розумний фолбек
- [x] **B1. `ModelCombobox` → `<select>`.** Поле моделі — `<select>` зі знайдених
  моделей (chat-фільтр + «показати всі»); поточне значення завжди як опція (щоб
  збережена модель показувалась до завантаження). Кнопка «Завантажити моделі»
  лишається. **Ручний `<input>` показуємо ЛИШЕ** коли: `error_reason==="no_models"`
  **або** (loaded && список порожній). На `bad_key` — тільки select + повідомлення
  «перевірте ключ»; на `rate_limited`/`timeout`/`unavailable` — select + «спробуйте
  ще». Session-кеш, жива валідація на Save — без змін.
- [x] **B2. i18n нових станів** (паритет uk/pl/en): `keys.selectModel`,
  `keys.models.badKey`, `keys.models.retry`, `keys.models.manualFallback`,
  `keys.models.noModelsManual` (тексти станів). Прибрати/перепризначити мертві
  ключі discovery, якщо зʼявились.
- [x] **B3. FE-гейти.** `tsc && eslint && prettier --check && vitest && build`.

### Блок C — Ревізія текстів розділу «API-ключі»
- [x] **C1. Аудит `keys.*`** — перечитати кожен рядок проти реальної поведінки
  (серверне шифроване сховище, write-only маска, іменовані слоти «AI 1 · Groq»,
  select моделі, довідник). Виправити неточності/калькування, узгодити тон;
  паритет uk/pl/en. Нічого поза `keys.*` не чіпати.
- [x] **C2. FE-гейти** (tsc/eslint/prettier/vitest/build; i18n паритет).

### Блок D — Доки + деплой
- [x] **D1. Доки.** `docs/08` — секція PH30.2; `docs/10` — нотатка-ревізія під D-20;
  `docs/03` — нові `error_reason` коди `/keys/models` (no_models/bad_key).
- [x] **D2. Деплой.** `status: done`; коміт + `git push origin main` (секрет уже в
  проді з PH30 — нового owner-action нема).

## Definition of Done
- [x] Поле моделі — тільки вибір зі `<select>`; ручний ввід зʼявляється **лише**
      на `no_models`/порожньому списку при валідному ключі.
- [x] Поганий ключ (401/403) НЕ відкриває ручне поле — показує «перевірте ключ».
- [x] Жива валідація на Save лишається; провайдер без `/models` (Perplexity)
      робочий через фолбек.
- [x] Тексти розділу API-ключів узгоджені з реальністю; паритет uk/pl/en.
- [x] Гейти зелені: BE pytest/ruff/black, FE tsc/eslint/prettier/vitest/build.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **D2 — ЗАВЕРШЕНО (status: done).** Блок D: доки
  оновлено (docs/08 PH30.2, docs/10 нотатка під D-20, docs/03 коди `error_reason`
  `/keys/models`); коміт+пуш у `main`. **ВЕСЬ ПЛАН PH30.2 ЗАКРИТО.**
- Наступний крок: **— немає (план завершено).**
- Порядок блоків: A (BE класифікація) → B (FE select) → C (тексти) → D (доки+деплой).
- Заблоковано: **ні**. Owner-action: нема (KEK уже в проді з PH30).
