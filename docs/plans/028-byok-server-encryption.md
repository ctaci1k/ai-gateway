---
plan: 028-byok-server-encryption
status: done
updated: 2026-06-03
---

# PH30 — BYOK: серверне зашифроване per-account зберігання ключів (D-20) + дропдаун валідних моделей

> Власник делегував рішення архітектору: «зробити як велика корпорація». Дві фічі
> в одному заході:
> 1. **Серверне per-account зберігання ключів** із шифруванням: зайшов з іншого
>    комп'ютера під тим самим логіном — ключі на місці; інший акаунт бачить **лише
>    свої**; вийшов — локально нічого не лишилось. Це **свідомий реверс D-12**
>    (раніше: лише sessionStorage + транзит) → нове рішення **D-20**.
> 2. **Model discovery:** замість ручного вводу `model_id` — **дропдаун реальних
>    моделей акаунта** (`GET /models` провайдера), з фолбеком на ручний ввід. Знімає
>    біль «що писати в ID моделі» по-дорослому (як Cursor/LibreChat/OpenRouter).
>
> Порядок робіт: спершу сховище/шифрування (Блоки A–C), далі discovery (Блок D),
> тоді доки+деплой (Блок E). Discovery спирається на серверне сховище (вміє
> листати моделі за вже збереженим ключем), тож іде після нього.

## Рішення архітектора (ухвалені — новий чат їх НЕ переграє)

1. **Реверс D-12 → D-20.** BYOK-ключі зберігаються server-side, per-account,
   зашифровано. Транзит ключа лишається **тільки на момент збереження** (PUT) і
   валідації; чат їх більше **не передає** — сервер вантажить із БД за `user_id`.
2. **Чому не zero-knowledge.** Ми викликаємо провайдерів **на сервері**
   (Compare/суддя/стрім), тож сервер **мусить** уміти розшифрувати ключ → справжній
   zero-knowledge неможливий. Отже — server-side envelope encryption, і ми свідомо
   беремо custody ключів (відповідальність зафіксувати в D-20).
3. **Криптографія = AES-256-GCM (AEAD), envelope.**
   - **KEK** (Key Encryption Key) — з env `BYOK_ENCRYPTION_KEY` (base64, 32 байти).
   - Кожен запис шифрується **випадковим 96-біт nonce**; зберігаємо `ciphertext`,
     `nonce`, `key_version`. **AAD = `f"{user_id}:{slot}"`** (прив'язує шифротекст
     до власника+слота: підміна рядка в БД провалить автентифікацію тега).
   - **Рівні зрілості (документуємо чесно):** *Good* — KEK у env-секреті (наш
     рівень на VPS); *Better* — per-user DEK, загорнутий KEK; *Ideal* — KEK у
     KMS/Vault. Колонка `key_version` готує ґрунт під ротацію.
   - Плейнтекст ключа й плейнтекст KEK **ніколи не зберігаються** і **ніколи не
     логуються** (зберігаємо «not logged» з D-12; замінюємо «not in DB» на
     «зашифровано в DB»).
4. **Write-only UX.** `GET /keys` повертає **лише метадані**: `slot`, `base_url`,
   `model_id`, `last4` (останні 4 символи ключа — не секрет, окрема колонка),
   `custom`. **Повний ключ назад не віддається ніколи.** UI: маска
   «••••last4 — введіть, щоб замінити».
5. **Per-account ізоляція** — усі запити фільтруються по `user_id` (наявний патерн
   chats/reports). Акаунт A фізично не дістане ключі B.
6. **Decrypt лише server-side у момент використання** (orchestrator/validate/
   discovery), у пам'яті, найкоротше вікно.
7. **Без «device-only» режиму** (спрощення): канонічна модель одна —
   зберігання в акаунт. (Опційний тумблер — майбутнє, поза цим планом.)
8. **Logout/зміна акаунта:** чистимо лише **локальний кеш метаданих**; серверні
   ключі лишаються per-account; ізоляція гарантується `user_id` на сервері.
   Логіку PH23 (clear on logout) спрощуємо до очищення локального кешу.
