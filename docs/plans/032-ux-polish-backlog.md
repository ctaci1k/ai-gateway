---
plan: 032-ux-polish
status: done
updated: 2026-06-03
---

# PH33 — поліш UX + баги (партія 1 від власника, D-23)

> Джерело: дві сесії уточнень власника (2026-06-03). Реалізує конкретний список
> B1–B6 (+B3b — мова відповіді). **Рішення архітектора нижче — ухвалені, новий
> чат їх НЕ переграє.** Працювати атомарними кроками з гейтом після кожного;
> прогрес — лише у цьому файлі (блок «СТАН»). Стиль і обсяг — Enterprise: без
> заглушок/TODO/напівфіч. Frontend golden rules діють (без дублювання; тексти
> лише через `t()` у паритеті uk/pl/en; кольори/відступи — лише токени; стани
> loading/empty/error; a11y). Безпеку D-20/D-21/D-22 не чіпати.

## Рішення архітектора (ухвалені)

- **B1 — лише текст.** Самі моделі/роутинг Compare НЕ чіпати. Прибрати «3 / three /
  trzy» з міток: `compare.modeTag` → «Порівняння · моделі + суддя», `topbar.compareInfo`
  → без «три» («…паралельно обробляють ШІ-моделі…»). uk/pl/en.
- **B2 — плашка «ваша модель» лише для ключа юзера.** Built-in (ключ застосунку) —
  **без** плашки; власний ключ користувача (`isOwnKey(slot)`) — фіолетова плашка
  (як таблиця-переможець Compare, але **без рамки**), текст через `t()` (uk/pl/en).
  Це **active-model** поверхня → коректно лишається на поточних ключах (D-22, не
  люк): джерело — `KeysContext.isOwnKey`.
- **B3a — порожня відповідь Mistral.** Власник уточнив: трапляється на **Mistral**.
  Діагностувати реальну причину (reasoning-поле `reasoning_content`/`finish_reason=
  length`/порожній `content`) і зробити **робастний** `OpenAICompatibleProvider`:
  читати контент із запасних полів і давати **чітку локалізовану причину** замість
  глухого «empty response». Не ламати наявний контракт `failed_providers[].reason`.
- **B3b — мова відповіді.** Рішення: відповідач має відповідати **мовою повідомлення
  користувача** (фолбек — мова інтерфейсу uk/pl/en). Інжектиться як системна
  директива у промт відповідача (Single і Compare). Суддю/ембеддинги не чіпати.
- **B4 — світла тема.** Лишити **білий** (не жовтий, не сірий) — приглушений
  off-white; перенести «глибину» оформлення з темної теми (поверхні/межі/тіні), щоб
  виглядало так само охайно. Точні значення токенів — рішення архітектора «щоб було
  безумно гарно»; правити лише light-гілку `theme/tokens.css` (+ за потреби
  `components.css` через токени). Не чіпати темну тему.
- **B5 — критерії судді мають впливати на ОЦІНКУ.** Промт користувача
  (`judge_prompt_override` = критерії) має бути авторитетним: суддя оцінює **за
  критеріями**, і бали це відображають. Прибрати ситуацію, коли наш нудж
  (`preference_weighting`) перебиває явні критерії: нудж застосовується **лише** на
  справжніх near-tie і **не** перекриває явно кращу за критеріями відповідь; за
  наявності `judge_prompt_override` нудж послаблюється/вимикається. Підсилити
  інструкцію каркаса `selector_judge`, що бали МУСЯТЬ відображати критерії.
- **B6 — дедуп моделей discovery.** `ModelCombobox`/джерело списку: дедуп за `id`
  (trim, case-insensitive), лишати перший; стабільний `key`. Рішення — «як велика
  компанія»: дедуп на рівні даних (не лише key), щоб і `<datalist>`, і `<select>`
  були чисті.

## Кроки (атомарні; гейт після кожного)

### S1 — B1: мітки Compare без «3»
- [x] `i18n/messages/{uk,pl,en}.json`: `compare.modeTag` («…моделі + суддя»),
  `topbar.compareInfo` (прибрати «три/three/trzy», лишити плавний текст). Паритет.
