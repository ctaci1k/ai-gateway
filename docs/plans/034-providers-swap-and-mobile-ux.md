# 034 — Заміна провайдерів (Mistral + NVIDIA NIM) і мобільний UX (PH35)

**Статус:** DONE (S1–S14 виконано, гейти зелені; S15 — деплой/ключі за власником) · реалізовано як PH35/D-25, 2026-06-04
**Власник:** Stanislav
**Передумова:** дослідження лімітів (Cerebras = 5 req/min, SambaNova = 20 req/**добу** — занадто мало). Мета — підняти найслабші ланки до ≥30 req/min, лишивши Groq-відповідач і Groq-Qwen суддю незмінними.

> **Цей план написаний для виконання в новому чаті (Cloud AI / Claude Code).**
> Працювати **атомарно**: один крок S → перевірка (gate) → коміт-готовність → наступний.
> Прогрес фіксувати **тільки в цьому файлі** (мітка `[x]` біля кроку + 1 рядок підсумку).

---

## Залізні правила (не порушувати)

1. **Не вигадувати стан.** Перед твердженням «як працює» — звіряйся з кодом і `docs/08-current-state.md`.
2. **Не чіпати шифрування BYOK (D-20), маски ключів (D-21), slot-vs-model (D-22).** Plaintext-ключ / KEK **ніколи** в логах, відповідях, ledger.
3. **Мінімальний радіус ураження:** не ламати квоти, billable-логіку, one-row-per-turn ledger, логіку вибору переможця суддею.
4. **Суддя лишається Groq · `qwen/qwen3-32b`** — у цьому плані **нічого** в судді не змінюємо.
5. **Frontend golden rules:** без дублювання JSX/стилів/текстів; тексти лише через `t("key")` з паритетом uk/pl/en; кольори/відступи лише через design tokens (виняток — наявна мапа `SLOT_COLOR`, що вже містить hex; лишаємось консистентними з нею, нового хардкоду кольору поза цією мапою не вводимо).
6. **STOP лише якщо вимога суперечить безпеці/рішенням.** Інакше — вирішуй сам і зафіксуй рішення тут.
7. **Жодного `docker compose down -v`.** Жодних деструктивних дій з БД.

---

## Узгоджені рішення цього плану (defaults — власник може змінити через env)

| Слот | Було | Стає | Провайдер | Base URL | Env-ключі | Модель (default) |
|---|---|---|---|---|---|---|
| 1 (responder) | groq | **groq** (без змін) | Groq | `api.groq.com/openai/v1` | `GROQ_API_KEY`, `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| 2 (responder) | cerebras | **mistral** | Mistral | `https://api.mistral.ai/v1` | `MISTRAL_API_KEY`, `MISTRAL_MODEL` | `mistral-small-latest` |
| 3 (responder) | sambanova | **nvidia** | NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `NVIDIA_API_KEY`, `NVIDIA_MODEL` | `deepseek-ai/deepseek-v3.1` *(звірити точний slug на build.nvidia.com)* |
| суддя | groq·qwen3-32b | **без змін** | Groq | — | — | `qwen/qwen3-32b` |

- **Slug слотів:** `mistral`, `nvidia`. (У BYOK-списку вже є endpoint `mistral` — це інша сутність: D-22 slot-vs-model, конфлікту немає, масиви різні.)
- **Різноманіття:** Llama (Meta) / Mistral / DeepSeek — три різні «родини»; суддя Qwen ні з ким не збігається → без self-bias.
- **`MISTRAL_MODEL`:** `mistral-small-latest` (швидкий, безкоштовний Experiment-tier, ~300 req/min). Власник може поставити `mistral-large-latest`.
- **`NVIDIA_MODEL`:** обрати **не-Llama, не-Qwen** модель (щоб не дублювати слот 1 і суддю). DeepSeek-V3.1 зберігає «розлогий/детальний» характер старого SambaNova. **Точний slug звірити в каталозі build.nvidia.com перед деплоєм.**
- **`*_max_tokens`:** Mistral-small / DeepSeek — не reasoning-моделі з обовʼязковим headroom, як GLM-4.7. Прибрати спец-кейс `cerebras_max_tokens=4096`; нові слоти беруть `responder_max_tokens`. *(Якщо власник обере reasoning-модель на NIM — повернути headroom через env.)*

---

## Що залишається коректним без змін (перевірено розвідкою коду)

- **«Справжня назва моделі» вже динамічна.** Денорм-колонки `usage_events.model_name` / `judge_model_name` заповнюються з `provider.model_name` (через `apply_model_spec()`); фронт показує через `modelDisplay()` / `reportModel()` / `responderLabel()`. Після оновлення мап назв — карти, порівняння, звіти, admin рендеряться **самі** (нічого більше чіпати).
- **`GET /providers`** повертає ключі з `ProviderService.providers` dict → оновиться автоматично.
- **Суддя** (`build_judge()` → Groq·qwen3-32b) — без змін.
- **Історичні рядки** (старі cerebras/sambanova-ходи) у звітах **залишаться** з «GLM-4.7 / DeepSeek V3.1» — бо саме ці моделі тоді й відповідали (truthful naming, межа D-21). Це **правильно**, не баг.

---

# ЧАСТИНА A — Backend: заміна провайдерів

### S1 — Config (`backend/core/config.py`)
- [x] Перейменувати поля: `cerebras_api_key`→`mistral_api_key` (alias `MISTRAL_API_KEY`), `sambanova_api_key`→`nvidia_api_key` (alias `NVIDIA_API_KEY`).
- [x] `cerebras_model`→`mistral_model` (default `"mistral-small-latest"`, alias `MISTRAL_MODEL`); `sambanova_model`→`nvidia_model` (default `"deepseek-ai/deepseek-v3.1"`, alias `NVIDIA_MODEL`).
- [x] Прибрано `cerebras_max_tokens` — нові слоти не reasoning, беруть `responder_max_tokens`.
- [x] Base-URL дефолти живуть у провайдер-класах/`provider_service` (не в config) → у S2/S4.
- **Gate:** ✅ `python -c "from core.config import get_settings; get_settings()"` без помилок; `mistral_model`/`nvidia_model` коректні, `cerebras_max_tokens` відсутній.

### S2 — Провайдер-класи (`backend/providers/`)
- [x] Створено `mistral_provider.py`: `MistralProvider`, base `https://api.mistral.ai/v1`, `mistral_api_key`.
- [x] Створено `nvidia_provider.py`: `NvidiaProvider`, base `https://integrate.api.nvidia.com/v1`, `nvidia_api_key`.
- [x] Видалено `cerebras_provider.py`, `sambanova_provider.py`.
- **Gate:** ✅ import нових класів без помилок.

### S3 — Реєстр моделей (`backend/config/models_config.py`)
- [x] `"mistral"`: `display_name="Mistral Small"`, `max_tokens=responder_max_tokens`.
- [x] `"nvidia"`: `display_name="DeepSeek V3.1"`, `max_tokens=responder_max_tokens`.
- **Gate:** ✅ реєстр = {groq, mistral, nvidia}, display_name присутні.

### S4 — ProviderService (`backend/services/provider_service.py`)
- [x] Імпорти → `MistralProvider`/`NvidiaProvider`; `providers` dict mistral/nvidia.
- [x] `DEFAULT_BASE_URLS`: mistral/nvidia; дефолтний ростер `["groq","mistral","nvidia"]`.
- **Gate:** ✅ `get_all_providers()` → {groq, mistral, nvidia}, DEFAULT_BASE_URLS оновлено.

### S5 — Selector + докстрінги
- [x] `ALLOWED_MODELS` = `["groq","mistral","nvidia"]`; суддя не чіпано.
- [x] Докстрінги: `chat_schema.py`, `db/models.py`, `openai_compatible.py`, `selector_config.py`.
- **Gate:** ✅ grep backend (non-test) → лише історичний коментар у `config.py` (навмисний); жодного активного коду.

### S6 — Тести backend
- [x] `tests/test_api.py`: `test_providers_list_is_public` → `{"groq","mistral","nvidia"}`.
- [x] `tests/conftest.py`: env-дефолти `MISTRAL_API_KEY`/`NVIDIA_API_KEY`.
- [x] Оновлено хардкод слотів у всіх test-файлах (mechanical rename cerebras→mistral, sambanova→nvidia); `test_responders` — переписано budget-тест на новий ростер.
- [x] **Тест зворотної сумісності:** `test_legacy_slot_rows_survive_provider_swap` — історичний ledger-рядок зі слотом cerebras/sambanova аґреґується, показує `model_name`, не падає.
- **Gate:** ✅ pytest **222 passed**; ruff clean; black clean.

### S7 — Env-приклади / docs
- [x] `backend/.env.example` + `.env.production.example`: додано `MISTRAL_*`/`NVIDIA_*`, прибрано `CEREBRAS_*`/`SAMBANOVA_*`/`CEREBRAS_MAX_TOKENS`. (Compose використовує `env_file` → passthrough автоматичний.)
- [x] Оновлено `08-current-state.md` (ground-truth склад відповідачів + секція PH35), `10-open-decisions.md` (**D-25** — D-23/D-24 вже зайняті PH33/PH34), `05-providers-and-selector.md` (таблиця ростера — це поточний контракт, не історія).
- **Gate:** ✅ env-файли чисті; у docs/ лишилися лише історичні/пояснювальні згадки (D-11/OD-1, PH16, пояснення видалення в PH35).

---

# ЧАСТИНА B — Frontend: динамічне відображення нових слотів

### S8 — Центральні мапи провайдерів
- [x] `models.ts` `RESPONDER_LABELS` → `mistral: "Mistral Small"`, `nvidia: "DeepSeek V3.1"`.
- [x] `ComposerContext.tsx` `SINGLE_PROVIDERS` + `KeysContext.tsx` `DEFAULT_RESPONDER_SLOTS` → `["groq","mistral","nvidia"]`.
- [x] `SingleModelPicker.tsx` `SLOT_COLOR`: mistral `#fa520f`, nvidia `#76b900`.
- **Gate:** ✅ `tsc --noEmit` чисто.

### S9 — BYOK built-in endpoints (`frontend/utils/byokEndpoints.ts`)
- [x] `BUILTIN_BASE_URLS`: cerebras/sambanova → mistral/nvidia. **Прибрано дублікат `mistral` зі списку сумісних** (тепер він built-in) → немає дубль-id в `ALL_ENDPOINTS`.
- [x] `byok-judge` fallback → Groq (без змін, `builtinForSlot`).
- **Gate:** ✅ `ProviderGuide` дата-кероване (`ALL_PROVIDER_LINKS`); жодного посилання на cerebras/sambanova у .ts/.tsx.

### S10 — i18n (паритет uk/pl/en)
- [x] `picker.desc.cerebras/sambanova` → `picker.desc.mistral/nvidia` (3 мови).
- [x] `SingleModelPicker` читає `picker.desc.${slot}` динамічно (гейт `slot in SLOT_COLOR`) → нові ключі підхоплюються.
- **Gate:** ✅ i18n parity test (4 tests) зелено; 344 ключі × 3 мови.

### S11 — Зворотна сумісність фронту
- [x] Легасі-слот: `responderLabel("sambanova")`→raw; `modelDisplay("cerebras","GLM-4.7",true)`→збережений model. UI не падає.
- [x] `models.test.ts`: оновлено кейси (mistral/nvidia) + кейс легасі-слоту; `KeysContext.test.ts` слоти оновлено.
- **Gate:** ✅ vitest **40 passed**; eslint + prettier чисто.

---

# ЧАСТИНА C — Мобільний UX

> **S12 спочатку — РОЗВІДКА точного елемента** (не вигадувати). Кандидати з карти коду:
> перемикач режимів реалізований як **акордеони в `Sidebar.tsx` (ряди 150-197)** через `useChatMode()` (`ChatModeContext.tsx`).
> Можливо існує й сегментований «бар» деінде — **спершу знайди реальний елемент, що «вивалюється» на телефоні**, і зафіксуй файл/рядок тут, перш ніж міняти.

### S12 — Мобільний перемикач режимів: бар → дві кнопки
**Мета:** на телефоні (`@media max-width:768px`) замість «бару переключення», що погано виглядає, показати **дві окремі кнопки**: «Одиночна модель» і «Порівняння».
- [x] **РОЗВІДКА (зафіксовано):** єдиний перемикач режимів — акордеони `Sidebar.tsx` (153-192) через `setMode`+`newChat`; на телефоні сайдбар = off-canvas-шухляда за бургером (CSS 3501-3516), тож перемикач **прихований**, а в головній області `MainHead` показує лише **статичний** `cc-mode-tag` (не клікабельний перемикач). Тобто на телефоні **немає видимого перемикача режимів** — це і є «поганий бар». **Рішення:** додати mobile-only блок із 2 кнопок (`ModeSwitch`) угорі головної області (після `MainHead`); десктоп (акордеони + tag) не чіпати; off-canvas-акордеони лишаються для History.
- [x] Новий компонент `components/layout/ModeSwitch.tsx` (mobile-only), рендериться в `app/page.tsx` після `MainHead`. Кнопки з мапи (без копіпасту JSX): Single → `setMode("single")`+`newChat()`+`openSingle(null)`; Compare → `setMode("compare")`+`newChat()` (дзеркало `newSingle/newCompare`).
- [x] Активний режим: `aria-pressed` + `.is-active` (accent-fill через токени).
- [x] Десктоп не чіпано: `.cc-modeswitch { display:none }` базово; `display:flex` лише в `@media (max-width:768px)`. Off-canvas-акордеони лишаються для History.
- [x] Тексти — наявні `t("sidebar.singleTitle")`/`t("sidebar.compareTitle")` (паритет уже є).
- [x] Стилі у `theme/components.css` (`.cc-modeswitch*` на токенах, у наявному `@media 768px`); таргети ≥44px.
- **Gate:** ✅ CSS-артефакт: база `display:none` (ряд 3081), mobile `display:flex` всередині `@media(max-width:768px)` (ряд 3580); ≥769px — приховано. tsc/eslint/prettier зелено.

### S13 — Мобільна картка «хто створив» у меню акаунта
**Мета:** на телефоні перенести `CreatorCard` із сайдбару в меню акаунта (`AccountMenu.tsx`), розмістивши **між Security і Logout**, відокремивши лінією.
- [x] У `AccountMenu.tsx` після **Security** вставлено блок `.cc-menu-creator`: `<div cc-menu-sep/> → <CreatorCard variant="menu"/>`, а наявний `cc-menu-sep` перед Logout лишився → послідовність Security → лінія → CreatorCard → лінія → Logout.
- [x] Один `CreatorCard` з `variant` (без копії JSX). Видимість через CSS: база `.cc-menu-creator{display:none}`; у `@media(max-width:768px)` — `.cc-menu-creator{display:block}` + `.cc-side .cc-creator{display:none}` (сайдбарна копія ховається) → немає дублювання.
- [x] Розділювач — наявний `.cc-menu-sep`; модифікатор `.cc-creator--menu{margin-top:0}` (через токени, без хардкоду).
- **Gate:** ✅ десктоп: CreatorCard у сайдбарі, у меню прихований (не дублюється); ≤768px: у меню Security→лінія→CreatorCard→лінія→Logout, сайдбарна копія схована; `author.*` × 3 мови. tsc/eslint/prettier/vitest(40) зелено.

---

# ЧАСТИНА D — Інтеграція, тести, деплой

### S14 — Наскрізна перевірка
- [x] `backend`: pytest **222 passed** + ruff + black — зелено.
- [x] `frontend`: tsc(0), vitest(**40**), eslint(0), prettier — зелено.
- [~] Ручний димтест Compare (3 слоти live) — **відкладено до S15**: потребує реальних ключів Mistral/NVIDIA (реєструє власник). Код готовий; історичні рядки truthful перевірено юніт-тестом (`test_legacy_slot_rows_survive_provider_swap` + FE `models.test.ts`).
- **Gate:** ✅ усе зелено; активних згадок cerebras/sambanova немає (лишилися лише пояснювальні коментарі в `config.py`/`.env.example`, legacy-compat тести, історичні docs/міграції). `prompts.yaml` без стале-ростера.

### S15 — Env на сервері + деплой (дії власника + код) — **КОД ГОТОВИЙ, чекає власника**
**Інструкція власнику (точні кроки):**
1. **Зареєструвати безкоштовні ключі** (без картки):
   - **Mistral:** `https://console.mistral.ai/api-keys` → створити API key → це `MISTRAL_API_KEY`.
   - **NVIDIA NIM:** `https://build.nvidia.com` → увійти → обрати модель DeepSeek (напр. `deepseek-ai/deepseek-v3.1`) → «Get API Key» → це `NVIDIA_API_KEY`. **Звірити точний slug** на сторінці моделі; якщо відрізняється — задати `NVIDIA_MODEL=<точний-slug>`.
2. **У `.env.production` на VPS** додати й **прибрати старі**:
   ```
   MISTRAL_API_KEY=<ключ Mistral>
   NVIDIA_API_KEY=<ключ NVIDIA>
   # опційно (інакше беруться дефолти з config.py):
   # MISTRAL_MODEL=mistral-small-latest
   # NVIDIA_MODEL=deepseek-ai/deepseek-v3.1
   ```
   Видалити рядки `CEREBRAS_API_KEY`, `CEREBRAS_MODEL`, `CEREBRAS_MAX_TOKENS`, `SAMBANOVA_API_KEY`, `SAMBANOVA_MODEL` (не обовʼязково, але чисто — код їх ігнорує через `extra="ignore"`).
3. Merge у `main` → CI → Deploy (GHCR → VPS, `docker compose pull && up`). **Міграцій БД немає** (схема не змінювалась) — `alembic upgrade head` на старті = no-op, безпечно.
4. Після деплою: якщо aaPanel-проксі кешує — звірити через `?v=N` (пуш `no-store` уже на місці).
- **Gate (власник):** на `https://ai.st.byn.sarl/` Compare відповідає groq/mistral/nvidia; ліміти більше не вузьке місце.
- [ ] (owner) Ключі зареєстровано + env заведено + деплой.

---

## Журнал виконання (заповнювати під час роботи)

| Крок | Статус | Підсумок (1 рядок) |
|---|---|---|
| S1–S7 backend | ✅ | Слоти cerebras/sambanova → mistral/nvidia (config, провайдер-класи, реєстр, provider_service, selector, докстрінги, env, docs D-25). Суддя/безпека/квоти не чіпано. BE 222 passed + ruff/black зелено. |
| S8–S11 frontend | ✅ | Мапи/SLOT_COLOR/BYOK-endpoints/i18n на mistral/nvidia; дубль mistral прибрано зі сумісних; легасі-слоти мають fallback. tsc/vitest(40)/eslint/prettier/i18n-parity зелено. |
| S12 mobile switch | ✅ | Новий `ModeSwitch` (mobile-only, 2 кнопки Single/Compare, aria-pressed, токени) у `page.tsx`; десктоп-акордеони не чіпано; CSS у `@media 768px`. |
| S13 mobile creator | ✅ | `CreatorCard` з `variant="menu"` у `AccountMenu` між Security і Logout (≤768px); сайдбарна копія ховається на телефоні; без дублю JSX. |
| S14 integration | ✅ | BE 222 + ruff/black; FE tsc/vitest(40)/eslint/prettier — усе зелено. Активних cerebras/sambanova немає. Live-димтест Compare відкладено до S15 (потрібні ключі). |
| S15 deploy | ⏳ owner | Код готовий. Власнику: завести `MISTRAL_API_KEY`+`NVIDIA_API_KEY` (опц. `*_MODEL`) у `.env.production`, прибрати `CEREBRAS_*`/`SAMBANOVA_*`, merge→CI→deploy. Міграцій БД немає. Точна інструкція — у кроці S15. |

## Чого НЕ робимо в цьому плані
- Не чіпаємо суддю (Groq·qwen3-32b), шифрування BYOK, маски, slot-vs-model.
- Не видаляємо історичні `usage_events` / збережені чати зі старими слотами (truthful naming зберігає коректність).
- Не міняємо квоти/billable/ledger.
- Orphan BYOK-рядки зі слотом cerebras/sambanova — нешкідливі (зашифровані, не використовуються); окрема чистка — поза планом.
