---
plan: 033-ux-polish-2
status: done
updated: 2026-06-03
---

# PH34 — поліш UX, партія 2 + атрибуція ключа (B7–B11, D-24)

> Джерело: сесія уточнень власника (2026-06-03, після PH33). Реалізує конкретний
> список B7–B11. **Рішення архітектора нижче — ухвалені** (узгоджені з власником
> через 3 уточнювальні питання); новий чат їх НЕ переграє. Працювати атомарними
> кроками з гейтом після кожного; прогрес — лише у цьому файлі (блок «СТАН»).
> Стиль і обсяг — Enterprise: без заглушок/TODO/напівфіч. Frontend golden rules
> діють (без дублювання JSX/стилів/кольорів/текстів; тексти лише через `t()` у
> паритеті uk/pl/en; кольори/відступи — лише токени; стани loading/empty/error;
> a11y). Безпеку D-20/D-21/D-22 не чіпати (шифрування BYOK, маски, slot-vs-model).

## Контекст від власника (дослівні вимоги, перекладено в задачі)

- **B7.** Кнопка «показати/сховати» API-ключ нічого корисного не робить (ключ
  write-only, його не видно — і це правильно). Кнопка виглядає як недороблена —
  **прибрати**.
- **B8.** У **всіх** спливаючих вікнах фіолетова кнопка (Зберегти / Перевірити) на
  hover стає світлою, а текст лишається білим → **не видно**. Текст має ставати
  **фіолетовим** (читабельний контраст). Бажано однаково в обох темах.
- **B9.** Атрибуція ключа «вбудований vs власний» — **подекуди йде хардкодом**;
  знайти **по всьому застосунку** і зробити **дата-керованою**. Конкретно у Звітах:
  моделі на **власному** ключі (додані AI 4/5, свій ключ на вбудованому слоті,
  суддя в Single) хибно показують «Вбудована» замість маски `перші4••••останні4`.
  **Доданий (BYOK) суддя** має з'являтися в статистиці **навіть у Compare** (для
  користувача це важливо); вбудований суддя може не з'являтися. (Q1: варіанти 1+2
  сумісні.)
- **B10.** Вертикальний скрол-повзунок не в стилі застосунку — **перестилізувати**
  під тематичний тонкий скрол.
- **B11.** Текст у картці автора **зник** під час редизайну — повернути короткий
  змістовний опис: **Full-Stack Developer**, застосунок зроблено **повністю
  самотужки, від початку до кінця**. БЕЗ «Junior», БЕЗ згадки «AI-оркестрація».
- **B12 (плашка «найкраща за критеріями» у Compare) — СКАСОВАНО** власником (Q2:
  «передумав конкретно по цьому пункту»). НЕ робити.

## Рішення архітектора (ухвалені)

- **B7 — прибрати show/hide.** У `components/keys/KeysForm.tsx` `KeyInput` прибрати
  кнопку `.keys-eye` і toggle `shown`. Збережені ключі ніколи не префіляться
  (write-only), тож маскування під час набору не дає безпеки — поле лишається
  звичайним `<input>` (тип `text`, щоб користувач бачив, що вставив). Прибрати
  невживані пропси `showLabel/hideLabel` і, якщо стануть мертвими, i18n
  `keys.show`/`keys.hide` (звірити, що ніде більше не вживані) + мертвий CSS
  `.keys-eye*`. Без зміни логіки збереження/валідації.
- **B8 — читабельний hover/active основних CTA.** Єдиний послідовний стан для
  залитих-акцентом кнопок у попапах: **hover/active = світла поверхня + АКЦЕНТНИЙ
  (фіолетовий) текст + акцентна рамка** (інверсія «filled→outline»), в **обох**
  темах; focus-visible і disabled — без регресу. Застосувати до `dialog-btn--primary`,
  `admin-btn--primary`, `auth-submit` та будь-яких інших залитих-акцентом CTA у
  спливаючих вікнах. Без дублювання: правити в `theme/components.css` через токени
  (`--accent`/`--accent-contrast`/`--panel`); за потреби — спільний клас. Звірити
  ВСІ попапи: KeysForm(Settings), Admin (створення/збереження), AuthScreen,
  ConfirmDialog, ComingSoon, ProviderGuide, будь-які `*-primary`.
