# 08 — Реальний стан (Ground Truth)

> Цей файл — **факти з коду** станом на зараз. Якщо інші документи описують «як має бути», то цей — «як є насправді». Не вигадувати поза цим.

## ✅ Що реально працює

**Backend**
- FastAPI-застосунок (`backend/main.py`) з CORS і роутером.
- `POST /chat` — Compare: паралельні запити до `groq`/`cerebras`/`sambanova`, збір `all_responses`, метадані виконання.
- `POST /chat/stream` — Single: стрімінг NDJSON від обраної моделі (groq/cerebras/sambanova); підтримує `rag_enabled` (термінальна подія `sources`); після стріму пише хід у rolling-історію (PH13) **і — якщо переданий `chat_id` — у збережений Single-чат** (`chat_messages`, PH24/D-17).
- `POST /chat/structured` — структурований (JSON) вивід.
- AI Selector: **Groq-суддя**, нейтральна модель `qwen/qwen3-32b` (не збігається з жодним відповідачем → без self-bias) + rule-based fallback. Перенесено з Gemini у PH13 через ліміт Gemini 20/добу (D-9); Gemini лишається для RAG-embeddings. Причина fallback (`fallback_reason`) і ручний перевибір тепер показуються правдиво й оборотні. Провайдер, що впав, показується окремою карткою з причиною (`failed_providers[].reason`: rate_limited/timeout/empty_response/unavailable).
- Персоналізація: накопичення `user_preferences` + `personalization_profile`, трекінг ручних виборів.
- Допоміжні ендпоінти: `/providers`, `/providers/info`, `/memory`, `/preferences`, `/memory/json`, `DELETE /memory`, `/preferences/manual-selection`.
- Паралелізм через `asyncio.gather` з ізоляцією помилок (`_safe_generate`).

**Frontend**
- Next.js App Router; перемикання Single / Compare через `ChatModeContext`.
- Single: стрімінг через `useChat` → `/chat/stream`.
- Compare: `useCompare` → `/chat` з 3 провайдерами + `selector_enabled`.
- Структура: layouts, components (sidebar/chat/compare/selector), features, services, store, theme, i18n, types.

## 🟡 Частково

- **TypeScript** лише частково (theme/types — `.ts`; решта — `.js/.jsx`).

## ⛔ Чого немає (попри згадки в первісному описі)

- **LiteLLM, httpx.** (Персист БД, акаунти, збережені чати, RAG, Docker/Nginx/SSL-артефакти — **вже реалізовано** в PH4/PH8/PH9/PH10/PH12; деталі нижче.)
- **Ендпоінти** `/all-responses`.
- **Реальний VPS/DNS/SSL-сертифікат** — поза агентом (owner-handoff, `DEPLOY.md`); усі артефакти готові.

## ✅ Усунено в PH0–PH1

- **Залежності зафіксовані** (`backend/requirements.txt` + `requirements-dev.txt` + `pyproject.toml`), `.env.example` (BE+FE), кореневий `README.md`, форматери/лінтери (Ruff/Black/Prettier/ESLint), `.editorconfig`.
- **Конфіг через Pydantic Settings** (`core/config.py`) з `.env`: ключі провайдерів, CORS origins, ліміти, rate-limit, лог-рівень.
- **Уніфіковані помилки** (`core/errors.py`): коректні статус-коди + тіло `{error:{code,message}}` (D-5); фронтенд обробляє через `services/apiClient.js` (`ApiError`).
- **CORS** із явного списку origins (`.env`), без `*`+credentials.
- ~~**Single ефемерний** (D-3)~~ — **переписано D-17 (PH24):** Single-чати тепер зберігаються як іменовані (`chats.mode='single'` + `chat_id` у `/chat/stream`). Rolling-`interactions` для персоналізації лишається.
- **Хардкод URL** прибрано: фронтенд бере базовий URL з `NEXT_PUBLIC_API_URL`.
- **Надійний селектор** (D-6): structured JSON output Gemini (`response_mime_type`), стійкий парсер `extract_json`, застосовані `SELECTOR_MAX_RETRIES/MIN_CONFIDENCE/TEMPERATURE/MAX_TOKENS`.
- **Rate limiting** (per-IP, mutating-методи) + конфігуровані ліміти запиту (`MAX_MESSAGE_LENGTH`).
- **Структуроване логування** (`core/logging.py`): запити, помилки провайдерів, рішення судді.
- **Базові тести** (`backend/tests/`, pytest): ChatBuffer, rule-based selector, агрегація провайдерів, ретраї/мін-впевненість селектора, `extract_json`, API-кейси (помилки/rate-limit).

## ✅ PH28 — Звіти: повноекранний розділ + drill-down «Розкладка» + фільтр за ключем доступу (Варіант B, D-18)

> UX-апгрейд PH27 за рішенням власника («дашборд у модалці дрібний/незручний»). Архітектор обрав **Варіант B**: винести Звіти з модалки у повноекранний розділ, додати акордеон-drill-down і глобальний фільтр за ключем доступу. План — [plans/026-reports-fullpage-breakdown.md](plans/026-reports-fullpage-breakdown.md).

