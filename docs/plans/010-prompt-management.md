---
plan: 010-prompt-management
status: done
updated: 2026-05-29
---

# Prompt management — YAML + версіонування

> Реалізує [09-roadmap](../09-roadmap.md) Фазу 2 (день 10) **повноцінно**: промпти виносяться з коду в YAML із версіонуванням. Будується на [003](003-backend-structural-refactor.md).

## СТАН (читається першим)
- Останній виконаний крок: **5** — усі кроки виконані; план `done`.
- Наступний крок: — (PH3 завершено; далі PH4 / план 007 — БД).
- Заблоковано: ні (003 завершено).
- Змінені файли: `requirements.txt` (PyYAML), `prompts/prompts.yaml`, `core/prompts.py`, `selector/selector_prompt.py`, `providers/openai_compatible.py`, `tests/test_prompts.py`.
- Відкриті питання/рішення: —

## Навіщо
- Промпт селектора зашитий у коді (`selector/selector_prompt.py`, провайдери) → важко керувати/версіонувати.

## Кроки
- [x] 1. PyYAML у залежності (`PyYAML==6.0.2`); `prompts/prompts.yaml` (з `version`).
- [x] 2. Лоадер `core/prompts.py` (`pathlib` + `yaml.safe_load`) + валідація (version/prompts) + `prompt_version()`.
- [x] 3. Винесено промпт судді + системні промпти провайдерів (`provider_json_system`, `provider_selector_system`) у YAML.
- [x] 4. Параметризація через `$placeholders` (`string.Template.safe_substitute`) — літеральні `{...}` JSON-приклади не ламаються.
- [x] 5. Тести `tests/test_prompts.py`: лоадер/рендер/версія/builder (з і без персоналізації).

## Перевірка (Definition of Done)
- [x] Промпти зовнішні + версіоновані; у коді немає зашитих рядків промптів (перевірено grep).
- [x] Тести зелені (36 passed); план `status: done`.