- **B9 — built-in vs own-key СКРІЗЬ дата-кероване (D-24, ядро).**
  - **(a) Виправити атрибуцію own-key.** Реальна причина — `usage_events.key_fingerprint`
    записується як `NULL` для моделей на власному ключі (тоді `KeyBadge` показує
    «Вбудована» — це **правильна** дата-керована логіка, проблема у даних). Пройти
    ланцюг **запис → агрегація → показ** і гарантувати: own-key переможець (Compare)
    і own-key модель Single (responder або суддя-слот NQ6) завжди несуть маску
    (`key_fingerprint` ≠ null) → ніколи хибне «Вбудована». Анкери: `routes/chat.py`
    (`_selected_key_fingerprint`, `/chat` record, стрім record), `memory/byok_repository.py`
    (`key_fingerprint`, `load_config` — плейнтекст є), `memory/usage_repository.py`
    (`record`), `memory/usage_report_repository.py` (агрегати `by_model`/`breakdown`/
    журнал/CSV проносять `key_fingerprint`), `schemas/reports.py`. **Відтворити з
    живим застосунком** (skill `verify`) до і після фіксу.
  - **(b) Доданий (BYOK) суддя у статистиці навіть у Compare.** Денормалізувати на
    `usage_events` дві колонки — `judge_model_name` (String(128), nullable) і
    `judge_key_fingerprint` (String, nullable) — заповнюються **лише коли суддя
    BYOK** (свій ключ); вбудований суддя → обидві NULL (не показуємо). Alembic-міграція
    (повторити перевірений патерн D-21/D-22: одна міграція + денормалізовані колонки).
    Reports (`usage_report_repository`) **синтезують окремий рядок** для BYOK-судді в
    `by_model`/`breakdown` (лічить ходи, де цей суддя брав участь; токени судді —
    окремо або null, не подвоюючи токени переможця) з його маскою ключа. Квоти/
    `billable`/one-row-per-turn інваріант — **не ламати** (рядок переможця лишається
    канонічним; суддя — похідний рядок зі своїх денормколонок). Атрибуція судді:
    `byok.judge` (як у `_selected_key_fingerprint` для `JUDGE_BYOK_SLOT`).
  - **(c) Аудит хардкоду по всьому застосунку.** Грепнути й перевірити КОЖНУ
    поверхню, що класифікує built-in/own-key: `is_byok`, `isOwnKey`, `byokModelId`,
    `key_fingerprint`, `modelDisplay`, `responderLabel`, `keySource`, `builtinModel`,
    `DEFAULT_RESPONDER_SLOTS`/`SINGLE_PROVIDERS` як «ознака built-in», рядки
    «Вбудована/Built-in/Wbudowany». Кожна має читати **збережений хід / реальний
    ключ**, а не слот-хардкод. Active-model поверхні (`MainHead`/`SingleModelPicker`/
    `sidebarStatus`) свідомо лишаються на поточних ключах (D-22) — НЕ чіпати; звітні/
    історичні — мусять бути за збереженим ходом. Задокументувати знайдене.
  - **Безпека:** плейнтекст ключа й KEK — ніколи в логах/відповідях/ledger; маски
    display-only; шифрування БД (D-20) не чіпати.
- **B10 — тематичний тонкий скрол скрізь.** Звести вертикальний скрол до єдиного
  тематичного тонкого стилю на токенах (`--scrollbar-thumb`/`-hover`), і WebKit
  (`::-webkit-scrollbar*`), і Firefox (`scrollbar-width:thin; scrollbar-color`).
  Знайти контейнери з нативним «товстим» скролом (головна область/секції/попапи) і
  привести до спільного класу/правила без дублювання (`theme/components.css`/
  `globals.css`). Не зламати наявні `.thin-scroll`/`.msgs` тощо.
- **B11 — текст автора.** `components/sidebar/CreatorCard.tsx` повертає змістовний
  короткий рядок: ім'я **Stanislav Byndas** + підпис «Full-Stack Developer» + одне
  речення, що застосунок зроблено **повністю самотужки, від початку до кінця**.
  Прибрати/замінити мертвий `author.rights` (відсутній ключ і дав «зниклий» текст);
  рендерити `author.tagline`. i18n uk/pl/en паритет; верстка/токени; a11y.
  **Ревізія власника (2026-06-04):** додати, що зроблено **з використанням AI** (про
  ПРОЦЕС розробки — інструменти AI; це ≠ старе «AI orchestration» як опис продукту,
  яке лишається прибраним). Прибрано «повністю/entirely», щоб не суперечило «самостійно».
  БЕЗ «Junior». Фінальна копія:
  - en: «Full-Stack Developer — designed and built solo, end to end, with the help of AI.»
  - uk: «Full-Stack розробник — спроєктовано й зроблено самостійно, від початку до
    кінця, з використанням AI.»
  - pl: «Full-Stack Developer — zaprojektowane i zbudowane samodzielnie, od początku
    do końca, z wykorzystaniem AI.»