- [x] Гейт FE: prettier --check (json) ✓, vitest 35/35 ✓ (i18n-паритет зелений).
  Повний `tsc && eslint && build` — на чекпойнті після FE-партії (S1–S4).

### S2 — B6: дедуп моделей у ModelCombobox
- [x] `components/keys/ModelCombobox.tsx`: експортована чиста `dedupeModels()` —
  дедуп за нормалізованим `id` (trim, lower-case), лишає перший, відкидає порожні;
  застосовано в `load()` перед кешем/рендером → `<select>` + ключі унікальні.
- [x] Тест vitest на дедуп (`ModelCombobox.test.ts`, 4 кейси: дублі/case/trim/порожні).
- [x] Гейт FE (батч S1–S4): tsc/eslint/prettier/vitest(39)/build зелені.

### S3 — B2: плашка «ваша модель» (лише власний ключ)
- [x] i18n `single.yourModel` (uk «ваша модель» / pl «twój model» / en «your model»)
  у паритеті.
- [x] `components/layout/MainHead.tsx`: у Single-чипі плашка, коли модель на власному
  ключі (`byokModelId(model) !== null` — точний own-key сигнал, покриває responder +
  judge слоти; built-in без плашки). Active-model поверхня на поточних ключах (D-22).
- [x] `SingleModelPicker.tsx`: дублікат індикації на картці власної моделі.
- [x] CSS `.cc-your-model` (на токенах: `--accent`/`--accent-contrast`, як прапор
  переможця Compare, **без рамки**), light+dark через токени; текст через `t()`.
- [x] Гейт FE (батч S1–S4): tsc/eslint/prettier/vitest(39)/build зелені.