9. **Мінімальний «вибух».** Чат-роути будують той самий об'єкт `ByokConfig`, але
   **джерело = БД** (розшифровано), а не тіло запиту → orchestrator/quota/reports
   **не чіпаємо**. Тіло `ChatRequest.byok` лишаємо опційним, але **ігноруємо**
   (клієнт більше не може інжектити ключі — це ще й безпековий плюс).
10. **Model discovery = дропдаун, не ручний ввід.** Після валідного ключа+ендпоінта
    тягнемо `GET {base_url}/models` через сервер (CORS+секретність) і даємо вибрати
    модель зі списку. **3 запобіжники (обов'язкові):** (а) великі списки → typeahead/
    фільтр; (б) у `/models` є не-чат моделі (embeddings/tts/whisper/image/rerank) →
    евристичний фільтр чат-моделей + перемикач «показати всі»; (в) провайдер без
    `/models` або помилка → **фолбек на ручний ввід, ніколи не блокувати**. Жива
    валідація на Save **лишається** (вибір зі списку ≠ гарантія роботи). Discovery
    вміє листати моделі і за **вже збереженим** ключем (decrypt server-side).
11. **«Де взяти ключі» = довідник + контекст у ⓘ (без лого).** Біля кожного поля
    ключа — посилання «Отримати API-ключ ↗» на **точну** сторінку ключів обраного
    провайдера (нова вкладка, `rel=noopener`). Плюс глобальна кнопка «Де взяти ключі
    та моделі?» зі списком усіх провайдерів і лінками. Дані лінків — в одному
    источнику (`utils/byokEndpoints.ts`): для кожного провайдера `keysUrl`+`modelsUrl`
    (+ окрема мапа для вбудованих Groq/Cerebras/SambaNova). Зовнішня навігація лише
    на доку провайдера — **жодні ключі/дані не передаються** (D-12/D-20 не зачіпає).
    Лого **не додаємо** (рішення власника).

## Ground truth (звірено з кодом 2026-06-03 — новий чат має перезвірити)

- **BE:** `request.byok` читається у `routes/chat.py` лише в 3 місцях:
  `_build_byok_judge(request)` (рядок ~37), `chat()` (~59), `_resolve_single_provider(request)` (~215).
  Усі будують `TransientProvider` через `ProviderService.{build_transient_judge,
  build_transient_responder,resolve_responders}`. Квота: `all_byok`/`should_charge`
  рахуються з готового набору провайдерів — **не чіпати**.
- **BE моделі:** `db/models.py` — `Base`, `User` (+relationships), патерн
  `UsageEvent` (FK `user_id` ondelete CASCADE). Сесія — `core/db.py::session_scope`.
  Міграції — `migrations/versions/000N_*.py` (остання `0007_usage_ledger`,
  `batch_alter_table` для SQLite+PG). Репозиторії — `memory/*` (per-user).
- **BE конфіг:** `core/config.py::Settings` (Pydantic, alias=ENV). Крипто-залежності:
  є `argon2-cffi`; **`cryptography` додати** в `requirements.txt` (перевірити, чи
  вже у venv транзитивно). Валідація BYOK: `routes/keys.py` (`POST /keys/validate`),
  `schemas/keys.py`.
- **FE:** ключі тримає `store/KeysContext.tsx` (sessionStorage). У запити
  підставляються через `byokPayload()`: `features/compare/useCompare.ts` (~54),
  `store/ComposerContext.tsx` (~124); типи в `services/{chatApi,compareApi}.ts`.
  UI-похідні: `store/sidebarStatus.ts` (byokPayload()!==null), `components/layout/
  MainHead.tsx`, `components/chat/SingleModelPicker.tsx`, `components/compare/
  {CompareColumn,CompareFailedCard}.tsx` (через `byokModelId`/`isOwnKey`).
  Форма: `components/keys/KeysForm.tsx`. Тести: `store/KeysContext.test.ts`.

---

## Кроки (атомарні; гейти після кожного)

### Блок A — Backend: крипто + сховище
- [x] **A1. Залежність + конфіг.** Додати `cryptography` у `backend/requirements.txt`
  (звірити venv). У `core/config.py` — `byok_encryption_key: str = Field(default="",
  alias="BYOK_ENCRYPTION_KEY")`. Додати у `.env.example` з інструкцією генерації
  (`python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"`)
  і в локальний `backend/.env` (dev-ключ). **Owner-handoff:** той самий секрет —
  у GitHub Actions/VPS env (інакше прод не розшифрує). Втрата/зміна KEK = усі
  збережені ключі недійсні (користувачі вводять заново) — задокументувати.
- [x] **A2. Крипто-модуль** `core/secret_box.py` — AES-256-GCM envelope:
  `encrypt_secret(plaintext, *, user_id, slot) -> (ciphertext, nonce, key_version)`
  та `decrypt_secret(ciphertext, nonce, *, user_id, slot, key_version) -> plaintext`.
  AAD = `f"{user_id}:{slot}"`. KEK з конфігу (base64→32 байти); якщо порожній —
  явна помилка «BYOK disabled: set BYOK_ENCRYPTION_KEY». Юніт-тест round-trip +
  невдала автентифікація при підміні AAD/nonce.
- [x] **A3. DB-модель + міграція.** `db/models.py`: `ByokCredential` (`id`,
  `user_id` FK CASCADE index, `slot` String(64), `base_url` String nullable,
  `model_id` String(256), `key_ciphertext` LargeBinary, `key_nonce` LargeBinary,
  `key_last4` String(8), `key_version` Integer default 1, `custom` Boolean,
  `created_at`/`updated_at`); `UniqueConstraint(user_id, slot)`; relationship на
  `User`. Alembic `0008_byok_credentials` (revises `0007_usage_ledger`,
  `batch_alter_table`-сумісно з SQLite+PG).
- [x] **A4. Репозиторій** `memory/byok_repository.py` (per-user, через
  `session_scope`): `list_metadata(user_id) -> [meta]`; `load_config(user_id) ->
  ByokConfig | None` (розшифрувати все → judge + responders); `upsert(user_id,
  entry)` (шифрує+пише; якщо `api_key` відсутній, але слот існує — переюзати
  збережений для ревалідації при зміні model/base_url); `delete(user_id, slot)`.
  Decrypt — лише тут; **жодних ключів у логах**.

### Блок B — Backend: ендпоінти + завантаження в чаті
- [x] **B1. Схеми** `schemas/keys.py`: `ByokKeyMeta{slot,base_url?,model_id,last4,
  custom}`; `ByokKeysResponse{keys:[meta]}`; `ByokSaveEntry{slot,base_url?,model_id,
  api_key?,custom}`; `ByokSaveRequest{entries:[...]}`; `ByokSaveResult{slot,ok,
  error?}`. (Лишити наявні Validate-схеми.)
- [x] **B2. Ендпоінти** `routes/keys.py` (auth + CSRF на мутаціях):
  `GET /keys` → метадані поточного юзера; `PUT /keys` → для кожного entry:
  валід-виклик (наявний `_validate_entry`/transient) → working: `upsert`(шифр.),
  failing: error без збереження → повертає `[ByokSaveResult]` + свіжі метадані;
  `DELETE /keys/{slot}` → видалити. Помилки — через `classify_provider_failure`
  (reason), без секретів у логах.
- [x] **B3. Чат вантажить із БД.** `routes/chat.py`: `_build_byok_judge` і
  `_resolve_single_provider` приймають `byok: ByokConfig | None` (не `request`);
  у `chat()`/`chat_stream()` — `byok = await ByokRepository.load_config(user.id)`;
  усі `request.byok` → `byok`. `ChatRequest.byok` лишити опційним, але **ігнорувати**
  (deprecated-коментар). Перевірити, що `all_byok`/`should_charge`/білінг
  `usage_events.billable` працюють як раніше.
- [x] **B4. BE-гейти.** Оновити/додати `tests/test_byok.py` (шифр-round-trip,
  GET/PUT/DELETE, per-user ізоляція, чат вантажить із БД, квота не зламана,
  ключ не в логах/відповідях). `./venv/bin/python -m pytest -q && ruff check . &&
  black --check .`.

### Блок C — Frontend: серверне сховище + write-only
- [x] **C1. Сервіс** `services/keysApi.ts`: `getKeys()`, `putKeys(entries)`,
  `deleteKey(slot)` (через наявний `apiClient`, CSRF). Лишити `validateKeys` за
  потреби.
- [x] **C2. `store/KeysContext.tsx`** — джерело правди = сервер: стан тримає
  **метадані** (не плейнтекст); гідрація через `getKeys()` при логіні; очищення
  локального кешу при logout/зміні акаунта (серверні ключі лишаються per-account).
  `saveAndValidate` → `putKeys`. `byokPayload()` → **прибрати** (чат не шле ключі).
  `isOwnKey`/`byokModelId`/`judgeActive`/`activeResponders`/`allParticipantsOwn` →
  з метаданих. Прибрати sessionStorage-логіку (D-15/PH23-нюанси переосмислити під
  серверну модель).
- [x] **C3. `components/keys/KeysForm.tsx`** — write-only: `model_id`/`base_url`
  префіл із метаданих; поле ключа порожнє з плейсхолдером «••••last4 — введіть,
  щоб замінити»; Save шле лише змінені рядки (api_key опц. якщо не міняли);
  «Очистити»/«Видалити» → `deleteKey`. Зберегти всі здобутки PH29.x (Select base
  URL для кастомних, ⓘ-підказки, блокування неповних рядків, валідація).
- [x] **C4. Прибрати транзит ключів із запитів.** `features/compare/useCompare.ts`
  і `store/ComposerContext.tsx` — більше не передавати `byok`; `services/
  {chatApi,compareApi}.ts` — `byok`-параметр прибрати/лишити опц.-невикористаним;
  `store/sidebarStatus.ts` — статус рахувати з метаданих (`activeResponders`/
  `judgeActive`), не з `byokPayload()`.
- [x] **C5. i18n + FE-гейти.** Нові ключі (плейсхолдер маски, «замінити», стани
  завантаження/помилки) — паритет uk/pl/en. Переписати `store/KeysContext.test.ts`
  під серверну модель. `npx tsc --noEmit && npx eslint . && npx prettier --check .
  && npm run test && npm run build`.

### Блок D — Model discovery (дропдаун валідних моделей)
- [x] **D1. BE ендпоінт** `POST /keys/models` (`routes/keys.py`, auth+CSRF): body
  `{slot?, base_url?, api_key?}`. Резолвить ендпоінт (порожній base_url + слот →
  вбудований дефолт), будує `TransientProvider`, кличе `client.models.list()`,
  повертає `{models:[id...], error_reason?}`. Якщо `api_key` відсутній, але слот має
  збережений ключ → **переюзати збережений** (decrypt server-side). Ключ —
  транзит/in-memory, **не логувати**. Помилка/нема `/models` → `{models:[],
  error_reason}` (через `classify_provider_failure`), щоб FE впав на ручний ввід.
- [x] **D2. BE утиліта чат-фільтра** — евристика «схоже на чат-модель» (виключити
  очевидні embeddings/tts/whisper/image/rerank за назвою) як **прапор**, список
  повертаємо повний і відсортований; рішення показувати/ховати — на FE.
- [x] **D3. FE сервіс** `services/keysApi.ts::fetchModels({slot?,baseUrl?,apiKey?})`.
- [x] **D4. FE combobox** — поле «ID моделі» стає комбобоксом (база — нативний
  `<input list>`+`<datalist>`, бо дає **ручний фолбек безкоштовно**): підвантаження
  після валідного ключа+ендпоінта (кнопка «Завантажити моделі» або авто), стани
  loading/empty/error з читабельним reason; евристичний фільтр чат-моделей +
  перемикач «показати всі»; **завжди дозволити ручний ввід**; кеш у сесії за
  `(endpoint+key)`. Для вбудованих слотів — листати проти резолвленого вбудованого
  ендпоінта. Жива валідація на Save лишається.
- [x] **D5. i18n + гейти** — нові ключі (завантажити моделі/завантаження/нема
  списку/показати всі) паритет uk/pl/en; BE+FE гейти зелені.

### Блок E — «Де взяти ключі та моделі» (довідник + контекст у ⓘ, без лого)
- [x] **E1. Дані лінків** — розширити `utils/byokEndpoints.ts`: кожен запис +`id`,
  `keysUrl`, `modelsUrl`, `needsKey?` (Ollama=false); окрема мапа
  `BUILTIN_PROVIDER_LINKS` (Groq/Cerebras/SambaNova, бо їх нема у списку); хелпери
  `providerLinksForUrl(url)` / `providerLinksForSlot(slot)`. URL **звірити перед
  релізом** (provider docs змінюються).
- [x] **E2. Глобальний довідник** `components/keys/ProviderGuide.tsx` — кнопка
  «Де взяти ключі та моделі?» біля intro → попап/панель (токени, a11y Esc/click-out/
  focus) зі списком провайдерів, кожен — «Отримати API-ключ ↗»/«Список моделей ↗»;
  Ollama — позначка «ключ не потрібен, локально».
- [x] **E3. Контекст у ⓘ** — розширити `InfoTip` опційним слотом `links`; у
  `KeysForm` біля поля ключа підкидати лінк саме на провайдера цього рядка
  (вбудований — за слотом; кастомний — за вибраним base URL). Усі лінки —
  `target="_blank" rel="noopener noreferrer"`, ≥44px, focus-visible.
- [x] **E4. i18n + гейти** — `keys.whereToGet`, `keys.getKey`, `keys.getModels`,
  `keys.ollamaNoKey`, `keys.providerGuideTitle` (паритет uk/pl/en); FE-гейти зелені.

### Блок F — Доки + деплой
- [x] **F1. Доки.** `docs/10` — нове рішення **D-20** (реверс D-12, причини,
  модель загроз, рівні Good/Better/Ideal) + нотатка про model discovery і довідник
  ключів; `docs/03` — `/keys` CRUD + `POST /keys/models` + прибраний транзит у
  `/chat*`; `docs/04` — таблиця `byok_credentials` + envelope; `docs/06` — серверний
  BYOK, write-only, combobox моделей, довідник провайдерів; `docs/08` — секція PH30;
  `CLAUDE.md`/брифи — оновити згадку «ключі лише в sessionStorage» (тепер —
  зашифровано в БД).
- [x] **F2. Деплой.** Owner-handoff: додати `BYOK_ENCRYPTION_KEY` у прод-секрети
  (GitHub Actions/VPS) **до** деплою. `status: done`; коміт + `git push origin main`
  → CI→Docker→VPS (Alembic `0008` застосується на старті).

## Definition of Done
- [x] Ключі зберігаються **зашифровано (AES-256-GCM envelope) per-account** у БД;
      плейнтекст ніколи не в БД/логах/відповідях; KEK з env (→ KMS у проді).
- [x] Cross-device: інший комп'ютер під тим самим акаунтом бачить свої ключі;
      інший акаунт — лише свої; logout чистить лише локальний кеш.
- [x] Чат вантажить BYOK із БД; orchestrator/quota/reports працюють як раніше;
      `ChatRequest.byok` ігнорується.
- [x] Write-only UI (маска last4, «замінити»); усі здобутки PH29.x збережені.
- [x] **Model discovery:** дропдаун реальних моделей провайдера (`POST /keys/models`)
      з фільтром чат-моделей, перемикачем «показати всі» і **фолбеком на ручний
      ввід**; жива валідація на Save лишається.
- [x] **Довідник ключів:** контекстний лінк «Отримати API-ключ ↗» біля поля ключа
      за обраним провайдером + глобальна кнопка-довідник; без лого; жодних даних
      назовні.
- [x] Гейти зелені: BE pytest/ruff/black, FE tsc/eslint/prettier/vitest/build,
      i18n паритет; D-20 у `docs/10`. ⏳ Деплой із `BYOK_ENCRYPTION_KEY` — F2
      (owner-action: завести секрет у прод перед/разом із пушем).

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **F2 — ЗАВЕРШЕНО (status: done).** Власник підтвердив
  `BYOK_ENCRYPTION_KEY` у прод-секретах; коміт `997f907` запушено в `main`
  (`ad85c90..997f907`) → CI→Docker→VPS, Alembic `0008` застосується на старті.
  **ВЕСЬ ПЛАН PH30 ЗАКРИТО.**
- Попередній крок: **F1** — доки оновлено: `docs/10` (D-20: реверс D-12,
  модель загроз, рівні Good/Better/Ideal, discovery, довідник), `docs/08` (секція
  PH30 A–E), `docs/03` (`/keys` CRUD + `/keys/models` + прибраний транзит у
  `/chat*`), `docs/04` (таблиця `byok_credentials` + envelope; `ByokConfig` тепер
  з БД), `docs/06` (серверний BYOK, write-only, ModelCombobox, ProviderGuide),
  `CLAUDE.md` (BYOK зашифровано в БД). DoD-чеклист закрито (крім деплою). ⚠️ Блоки
  A–E — історія нижче / у docs/08 (PH30).
- Наступний крок: **— немає (план завершено).** Опційно: моніторити GitHub
  Actions / прод і перевірити наживо збереження ключа + дропдаун моделей.
- Порядок блоків: A✅→B✅→C✅→D✅→E✅→F1✅→F2✅.
- Заблоковано: **ні**. Усе зроблено й задеплоєно.

### Історія E
- Блок E (довідник ключів) завершено. E1:
  `utils/byokEndpoints.ts` розширено (`id`/`keysUrl`/`modelsUrl`/`needsKey` на
  кожен запис + `BUILTIN_PROVIDER_LINKS` для Groq/Cerebras/SambaNova + хелпери
  `providerLinksForUrl`/`providerLinksForSlot` + `ALL_PROVIDER_LINKS`; URL —
  best-effort, звірити перед релізом). E2: `components/keys/ProviderGuide.tsx`
  (кнопка «Де взяти ключі та моделі?» → a11y-панель, Esc/click-out/focus, лінки
  target=_blank rel=noopener). E3: `InfoTip` отримав опційний `links`; у KeysForm
  per-row apiKey-ⓘ підкидає «Отримати API-ключ ↗» (built-in за слотом, custom за
  base URL). E4: i18n (5 ключів × uk/pl/en) + CSS `.keys-guide*`/`.keys-info-link*`/
  `.keys-intro-row`. Гейти зелені: BE **178 passed** + ruff/black; FE tsc/eslint/
  prettier/vitest(29)/build. ⚠️ Блоки A–D — історія нижче.
- Наступний крок: **F1** — оновити docs (03/04/06/08/10 + CLAUDE.md), потім F2 деплой.
- Порядок блоків: A✅→B✅→C✅→D✅→E✅→F (доки+деплой).
- Заблоковано: **ні**. Owner-action перед F2: завести `BYOK_ENCRYPTION_KEY` у
  прод-секрети.

### Історія D
- Блок D завершено. D1:
  `POST /keys/models` (`routes/keys.py`, auth+CSRF) — резолвить ендпоінт/ключ
  (reuse stored при відсутності `api_key`), `provider.list_models()`, фолбек
  `{models:[], error_reason}`. D2: `core/model_filter.py::is_chat_model`
  (евристика; повний список + прапор `is_chat`). D3: `services/keysApi.ts::
  fetchModels`. D4: `components/keys/ModelCombobox.tsx` (нативний `<input list>`+
  `<datalist>` → ручний фолбек; «Завантажити моделі», loading/empty/error,
  chat-фільтр + «показати всі», session-кеш) вмонтовано в обидва model-поля
  KeysForm. D5: i18n (7 ключів × uk/pl/en) + CSS `.keys-model*`/`.keys-link-btn`.
  Гейти: BE pytest(**16 byok**, ruff/black) + FE tsc/eslint/prettier/vitest(29)/
  build зелені. ⚠️ Блоки A,B,C — історія нижче.
- Наступний крок: **E1** — лінки провайдерів у `utils/byokEndpoints.ts`.
- Порядок блоків: A✅→B✅→C✅→D✅→E (довідник) → F (доки+деплой).
- Заблоковано: **ні**. Owner-action перед F2: завести `BYOK_ENCRYPTION_KEY` у
  прод-секрети.

### Історія C
- Блок C завершено. C1: `services/keysApi.ts`
  (`getKeys`/`putKeys`/`deleteKey` + типи `KeyMeta`/`SaveEntry`/`SaveResult`;
  `validateKeys` лишено). C2: `store/KeysContext.tsx` переписано на серверну
  метадата-модель (`stateFromMetadata`, гідрація через `getKeys()` per-account,
  `saveKeys`/`removeKey`, `byokPayload` прибрано; пер-юзер кеш чиститься на
  logout). C3: `KeysForm.tsx` write-only (маска `••••last4`, prefill model/base,
  Save шле лише змінені рядки, Clear/Remove → DELETE; PH29.x збережено). C4: транзит
  ключів прибрано з `useCompare`/`ComposerContext`/`chatApi`/`compareApi`;
  `sidebarStatus` рахує з метаданих. C5: i18n (`keys.replaceMask` +
  оновлено `keys.noteSecurity` під шифроване сховище, паритет uk/pl/en),
  `KeysContext.test.ts` переписано. FE-гейти зелені: tsc/eslint/prettier/
  **vitest(29)**/build.
  ⚠️ Блоки A,B — див. історію нижче.
- Наступний крок: **D1** — `POST /keys/models` (model discovery).
- Порядок блоків: A✅→B✅→C✅→D (моделі) → E (довідник) → F (доки+деплой).
- Заблоковано: **ні**. Owner-action перед F2: завести `BYOK_ENCRYPTION_KEY` у
  прод-секрети.

### Історія B
- Блок B завершено. B1: CRUD-схеми
  (`ByokKeyMeta`/`ByokKeysResponse`/`ByokSaveEntry`/`ByokSaveRequest`/
  `ByokSaveResult`/`ByokSaveResponse`) у `schemas/keys.py`. B2: `routes/keys.py`
  — `GET/PUT/DELETE /keys` (auth+CSRF; PUT валідує конкурентно, пише послідовно;
  reuse stored key при зміні model/base_url; KEK-gate). B3: `routes/chat.py`
  вантажить BYOK з БД через `ByokRepository(user.id).load_config()`; тіло
  `ChatRequest.byok` ігнорується (deprecated). B4: BE-гейти зелені —
  **175 passed**, ruff/black чисто; `tests/test_byok.py` переписано
  (storage round-trip, write-only last4, per-account ізоляція, key-not-in-DB/
  response, reuse-key, body-byok-ignored, quota з БД).
  ⚠️ Попередній Блок A — див. історію нижче.
- Наступний крок: **C1** — `services/keysApi.ts` (getKeys/putKeys/deleteKey).
- Порядок блоків: A✅→B✅→C (FE сховище) → D (моделі) → E (довідник) → F (доки+деплой).
- Заблоковано: **ні**. Owner-action перед F2: завести `BYOK_ENCRYPTION_KEY` у
  прод-секрети.

### Історія A
- Блок A завершено. A2: `core/secret_box.py`
  (AES-256-GCM envelope, KEK з env, AAD=user:slot, `key_version`) + 7 unit-тестів
  (`tests/test_secret_box.py`, зелені). A3: модель `ByokCredential` у `db/models.py`
  (UNIQUE(user_id,slot), FK CASCADE, LargeBinary ciphertext/nonce, last4,
  key_version, custom) + Alembic `0008_byok_credentials` (застосовано на чистій БД).
  A4: `memory/byok_repository.py` (`list_metadata`/`resolve_key`/`load_config`/
  `upsert`/`delete`, per-user, decrypt лише тут). conftest отримав тестовий
  `BYOK_ENCRYPTION_KEY`.
- Наступний крок: **B1** — CRUD-схеми в `schemas/keys.py`.
- Порядок блоків: A✅→B→C (сховище) → D (моделі) → E (довідник ключів) → F (доки+деплой).
- Змінені файли (A): `backend/requirements.txt`, `core/config.py`, `.env.example`,
  `.env`, `core/secret_box.py`, `tests/test_secret_box.py`, `tests/conftest.py`,
  `db/models.py`, `migrations/versions/0008_byok_credentials.py`,
  `memory/byok_repository.py`.
- Заблоковано: **ні**. Owner-action перед F2: завести `BYOK_ENCRYPTION_KEY` у
  прод-секрети.