- **(A) Бекенд — фільтр + breakdown.** `UsageReportRepository._scope(start,end,billable)` + усі методи приймають `billable: bool|None` (app-key/own-key/усе). Новий `breakdown(start,end,billable)` → вкладене дерево **access_key(app|own) → model → chats** з requests/total_tokens на кожному рівні (зібране в Python з однієї пласкої вибірки, LEFT JOIN chats; chat_id NULL → ad-hoc). Спільний query-параметр **`access`** (`app|own`) на **усіх** `/reports/*` (incl. `events.csv`) + новий `GET /reports/breakdown`. Схеми `Breakdown{Chat,Model,Group,Response}`. Тести: `test_access_filter_summary_and_events`, `test_breakdown_tree_shape`.
- **(B) Фронтенд — повний екран.** Звіти більше **не модалка**: `app/page.tsx` рендерить `<ReportsPage/>` у головній області (як `AdminPanel`), коли `ReportsContext.isOpen`. Повноекранні розділи **взаємовиключні** (відкриття Звітів закриває Admin і навпаки — на call-sites `AccountMenu`/`Topbar`; пріоритет reports > admin > chat). `ReportsModal` видалено. `ReportsPage` — шапка (тайтл + «Назад») + тулбар (період + сегмент ключа доступу) + вкладки **Огляд / Розкладка / За моделями / За чатами / Журнал**; remount активної вкладки по `key=${rangeKey}|${access}`.
- **(C) Розкладка + фільтр ключа.** `BreakdownTab` — акордеон `ключ → модель → чати` (a11y: `aria-expanded`/`aria-controls`/Enter/Space/focus-visible; шеврон обертається; листок-чат відкриває чат). Сегмент «усе/наш/свій» тече у `ReportRange.access` → всі виклики `reportsApi` + CSV. `getBreakdown` + типи `Breakdown*`.
- **(D) i18n/CSS/гейти.** Нові ключі `reports.{tab.breakdown,access.*,breakdown.legend,back}` (паритет uk/pl/en). CSS-секція «USAGE REPORTS» переписана під повний екран (`.rep-page`/тулбар/вкладки/акордеон на токенах; responsive 768/430). Гейти: BE **159 passed** + ruff/black; FE tsc/eslint/prettier/vitest(**26**)/build зелені.

## ✅ PH27 — Звіти про використання (Usage Reports) · `usage_events` як канонічний per-turn ledger (D-18)

> Реальний self-service розділ **«Звіти»** для КОЖНОГО акаунта (замінює заглушку `ComingSoonModal("reports")`): повна історія активності — запити, токени, моделі, чати, повідомлення — з агрегаціями, графіками, фільтром періоду та CSV-експортом. Рішення — [10-open-decisions.md](10-open-decisions.md) (D-18).

- **(A) `usage_events` = канонічний per-turn ledger.** Розширено колонками `chat_id` (FK→chats, **ondelete SET NULL**, nullable, index), `billable` (bool, NOT NULL, server_default true), `token_estimated` (bool, NOT NULL, server_default false) — Alembic `0007_usage_ledger` (batch_alter_table → Postgres+SQLite). Тепер пишуться **ВСІ** ходи, у т.ч. **BYOK** (раніше BYOK не записувався): гейт `if should_charge` навколо `record()` прибрано в обох роутах (`routes/chat.py`); `billable = should_charge` (False = на власному ключі), `chat_id` з `request.chat_id`. Персист у saved chat — **перед** записом ledger (`/chat`) / лінк лише при успішному персисті (`/chat/stream`) → бад `chat_id` 404-иться/нуляється, не трощить FK.
- **(A4) Квоти рахують лише `billable`.** `UsageRepository.count_since`/`timestamps_since` фільтрують `billable.is_(True)`; `QuotaService` без змін. **Поведінка лімітів не змінилась**, але реєстр повний — BYOK безкоштовний і тепер потрапляє у звіт.
- **(B) Чесні токени.** Single-стрім: `OpenAICompatibleProvider.generate_stream` додає `stream_options={"include_usage": True}` і yield-ить термінальний маркер `StreamUsage` (`base_provider`) з реальним `total_tokens`; `ProviderService.generate_stream` мапить у подію `{"type":"usage"}`, `routes/chat.py::generate()` ловить (не форвардить клієнту). Фолбек — `core/tokens.py::estimate_tokens` (`ceil(chars/4)`, без залежностей), `token_estimated=True`. Compare-агрегат — реальний; якщо `None` — оцінка. Per-provider токени вже були в `all_responses[*]` (B3).
- **(C) `/reports/*` API (per-user, НЕ admin-gated).** `memory/usage_report_repository.py::UsageReportRepository(user_id)` (read-only): `summary`, `by_model`, `by_chat` (LEFT JOIN chats; null → deleted/ad-hoc), `timeseries(day|hour)` (групування в Python, gap-filled), `events` (keyset за `(created_at,id)`), `iter_events_for_csv` (id-paged стрім). `schemas/reports.py` + `routes/reports.py` (`Depends(current_user)`, суворо per-user): `GET /reports/{summary,by-model,by-chat,timeseries,events}` + `GET /reports/events.csv` (`StreamingResponse`, attachment). `from`/`to` ISO (дефолт 30д; epoch-from = «усе»). Зареєстровано в `main.py`.
- **(D–F) Дашборд.** `store/ReportsContext` (open/close); `AccountMenu` → `open()`; `reports` прибрано з `ComingSoonContext`. `components/reports/`: `ReportsModal` (рамка `settings-dialog`, a11y, фільтр періоду, 4 вкладки, remount по `key=rangeKey` → mount-once fetch без синхронного setState), `OverviewTab` (KPI + `MiniChart.tsx` inline-SVG бари/лінія + спліт-бари), `ByModelTab`, `ByChatTab` (рядок → відкриває чат), `ActivityLogTab` (keyset-пагінація + CSV), `RepState`, `reportUtils`. ~50 i18n-ключів `reports.*` (паритет uk/pl/en); CSS-секція «USAGE REPORTS» (`rep-*` на токенах, responsive).
- **(G) Свідомо НЕ зроблено (опц.):** адмін-перегляд звітів іншого юзера — поза мінімальним DoD; бекенд-агрегації параметризовані `user_id`, `ReportsContext`/`ReportsModal` мають `target`/`readOnly`-scaffold → доробка тривіальна окремим планом.
- **Гейти:** BE **157 passed** + ruff/black; FE tsc/eslint/prettier/vitest(**26**)/build зелені; i18n паритет uk/pl/en. Контракти — [03](03-api-contracts.md) (`/reports/*`), дані — [04](04-data-models.md) (ledger-колонки), фронтенд — [06](06-frontend-architecture.md) (дашборд), рішення — [10](10-open-decisions.md) (D-18).

## ✅ PH24 — редизайн «Classic Console» · Single-чати зберігаються · реальні Налаштування (D-17)

> Велика візуальна переробка під референс **Classic Console** + функційні зміни. **Переписує D-3** (Single тепер зберігається). Деталі рішення — [10-open-decisions.md](10-open-decisions.md) (D-17).

