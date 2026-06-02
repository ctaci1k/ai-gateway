---
plan: 024-classic-console-redesign
status: done
updated: 2026-06-02
---

# PH24 — Редизайн «Classic Console» · історія Single · налаштування (суддя+BYOK) · топ-меню/заглушки

> Велика візуальна переробка під референс **«AI Gateway · Classic Console»** (Claude Design)
> + функційні зміни: (A) новий chrome (топбар із темою/мовою/акаунтом/адмін/settings,
> акордеонний сайдбар, картка творця); (B) **Single отримує збережену історію чатів** як
> Compare (переписує D-3); (C) історія з відносним часом; (D) зміна моделі через дропдаун,
> фіксується при створенні; (E) **реальний екран Налаштувань** із розділами (промпт судді +
> перенесений BYOK); (F) заглушки «в розробці» (Профіль/Аватар, Безпека, Звіти); (G) **увесь
> наявний функціонал лишається** (прикріплення файлів/RAG, ручний перевибір Compare, банер
> судді, ліміти, статуси BYOK); (H) responsive + a11y; (I) i18n+доки+гейти+деплой.
> Enterprise: без заглушок-недоробок (окрім свідомих «в розробці»), без TODO, кроки атомарні,
> гейти після кожного. Коміт/пуш — у фіналі (деплой автоматичний з push origin main).

## Джерело дизайну (handoff-бандл Claude Design)
- Референс скопійовано в репозиторій: **`design-reference/classic-console/`** —
  `AI Gateway · Classic Console.html` + `cc-app.jsx` + `cc-styles.jsx` + `ent-icons.jsx` +
  `README.md` + транскрипт `chat1.md`. **READ FIRST:** прочитай `README.md`, транскрипт `chat1.md`,
  а тоді `cc-app.jsx` (структура/поведінка) і `cc-styles.jsx` (точні пікселі/кольори/розміри)
  повністю — там інтенція. (Повний бандл зі скріншотами тимчасово був у `/tmp/design/stas/`.)
- Токени дизайну **збігаються з нашими** (`theme/tokens.css`): violet `#8b5cf6`, той самий slate
  dark/light. Тобто кольори переписувати майже не треба — мапимо `cc-*` на наші семантичні токени.

## Ухвалені рішення власника (2026-06-02) — дотримуйся дослівно
1. **Single-чати тепер зберігаються** як іменовані (назва = текст 1-го повідомлення, прив'язка
   до однієї моделі, окремий список історії) — **переписує D-3** (Single більше не «ефемерний»;
   уточнення PH13 про rolling-`interactions` лишається чинним для персоналізації).
2. **Ліміти НЕ чіпати.** Request-квота вже **сумарна** на Single+Compare (5/хв, денний ліміт —
   один на обидва розділи). Нічого в квотах не міняти — лише додати збереження історії.
3. **Зміна моделі:** модель **фіксується при створенні** Single-чату; у наявному чаті клік по
   чипу моделі показує **підказку** «змінити модель можна лише в новому чаті» — **без діалогу й
   без очищення треду** (прибрати теперішній ConfirmDialog-флоу зміни моделі в Single).
4. **Адмінпанель — реальна** (як зараз), **тільки для адміна**, тригер — у топ-барі (icon-btn або
   пункт меню), НЕ в лівому сайдбарі.
5. **Налаштування — РЕАЛЬНИЙ екран із розділами** (не заглушка):
   - **Промпт судді** — даємо користувачу редагувати системний промпт судді (той, що «під
     капотом»), з кнопкою «Скинути до типового» і показом типового. Персист — **per-user**.
   - **API-ключі (BYOK)** — **перенести існуючий** `KeysModal`-функціонал сюди окремим розділом
     (не дублювати логіку — рендерити наявні компоненти всередині Settings).
6. **Заглушки «в розробці»** (модалка з кнопкою «Закрити», i18n): **Профіль і Аватар**,
   **Безпека**, **Звіти**. «Звіти» — кнопка для **ВСІХ** користувачів (адмін теж її має);
   реальні звіти по моделях (Single + Compare) — окремий майбутній план.
7. **BYOK і ліміти — розмістити за enterprise-конвенцією** (власник делегував рішення архітектору):
   - **BYOK → у Settings** (розділ «API Keys») — як у п.5.
   - **Ліміти/usage → компактний індикатор у топ-барі** (пілюля «X/5» з popover: лишок хв/день +
     час скидання + чи на власному ключі), а контекстне повідомлення про вичерпання/own-key
     rate-limit — біля композера (як зараз). Сайдбар лишається чистим (як у шаблоні).