## Кроки (атомарні; гейт після кожного)

### S1 — B7: прибрати кнопку show/hide ключа
- [x] `components/keys/KeysForm.tsx`: прибрано `.keys-eye`/`shown`/пропси show/hide;
  поле — звичайний `<input type="text">` з маскою-плейсхолдером (write-only).
- [x] Прибрано мертві i18n `keys.show`/`keys.hide` (ніде більше не вживані) + мертвий CSS
  `.keys-eye`/`.keys-eye:hover` і непотрібний `.keys-input-wrap` (+ `.keys-input-wrap .keys-input`).
- [x] Гейт FE зелений: tsc, eslint, prettier, vitest(39), build (i18n паритет).

### S2 — B8: читабельний hover/active основних CTA у попапах
- [x] `theme/components.css`: hover/active залитих-акцентом CTA → інверсія filled→outline
  (поверхня `--panel` + акцентний текст `--accent` + акцентна рамка), обидві теми.
  Єдине згруповане правило для `.dialog-btn--primary`/`.admin-btn--primary`/`.auth-submit`
  (без дублювання). Прибрано старі `:hover{filter:brightness}`. Guard `:not(:disabled)`
  → disabled без інверсії; `.auth-submit` отримав `border:1px solid transparent` (без
  зсуву). focus-visible не чіпано. Покриває всі попап-CTA: KeysForm Save, ComingSoonModal,
  JudgePromptSection (Settings), AdminPanel (створення/ліміти), AuthScreen.
- [x] Перевірено `verify`: правило присутнє у CSS, що віддає dev-сервер; каскад/специфіка
  виграють; старі brightness-hover прибрано; токени обох тем дають читабельний контраст
  (light: `#7c3aed` на `#fff`; dark: violet-500 на `#0f111a`). Піксельний скриншот
  неможливий у цьому середовищі (Playwright не підтримує ubuntu26.04, системного chrome
  нема) — верифіковано по рантайм-CSS-артефакту + токенах.
- [x] Гейт FE зелений: tsc/eslint/prettier/vitest(39)/build.

### S3 — B10: тематичний тонкий скрол скрізь
- [x] `theme/components.css`: per-class allowlist (`.thin-scroll/.msgs/.composer-popover/
  .keys-dialog/.sidebar`) замінено на **глобальне** правило на токенах — Firefox
  `scrollbar-width/-color` на `html` (успадковується всіма), WebKit `*::-webkit-scrollbar*`
  універсально. Покриває всі 15+ `overflow-y:auto` контейнерів (головна/секції/попапи/
  Звіти/Admin), яких раніше не було в списку → нативний «товстий» скрол. Без дублювання;
  `.thin-scroll`/`.msgs` працюють (тепер з єдиного джерела).
- [x] Перевірено по CSS-артефакту dev-сервера: єдиний набір webkit-правил + `scrollbar-color`
  на html, allowlist прибрано; токени обох тем (`--scrollbar-thumb`/`-hover`). Піксель —
  як у S2 (середовище без браузера).
- [x] Гейт FE зелений: tsc/eslint/prettier/vitest(39)/build.

### S4 — B11: текст автора
- [x] `components/sidebar/CreatorCard.tsx`: рендер `author.tagline` замість мертвого
  `author.rights` (ключ був відсутній → текст «зник»). i18n `author.tagline` оновлено
  під вимогу (БЕЗ «Junior»/«AI orchestration»): en/uk/pl «Full-Stack Developer — …
  повністю самотужки, від початку до кінця». Структура картки: cap + name (Stanislav
  Byndas) + tagline. CSS картки (flex column, перенос) — без змін. Паритет uk/pl/en.
- [x] Гейт FE зелений: tsc/eslint/prettier/vitest(39)/build; i18n-паритет-тест ок.

### S5 — B9a+c: виправити атрибуцію own-key + аудит хардкоду
- [x] **Відтворення (TestClient = живий шлях: реальне AES-шифрування→запис→агрегація,
  мокнуті лише мережеві виклики провайдерів).** Прогнав усі 3 випадки власника +
  Compare-переможця. РЕЗУЛЬТАТ: **баг НЕ відтворюється** — `key_fingerprint`
  записується маскою для own-key у ВСІХ випадках: Single custom AI4/5
  (`user••••7777`), Single суддя (`user••••3456`), Single own-key на built-in слоті
  (`user••••1234`), Compare-переможець built-in-слот own-key (`user••••1234`), Compare
  custom-переможець (`user••••7777`). Ланцюг запис→агрегація→показ **уже дата-керований**.
