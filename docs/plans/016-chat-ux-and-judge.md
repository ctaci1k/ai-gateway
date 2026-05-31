---
plan: 016-chat-ux-and-judge
status: done
updated: 2026-05-30
---

# PH16 — Поліш чатів (Single/Compare), правдиві назви моделей, навчання судді

> Друга партія недоробок (за переліком власника A–F4). Мета: довести Single і Compare
> до завершеного вигляду, зробити назви моделей правдивими й узгодженими скрізь, замінити
> слабку Cerebras-модель, і змусити суддю **реально підлаштовуватись** під ручні вибори
> користувача. Жодних заглушок/напівфіч — Enterprise-рівень.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **7** — фінальні гейти зелені (BE 113 + ruff/black; FE tsc/eslint/prettier/vitest 12/build); оновлено docs/03,05,08,10 (+D-11); live-сценарій пройдено (uvicorn+API: `/providers/info` правдивий, три різні моделі відповідають, чат авто-названо за 1-м повідомленням, хід персиститься, суддя Qwen + preference_weighting, ручні вибори накопичуються). **План ЗАВЕРШЕНО — status: done.**
- Наступний крок: **—** (усі 7 кроків виконані).
- Заблоковано: **ні** — усі мікро-рішення ухвалені (OD-1/2/3 ✅). Готово до виконання.
- Змінені файли (крок 1): `backend/config/models_config.py` (новий реєстр), `backend/core/config.py`, `backend/providers/{base_provider,openai_compatible,groq_provider,cerebras_provider,sambanova_provider}.py`, `backend/schemas/chat_response.py` (display_name), `backend/config/selector_config.py` (коментар), `backend/.env(.example)`; `frontend/utils/models.ts` (новий), `frontend/components/chat/ModelSwitcher.tsx(+test)`, `frontend/components/compare/CompareColumn.tsx`, `frontend/components/selector/SelectorBanner.tsx`.
- Змінені файли (крок 2): `backend/core/config.py` (cerebras_max_tokens, дефолти моделей+бюджету), `backend/config/models_config.py` (GLM-4.7, cerebras budget), `backend/.env(.example)`, `backend/tests/test_responders.py` (бюджет із settings + 2 нові тести), `frontend/utils/models.ts` (мітка GLM-4.7).
- Змінені файли (крок 3): `backend/prompts/prompts.yaml` (v4, manual_model_selections+правила), `backend/selector/selector_prompt.py` (anti-position ordering + manual у промпт), `backend/selector/preference_weighting.py` (новий), `backend/selector/response_selector.py` (інтеграція пост-зваження), `backend/services/orchestrator_service.py` (preference_weighting у metadata), `backend/tests/{test_preference_weighting.py(новий),test_response_selector.py,test_prompts.py}`.
- Змінені файли (крок 4): `backend/core/config.py` (saved_chats_limit=25); `frontend/store/ChatsContext.tsx` (чернетка+createActiveChat+reloadActive(id)+limit 25), `frontend/features/compare/{ComparePage.tsx,useCompare.ts}`, `frontend/components/sidebar/{ChatList.tsx,NewChatButton.tsx}`, `frontend/theme/components.css` (прибрано .chat-row-count), `frontend/i18n/messages/{uk,en,pl}.json` (limitReached {limit} + видалено currentEmpty).
- Відкриті питання/рішення: після виконання внести **D-11** у `docs/10-open-decisions.md`.

### Live-звірка доступності моделей (2026-05-30, через `GET /v1/models` + тестові `/chat/completions`)
- **Cerebras** доступні лише: `zai-glm-4.7`, `gpt-oss-120b`. Рекомендована `llama-4-scout-17b-16e-instruct` — **НЕДОСТУПНА**.
  → **OD-1 фінал: Cerebras = `zai-glm-4.7`** (GLM-4.7, Z.ai). Сильна, відмінна від Groq (Llama) і судді (Qwen). Reasoning-модель (має приховане reasoning) — потребує більшого бюджету токенів (інакше порожній content). На бюджеті 2048 стабільно віддає видимий контент; finish=stop; ідентичність — «GLM/Z.ai». Інколи `queue_exceeded` (rate limit) → обробляється як failed_provider (reason=rate_limited).