8. **Увесь наявний функціонал, не намальований у шаблоні, ЛИШАЄТЬСЯ:** прикріплення файлів (RAG)
   у композері; ручний перевибір моделі у Compare; банер судді (`SelectorBanner`); картки
   провайдерів/невдач; правдиві назви BYOK (PH23/A); очищення ключів при logout (PH23/B).

## Контекст із коду (ground truth — ЗВІР перед кожним блоком, не вигадуй)
- **Режими:** `store/ChatModeContext` (single|compare). Сторінки: `features/chat/ChatPage`
  (Single), `features/compare/ComparePage` (Compare). Композиція — `app/page.tsx` →
  `layouts/MainLayout` (топбар) + `components/sidebar/Sidebar` + `ChatLayout`.
- **Тема:** `store/ThemeContext` уже має `theme`/`setTheme`/`toggleTheme` (dark/light, persist
  `ai-gateway.theme`); токени світлої теми вже є (`theme/tokens.css [data-theme="light"]`). Топ-
  тогл moon/sun = `toggleTheme()`.
- **Мова:** `store/LanguageContext` + `components/common/LanguageToggle`. У топ-барі замінити на
  **дропдаун** (як `cc-app.jsx::LangMenu`); прибрати мову з сайдбара (PH23 її вже ховав у рейлі).
- **Single зараз ефемерний (D-3):** `/chat/stream` пише лише в rolling-`interactions`; іменованих
  Single-чатів немає. `ModelSwitcher` (чипи + ConfirmDialog при зміні моделі) — переробити під
  picker (новий чат) + чип-дропдаун-підказку (наявний чат).
- **Compare saved chats (взірець для Single):** таблиці `chats`/`chat_messages` (`db/models.py`,
  Alembic `0003`), `repositories`/`SavedChatRepository` (per-user, ліміт `SAVED_CHATS_LIMIT=25`),
  CRUD `/chats` (`routes/chats.py`), `store/ChatsContext` (active-chat), `components/sidebar/
  {ChatList,NewChatButton}`, `chat_id` у `POST /chat`. **Single має повторити цей патерн.**
- **Суддя-промпт:** `prompts/prompts.yaml` → `core/prompts.py` (PROMPTS_PATH) →
  `selector/selector_prompt.py::SelectorPromptBuilder.build_selector_prompt` →
  `selector/response_selector.py`. Per-user override зберігати у **`Preference.data`** (generic
  `JSON`, без міграції) ключем напр. `judge_prompt_override` (null/порожнє = типовий).
- **Адмінка:** `components/admin/AdminPanel` + `store/AdminViewContext` (видима лише адміну).
- **BYOK:** `store/KeysContext` + `components/keys/{KeysModal,KeysButton,KeysStatusBanner}`;
  правдиві назви/очищення ключів — PH23. **Перенести вхід у Settings** (не дублювати).
- **Ліміти:** `components/account/LimitBanner` + `store/sidebarStatus.useSidebarStatus` (єдине
  джерело BYOK/limited — PH23/D1). Переробити рендер під топ-бар-індикатор + composer-notice.
- **PH23-сайдбар (рейл/квадратики/бургер):** акордеонний дизайн **замінює** desktop-рейл і
  статус-квадратики; **mobile бургер-шухляду — зберегти/адаптувати**; `useSidebarStatus`
  переюзати для топ-індикатора. Не викидати корисне — адаптувати.
- Стан — через `store/`; тексти — `t()` (паритет uk/pl/en); кольори/відступи — токени `theme/`;
  без `fetch` у компонентах (лише `services/`).

---

## Кроки (атомарні; FE-гейти після кожного: tsc/eslint/prettier/vitest/build + i18n паритет;
## BE-гейти, якщо торкнувся бекенду: pytest/ruff/black)

### Блок A — chrome «Classic Console» (топбар + акордеонний сайдбар + токени)
- [x] **A1. Утиліта дропдауна + іконки.** Спільний a11y-дропдаун (`components/common/Dropdown`
  або Menu): відкриття/закриття, click-outside, Esc, focus-mgmt, `role="menu"`/`aria`. Додати
  потрібні іконки (moon/sun/gear/shield/history/chevD/chevR/code) у `components/icons/Icons`.