- [x] **Фікс не потрібен.** `_selected_key_fingerprint` слот-агностичний (loop по
  `byok.responders` + judge-гілка), `load_config` несе плейнтекст, record денормалізує
  маску в обох шляхах (`/chat`, `/chat/stream`). `null` лише для built-in (app-ключ).
  **Залишкове «Вбудована» на own-key можливе ЛИШЕ на історичних рядках до Alembic
  `0009`** (колонки не було → NULL, плейнтексту для backfill нема — задокументована
  межа D-21, не виправляється заднім числом).
- [x] **Аудит хардкоду (B9c) — Explore-агент по BE+FE.** Результат: **0 хардкод-багів**.
  Усі звітні/історичні поверхні дата-керовані: BE `usage_report_repository` групує за
  `(selected_model, key_fingerprint, model_name)`; `routes/reports.py`/`schemas/reports.py`
  несуть трійку; FE `reportUtils.{reportModel,keySource}`+`KeyBadge`+`modelDisplay`,
  таби `ByModel/Breakdown/Activity/ByChat`, replay `SelectorBanner`/`CompareColumn`/
  `CompareFailedCard` — усе за збереженим ходом (`key_fingerprint`/`is_byok`/`model_name`).
  Active-model поверхні (`MainHead`/`SingleModelPicker`/`sidebarStatus`) свідомо на
  поточних ключах (`byokModelId`, D-22) — НЕ чіпано. Константи `DEFAULT_RESPONDER_SLOTS`/
  `SINGLE_PROVIDERS`/`RESPONDER_LABELS` вживаються лише як слот-id/мітки в active-model,
  не як «ознака built-in» у звітах.
- [x] Тести BE (`test_byok.py`): +3 постійні — Single custom AI4/5 → маска; Single
  суддя-слот → маска; Compare own-key переможець → маска. (Single built-in own-key →
  маска + built-in → null уже були; `_selected_key_fingerprint` юніт уже був.) FE — змін
  не потрібно (дисплей уже коректний).
- [x] Гейт BE зелений: **pytest 210 passed** + ruff + black. FE — без змін у S5
  (гейт зелений з S4).

