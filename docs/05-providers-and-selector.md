# 05 — Провайдери та селектор

## Контракт провайдера — `providers/base_provider.py`

Усі провайдери успадковують `BaseProvider(ABC)`.

**Атрибути (метадані спроможностей):**

| Атрибут | Тип | Сенс |
|---|---|---|
| `provider_name` | str | Ідентифікатор (`"groq"`, …) |
| `model_name` | str | API-id моделі (із реєстру, PH16) |
| `display_name` | str | Правдива людська назва (UI / `/providers/info`, PH16) |
| `max_output_tokens` | int\|None | Per-provider бюджет виводу (із реєстру; None → `RESPONDER_MAX_TOKENS`) |
| `supports_streaming` | bool | Чи вміє стрімити |
| `supports_structured_output` | bool | JSON-вивід |
| `supports_tool_calling` | bool | Tool calls |
| `supports_vision` | bool | Зображення |
| `supports_selector_execution` | bool | Чи може бути суддею |
| `max_context_window` | int | Розмір контексту |

`model_name`/`display_name`/`max_output_tokens` більше **не хардкодяться** у класах провайдерів — провайдер у `__init__` викликає `apply_model_spec(get_model_spec(provider_name))`, який біндить інстанс до запису реєстру (PH16, D-11).

### Реєстр моделей — `config/models_config.py` (єдине джерело правди, PH16/D-11)

`ModelSpec{provider, api_model_id, display_name, max_tokens}`; `api_model_id` читається з `.env` (override без коду), `display_name` — правдива назва, `max_tokens` — per-provider бюджет. Це джерело для коду провайдерів, `/providers/info` і (дзеркально) FE-констант (`utils/models.ts`).