- **SambaNova** доступні: `DeepSeek-V3.1`, `DeepSeek-V3.2`, `Llama-4-Maverick-17B-128E-Instruct`, `Meta-Llama-3.3-70B-Instruct`, `MiniMax-M2.7`, `gemma-3-12b-it`, `gemma-4-31B-it`, `gpt-oss-120b`. Кандидат `DeepSeek-R1-Distill-Llama-70B` — **НЕДОСТУПНИЙ**.
  → **OD-2 фінал: SambaNova = `DeepSeek-V3.1`** (відмінна родина від Groq-Llama і Cerebras-GLM → три по-справжньому різні відповіді: Llama / GLM / DeepSeek). Тест: finish=stop, повний контент, не reasoning-«пожирач»; ідентичність — «DeepSeek».
- **Підсумковий лінап:** Groq `llama-3.3-70b-versatile` (Llama 3.3 70B) · Cerebras `zai-glm-4.7` (GLM-4.7) · SambaNova `DeepSeek-V3.1` (DeepSeek V3.1) · суддя Qwen `qwen/qwen3-32b`. Жодних збігів родин, без self-bias.

## Контекст із коду (ground truth, звірено 2026-05-30)
- **Моделі-відповідачі (class `model_name`):** Groq `llama-3.3-70b-versatile` (`providers/groq_provider.py`), Cerebras `gpt-oss-120b` (`providers/cerebras_provider.py`), SambaNova `Meta-Llama-3.3-70B-Instruct` (`providers/sambanova_provider.py`). ⚠️ Groq і SambaNova — **по суті та сама модель** (Llama 3.3 70B) → у Compare дві майже однакові відповіді.
- **Суддя:** `SELECTOR_PROVIDER`/`SELECTOR_MODEL=qwen/qwen3-32b` (`config/selector_config.py`), `RESPONDER_MAX_TOKENS` дефолт 1024 (`core/config.py`).
- **Селектор:** `selector/response_selector.py` → `SelectorPromptBuilder.build_selector_prompt` (`selector/selector_prompt.py`) формує блок персоналізації лише з `preferred_models`/`favorite_response_style`/`response_style_preferences` — **`manual_model_selections` у промпт НЕ потрапляє**; пост-зваження рішення судді **немає**; відповіді подаються у порядку словника `all_responses` → можливий **позиційний перекіс**. Промпти — у `prompts/prompts.yaml` (`selector_judge`, `selector_personalization_block`).
- **Персоналізація:** `memory/preferences_logic.py` рахує `preferred_models` (за обраною суддею) і `manual_model_selections` (за ручним вибором) — дані Є, але на суддю не впливають.
- **Compare UI (`features/compare/ComparePage.tsx`):** коли `activeChatId !== null` — рендериться **повний тред** `CompareTurn` (питання+3 відповіді×N). Коли активного чату немає — ефемерний одиночний `CompareModal`. `ComparePage.submit()` передає `chatId: activeChatId` у `runCompare`.
- **Чати (`store/ChatsContext.tsx`):** `newChat()` **одразу** робить `createChat()` (персистить порожній чат); `SAVED_CHATS_LIMIT=3` (FE-константа + BE `core/config.py`); `createChat()` дефолтна назва «New Chat» (BE `memory/chats_repository.py`).
- **ChatList (`components/sidebar/ChatList.tsx`):** показує `chat.message_count` (`.chat-row-count`).
- **Single (`features/chat/ChatPage.tsx` + `components/chat/ModelSwitcher.tsx`):** стан треду — у хуку `useChat()` (локальний у `ChatPage`); провайдер — у `ComposerContext` (`singleProvider`/`setSingleProvider`). `ModelSwitcher` **не має** доступу до треду/`clear()` → перемикання моделі тред НЕ чистить і не питає.
- **Скрол:** `.msgs` — скрол-контейнер (PH14); кастомного стилю смужки немає (дефолтна негарна).