### S4 — B4: приглушена світла тема + «глибина» як у темній
- [x] `theme/tokens.css` (лише light-гілка): muted off-white canvas `--bg #e9edf4`;
  panel/card/sidebar = чисто білі (#fff) → поверхні «плавають» над приглушеним
  фоном (інверсія шарування темної теми = глибина). Межі трохи крихкіші
  (`--border .11`, `--border-strong .2`) для преміум-країв; `--subtle` злегка
  тепліше-нейтральний; нейтральні філи уніфіковано на cool-slate. Білий-family,
  не жовтий/не сірий. Темну тему НЕ чіпано.
- [x] Гейт FE (батч S1–S4): tsc/eslint/prettier/vitest(39)/build зелені. Візуальну
  перевірку власник зробить у S9 (toggle теми).

### S5 — B3a: робастний парс контенту (Mistral) + чітка причина
- [x] `backend/providers/openai_compatible.py`: `_message_text()` читає відповідь
  із запасних полів (`reasoning_content`/`reasoning`) для `generate_full` і стріму
  (буфер reasoning, якщо content порожній); `_empty_error(finish_reason)` дає чітку
  причину: `length` → «output truncated», інакше «empty». `classify_provider_failure`
  отримав код `length_exceeded` (перед `empty_response`); наявні коди не зламані.
- [x] FE: `FailureReason` += `length_exceeded`; `CompareFailedCard` мапить
  `compare.fail.lengthExceeded`; Single (`ComposerContext`) показує локалізовані
  `errors.lengthExceeded`/`errors.emptyResponse`; i18n uk/pl/en (паритет).
- [x] Тест BE (`test_responders.py` +5): reasoning-фолбек → success; `finish_reason=
  length` → `length_exceeded`; порожнє → `empty_response`; стрім-reasoning-фолбек.
- [x] Гейт BE: pytest 201 ✓, ruff ✓, black ✓. Гейт FE: tsc/eslint/prettier/vitest(39) ✓.

### S6 — B3b: мова відповіді = мова повідомлення (фолбек — UI-локаль)
- [x] Директива мови (`prompts.yaml::responder_language`, версія 5→6) інжектиться
  у промт **відповідача** через `core/prompts.with_language_directive(msg, locale)`:
  Compare (`orchestrator.process_chat(response_locale=)`) і Single-стрім
  (`routes/chat.py`). Суддя/ембеддинги/квоти/selected_model — не чіпані (директива
  лише в `responder_message`). `ChatRequest.locale` (опційне) — фолбек-мова; FE
  передає UI-локаль (`lang`) у `streamChat`/`compareChat`.
- [x] Тести BE: `test_prompts.py` (`language_directive`/`with_language_directive`,
  мапа uk/pl/en + фолбек EN); `test_provider_service.py` (process_chat інжектить
  директиву у responder-повідомлення, фолбек EN).
- [x] Гейт BE: pytest 205 ✓, ruff ✓, black ✓. Гейт FE: tsc/eslint/prettier/vitest(39) ✓.

### S7 — B5: критерії судді впливають на оцінку; нудж не перебиває
- [x] `prompts.yaml::selector_judge` (версія 6→7): блок «SCORING DISCIPLINE» —
  бали МУСЯТЬ відображати `$judging_criteria` (явно кращий за критеріями → суттєво
  вищий бал, не near-tie); `selected_model` = найвищий бал за критеріями; критерії
  авторитетні, нудж — лише тайбрейкер і не перекриває кращу за критеріями.
- [x] `preference_weighting.apply_preference_weighting(criteria_override=)` — за
  наявності явних критеріїв нудж **вимкнено** (`suppressed_by_criteria`);
  `response_selector` передає `criteria_override=bool(judge_prompt_override)`.
  Near-tie-обмеження (margin) збережено: нудж ніколи не перекриває явно кращу.
- [x] Тести BE: `test_preference_weighting.py` (override → нудж вимкнено навіть на
  near-tie); `test_response_selector.py` (override → `applied=False`,
  `suppressed_by_criteria=True`); наявний «clear winner» кейс лишається зеленим.
- [x] Гейт BE: pytest 207 ✓, ruff ✓, black ✓.

### S8 — Доки + рішення D-23
- [x] `docs/08` — секція **PH33** (B1–B6 + B3b, що саме змінено) + reason-список
  розширено `length_exceeded`; `docs/10` — **D-23** (повний запис рішень + перелік
  файлів/тестів/гейтів); `docs/03` — `ChatRequest.locale`; `docs/05` — робастний
  парс контенту + директива мови + критерії авторитетні (нудж вимикається на
  override); `docs/06` — плашка/тема/дедуп/локаль PH33.

### S9 — Звіт власнику (перевірка) + деплой
- [x] **Короткий звіт власнику** надано у відповіді в чаті (простою мовою: що
  змінено й де побачити в UI по кожному пункту + перелік файлів).
- [x] **Деплой:** усі кроки [x], гейти зелені (BE+FE), доки оновлені, `status:
  done` → `git add . && git commit && git push origin main`. Нового env/owner-action
  нема; міграцій нема.

## Definition of Done
- [x] B1: ніде нема «3 моделі + суддя» — лише «моделі + суддя» (uk/pl/en).
- [x] B2: Single на власному ключі показує фіолетову плашку «ваша модель» (без
  рамки); built-in — без плашки; переклад у паритеті.
- [x] B3a: Mistral більше не дає глухого «empty response» — або відповідає (reasoning-
  фолбек), або дає чітку локалізовану причину (`length_exceeded`/`empty_response`).
- [x] B3b: відповідь приходить мовою повідомлення (фолбек — мова інтерфейсу).
- [x] B4: світла тема приглушена (білий, не жовтий/сірий), оформлення «глибоке» як
  у темній (білі поверхні над muted canvas); темну тему не чіпано.
- [x] B5: суддя оцінює за критеріями користувача; нудж не перебиває явну перевагу
  (і повністю вимкнено за наявності явних критеріїв).
- [x] B6: нема React-warning про дублікати ключів; список моделей унікальний.
- [x] Гейти зелені (BE pytest 207/ruff/black; FE tsc/eslint/prettier/vitest 39/build;
      i18n паритет); D-23 у `docs/10`; звіт власнику надано; задеплоєно.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **S9** — звіт власнику + деплой. Усі S1–S8 виконані,
  гейти зелені (BE pytest 207 + ruff/black; FE tsc/eslint/prettier/vitest 39/build),
  i18n паритет uk/pl/en, D-23 у `docs/10`, доки оновлені (08/10/03/05/06).
- Наступний крок: **немає** — план завершено (`status: done`).
- Порядок: S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 (усі ✓).
- Заблоковано: **ні**. Owner-action: нема (без нового env, без міграцій).
