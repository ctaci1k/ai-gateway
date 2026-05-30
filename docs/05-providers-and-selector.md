# 05 — Провайдери та селектор

## Контракт провайдера — `providers/base_provider.py`

Усі провайдери успадковують `BaseProvider(ABC)`.

**Атрибути (метадані спроможностей):**

| Атрибут | Тип | Сенс |
|---|---|---|
| `provider_name` | str | Ідентифікатор (`"groq"`, …) |
| `model_name` | str | Назва моделі |
| `supports_streaming` | bool | Чи вміє стрімити |
| `supports_structured_output` | bool | JSON-вивід |
| `supports_tool_calling` | bool | Tool calls |
| `supports_vision` | bool | Зображення |
| `supports_selector_execution` | bool | Чи може бути суддею |
| `max_context_window` | int | Розмір контексту |

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

### Відповідачі (у `ProviderService.providers`)

| Провайдер | `model_name` | Контекст | SDK |
|---|---|---|---|
| `groq` ✅ | `llama-3.3-70b-versatile` | 128 000 | `groq` |
| `cerebras` ✅ | (за кодом провайдера) | — | Cerebras |
| `sambanova` ✅ | (за кодом провайдера) | — | SambaNova |

Дефолтний набір для Compare: `["groq", "cerebras", "sambanova"]`.
Дефолтний провайдер: `groq`.

### Суддя (окремо, НЕ в словнику відповідачів)

| Провайдер | `model_name` | Контекст | Роль |
|---|---|---|---|
| `gemini` ✅ | `gemini-2.5-flash-lite` | 1 000 000 | AI Selector (суддя), `supports_vision=true` |

> ❗ Це **ключова відмінність** від первісного опису (де GPT/Claude/Gemini були відповідачами). Реально відповідають Groq/Cerebras/SambaNova, а Gemini **судить**. Див. [10-open-decisions.md](10-open-decisions.md) (D-1).

---

## Виконання провайдерів — `services/provider_service.py`

- `execute_many()` — паралельно через `asyncio.gather`, дедуплікує провайдерів, кожен у `_safe_generate` (заміри часу + ловля помилок). Падіння однієї моделі не валить запит.
- `generate_stream()` — стрім для Single; обгортає чанки у події `{type:"token", content, provider, model}`.
- `execute_selector_ai()` — створює `GeminiProvider`, виклик з `asyncio.wait_for(timeout=SELECTOR_TIMEOUT)`.

---

## AI Selector (суддя) — `selector/`

**Ланцюг:**

```
ResponseSelector.select_best_response
   │  будує промпт (SelectorPromptBuilder) з усіма відповідями + контекстом персоналізації
   ├─► execute_selector_ai (Gemini)  →  SelectorParser.parse  →  валідація
   │       selected_model ∈ ALLOWED_MODELS=[groq,cerebras,sambanova]  І  ∈ responses ?
   │            так → повертає вибір
   │            ні  → fallback
   └─► будь-яка помилка → SelectorFallback
```

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
| `SELECTOR_PROVIDER` | `"gemini"` |
| `SELECTOR_MODEL` | `"gemini-2.5-flash-lite"` |
| `SELECTOR_TIMEOUT` | `20` |
| `SELECTOR_MAX_RETRIES` | `2` |
| `SELECTOR_TEMPERATURE` | `0.1` |
| `SELECTOR_MAX_TOKENS` | `1200` |
| `SELECTOR_USE_STRUCTURED_OUTPUT` | `True` |
| `SELECTOR_ENABLE_FALLBACK` | `True` |
| `SELECTOR_FALLBACK_SELECTOR` | `"rule_based"` |
| `SELECTOR_MIN_CONFIDENCE` | `0.65` |
| `SELECTOR_ENABLE_REASONING` | `True` |
| `SELECTOR_ENABLE_DETAILED_SCORING` | `True` |
| `SELECTOR_ENABLE_PROVIDER_METADATA` | `True` |

> ⚠️ Борг: `SELECTOR_MAX_RETRIES`, `SELECTOR_MIN_CONFIDENCE`, `SELECTOR_TEMPERATURE`, `SELECTOR_MAX_TOKENS` оголошені, але **не всі застосовані** в коді судді (Gemini-провайдер не передає temperature/max_tokens, ретраї не реалізовані). Перевірити при доробці — D-6.

---

## Як додати нового провайдера

1. Створити `providers/<name>_provider.py`, успадкувати `BaseProvider`, задати метадані, реалізувати `generate` / `generate_structured` / `generate_stream`.
2. Зареєструвати в `ProviderService.providers`.
3. (Якщо має бути доступний судді) додати в `ResponseSelector.ALLOWED_MODELS`.
4. Оновити [03-api-contracts.md](03-api-contracts.md) і фронтенд-список у `useCompare`.