## Ухвалені рішення (власник, 2026-05-30) — внести як D-11
- **(B) Правдиві назви, без брехні.** Не змушуємо моделі вигадувати ідентичність. Натомість **назви/мітки моделей мають правдиво відповідати реальній моделі** скрізь: код, `/providers/info`, UI, `.env`, `.env.example`. Узгодженість критична (перевіряє працедавець).
- **(B) Заміна Cerebras.** `gpt-oss-120b` — слабка GPT-версія, що швидко обривається; замінити на потужнішу модель (вибір архітектора, див. OD-1) + підняти бюджет вихідних токенів, щоб відповіді не обрізались.
- **(E) Суддя лишається Qwen**, але доробляється так, щоб **ручні вибори користувача реально зміщували його рішення** (для цього й існує ручний вибір — суддя підлаштовується під людину). Прибрати перекіс «завжди Groq».
- **(A/C/D/F) UX-фікси** Single (підтвердження+очищення при зміні моделі), скрол-поліш, повний тред у Compare завжди, автозбереження ходу, назва чату за першим повідомленням, чернеткова поведінка «+», без лічильника повідомлень.

## Мікро-рішення (статус підтверджень власника, 2026-05-30)
- **OD-1 (крок 2) ✅ ВИРІШЕНО:** Cerebras-модель **обирає архітектор** + звіряє доступність у поточному API Cerebras. Критерії: сильна, **відмінна від Groq** і від судді (не Qwen), великий max output. Рекомендація: `llama-4-scout-17b-16e-instruct`; якщо недоступна — найближча за критеріями. Фінальний `model_id` зафіксувати в плані+доках.
- **OD-2 (крок 1) ✅ ВИРІШЕНО:** **зробити SambaNova відмінною моделлю** (три по-справжньому різні відповіді у Compare). Кандидати: `DeepSeek-R1-Distill-Llama-70B` / `Llama-4-Maverick-17B-128E-Instruct` — звірити доступність у SambaNova, зафіксувати фінальний `model_id`. Лишити різними також від Cerebras (OD-1).
- **OD-3 (крок 4) ✅ ВИРІШЕНО:** ліміт **25** збережених чатів (`SAVED_CHATS_LIMIT=25`, конфігуровано). При досягненні — **явне повідомлення** «Ліміт 25 чатів досягнуто. Видаліть чат, щоб створити новий» (i18n uk/pl/en). **Без автовидалення** — користувач видаляє вручну. Узгодити FE-константу й BE-конфіг.

---

## Кроки (атомарні; бекенд → фронтенд; гейти після кожного)

- [x] **0. Bootstrap + інспекція.** Прочитати CLAUDE.md, docs/README, docs/08, docs/10; звірити поведінку по файлах із блоку «Контекст із коду» (підтвердити, що актуально); прочитати `prompts/prompts.yaml` (`selector_judge`, `selector_personalization_block`), `selector/selector_parser.py`, `selector/selector_fallback.py`, `features/compare/useCompare.ts`, `features/chat/useChat.ts`, `store/ComposerContext.tsx`, `services/chatsApi.ts`, `routes/chats.py`. Зафіксувати будь-які розбіжності в блоці «СТАН». **Без змін коду.**

- [x] **1. (B) Правдиві назви моделей — єдине джерело правди.** _Залежить від OD-2._
  - Винести `model_id` кожного відповідача в **один реєстр** (конфіг, читається з `.env`): провайдер → `{ api_model_id, display_name }`. `display_name` — правдивий (напр. «Llama 3.3 70B», «GPT-OSS 120B», «Llama 4 Scout»), без вендорської брехні.
  - Прибрати хардкод `model_name` із `providers/*_provider.py` → брати з реєстру/конфігу. Оновити `.env` і `.env.example` правильними ключами/значеннями.
  - Оновити `/providers` та `/providers/info` (модель + мітка), `config/selector_config.py` коментарі (актуальні моделі), `ALLOWED_MODELS` за потреби.
  - FE: показувати **правдиві display-назви** замість сирих ключів провайдерів у `CompareModal`/`CompareTurn`/`ModelSwitcher`/`SelectorBanner`; джерело назв — з `/providers/info` (через сервіс) або єдина FE-константа, що дзеркалить бекенд (як `JUDGE_MODEL`/`utils/judge`). Без хардкоду текстів у JSX (i18n для підписів-обгорток, назви моделей — дані).
  - (OD-2) Якщо підтверджено — змінити модель SambaNova на відмінну.
  - Гейти: BE pytest+ruff+black; FE tsc+eslint+prettier+vitest+build. Acceptance: `/providers/info` і UI показують реальні моделі; `.env(.example)` узгоджені; жодного «gpt-4»-міфу.