**Абстрактні методи (обов'язкові):**

```python
async def generate(self, message: str) -> str
async def generate_structured(self, message: str) -> Any
async def generate_stream(self, message: str) -> AsyncGenerator[str, None]
```

**З поведінкою за замовчуванням:**
- `generate_selector_response()` → за замовчуванням викликає `generate_structured()`.
- `get_provider_info()` → повертає словник метаданих (для `/providers/info`).

---

## Реальні провайдери

### Відповідачі (у `ProviderService.providers`) — три **різні** родини (PH16/D-11)

| Провайдер | `api_model_id` (env) | `display_name` | Бюджет | Контекст | SDK |
|---|---|---|---|---|---|
| `groq` ✅ | `llama-3.3-70b-versatile` | Llama 3.3 70B | 2048 | 128 000 | `groq` |
| `cerebras` ✅ | `zai-glm-4.7` | GLM-4.7 | 4096 (reasoning) | 8 192 | OpenAI-compat |
| `sambanova` ✅ | `DeepSeek-V3.1` | DeepSeek V3.1 | 2048 | 128 000 | OpenAI-compat |

Три родини (Llama / GLM / DeepSeek) → у Compare три **по-справжньому різні** відповіді; жодна не збігається з суддею (Qwen) → без self-bias. Бюджети: глобальний `RESPONDER_MAX_TOKENS=2048`, Cerebras (reasoning-модель) — `CEREBRAS_MAX_TOKENS=4096`. Доступність моделей звірено live у API провайдерів (рекомендована `llama-4-scout` була недоступна в Cerebras → обрано найсильнішу доступну відмінну GLM-4.7).
Дефолтний набір для Compare: `["groq", "cerebras", "sambanova"]`. Дефолтний провайдер: `groq`.

### Суддя (окремо, НЕ в словнику відповідачів) — D-9

| Провайдер | `model_name` | Роль |
|---|---|---|
| `groq` ✅ | `qwen/qwen3-32b` | AI Selector (суддя), будується через `ProviderService.build_judge` |

> ❗ Реально відповідають Groq/Cerebras/SambaNova, а суддя — **нейтральна Qwen на Groq** (D-9; перенесено з Gemini через ліміт 20/добу). **Gemini лишається лише для RAG-embeddings.** Qwen не збігається з жодним відповідачем → без self-bias. Див. [10-open-decisions.md](10-open-decisions.md) (D-1, D-9, D-11).

---

## Виконання провайдерів — `services/provider_service.py`

- `execute_many(message, provider_names?, providers_map?)` — паралельно через `asyncio.gather`, кожен слот у `_safe_generate(slot, provider, message)` (заміри часу + ловля помилок). Падіння однієї моделі не валить запит. Приймає або список імен (будує синглтони), або готовий `providers_map: {slot → provider}` (для BYOK).
- `generate_stream(message, provider_name, provider?)` — стрім для Single; явний `provider` (напр. транзитний BYOK) має пріоритет над синглтоном за іменем.
- `build_judge()` — будує суддю окремо від відповідачів (для `groq` бере `SELECTOR_MODEL=qwen/qwen3-32b`, не модель groq-відповідача → без self-bias).
- `execute_selector_ai(message, judge_provider?)` — викликає `(judge_provider or build_judge()).generate_selector_response()` через `asyncio.wait_for(timeout=SELECTOR_TIMEOUT)`; `judge_provider` дозволяє BYOK-суддю.

### BYOK — транзитні провайдери (PH17, D-12)

- `TransientProvider(OpenAICompatibleProvider)` — будується **на час одного запиту** з `(base_url + api_key + model_id)`; `model_name = model_id` (правдива назва в UI). **Не кешується**, ключ відкидається з інстансом (NQ5).
- `resolve_responders(provider_slots, byok_responders)` — мапить кожен слот: є BYOK-ключ → `TransientProvider`; інакше → вбудований синглтон (ключ застосунку). Підтримує **3–5** відповідачів (3 дефолтні + до 2 кастомних; кастомним потрібен `base_url`).
- `build_transient_judge(entry)` — транзитний суддя (дефолтний endpoint — Groq). `JUDGE_BYOK_SLOT = "byok-judge"`.
- `OpenAICompatibleProvider.validate_credentials()` — легкий тест-виклик для `POST /keys/validate`; кидає на будь-якій помилці API; нічого не зберігає, ключ не логується.
- **Endpoints дефолтних слотів** (`DEFAULT_BASE_URLS`): groq `https://api.groq.com/openai/v1`, cerebras `https://api.cerebras.ai/v1`, sambanova `https://api.sambanova.ai/v1`.
- **Ліміт власного ключа (PH18/8, D-13).** Ліміти всередині ключа користувача нам невидимі. Коли провайдер віддає rate-limit на BYOK-моделі, збій класифікується `classify_provider_failure` → `reason="rate_limited"`: у Compare через `failed_providers[].reason`, у Single через стрім-подію `{"type":"error","reason":...}`. UI показує **окреме** грамотне повідомлення («ліміти вашого ключа вичерпано — перевірте акаунт провайдера»), чітко відмінне від нашого `quota_exceeded`. На своєму ключі наші ліміти **не** списуються (D-13).

---

## AI Selector (суддя) — `selector/`

**Ланцюг:**

```
ResponseSelector.select_best_response
   │  будує промпт (SelectorPromptBuilder) з усіма відповідями + контекстом персоналізації
   │  (включно з manual_model_selections); відповіді подаються у детермінованому
   │  анти-позиційному порядку (hash(message|provider)) — без bias «перший=переможець»
   ├─► execute_selector_ai (Qwen на Groq, або BYOK-суддя) → SelectorParser.parse → валідація
   │       selected_model ∈ responses.keys() ?  (PH17: підтримує кастомні BYOK-слоти;
   │       для дефолтного набору це = [groq,cerebras,sambanova])
   │       confidence ≥ SELECTOR_MIN_CONFIDENCE ?
   │            так → пост-зваження за ручними виборами → повертає вибір
   │            ні  → fallback
   └─► будь-яка помилка → SelectorFallback
```

### Per-user override промпта судді (PH24/D-17, E2)

Користувач може редагувати **системний промпт судді** у Налаштуваннях. Override зберігається per-user (`Preference.data['judge_prompt_override']`); `routes/chat.py` читає його (лише коли `selector_enabled`) і передає вниз: `OrchestratorService.process_chat → ResponseSelector.select_best_response → SelectorPromptBuilder.build_selector_prompt(judge_prompt_override=…)`. Коли override заданий — він **замінює** вбудований шаблон `selector_judge` (рендериться `render_template_string` з тими самими `$placeholders`); інакше — типовий `prompts.yaml`. Обов'язкові плейсхолдери валідуються на збереженні (`/preferences/judge-prompt`, [03](03-api-contracts.md)). BYOK-суддя й override — **ортогональні** (можна мати і свій ключ судді, і свій промпт).

### Навчання судді на ручних виборах (PH16/E, D-11)

Мета: ручний перевибір користувача має **реально зміщувати** суддю (для цього він і існує).

1. **Промпт** (`prompts.yaml` v4, `selector_personalization_block`): додано блок `manual_model_selections` + правила — «на співмірній якості віддавай перевагу частіше обраній вручну моделі» і «**не давай порядку відповідей впливати** на рішення».
2. **Анти-позиційний bias**: `SelectorPromptBuilder` подає відповіді у детермінованому, але не завжди однаковому порядку (`hash(user_message|provider)`).
2a. **Brand-нейтральні мітки (PH22):** судді відповіді подаються під нейтральними іменами **«AI 1…AI N»** (а не назвами провайдерів/слотів) → суддя не може віддавати перевагу знайомому бренду й **оцінює та може обрати будь-якого учасника, включно з доданими BYOK-моделями** (раніше промпт хардкодив лише groq/cerebras/sambanova, тож доданий AI отримував 0/100 і не міг бути обраним). Вердикт судді (`selected_model` + `scores`) мапиться назад на реальні слоти (`SelectorPromptBuilder.remap_verdict_to_slots`); валідація вибору — за **фактичним** набором відповідей (`responses.keys()`), а не за хардкод-реєстром (парсер більше не використовує `ALLOWED_MODELS`). Персоналізаційний блок теж релейблиться на «AI N» для узгодженості.
3. **Обмежене пост-зваження** (`selector/preference_weighting.py`): після парсингу — детермінований нудж до manual-preferred моделі, **тільки** серед near-tie кандидатів (score у межах `PREFERENCE_NEAR_TIE_MARGIN=5` від вибору судді) і лише якщо її преференс-вага (manual×2 + preferred) **строго більша**. Ніколи не перекриває явно кращу відповідь. Прозоро: `selector_metadata.preference_weighting` + дописка в `reason`.

**Fallback (rule-based)** — `selector/ai_selector.py` (`selector_version 4.0`, `type rule-based-fallback`):
оцінює кожну відповідь за метриками й обирає максимальну суму:

| Метрика | Макс |
|---|---|
| `length_score` | 30 |
| `structure_score` | 20 |
| `readability_score` | 20 |
| `explanation_score` | 20 |
| `style_score` | 15 |

Маркери fallback у відповіді: `fallback_used=true`, `confidence=0.5`, `selector_provider="fallback"`, `selector_model="rule-based-selector"`.

**`simple_selector.py`** — найпростіший вибір (перша відповідь); допоміжний.

---

## Конфігурація селектора — `config/selector_config.py`

| Ключ | Значення |
|---|---|
| `SELECTOR_PROVIDER` | `"groq"` |
| `SELECTOR_MODEL` | `"qwen/qwen3-32b"` |
| `SELECTOR_TIMEOUT` | `20` |
| `SELECTOR_MAX_RETRIES` | `2` |
| `SELECTOR_TEMPERATURE` | `0.1` |
| `SELECTOR_MAX_TOKENS` | `2048` |
| `SELECTOR_USE_STRUCTURED_OUTPUT` | `True` |
| `SELECTOR_ENABLE_FALLBACK` | `True` |
| `SELECTOR_FALLBACK_SELECTOR` | `"rule_based"` |
| `SELECTOR_MIN_CONFIDENCE` | `0.65` |
| `SELECTOR_ENABLE_REASONING` | `True` |
| `SELECTOR_ENABLE_DETAILED_SCORING` | `True` |
| `SELECTOR_ENABLE_PROVIDER_METADATA` | `True` |

> D-6 закрито: `SELECTOR_MAX_RETRIES`/`MIN_CONFIDENCE`/`TEMPERATURE`/`MAX_TOKENS` реально застосовані (ретраї + поріг впевненості у `ResponseSelector`; temperature/max_tokens у `generate_selector_response`).

---

## Як додати нового провайдера

1. Створити `providers/<name>_provider.py`, успадкувати `BaseProvider`, задати метадані, реалізувати `generate` / `generate_structured` / `generate_stream`.
2. Зареєструвати в `ProviderService.providers`.
3. (Якщо має бути доступний судді) додати в `ResponseSelector.ALLOWED_MODELS`.
4. Оновити [03-api-contracts.md](03-api-contracts.md) і фронтенд-список у `useCompare`.
