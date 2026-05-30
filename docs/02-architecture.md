# 02 — Системна архітектура

Опис **реальної** архітектури (як у коді). Плани розширення — у [09-roadmap.md](09-roadmap.md).

## Високорівневий потік (Compare Mode)

```
Frontend (Next.js)
   │  POST /chat { message, providers[], compare_mode, selector_enabled }
   ▼
Middleware (core/middleware.py): CORS → request log → rate limit (per-IP)
   ▼
FastAPI route  (routes/chat.py)  ──► response_model=ChatResponse
   │
   ▼
OrchestratorService.process_chat
   │
   ├──► ProviderService.execute_many ──► asyncio.gather
   │        ├─ GroqProvider.generate()      (llama-3.3-70b)   ─┐ блокуючий SDK
   │        ├─ CerebrasProvider.generate()                    ─┤ загорнуто в
   │        └─ SambaNovaProvider.generate()                   ─┘ asyncio.to_thread
   │        → all_responses, failed_providers, execution_metadata
   │
   └──► ResponseSelector.select_best_response   (якщо selector_enabled)
            ├─ ProviderService.execute_selector_ai ──► GeminiProvider (суддя, structured JSON)
            │      └─ ретраї + min_confidence (D-6)
            └─ якщо помилка/невалідно ──► SelectorFallback ──► AISelector (rule-based)
            → selected_model, best_response, scores, reason, confidence
   │
   ▼
ChatRepository.add_message  (seam → InMemory ChatBuffer, deque maxlen=10)  +  update preferences
   │
   ▼
ChatResponse (typed) ──► Frontend (services/* → ApiError на не-2xx)
```

## Потік (Single Mode)

```
Frontend ──► POST /chat/stream { message, provider }
          ──► ProviderService.generate_stream ──► provider.generate_stream()
                 └─ блокуючий стрім SDK ітерується через aiter_in_thread (не блокує loop)
          ──► StreamingResponse (NDJSON token-by-token, media_type application/x-ndjson)
          ──► НІЧОГО не пише в пам'ять (ефемерний, D-3)
```

## Компоненти бекенду

| Шар | Файл(и) | Відповідальність |
|---|---|---|
| Entry | `backend/main.py` | App factory: logging, CORS, middleware, error handlers, роутери |
| Core | `core/{config,errors,logging,middleware}.py` | Settings(.env), уніфіковані помилки, JSON-логи, rate-limit/req-log |
| Routes | `routes/{chat,preferences,providers,memory}.py` | Тонкі HTTP-ендпоінти з `response_model`; мапінг у схеми |
| Orchestration | `services/orchestrator_service.py` | Координація: виконати моделі → суддя → зібрати результат |
| Providers | `services/provider_service.py` + `providers/*` | True-async виклики LLM (`to_thread`), паралелізм, заміри. `OpenAICompatibleProvider` — спільна реалізація для groq/cerebras/sambanova |
| Selector | `selector/*` | AI-суддя (Gemini) + rule-based fallback + парсинг/промпт; `ALLOWED_MODELS` — одне джерело |
| Memory | `memory/repository.py` (seam) + `memory/chat_buffer.py` (in-memory імпл) | Історія + профіль уподобань за інтерфейсом `ChatRepository` |
| Schemas | `schemas/{chat_schema,chat_response,common}.py` | Pydantic request + **response** моделі |
| Config | `config/selector_config.py` | Налаштування селектора + `ALLOWED_MODELS` |

## Ключові архітектурні рішення (як є)

- **Справжній паралелізм:** блокуючі SDK-виклики провайдерів виконуються в `asyncio.to_thread`, тому `asyncio.gather` дає реальну конкурентність (сумарний час ≈ найповільніший). Кожен виклик у `_safe_generate` (ловить помилки, міряє час).
- **Поділ суддя/відповідачі:** відповідачі — у `ProviderService.providers` (`groq`, `cerebras`, `sambanova`). Суддя `gemini` створюється **окремо**.
- **Fallback-ланцюг судді:** Gemini (structured JSON + ретраї + min_confidence) → rule-based `AISelector`.
- **Типовані відповіді:** усі ендпоінти мають `response_model` (`schemas/chat_response.py`); помилки — уніфіковані (`core/errors.py`).
- **Repository seam:** API-шар залежить від інтерфейсу `ChatRepository`, не від конкретного сховища → персист (PH4) підключається без зміни роутерів.
- **Stateless-провайдери:** стан розмови — лише в репозиторії.

## Архітектурні слабкі місця (залишок)

Усунено в PH1–PH2: CORS `*`, помилки-200, Single-запис, хардкод URL, крихкий парсинг судді, відсутність rate-limit/логів, фіктивний паралелізм, дублювання провайдерів/`ALLOWED_MODELS`, товстий роутер. Деталі — [08-current-state.md](08-current-state.md).

Залишається (заплановано):
- **Стан глобальний та in-memory:** один `ChatBuffer` (`deque maxlen=10`), без персисту/мульти-юзера → seam готовий, реальний персист у PH4, акаунти у PH8.
- Немає **автентифікації** (PH8).