- [x] **2. (B) Заміна Cerebras-моделі + бюджет токенів.** _Залежить від OD-1._
  - Замінити Cerebras `gpt-oss-120b` на обрану (OD-1) у реєстрі/`.env`/`.env.example`/`display_name`.
  - Підняти `RESPONDER_MAX_TOKENS` (напр. 2048) і/або зробити **per-provider** бюджет, щоб відповіді не обривались; звірити, що нова модель не reasoning-«пожирач» порожнього контенту (інакше → `ProviderError`, як для gpt-oss раніше).
  - **Live-перевірка:** реальний `/chat` Compare → нова Cerebras-модель дає повну відповідь і на «хто ти» відповідає узгоджено зі своєю display-назвою (без «я ChatGPT», якщо назва інша).
  - Гейти: BE+FE зелені + ручний live-чек.

- [x] **3. (E) Суддя враховує ручні вибори (Qwen лишається).**
  - **Промпт:** у `selector_personalization_block` (prompts.yaml) додати `manual_model_selections` + явну інструкцію: «користувач неодноразово вручну обирав модель X (N разів); за **співмірної якості** віддавай перевагу X; **не давай порядку відповідей впливати** на рішення». Пробросити `manual_model_selections` через `SelectorPromptBuilder.build_selector_prompt` (зараз не передається).
  - **Анти-позиційний перекіс:** подавати відповіді судді в нормалізованому/перемішаному порядку (детерміновано на запит, але не завжди Groq-перший) — щоб усунути bias «перший=переможець».
  - **Пост-зваження (детерміноване, обмежене):** після парсингу рішення судді застосувати невелику преференс-вагу з `manual_model_selections`/`preferred_models`, **обмежену** так, щоб вона зміщувала вибір лише на близьких скорах (ties/near-ties) і **не перекривала** явно кращу відповідь. Має бути прозоро (відбито у `scores`/`reason`/`selector_metadata`). Зберегти валідацію `ALLOWED_MODELS`/`responses` і поведінку fallback.
  - **BE-тести:** (а) після N ручних виборів `cerebras` на симетричних входах підсумковий `selected_model=cerebras`; (б) інваріант до порядку: ті самі відповіді в різному порядку → стабільний вибір, не залежний від позиції; (в) пост-зваження не перекриває явно кращу відповідь.
  - Гейти: BE pytest+ruff+black.

- [x] **4. (D1+F1+F2+F3+F4) Compare: завжди тред, автозбереження, назва за першим повідомленням, чернеткове «+», без лічильника.** _Ліміт — за OD-3._
  - **F2 чернетка «+»:** `ChatsContext.newChat()` більше **не** створює чат на сервері — переходить у локальну **чернетку** (активний чат скинуто, порожній стан). Повторне «+» на порожній чернетці — no-op (прибрати створення порожніх чатів на сервері).
  - **F1 автозбереження:** у `ComparePage.submit()` якщо активного чату немає → `createChat(<назва з 1-го повідомлення>)`, зробити активним, далі `runCompare({chatId})`, `reloadActive()`. Кожне наступне повідомлення — додається у цей чат.
  - **F3 назва:** дефолт «New Chat» більше не використовувати для авто-чатів — назва = текст **першого повідомлення** (обрізати до ~60 симв., BE вже клемпить ≤255). Прибрати показ «New Chat» у новостворених.
  - **D1 завжди тред:** оскільки після 1-го повідомлення завжди є активний чат — рендериться повний `CompareTurn`-тред (питання+3 відповіді×N) у `.msgs`. Ефемерний одиночний шлях (`CompareModal` без чату) спростити/прибрати, щоб не лишалось «недоробленого» вигляду; порожня чернетка показує `compare.empty`.
  - **F4 без лічильника:** прибрати `.chat-row-count` із `ChatList.tsx` (+ мертвий CSS).
  - **OD-3 ліміт = 25:** `SAVED_CHATS_LIMIT=25` (BE-конфіг + FE-константа синхронно); при досягненні — повідомлення «Ліміт 25 чатів досягнуто. Видаліть чат, щоб створити новий» (i18n uk/pl/en). Без автовидалення.
  - Узгодити з **D-3**: Single лишається без збережених чатів; це лише Compare.
  - Гейти: BE pytest+ruff+black; FE tsc+eslint+prettier+vitest+build; i18n паритет uk/pl/en для нових текстів.

