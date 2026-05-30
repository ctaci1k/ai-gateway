---
plan: 003-backend-structural-refactor
status: done
updated: 2026-05-29
---

# Backend structural refactor — async, схеми, тонкі роутери, dedupe, стиль

> Структурне оздоровлення бекенду **після** [002](002-backend-core-hardening.md) (будується на новому форматі помилок/конфігу). Усуває B4–B8, B14, seam для B11.

## СТАН (читається першим)
- Останній виконаний крок: **8** — усі кроки виконані; план `done`.
- Наступний крок: — (PH2 завершено; далі PH3 / план 010 — промпти YAML).
- Заблоковано: ні (002 завершено).
- Змінені файли: `providers/{base_provider,openai_compatible,groq,cerebras,sambanova,gemini}_provider.py`, `config/selector_config.py` (ALLOWED_MODELS), `selector/{selector_parser,response_selector}.py`, `schemas/{chat_response,common}.py`, `routes/{chat,preferences,providers,memory}.py` (chat_route.py видалено), `memory/repository.py` (+ ChatBuffer impl), `main.py`, `tests/*`, `docs/02-architecture.md`, `docs/03-api-contracts.md`. Прогнано Black/Ruff по всьому backend.
- Відкриті питання/рішення: контракти оновлені; формат відповідей типовано.

## Навіщо (приземлено)
- **B4:** провайдери викликають **синхронні** SDK (`client.chat.completions.create`, `model.generate_content`) усередині `async def` → блокують event loop; `asyncio.gather` не дає реальної паралельності.
- **B5:** немає `response_model` → відповіді сирі dict, контракт не гарантований.
- **B6:** `chat_route.py` 519 рядків — ручний unpack+repack того, що оркестратор уже зібрав.
- **B7/B8:** `clean_json_response` і `ALLOWED_MODELS` дубльовані.
- **B14:** роздутий стиль (≈×2 рядків).

## Кроки
- [x] 1. **True-async провайдери:** блокуючі SDK-виклики у `asyncio.to_thread`; стріми — через `aiter_in_thread`. Тест `test_providers_run_concurrently` (3×0.15s < 0.35s) підтверджує конкурентність.
- [x] 2. **Спільний json-parse:** `extract_json` (стійкий) у `base_provider`; `OpenAICompatibleProvider` — спільна реалізація; копії `clean_json_response` прибрані.
- [x] 3. **Один `ALLOWED_MODELS`:** у `config/selector_config.py`; вживають `ResponseSelector` і `SelectorParser`.
- [x] 4. **Response-схеми:** `schemas/chat_response.py` (`ChatResponse`, `ProviderResponse`, …) + `schemas/common.py` (`ErrorResponse`); `response_model` на всіх ендпоінтах.
- [x] 5. **Тонкі роутери:** `chat_route.py` розбито на `routes/{chat,preferences,providers,memory}.py`; результат оркестратора мапиться у `ChatResponse` (chat-роутер ~95 рядків з логуванням/персистом, тіло мапінгу тонке).
- [x] 6. **Memory seam:** `memory/repository.py` (`ChatRepository` ABC + `get_chat_repository()`); `ChatBuffer` імплементує інтерфейс — без зміни поведінки.
- [x] 7. **Стиль:** Black/Ruff прогнано по всьому backend (38 файлів, чисто).
- [x] 8. Оновлено [../02-architecture.md](../02-architecture.md) і [../03-api-contracts.md](../03-api-contracts.md).

## Перевірка (Definition of Done)
- [x] Реальна паралельність провайдерів — заміряно тестом.
- [x] Усі ендпоінти мають `response_model`; відповіді відповідають [../04-data-models.md](../04-data-models.md).
- [x] `chat`-роутер тонкий; жодного дубльованого helper/константи (`extract_json`/`ALLOWED_MODELS` — одне джерело).
- [x] `pytest` зелений (29 passed); контракт `/chat` незмінний → без регресій Single/Compare на фронтенді.
- [x] docs синхронні з кодом; план `status: done`, «СТАН» актуальний.

## Ризики / нотатки
- Кроки 4–5 змінюють форму, не зміст відповіді — звірити з фронтендом (services) на регресії.
- Не вводити БД тут (лише seam) — це roadmap.