- **(A) Новий chrome.** Повноширинний топбар (`components/layout/Topbar`): бренд (sparkle-градієнт), тема moon/sun (`ThemeToggle` → `ThemeContext.toggleTheme`), мова-дропдаун (`LangMenu`), usage-пілюля (`UsagePill`), Settings/Admin icon-btn (Admin лише адмін), акаунт-дропдаун (`AccountMenu`). Акордеонний сайдбар (`Sidebar` + `AccordionSection`): два згортувані блоки **Single Models / Compare**, кожен з `+ New Chat` і вкладеною **History** (`utils/relativeTime` — «щойно/N хв/год/дн тому», без назв днів); картка творця (`CreatorCard`). Спільний a11y-дропдаун `components/common/Dropdown` (Esc/click-out/focus-trap). CSS — `theme/components.css` (секція «CLASSIC CONSOLE CHROME», мапінг на семантичні токени; нові `--soft`/`--softer`).
- **(B) Single-персистентність (переписує D-3).** `chats` отримала `mode` ('single'|'compare', дефолт 'compare') + `model` (слот Single; NULL для Compare) — Alembic `0006`. `SavedChatRepository.list_chats(mode=…)`/`create_chat(mode,model)`; `routes/chats.py` приймає `?mode=` і `mode`/`model` у body. `/chat/stream` приймає `chat_id` і **персистить Single-хід** у `chat_messages` (rolling-`interactions` лишається). FE: `ChatsContext` mode-aware (`singleChats`/`compareChats`), `ComposerContext` — стрімінг-контролер + create-on-first; `ChatPage` рендерить збережені ходи Single + оптимістичний хід; `SingleModelPicker` (вибір моделі для нового чату); `MainHead` (чип моделі / тег режиму). Ліміт збережених чатів — спільний 25; request-квоти НЕ змінено.
- **(C) Зміна моделі.** Фіксується при створенні; у наявному Single-чаті чип read-only → підказка (`single.modelLocked`), без діалогу/очищення (старий `ModelSwitcher`/ConfirmDialog видалено).
- **(E) Реальні Налаштування.** `SettingsModal` (розділи): **Промпт судді** (`JudgePromptSection`) — редагування + «Скинути до типового» + показ типового; персист per-user у `Preference.data['judge_prompt_override']` (репозиторій `get/set_judge_prompt_override`); endpoints `GET/PUT /preferences/judge-prompt` (CSRF на PUT, валідація обов'язкових плейсхолдерів); `build_selector_prompt`/`ResponseSelector`/`OrchestratorService` приймають `judge_prompt_override`. **API-ключі** (`ApiKeysSection`) — наявний BYOK-функціонал (`KeysForm`, винесено з `KeysModal`, без дублювання).
- **(F) Заглушки «в розробці».** `ComingSoonModal` — Профіль і Аватар, Безпека (меню акаунта), Звіти (топ-бар, для **всіх**).
- **(G) Наявний функціонал.** RAG-attach (`ComposerTools`) у Single+Compare; ручний перевибір Compare, `SelectorBanner`, картки провайдерів/невдач — без змін; ліміти/usage → топ-пілюля (`UsagePill` на `useSidebarStatus`/`/auth/me`) + composer-notice (own-key rate-limit/quota); правдиві назви BYOK (PH23/A) і очищення ключів при logout (PH23/B) збережено (живуть у `KeysContext`).
- **(H) Responsive/a11y.** Бургер-шухляда (focus-trap/Esc/close-on-nav); брейкпоінти 900/768/430; меню/Settings на всю ширину, picker 1 колонка, таргети ≥44px, focus-visible.
- **Видалено (мертве):** `ModelSwitcher(+test)`, `TopbarModeContext`, `LimitBanner`, `KeysModal`/`KeysButton`/`KeysStatusBanner`, `ChatList`, `NewChatButton`, `ProfileCard`, `AuthorCard`, `ChatModeSelector(+test)`, `LanguageSwitcher`, `SidebarToggle`/`StatusSquares`/`SidebarSquare`.
- **Гейти:** BE **142 passed** + ruff/black; FE tsc/eslint/prettier/vitest(**25**)/build зелені; i18n паритет uk/pl/en (+нові ключі chrome/settings/picker/history/usage/comingSoon).

## ✅ PH23 — правдиві назви BYOK · очищення ключів при виході · мобільна версія + згортання сайдбара (D-16)

- **(A) Правдиві назви скрізь.** Compare-картка (`CompareColumn`) для **перевизначеного** дефолтного слота (свій ключ на `groq`/`cerebras`/`sambanova`) показує введений `model_id` через `byokModelId(provider) ?? RESPONDER_LABELS[provider] ?? model ?? provider` (як `CompareFailedCard`); рядок `.rcard-model` лишається. Назва судді в топбарі (`TopbarModeContext`) = `byokModelId(JUDGE_SLOT) ?? judgeModelName(JUDGE_MODEL)` — реальний BYOK-суддя коли активний, інакше дефолтний (Qwen). Аудит: усі банери (`SelectorBanner`/`ManualSelectionButton`/`CompareModal`) уже на реальному `selector_metadata.selector_model`; `ModelSwitcher` уже на `byokModelId`; «типово: Qwen» у `KeysModal` — статичний дефолт-лейбл (коректний).
- **(B) Безпека: очищення BYOK-ключів при зміні акаунта.** `KeysContext` отримав `clearKeys()` (скид стану в дефолт + `sessionStorage.removeItem("byok-keys-v1")`). `KeysProvider` читає `useAuth().user?.id`+`status`; pure-хелпер `shouldClearKeysOnAuthChange(prev,current)` вирішує: перша резолюція автентифікованого юзера → **лишити** (відновлення сесії в тій самій вкладці), перша резолюція anonymous → очистити; будь-яка подальша зміна id (logout→null / інший акаунт) → `clearKeys()`. Гарантує: новий/інший акаунт **ніколи** не успадковує чужі ключі. Юніт-тести: `store/KeysContext.test.ts` (+6).
- **(C) Згортання сайдбара (ChatGPT-стиль).** Новий `store/SidebarContext` — `collapsed` (desktop, персист `localStorage`, SSR-safe) + `mobileOpen` (ефемерний). Desktop: `SidebarToggle` (кнопка-тогл) → `.sidebar--collapsed` (токен `--sidebar-width-collapsed`), вузький рейл; рейл — **через CSS** у `@media(min-width:769px)` (ховає текст/банери, показує `.rail-only`-квадратики), без дублювання JSX. Mobile: бургер у `MainLayout` → висувна шухляда `@media(max-width:768px)` поверх контенту + backdrop; focus-trap (лише видимі focusables), Esc, close-on-nav (зміна mode/chat/admin/keys), `aria-label`/`aria-expanded`.
- **(D) Єдина система статусів.** `store/sidebarStatus.ts::useSidebarStatus()` — одне джерело (`byok` ok/warn + `limited`) з контекстів Keys/Auth/ChatMode/Composer; `KeysStatusBanner` і `LimitBanner` (гейт видимості) рефакторено на нього. Згорнуто — компактні квадратики (`StatusSquares`+`SidebarSquare`): обмежений акаунт = червоний, частковий набір ключів = червоний (окремий), свій ключ = зелений; «SB» (автор), «API» (BYOK, відкриває вікно ключів); мова (`.sb-lang`) ховається. Кожен квадратик — tooltip + `aria-label` (i18n), кольори лише через токени (`--success`/`--danger`). Банер лімітів: `.limit-reset` без `white-space:nowrap` → довгий reset-текст переноситься донизу, не вилазить за сайдбар.
- **(E) Повний responsive.** `theme/components.css`: `@media(max-width:768px)` — бургер, компактний топбар (ховає підзаголовок), `.app`-шухляда, Compare у 1 колонку (`.modal-grid`), діалоги на всю ширину (bottom-sheet), таргети ≥44px (бургер/close/send/keys-close); `@media(max-width:430px)` — тонші відступи. `.rcard-name`/`.rcard-model` отримали `overflow-wrap:anywhere`+`min-width:0` → довгий BYOK-`model_id` не дає горизонтального оверфлоу. Явний `viewport` (`width=device-width, initial-scale=1`) у `app/layout.tsx`; focus-visible-кільця на нових контролах.
- **i18n:** +11 ключів × uk/pl/en (паритет): `sidebar.{label,collapse,expand,openMenu,closeMenu}`, `status.{limited,ownKey,compareUnlimited,comparePartial}`, `author.initials="SB"`, `keys.shortLabel="API"`.
- **Гейти:** FE tsc/eslint/prettier/vitest(**22**)/build зелені; i18n паритет uk/pl/en. Бекенд не змінювався.

## ✅ PH22 — суддя оцінює доданий AI · тонкий скрол сайдбара · base_url дефолтних слотів

- **(1, корінь) Суддя тепер оцінює й може обрати доданий BYOK-AI.** Раніше промпт судді (`prompts.yaml`) хардкодив «select ONLY: groq/cerebras/sambanova» + приклад scores лише для них, а `selector_parser` відкидав не-дефолтний вибір (`ALLOWED_MODELS`) → доданий AI отримував 0/100 і не міг перемогти. Виправлено: судді відповіді подаються під **brand-нейтральними мітками «AI 1…AI N»** (`selector_prompt.py`), промпт — **динамічний** (список і приклад scores за фактичними учасниками); вердикт мапиться назад на слоти (`remap_verdict_to_slots`); валідація — за `responses.keys()` (парсер без `ALLOWED_MODELS`); персоналізаційний блок релейблиться. **Бонус:** нейтральні мітки прибирають бренд-байас судді. Тести: `test_response_selector.py` (вибір custom-слота) + `test_prompts.py` (remap, динамічні мітки).
- **(2) Тонкий скрол сайдбара.** `.sidebar` додано до груп тематичного тонкого скролу (`theme/components.css`) — ліва колона більше не має дефолтного скролбара.
- **(3) base_url для дефолтних слотів.** Бекенд уже підтримував (`_transient_base_url`); тепер `KeysModal` показує **опційне** поле Base URL і для дефолтних слотів (AI 1/2/3), а `KeysContext` (`saveAndValidate`/`byokPayload`) шле `base_url` для будь-якого слота → можна замінити дефолтний слот своїм ключем іншого провайдера. i18n `keys.baseUrlOptional` (uk/pl/en).
- **Гейти:** BE **131 passed** + ruff/black; FE tsc/eslint/prettier/vitest(16)/build зелені. Live: промпт судді з custom-слотом дає мітки AI 1–N і не хардкодить ростер.

## ✅ PH21 — BYOK: швидка валідація ключа (fix 500)

- **Баг:** валідація свого ключа на повільному/rate-limited (429) ендпоінті (напр. OpenRouter free) «висіла» ~40с через дефолтні SDK-ретраї (backoff 10с+30с) → Next dev rewrite-проксі відвалювався по таймауту з **500**.
- **Фікс:** `TransientProvider` будує OpenAI-клієнт із `max_retries=0` + `timeout=60с` (`BYOK_REQUEST_TIMEOUT_SECONDS`) — без backoff-ретраїв; `validate_credentials` робить ping через `with_options(timeout=12с)` (`VALIDATE_TIMEOUT_SECONDS`) → fail-fast; `/keys/validate` валідує записи конкурентно (`asyncio.gather`). Тепер `/keys/validate` повертає 200 з per-slot `ok`/`error` за секунди (live: невалідний ключ → `ok:false` за 0.54с). Ключ і далі не логується/не зберігається.
- **Гейти:** BE 128 passed + ruff/black. Фронтенд не змінювався.

## ✅ PH20 — BYOK: життєвий цикл доданої моделі (D-15)

- **Сховище тримає додану (custom) модель лише якщо вона валідна+робоча.** `KeysContext.buildPersistedState` (нова чиста функція) на «Зберегти» персистить дефолтні 3 слоти + суддю як раніше, але custom-рядки — **лише** з `active=true` (валідні); порожні й невалідні custom-рядки у `sessionStorage` **не** потрапляють. `sanitizeLoadedState` відкидає на гідрації будь-який неактивний custom-рядок (легасі-захист). Юніт-тести: `store/KeysContext.test.ts` (+4).
- **Порожній** доданий рядок на «Зберегти» — прибирається з форми (`KeysModal.save` фільтрує custom-рядки з порожніми `apiKey`/`modelId`/`baseUrl`) і не зберігається.
- **Невалідний** доданий рядок — лишається у вікні **червоним** (можна виправити друкарську помилку), але не персиститься; при закритті вікна локальна чернетка відкидається → сховище чисте (нічого «неправильного» не висить).
- Дефолтні 3 слоти + суддя — поведінка без змін (порожнє=вбудований; невалідне=червоним).
- **Підпис доданих моделей** — `keys.customResponderNumbered` «Додана модель — AI 4/5» (продовження нумерації AI 1/2/3; перенумерація за позицією). Кнопка «Видалити» — без змін.
- **Гейти:** FE tsc/eslint/prettier/vitest(16)/build зелені; i18n паритет uk/pl/en. Бекенд не змінювався.

## ✅ PH19 — BYOK-мітки, картка акаунта, мова на вході (D-14)

- **(1) BYOK-мітки «AI 1/2/3».** У вікні «свої ключі» (`KeysModal`) три дефолтні відповідачі показуються узагальнено — `keys.responderSlot` «AI 1/2/3» + підпис `keys.defaultName` «типово: <реальна модель>» (дзеркалить рядок судді «типово: Qwen»). **Лише тут** (D-14): `responderLabel` і назви в Compare-картках / перемикачі Single / банері судді лишаються **правдивими** (Llama 3.3 70B / GLM-4.7 / DeepSeek V3.1) — D-11 не порушено. Нумерація слотів — за порядком дефолтних слотів, незалежно від доданих custom-рядків.
- **(2) Картка акаунта.** `ProfileCard`/`.acct-name`: прибрано `flex:1`+`text-align:center` (PH18/7) → ім'я (username) тепер **поряд з іконкою**, вертикально по центру відносно неї; «Вийти» праворуч (`margin-left:auto`); довге ім'я обрізається (ellipsis), іконка `flex-shrink:0`.
- **(3) Перемикач мов на вході.** Спільний презентаційний `components/common/LanguageToggle.tsx` (рядок пілюль EN/PL/UA, `type="button"` — щоб не сабмітити форму входу, `role="group"`+`aria-pressed`). Sidebar `LanguageSwitcher` = caption + `LanguageToggle`; `AuthScreen` показує `LanguageToggle` угорі картки. Без дублювання логіки/стилів.
- **(4) Мова за умовчанням = English.** `LanguageContext.detectInitialLocale` більше **не** визначає мову за `navigator.language`: нові користувачі стартують з `DEFAULT_LOCALE` (EN); збережений у `localStorage` вибір застосовується й персиститься, як і раніше.
- **Поза обсягом (наступний крок):** перевірка валідації доданої BYOK-моделі (порожні поля → видаляються на Save; невалідні → червоним) — окремий майбутній план.
- **Гейти:** FE tsc/eslint/prettier/vitest(12)/build зелені; i18n паритет uk/pl/en. Бекенд не змінювався.

## ✅ PH18 — фінальний UX-поліш (D-13)

- **(1) BYOK-тексти (Варіант A).** Узгоджено суперечливі нотатки у вікні ключів (`keys.notePartial`/`keys.noteJudgeSingle`, uk/pl/en): на **своєму** ключі будь-яка модель у Single — без списання; ліміти лише за вбудовані AI; своя модель у полі «Суддя» доступна в Single «без обмежень»; Compare безлімітний лише коли **всі** учасники на своїх ключах. Прибрано фразу-протиріччя «…і лише якщо це не суддя».
- **(2) Скролбар вікна BYOK.** `.keys-dialog` додано до груп тонкого тематичного скролу (`theme/components.css`, ті самі токени `--scrollbar-thumb`).
- **(3) Ім'я автора.** `author.name` = «**Stanislav Byndas**» латиницею в усіх 3 мовах.
- **(4) Банер лімітів без переповнення.** `.limit-banner-body`/`.limit-row` отримали `min-width:0`+`flex-wrap`+`overflow-wrap` → довгі pl/uk reset-тексти переносяться, не вилазять за сайдбар.
- **(5) Кнопка «вниз» + авто-скрол.** Спільний `components/chat/MessageScroll.tsx` (Single+Compare): sticky-bottom через `MutationObserver` (тримається низу під час стріму, лише якщо користувач унизу), кнопка по центру над композером з'являється поза низом (`!atBottom`), авто-скрол у низ після відправки промта (`scrollSignal`). CSS `.msgs-wrap`/`.scroll-bottom`; i18n `chat.scrollToBottom`.
- **(6) Хвилинний ліміт — повний скид.** `QuotaService._minute_window` реконструює **фіксоване** 60с-вікно з `usage_events` (lookback 2×60с): лічильник повертається **повністю** до ліміту на 60-й секунді (не поштучно). Enforcement і `/auth/me` читають те саме вікно; `UsageRepository.timestamps_since` замінив `earliest_since`. FE-тикер `LimitBanner` refetch-ить на 0 → показує повний ліміт.
- **(7) Картка акаунта.** `ProfileCard` спрощено: лише іконка + ім'я (username) по центру + «Вийти»; прибрано підпис `acct-sub`; видалено мертві ключі `profile.subtitle`/`account.title`/`account.subtitle`.
- **(8) Ліміт власного ключа.** Окреме повідомлення, коли BYOK-модель віддає rate-limit, відмінне від `quota_exceeded`. Compare: `CompareFailedCard` (`isOwnKey` + `reason==="rate_limited"` → `compare.fail.ownKeyRateLimited`). Single: стрім-подія `{type:"error",reason}` (`classify_provider_failure`) → `ComposerContext` (`StreamError`/`ComposerError`, own-key через `byokModelId`) → `ChatPage` рендерить `errors.ownKeyRateLimited` через `t()`.
- **Гейти:** BE **128 passed** + ruff/black; FE tsc/eslint/prettier/vitest(12)/build зелені.

## ✅ PH17 — виправлення чатів, живі ліміти, BYOK (D-12)

- **(A) Видалення чату.** `SavedChatRepository.delete_chat` тепер явно видаляє `chat_messages` перед `Chat` (Core bulk-DELETE не запускав ORM-каскад → осиротілі повідомлення, а SQLite перевикористовував id → новий чат «всмоктував» старі). Додано `purge_orphan_chat_messages()` (одноразова чистка сиріт на старті) і `PRAGMA foreign_keys=ON` для SQLite-конекшнів (`core/db.py`, defense-in-depth). Тести: `test_chats.py` (видалення без сиріт; перевикористання id; purge).
- **(B) Картка недоступної моделі.** `CompareFailedCard` показує реальну назву (`byokModelId(slot) ?? responderLabel(slot)`); CSS `.rcard-fail` залито легким `--danger-surface` (прибрано `opacity`, текст читабельний), бейдж на opaque `--card` (пунктир не «ріже»).
- **(C) Живі ліміти.** `QuotaService`: хвилинне вікно «від 1-го запиту» (60с, `minute_resets_in_seconds`) + денне за **Europe/Warsaw** (00:00, DST-aware `zoneinfo`, `day_resets_at`); enforcement = ті самі вікна. `/auth/me` (`MeResponse`) розширено `remaining_this_minute`/`minute_resets_in_seconds`/`day_resets_at` (null для безлімітних). FE `LimitBanner` — два рядки (хвилина з тикером 1с+refetch на 0, день із підписом «00:00 польського часу»); `refresh()` після кожного запиту.
- **(BYOK) Свої ключі.** `ChatRequest.byok` (judge + 3–5 responders); `TransientProvider` + `resolve_responders`/`build_transient_judge` (транзитні, не чіпають синглтони); `execute_many`/`generate_stream`/`execute_selector_ai`/`ResponseSelector` приймають провайдерів/judge-override (валідація за `responses.keys()`, BYOK-суддя репортиться правдиво). **Квота:** Single безкоштовний на своєму ключі; Compare безкоштовний лише коли **всі** учасники (відповідачі + суддя) на своїх — інакше 1 запит; адмін без лімітів. `POST /keys/validate` (auth+CSRF, живий тест-виклик, ключі не в логах/БД). FE: `store/KeysContext` (sessionStorage), `components/keys/{KeysModal,KeysButton,KeysStatusBanner}`, дві точки входу (над `AuthorCard` + «+» у `ModelSwitcher`), масковані інпути з show/hide, пер-ключова валідація на Save; Single чіпи включають додані моделі + модель судді (NQ6); Compare адаптивний під 4–5; зелена плашка (свій ключ Single / усі свої Compare) + червона (частковий набір); назви моделей = `model_id` скрізь. Ключі **ніколи** не зберігаються в БД і не логуються (NQ5; sessionStorage + транзит).
- **Гейти:** BE **123 passed** + ruff/black; FE tsc/eslint/prettier/vitest(12)/build зелені.

## ✅ PH16 — поліш чатів, правдиві моделі, навчання судді (D-11)

- **Реєстр моделей (єдине джерело правди):** `config/models_config.py` (`ModelSpec{api_model_id, display_name, max_tokens}`); `api_model_id` із `.env` (`GROQ_MODEL`/`CEREBRAS_MODEL`/`SAMBANOVA_MODEL`). Провайдери більше не хардкодять `model_name` — `apply_model_spec()` у `__init__`. Лінап — три **різні** родини: Groq `llama-3.3-70b-versatile` («Llama 3.3 70B»), Cerebras `zai-glm-4.7` («GLM-4.7»), SambaNova `DeepSeek-V3.1` («DeepSeek V3.1»). Суддя — Qwen `qwen/qwen3-32b` (без збігу родин → без self-bias). `/providers/info` віддає `display_name`; FE-мітки — `utils/models.ts` (дзеркало). Доступність моделей звірено live (рекомендована `llama-4-scout` недоступна в Cerebras → GLM-4.7).
- **Бюджет токенів:** глобальний `RESPONDER_MAX_TOKENS=2048`, per-provider `CEREBRAS_MAX_TOKENS=4096` (GLM-4.7 — reasoning-модель; інакше обрив). `_max_tokens()` бере бюджет із реєстру.
- **Навчання судді (E):** `manual_model_selections` додано в промпт судді (`prompts.yaml` v4) з правилом «на ties віддавай перевагу частіше обраній вручну» + «order не впливає»; **анти-позиційне** детерміноване впорядкування відповідей (`hash(message|provider)`); **обмежене пост-зваження** (`selector/preference_weighting.py`, margin=5, manual×2+preferred, лише near-tie, ніколи не перекриває явно кращу) — прозоро в `selector_metadata.preference_weighting` + `reason`. Тести: `test_preference_weighting.py` (новий) + кейси в `test_response_selector.py`/`test_prompts.py`.
- **Compare UX:** «+» = порожня **чернетка** без персисту (`ChatsContext.newChat`); автозбереження на 1-му повідомленні (`createActiveChat(title)`), **назва чату = текст 1-го повідомлення** (обрізка ~60); завжди повний `CompareTurn`-тред (ефемерний шлях прибрано; `useCompare` спрощено до loading/error/runCompare); прибрано лічильник повідомлень; **ліміт 25** (`SAVED_CHATS_LIMIT`, BE+FE) з явним i18n-повідомленням (uk/pl/en), без автовидалення.
- **Single (A1):** стан треду піднято у store (`ComposerContext`); зміна моделі на непорожньому треді → a11y `ConfirmDialog` (focus-trap/Esc) → «Так» очищає тред + перемикає; на порожньому — без діалогу. (`useChat.ts` видалено.)
- **Скрол:** тонка заокруглена тематична смужка через токени `--scrollbar-thumb`/`-hover` (`.msgs` — єдиний контейнер + `.composer-popover` + `.thin-scroll`).
- **Гейти:** BE 113 passed + ruff/black; FE tsc/eslint/prettier/vitest 12/build зелені. Live: `/providers/info` правдивий, три різні моделі відповідають, чат авто-названо за повідомленням, суддя враховує ручні вибори.

## ✅ PH15 — адмінпанель + ліміти акаунтів + код реєстрації (D-10)

- **Per-user квоти запитів:** `User` отримав `is_admin`, `max_requests_per_minute`, `max_requests_per_day` (nullable=безліміт); append-only таблиця `usage_events` (Alembic `0005`). `QuotaService` рахує rolling-вікна (хвилина/доба) з `usage_events`; гард `enforce_quota` на `/chat` і `/chat/stream` → **429** `quota_exceeded` при перевищенні. **Compare рахується як 1 запит.** Адмін і безлімітні (`null`) — без перевірки. Після кожного ходу пишеться `usage_events` (mode, message, selected_model, total_tokens, success) — токени дістаються з `response.usage.total_tokens` відповідачів (`OpenAICompatibleProvider.generate_full`); стрім-SDK не звітує usage → `total_tokens=null`.
- **Реєстрація лише за кодом:** `/auth/register` потребує `registration_code` (== `REGISTRATION_CODE`), інакше **403** `invalid_registration_code` (порожній конфіг → реєстрація вимкнена). Акаунт із `ADMIN_USERNAME` → `is_admin=true` + безліміт; інші — дефолтні ліміти (`DEFAULT_MAX_REQUESTS_PER_MINUTE/_PER_DAY`, 5/30).
- **Admin API** (`/admin/*`, гард `require_admin` → 401/403; мутації +CSRF): `GET /admin/users`, `GET /admin/users/{id}/usage` (події+токени), `POST /admin/users` (створення без коду реєстрації), `PATCH /admin/users/{id}` (ліміти/роль, exclude_unset). `/auth/me` розширено: `is_admin`, ліміти, `used_this_minute`, `used_today`, `remaining_today`.
- **Frontend:** `services/adminApi`; `AuthContext` зберігає `CurrentUser` (is_admin/ліміти/usage), гідрує через `/auth/me`, має `refresh()`; `LimitBanner` (червона рамка, лише для лімітованих не-адмінів); поле «код реєстрації» + локалізована помилка в `AuthScreen`; **адмінпанель** (`AdminPanel` + `AdminViewContext`, видима лише адміну): таблиця користувачів, inline-редагування лімітів, створення акаунтів, розгортання аудиту з токенами; стани loading/empty/error, a11y, i18n паритет uk/pl/en.
- **Тести:** BE `tests/test_admin_quotas.py` (9 кейсів: код реєстрації, адмін-флаг/безліміт, ізоляція `/admin/*`, enforcement хв/доба, Compare=1, аудит токенів) — усього **101 BE**; FE — tsc/eslint/prettier/vitest(12)/build зелені.

## ✅ PH14 — фінальний UX-поліш

- **Нейтральні мітки судді (D-9):** прибрано хардкод «Gemini» з UI; `selector.title` → «AI-суддя/AI Judge/Sędzia AI», реальна модель судді показується дружньою назвою з `selector_metadata.selector_model` через `utils/judge.judgeModelName` (напр. «Qwen») у `SelectorBanner` та `ManualSelectionButton`. Мертвий ключ `banner.judgeUnavailable` видалено (код використовує лише `banner.reason.*`).
- **Топбар:** прибрано годинник + статус-крапку (і `IconClock`). Доданий **режимо-залежний контекст** (`components/chat/TopbarModeContext.tsx`) у спільному слоті `MainLayout`: Single → `ModelSwitcher` + примітка `single.note` (перенесені зі сторінки); Compare → пояснення режиму `topbar.compareInfo` з назвою судді (FE-константа `JUDGE_MODEL`, дзеркалить backend `SELECTOR_MODEL`).
- **Скрол:** `.msgs` — єдиний скрол-контейнер чатів (`.responses` більше не має власного `overflow`/`flex:1`, тож Compare-тред скролиться як стрічка); `.composer-popover` (документи) обмежено по висоті з власним `overflow-y` + `overscroll-behavior:contain`; `.msgs` отримав `scrollbar-gutter:stable` + `scroll-behavior:smooth`.
- **Композер:** звужено (`max-width`) і відцентровано, трохи піднято від низу — кнопка «надіслати» більше не в крайньому правому куті.
- **Прибрано System Log** (`SystemLog.tsx`, мертві `syslog.*` + `status.online`, мертвий CSS); на його місці — **персональна картка автора** (`AuthorCard`, `author.*`, i18n uk/pl/en).
- Гейти FE зелені: tsc/eslint/prettier/vitest (12)/next build; i18n паритет uk/pl/en.

## ✅ PH13 — доведення UX чатів

- **Інтерактивні збережені чати (Compare):** клік по чату → **тред усіх ходів** у головній області (`CompareTurn`); сабміт у активному чаті додає хід (`chat_id`), персиститься й підвантажується (`reloadActive`); поки активний чат порожній — створення нового блокується з повідомленням (`canCreate`/`notice`, A3); підписи «Збереження чатів з порівнянням» / «Новий чат з порівнянням». Секція збережених чатів — лише в Compare.
- **Single уточнено (уточнення D-3):** перемикач моделі (`ModelSwitcher`, groq/cerebras/sambanova через `ComposerContext`); кнопка «Очистити» прибирає лише **візуальний** тред; ходи пишуться в **rolling-історію** БД після стріму (`/chat/stream`, `compare_mode=false`); помітна примітка-зірочка; окремих single-чатів немає.
- **RAG вбудовано в чати (не окремий режим):** компактний менеджер документів у композері (`ComposerTools`, кнопка «Документи») для Single і Compare; **RAG вмикається автоматично, поки є хоч один документ** (без ручного тумблера — `rag_enabled = documents.length > 0`); `/chat/stream` підтримує `rag_enabled` з поверненням джерел подією `sources`; видалено `RagPage`/`useRag`/`ragApi` та rag-режим у `ChatModeSelector`. Помилки завантаження мають типізовані коди (`unsupported_type`/`no_text`/…) → локалізовані повідомлення в UI; клієнтська перевірка типу + підказка про підтримувані формати (PDF/TXT/MD).
- **Прозорість судді:** `fallback_reason` (judge_unavailable / invalid_response / low_confidence) збирається в `response_selector.py` → `SelectorFallback` → `selector_metadata` → `SelectorBanner` показує конкретну причину (i18n uk/pl/en). Збережений чат показує збережений стан того ходу (D3).
- **Третя модель (Cerebras gpt-oss-120b):** явний `RESPONDER_MAX_TOKENS` (дефолт 1024) у `generate`/`generate_stream`; порожній content → `ProviderError` (у Compare → failed_provider, без порожньої картки).
- Тести: BE `test_responders.py`, `test_chat_stream.py`, нові кейси `test_response_selector.py` (усього 90 BE); FE vitest 12 (нові `SelectorBanner`/`ModelSwitcher`).

## ✅ PH12 — деплой-артефакти

- **Dockerfiles**: `backend` (multi-stage, non-root, healthcheck, авто-`alembic upgrade head`), `frontend` (Next standalone → slim non-root runtime).
- **`docker-compose.yml`**: Postgres + backend + frontend + nginx; volumes `pgdata`/`chroma` (ChromaDB — embedded у backend); healthchecks + `restart: unless-stopped`.
- **nginx** reverse proxy (`/`→FE, `/api/`→BE, gzip, security headers) + TLS-шаблон (`nginx.tls.conf.example`, HSTS).
- **`.env.production.example`**, `.gitignore` для `.env.production`, **`DEPLOY.md`** (локальний запуск однією командою + owner-handoff: VPS/DNS/секрети/TLS/renew/чеклист).
- Реальний запуск на VPS — зовнішня залежність власника (не борг).

## ✅ PH11 — якість/CI

- **Масовий формат** (Black/Prettier) на всьому репо; `design-reference` винесено з Prettier (reference-артефакт).
- **pre-commit** (`.pre-commit-config.yaml`): local/system хуки ruff+black (backend), prettier+eslint (frontend).
- **Тести FE** — `vitest` + Testing Library (i18n parity, рендер `PromptInput`/`ChatModeSelector`), 7 тестів; `npm run test`.
- **CI** (`.github/workflows/ci.yml`): backend (ruff/black/pytest) + frontend (prettier/eslint/tsc/vitest/next build) на push+PR у `main`.

## ✅ PH6–PH10

- **PH6:** повна TypeScript-міграція фронтенду (strict; tsc/build/eslint зелені).
- **PH7:** pixel-match дизайн — візуальна система у `theme/components.css` (токени), icon-set, sidebar/topbar/chat/compare-картки, реальні дані `/chat`, ручний вибір → персоналізація, адаптив/a11y.
- **PH8:** акаунти/auth — argon2, server-side сесії (`sessions`), httpOnly cookie + double-submit CSRF, `/auth/{register,login,logout,me}`, **per-user ізоляція** даних (репозиторії за `user_id`); FE AuthScreen + gate у `page.tsx` + logout у Sidebar.
- **PH9:** збережені Compare-чати — таблиці `chats`/`chat_messages` (Alembic `0003`), `SavedChatRepository` (per-user, ліміт ≤3), CRUD `/chats` (list/create/get/rename/delete, CSRF на мутаціях), `chat_id` у `POST /chat` персистить хід у чат; FE `services/chatsApi` + `store/ChatsContext` (active-chat) + `ChatList`/`NewChatButton` (реальні дані, перемикання/перейменування/видалення, стани, i18n, a11y); відкриття чату підвантажує останній хід у Compare. Single лишається ефемерним (D-3).
- **PH10:** RAG — `documents` (Alembic `0004`) + ChromaDB vector store (`core/rag/`: parser PDF/TXT, chunker, `EmbeddingClient`→Gemini `gemini-embedding-001`, store), `RagService` (ingest→chunk→embed→store; retrieve similarity + per-user `where`), CRUD `/documents` (upload/list/delete, ліміти типу/розміру/кількості), `rag_enabled` у `POST /chat` інʼєктує контекст у відповідачів і повертає `rag_sources`; FE `services/{documentsApi,ragApi}` + `store/RagContext` + RAG-режим у `ChatModeSelector` + `RagPage` (upload/список/видалення документів, відповідь+джерела, стани, i18n, a11y).

## ✅ Усунено в PH2–PH5

- **PH5 (frontend foundation):** робоча токен-система (`theme/tokens.css`, dark+light, один источник) + Tailwind v4 `@theme`; функціональний i18n (`i18n/index.ts`, `useI18n().t`, словники uk/pl/en у паритеті, робочий `LanguageSwitcher`); `ThemeContext`/`LanguageContext` з персистом; шрифти Plus Jakarta Sans + JetBrains Mono; стани empty/error у Chat/Compare; видалено `page-old.js` і дрейф `theme/*.ts`; імпорти через `@/`. Хардкоду кольорів/тексту в компонентах немає; `next build` зелений.



- **PH2:** true-async провайдери (`to_thread`), типовані `response_model`, тонкі роутери (`routes/{chat,preferences,providers,memory}.py`), dedupe (`OpenAICompatibleProvider`, `extract_json`, один `ALLOWED_MODELS`), repository seam.
- **PH3:** промпти винесено у `prompts/prompts.yaml` (версіоновано), завантажувач `core/prompts.py`.
- **PH4:** **персист БД** — `SqlChatRepository` (async SQLAlchemy 2.x) замінив in-memory `ChatBuffer`; моделі `users/preferences/interactions`; Alembic-міграції; дані переживають рестарт; готовність до Postgres через `DATABASE_URL`.

## 🐞 Відомі дефекти / технічний борг (залишок)

Критичного боргу немає. Заплановане (не борг, а майбутні фази): деплой-артефакти (PH12).

> Примітка: `google-generativeai` має upstream-попередження про депрекацію (рекомендують `google-genai`). Це канон-SDK за документацією; міграція — поза обсягом.
> Пріоритезація виправлень — у [09-roadmap.md](09-roadmap.md); відкриті рішення — у [10-open-decisions.md](10-open-decisions.md).