- [x] **5. (A1) Single: підтвердження + очищення треду при зміні моделі.**
  - Змінені файли (крок 5): `frontend/store/ComposerContext.tsx` (стан треду), `frontend/features/chat/ChatPage.tsx` (читає зі store), `frontend/features/chat/useChat.ts` (видалено), `frontend/components/common/ConfirmDialog.tsx` (новий, a11y), `frontend/components/chat/ModelSwitcher.tsx(+test)`, `frontend/theme/components.css` (.dialog*), `frontend/i18n/messages/{uk,en,pl}.json` (single.switch*, common.cancel).
  - Підняти рантайм-стан Single-треду (messages/streaming/sources/loading + `clear`/`sendMessage`) у **store** (новий `SingleChatContext` або розширення `ComposerContext`), щоб `ModelSwitcher` і `ChatPage` ділили стан (golden rule «стан — у store/»).
  - `ModelSwitcher`: при кліку на іншу модель, якщо тред **непорожній** → модалка підтвердження («Якщо переключити модель, ваші повідомлення зникнуть і не відновляться» / Так-Скасувати). На «Так» → `clear()` + `setSingleProvider`. На порожньому треді — перемикати без діалогу. i18n uk/pl/en; модалка a11y (focus-trap/Esc).
  - Гейти: FE tsc+eslint+prettier+vitest+build; i18n паритет.

- [x] **6. (C1) Скрол-поліш.** _Змінені файли: `frontend/theme/tokens.css` (нові scrollbar-токени dark+light), `frontend/theme/components.css` (тонка смужка для `.msgs`/`.composer-popover`/`.thin-scroll`). Візуальний чек — у кроці 7 (live)._
  - Стилізувати смужку прокрутки контейнерів `.msgs` і `.compare-thread`: тонка, заокруглена, через **design tokens** (`::-webkit-scrollbar*` + Firefox `scrollbar-width/scrollbar-color`). Підтвердити, що скрол-контейнер один (без подвійних смужок).
  - Гейти: FE tsc+eslint+prettier+build + ручний візуальний чек у браузері.

- [x] **7. Зелено + доки + D-11 + live.**
  - Перезапустити обидва набори гейтів.
  - Оновити доки: `03-api-contracts` (`/providers/info` моделі, поведінка судді), `05-providers-and-selector` (реальний лінап моделей, персоналізація судді, анти-bias), `08-current-state` (нова секція PH16), `10-open-decisions` (внести **D-11**; зафіксувати OD-1/OD-2 фінальні рішення).
  - Live-перевірка наскрізного сценарію (uvicorn + npm): зміна моделі в Single чистить тред після підтвердження; Compare автозберігає, назва = 1-ше повідомлення, тред повний; після кількох ручних виборів суддя зміщує вибір; нові моделі відповідають коректно.
  - Виставити `status: done`.

## Перевірка (Definition of Done)
- [x] Назви моделей правдиві й узгоджені скрізь (код, `/providers/info`, UI, `.env`, `.env.example`); немає міфічних назв.
- [x] Cerebras-модель замінена, відповіді не обриваються; на «хто ти» — узгоджено з display-назвою (live: «GLM/Z.ai»).
- [x] Після ≥3 ручних виборів однієї моделі на співмірних відповідях суддя обирає її; вибір не залежить від порядку подачі; явно краща відповідь не перекривається (BE-тести + live).
- [x] Single: зміна моделі при непорожньому треді показує підтвердження; на «Так» тред чиститься і модель змінюється.
- [x] Compare: 1-ше повідомлення автостворює чат із назвою = текст повідомлення; «+» дає порожню чернетку без персисту до 1-го повідомлення; уся історія видима тредом (питання+3 відповіді×N); лічильника повідомлень немає; ліміт чатів за OD-3 без мовчазних збоїв.
- [x] Скрол: смужка тонка/тематична, один контейнер.
- [x] Зелено BE+FE; доки оновлені; D-11 внесено; live-сценарій пройдено.
- [x] Стани UI loading/empty/error враховані; i18n паритет uk/pl/en; без хардкоду кольорів/текстів; без fetch у компонентах.