### S6 — B9b: доданий (BYOK) суддя у статистиці навіть у Compare
- [x] `db/models.py` + Alembic `0011_usage_judge_byok`: `usage_events.judge_model_name`
  (String(128) nullable), `judge_key_fingerprint` (String(32) nullable) — заповнені
  лише для BYOK-судді (batch_alter_table, патерн 0009/0010). Перевірено реальним alembic
  upgrade head + downgrade -1 (колонки з'являються/зникають).
- [x] `routes/chat.py` (`/chat`): при записі — `judge_used = selector_enabled and
  all_responses`; якщо `byok.judge` → пише `judge_model_name=byok.judge.model_id`,
  `judge_key_fingerprint=key_fingerprint(byok.judge.api_key)`; вбудований суддя → обидва
  null. Плейнтекст ніколи не зберігається.
- [x] `usage_repository.record` приймає 2 judge-поля (дефолт None). `usage_report_repository`:
  **by_model** — похідні judge-рядки (`role="judge"`, реальна модель+маска, tokens=0, не
  під app-фільтром); **breakdown** — похідні judge-вузли під групою «own» (top-level
  access-лічильники турів не чіпані, D-21); **events/CSV** — judge-колонки inline
  (одна-на-хід ledger-інваріант збережено). Квоти/billable/winner-рядок — не змінено.
- [x] `schemas/reports.py` (+`role` у ModelUsage/BreakdownModel, +`judge_*` у
  UsageEventDetail) + `routes/reports.py` (CSV-колонки). FE: `types/api.ts`,
  `ByModelTab`/`BreakdownTab` (judge-тег + унікальний ключ з role), `ActivityLogTab`
  (inline judge-бейдж), i18n `reports.judgeTag` (uk/pl/en), CSS `.rep-roletag`/`.rep-judge-inline`.
- [x] Тести BE (`test_reports.py` +6): BYOK-суддя у Compare → окремий рядок із маскою;
  вбудований суддя → НЕ з'являється; прихований під app-фільтром, видимий під own/all;
  breakdown judge-вузол під «own»; журнал — 1 рядок/хід з inline-суддею; e2e HTTP →
  by-model judge-рядок + CSV. Тест міграції — реальний alembic apply/rollback (вище).
- [x] Гейт BE зелений: **pytest 216** + ruff + black. Гейт FE зелений:
  tsc/eslint/prettier/vitest(39)/build; i18n паритет.

### S7 — Доки + рішення D-24
- [x] `docs/08` — секція **PH34** (B7–B11 + результат аудиту хардкоду: 0 багів +
  висновок B9a «не відтворюється»). `docs/10` — **D-24** (повне рішення). `docs/04` —
  нові колонки `usage_events.judge_model_name`/`judge_key_fingerprint` + Alembic `0011`.
  `docs/03` — звітні поля: `role` у by-model/breakdown, `judge_*` у events/CSV. `docs/06`
  — змін не потрібно (CreatorCard згаданий; скрол/кнопки — CSS-деталі поза контрактом).

### S8 — Звіт власнику (перевірка) + деплой
- [x] **Короткий звіт власнику** простою мовою надано (по кожному B7–B11 — що змінено і
  де побачити в UI + перелік файлів).
- [x] **Деплой:** усі [x], гейти зелені (BE 216 + ruff/black; FE tsc/eslint/prettier/
  vitest39/build), доки оновлені, `status: done`. Коміт + push origin main; деплой-пайплайн
  авто-`alembic upgrade head` застосовує `0011_usage_judge_byok` (нового env/owner-action
  нема).

## Definition of Done
- [x] B7: кнопки show/hide ключа немає; поле write-only працює (ввід/збереження ок).
- [x] B8: у всіх попапах основна кнопка на hover/active читабельна (акцентний текст),
  обидві теми; a11y без регресу (`:not(:disabled)`, focus-visible не чіпано).
- [x] B9: ніде built-in/own-key не визначається хардкодом — лише за даними (аудит: 0 багів);
  own-key моделі у Звітах показують маску (write-path перевірено, коректний); **доданий
  BYOK-суддя видно у статистиці навіть у Compare**; вбудований суддя — невидимий (NULL).
- [x] B10: вертикальний скрол усюди тематичний/тонкий, у стилі застосунку (глобальне правило).
- [x] B11: картка автора показує змістовний короткий текст (Full-Stack Developer,
  зроблено самотужки end-to-end; без «Junior»/«AI orchestration»); паритет uk/pl/en.
- [x] Гейти зелені (BE pytest 216/ruff/black; FE tsc/eslint/prettier/vitest39/build; i18n
  паритет); D-24 у `docs/10`; звіт власнику надано; задеплоєно (міграція `0011` застосована).

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **S6** (B9b — доданий BYOK-суддя у статистиці навіть у
  Compare). Нові денормколонки `usage_events.judge_model_name`/`judge_key_fingerprint`
  (Alembic `0011`, перевірено upgrade/downgrade). `routes/chat.py` пише їх лише для
  BYOK-судді. Звіти синтезують похідний judge-рядок (by_model `role="judge"`) і
  judge-вузол під «own» (breakdown), inline judge-колонки в журналі/CSV; квоти/billable/
  winner/one-row-per-turn не зламано. FE: judge-тег у by-model/breakdown, inline-бейдж у
  журналі, i18n `reports.judgeTag`. +6 BE-тестів. Гейти: BE **216** + ruff/black; FE
  tsc/eslint/prettier/vitest(39)/build. Змінено: `db/models.py`, `migrations/0011…`,
  `memory/{usage_repository,usage_report_repository}.py`, `routes/{chat,reports}.py`,
  `schemas/reports.py`, `tests/test_reports.py`; FE `types/api.ts`,
  `components/reports/{ByModelTab,BreakdownTab,ActivityLogTab}.tsx`, `theme/components.css`,
  `i18n/messages/*`. (S5: баг own-key не відтворився, write-path коректний, аудит чистий.)
- **ПЛАН ЗАВЕРШЕНО (status: done).** S7 (доки: docs/08 PH34, docs/10 D-24, docs/04
  judge-колонки, docs/03 role/judge-поля) і S8 (звіт власнику + деплой) виконано.
- Порядок: S1 ✅ → S2 ✅ → S3 ✅ → S4 ✅ → S5 ✅ → S6 ✅ → S7 ✅ → S8 ✅.
- Заблоковано: **ні**. Owner-action: нема нового env; **є Alembic-міграція** (S6,
  авто-застосовується на деплої).