- [x] **A2. Топбар (`MainLayout`/новий `Topbar`).** За `cc-app.jsx`/`cc-styles.jsx`: бренд
  (sparkle-градієнт + «AI Gateway / Enterprise · v1.0»), spacer, **тема moon/sun** (`toggleTheme`),
  **мова-дропдаун** (LangMenu), divider, **Settings** icon-btn, **Admin** icon-btn (лише адмін),
  divider, **акаунт-дропдаун** (avatar+ім'я+роль). Зберегти наявний бургер (mobile) зліва.
- [x] **A3. Акордеонний сайдбар + картка творця.** `components/sidebar/Sidebar` → два акордеони
  (`Single Models` / `Compare`) з `+ New Chat` і вкладеною `History`; внизу — картка творця
  («Stanislav Byndas», без «All systems online»). Класи мапити на наші токени (без хардкод-кольорів).
- [x] **A4. Мапінг CSS у `theme/components.css`.** Перенести `cc-*` стилі під наші семантичні
  токени (нові класи в нашому неймінгу). Без дублювання токенів; pixel-match зі `cc-styles.jsx`.

### Блок B — Single-персистентність (бекенд + дані) — переписує D-3
- [x] **B1. Схема.** Розширити `chats`: `mode` ('single'|'compare', default 'compare' для легасі)
  + `model` (nullable, обрана модель для single). Alembic-міграція (idempotent, безпечний default).
  Оновити `db/models.py`, `schemas`, `docs/04-data-models.md`.
- [x] **B2. Репозиторій + CRUD.** `SavedChatRepository`/`routes/chats.py`: list із фільтром `mode`;
  create приймає `mode`+`model`; ліміт збережених чатів — **спільний 25** (Single+Compare разом,
  поточний `SAVED_CHATS_LIMIT`) АБО лиши поточну логіку, але **request-квоти НЕ чіпай** (рішення 2).
  Оновити `docs/03-api-contracts.md`.
- [x] **B3. Single пише в іменований чат.** `/chat/stream` (Single) приймає `chat_id` і **персистить
  хід** у `chat_messages` (як `/chat` у Compare), title = 1-ше повідомлення (обрізка ~60), `model`
  фіксується. Rolling-`interactions` лишається (персоналізація). Тести BE (`test_chats.py`/новий).
- [x] **B4. Frontend store.** `store/ChatsContext` (або новий `SingleChatsContext`) — режимо-
  обізнані списки (single|compare), активний чат, create/select/rename/delete; Single-сабміт
  створює/догружає іменований чат (як Compare). Без `fetch` у компонентах (через `services/`).

### Блок C — сайдбар-історія + відносний час + прив'язка моделі
- [x] **C1. Відносний час.** Util `utils/relativeTime.ts`: <60с → «щойно»; <60хв → «N хв тому»;
  <24год → «N год тому»; далі — «N дн тому» (без назв днів тижня). i18n-форми uk/pl/en. Юніт-тест.
- [x] **C2. History-рядки.** Акордеон-History показує збережені чати режиму: назва (1-ше
  повідомлення, ellipsis) + відносний час; активний — підсвічений. Стан loading/empty/error.
- [x] **C3. Відкриття Single-чату.** Клік по Single-history → завантажує тред + показує **модель
  цього чату** у чипі шапки (`model`); сабміт додає хід у той самий чат.

### Блок D — топ-меню: тема/мова/акаунт/адмін/settings/звіти
- [x] **D1. Тема + мова.** Тогл moon/sun (`toggleTheme`); LangMenu-дропдаун (через
  `LanguageContext`); прибрати `LanguageSwitcher` із сайдбара. a11y (Esc/click-out/focus).
- [x] **D2. Акаунт-дропдаун.** avatar (ініціали)+ім'я+роль; пункти: «Профіль і Аватар» (заглушка),
  «Налаштування акаунта» (→ Settings), «Безпека» (заглушка), «Вийти» (реальний logout).
- [x] **D3. Admin + Settings + Reports тригери.** Admin icon-btn (лише адмін) відкриває **реальний**
  `AdminPanel` (через `AdminViewContext`). Settings icon-btn → екран/модалка Settings (блок E).
  «Звіти» — кнопка для **всіх** → заглушка (блок F).

### Блок E — Settings (реальний, з розділами)
- [x] **E1. Каркас Settings.** Екран/модалка з лівим списком розділів (sections) + контент;
  a11y (focus-trap/Esc/aria), responsive. i18n.
- [x] **E2. Розділ «Промпт судді».** UI: textarea з поточним override + «Скинути до типового» +
  показ типового (read-only). **Backend:** зберігати `judge_prompt_override` у `Preference.data`
  (per-user); endpoint GET/PUT (напр. `/preferences/judge-prompt`, CSRF на мутації);
  `build_selector_prompt`/`response_selector` використовують override, якщо є, інакше типовий із
  `prompts.yaml`. Транзит у `/chat`(Compare) і — якщо суддя застосовний — узгоджено. Тести BE
  (override застосовується; порожній → типовий). Оновити `docs/03`/`docs/05`.
- [x] **E3. Розділ «API Keys» (BYOK).** Перенести **існуючий** `KeysModal`-контент у розділ
  Settings (рендерити наявні компоненти/контекст `KeysContext`, без дублювання логіки). Прибрати
  стару точку входу `KeysButton` із сайдбара (вхід тепер лише через Settings) — або лишити «+»
  у Single-picker, якщо доречно. Зберегти PH23 (правдиві назви, очищення при logout).

### Блок F — заглушки «в розробці»
- [x] **F1. Спільна заглушка.** `components/common/ComingSoonModal` (іконка + «в розробці» + опис
  + «Закрити»; focus-trap/Esc/aria; i18n). Підключити: «Профіль і Аватар», «Безпека», «Звіти».

### Блок G — зберегти наявний функціонал у новому chrome
- [x] **G1. Композер + RAG-attach.** Перенести композер під новий стейдж; **прикріплення файлів
  (RAG `ComposerTools`/документи) лишається** і працює в Single і Compare.
- [x] **G2. Compare без втрат.** Ручний перевибір моделі, `SelectorBanner`, картки провайдерів/
  невдач, скрол/кнопка «вниз» — лишаються в новому стейджі Compare.
- [x] **G3. Ліміти/usage-індикатор.** Топ-бар-пілюля «X/5» з popover (лишок хв/день + час скиду +
  стан власного ключа) на базі `useSidebarStatus`/`/auth/me`; composer-notice про вичерпання/own-
  key rate-limit лишається. Прибрати старий `LimitBanner`/`KeysStatusBanner` із сайдбара
  (рефактор на топ-індикатор, **єдине джерело** не дублювати).

### Блок H — responsive + a11y
- [x] **H1. Mobile.** Адаптувати PH23-бургер-шухляду під новий акордеонний сайдбар (drawer поверх
  контенту, backdrop, focus-trap, Esc, close-on-nav). Дропдауни топ-бара — мобільно-дружні.
- [x] **H2. Брейкпоінти/таргети.** 360/390/430px без горизонтального скролу; Compare 1 колонка;
  Settings/заглушки/дропдауни на всю ширину; таргети ≥44px; focus-visible. Прогнати всі FE-гейти.

### Блок I — i18n + доки + гейти + деплой
- [x] **I1. i18n.** Усі нові тексти — `t()` з паритетом uk/pl/en (тема/мова/акаунт/settings/
  заглушки/історія/відносний час/usage). Перевірити парність (`i18n/index.test.ts`).
- [x] **I2. Доки.** `docs/06-frontend-architecture.md` (новий chrome/Settings/історія Single),
  `docs/08-current-state.md` (секція PH24), `docs/04` (chats.mode/model), `docs/03` (chats mode,
  judge-prompt endpoint), `docs/05` (override промпта судді), `docs/10` (нове рішення **D-17**,
  яке переписує D-3 щодо Single-персистентності). `status: done`, усі `[x]`, «СТАН» актуальний.
- [x] **I3. (Опц., рекомендовано) Кеш-фікс прода.** Щоб деплой був видимий одразу: у
  `deploy/nginx/nginx.conf` віддавати HTML-документ `Cache-Control: no-store` (а `/_next/static/*`
  — immutable). Інакше aaPanel-nginx кешує стару сторінку (відомий інцидент PH23-деплою).
- [x] **I4. Деплой.** Коміт + `git push origin main` (CI → Docker → деплой). Перевірити Actions
  (CI+Deploy зелені) і `https://ai.st.byn.sarl/` = 200 з НОВИМ хешем CSS (звірити, що публічний
  CSS = контейнерний; за потреби почистити `proxy_cache_dir` на сервері — це робить власник). БД
  міграція (B1) застосовується контейнером (`alembic upgrade head` у CMD) — **без** `down -v`.

---

## Перевірка (Definition of Done)
- [x] Візуал відповідає «Classic Console»: топбар (тема/мова/акаунт/admin/settings), акордеонний
      сайдбар (Single Models / Compare з New Chat + History), картка творця. Pixel-match токенами.
- [x] **Single має збережену історію** (іменовані чати, назва=1-ше повідомлення, прив'язка до
      моделі), відкриття показує модель чату; відносний час без назв днів тижня.
- [x] Модель фіксується при створенні; у наявному Single-чаті — підказка «лише в новому чаті»
      (без діалогу/очищення).
- [x] Тема перемикається зверху (moon/sun); мова — дропдаун; акаунт — дропдаун; admin — реальний,
      лише адмін, у топ-меню.
- [x] **Settings — реальний**: розділ «Промпт судді» (редагування+скид, персист, застосовується
      бекендом) + розділ «API Keys (BYOK)» (перенесений існуючий). Профіль/Аватар, Безпека,
      Звіти — заглушки «в розробці» (Звіти — для всіх).
- [x] **Ліміти не змінені** (сумарні 5/хв + денний на обидва режими); usage показано за enterprise-
      конвенцією (топ-індикатор + composer-notice); BYOK — у Settings.
- [x] **Увесь наявний функціонал лишився**: прикріплення файлів (RAG), ручний перевибір Compare,
      банер судді, правдиві назви BYOK, очищення ключів при logout.
- [x] Responsive (360/390/430): без горизонтального скролу; Compare 1 колонка; модалки/дропдауни
      на всю ширину; ≥44px; focus видимий; a11y (Esc/focus-trap/aria) для дропдаунів і модалок.
- [x] Зелено FE (tsc/eslint/prettier/vitest/build) + BE (pytest/ruff/black, бо є бекенд-зміни);
      i18n паритет uk/pl/en; docs (03/04/05/06/08/10) оновлені; задеплоєно (CI+Deploy зелені,
      сайт 200 з новим CSS-хешем).
- [x] Golden rules: без дублювання JSX/стилів/кольорів/текстів; тексти `t()`; без `fetch` у
      компонентах; кольори/відступи — токени; стан — store/; стани loading/empty/error; секрети
      (BYOK) не в БД/логах; D-3 формально переписано в D-17 (docs/10).

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **I4** — реалізовано **всі** блоки A–I; гейти зелені (BE 142 + ruff/black;
  FE tsc/eslint/prettier/vitest 25/build); смоук-рендер прода 200. `status: done`.
- Наступний крок: — (план завершено; деплой через `git push origin main`).
- Заблоковано: **ні**.
- Відкрите питання вирішено: ліміт збережених чатів = **спільний 25** на Single+Compare
  (`SAVED_CHATS_LIMIT`); request-квоти не змінювалися.
- Ключові змінені файли: BE — `db/models.py`, `migrations/0006_chat_mode_model.py`,
  `memory/{chats_repository,sql_repository}.py`, `routes/{chats,chat,preferences}.py`,
  `schemas/{chats,preferences}.py`, `selector/{selector_prompt,response_selector}.py`,
  `services/orchestrator_service.py`, `core/prompts.py`, тести `test_chats.py`/`test_judge_prompt.py`.
  FE — chrome (`layouts/MainLayout`, `components/layout/*`, `components/topbar/*`,
  `components/sidebar/{Sidebar,AccordionSection,CreatorCard}`, `components/settings/*`,
  `components/common/{Dropdown,ComingSoonModal}`, `components/chat/SingleModelPicker`,
  `components/keys/KeysForm`), стори (`ChatsContext`/`ComposerContext` переписані,
  `Settings/ComingSoon` нові), `utils/{relativeTime,chatTitle}`, `theme/{tokens,components}.css`,
  i18n×3, `app/{page,layout}.tsx`, `deploy/nginx/nginx.conf`.
- Свідомо НЕ зроблено (заглушки за рішенням власника 6): Профіль/Аватар, Безпека, реальні Звіти —
  `ComingSoonModal` («в розробці»), окремий майбутній план.
