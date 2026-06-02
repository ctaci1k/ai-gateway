# 06 — Архітектура фронтенду

Стек: **Next.js (App Router) + React + Tailwind CSS**. Мова: проєкт переходить на типізацію (TS-файли в `theme/`, `types/`), але `services/` та компоненти наразі `.js/.jsx` — див. борг нижче.

> 🎨 **Цільовий візуал (дизайн-референс):** [../frontend/design-reference/ai-gateway/](../frontend/design-reference/ai-gateway/) — handoff-макет із Claude Design (темна тема `#07080d`, фіолетовий акцент `#8b5cf6`, шрифти Plus Jakarta Sans + JetBrains Mono). Витяг токенів і відповідність компонентам — у `NOTES.md` там. **Статус:** перенесено як референс; інтеграція в застосунок — запланований крок (рефакторинг за окремим планом, не спонтанно).

## Структура (реальна, з коду)

```
frontend/
├── app/                      # Next.js App Router (page.js, layout.js, globals.css)
├── layouts/                  # MainLayout.jsx, ChatLayout.jsx
├── components/
│   ├── sidebar/              # Sidebar, ProfileCard, LanguageSwitcher, ChatModeSelector,
│   │                         #   ChatList, NewChatButton, AccountCard
│   ├── chat/                 # ChatContainer, MessageList, MessageBubble, PromptInput,
│   │                         #   StatusBanner, ErrorBanner
│   ├── compare/              # CompareModal, CompareColumn, ModelScoreCard, ManualSelectionButton
│   └── selector/             # SelectorBanner
├── features/
│   ├── chat/                 # ChatPage.jsx, useChat.js  (Single + стрімінг)
│   └── compare/              # ComparePage.jsx, useCompare.js  (Compare)
├── services/                 # chatApi.js (/chat/stream), compareApi.js (/chat)
├── store/                    # ChatModeContext, ThemeContext, LanguageContext
├── theme/                    # colors.ts, spacing.ts, radius.ts, shadows.ts, typography.ts
├── i18n/                     # uk.json, pl.json, en.json
├── types/                    # Chat.ts, Message.ts, Provider.ts, Selector.ts, Preferences.ts
├── hooks/
└── utils/
```

## Шари і відповідальності

| Шар | Правило |
|---|---|
| `app/` | Точка входу, роутинг. Рендерить `ChatPage`/`ComparePage` за `mode` з `ChatModeContext`. |
| `layouts/` | Каркас (Sidebar + область контенту). Без бізнес-логіки. |
| `components/` | Презентаційні, перевикористовувані. **Заборонено** прямий `fetch`. |
| `features/` | Зв'язок UI ↔ дані (хуки `useChat`, `useCompare`). |
| `services/` | Уся робота з API. Компоненти не викликають `fetch` напряму. |
| `store/` | React Context: режим чату, тема, мова. |
| `theme/` | **Design tokens.** Хардкод кольорів у компонентах заборонено. |
| `i18n/` | Усі тексти через `t("key")`. Хардкод тексту заборонено. |
| `types/` | Типізація даних. |

## Поточна поведінка (з коду)

- `ChatModeContext`: `mode ∈ {"single","compare"}`, дефолт `"single"`.
- `useChat`: `POST /chat/stream`, читає NDJSON-потік, акумулює токени у `streamingMessage`. Дефолтний провайдер `groq`.
- `useCompare`: `POST /chat` з `providers:["groq","cerebras","sambanova"]`, `selectorEnabled:true`; розкладає `all_responses` у колонки з оцінками/часом.
- API base URL **захардкоджено** у сервісах (`http://127.0.0.1:8000`).

## Chrome «Classic Console» (PH24/D-17)

Редизайн під референс `design-reference/classic-console/`. Структура — повноширинний топбар над рядком сайдбар+контент (`layouts/MainLayout` → `.cc-root` → `Topbar` + `.cc-body`(`Sidebar` + `.cc-main`)).

- **Топбар** (`components/layout/Topbar`): бренд; тема moon/sun (`components/topbar/ThemeToggle` → `ThemeContext.toggleTheme`); мова-дропдаун (`LangMenu`); usage-пілюля (`UsagePill` — `X/N` + popover лишку хв/день/скид + own-key, на `useSidebarStatus`+`/auth/me`); Settings/Admin icon-btn (Admin лише адмін); акаунт-дропдаун (`AccountMenu`: профіль/налаштування/безпека/вихід); бургер (mobile).
- **Дропдауни** — спільний a11y `components/common/Dropdown` (відкриття/Esc/click-out/focus-trap, `role="menu"`).
- **Сайдбар** (`components/sidebar/Sidebar` + `AccordionSection`): два незалежні акордеони **Single Models / Compare**, кожен з `+ New Chat` і вкладеною **History** (рядки: назва + відносний час через `utils/relativeTime`, активний підсвічений, inline rename/delete); `CreatorCard` унизу. Mobile — off-canvas шухляда (`SidebarContext`, focus-trap/Esc/close-on-nav, backdrop у `MainLayout`).
- **Налаштування** (`components/settings/SettingsModal`, стан `store/SettingsContext`): розділи **Промпт судді** (`JudgePromptSection`, `services/preferencesApi.getJudgePrompt/putJudgePrompt`) і **API-ключі** (`ApiKeysSection` → `KeysForm`, винесено з `KeysModal`). Заглушки — `components/common/ComingSoonModal` (стан `ComingSoonContext`): Профіль/Безпека (Звіти **graduated** у реальний дашборд — PH27/D-18, нижче).
- **Стан чатів** — `ChatsContext` mode-aware (`singleChats`/`compareChats`, спільний ліміт 25); `ComposerContext` — стрімінг-контролер Single + create-on-first (`utils/chatTitle`); `ChatPage` рендерить збережені Single-ходи + оптимістичний хід або `SingleModelPicker`; `MainHead` — чип моделі (fixed-at-creation, підказка) / тег режиму.
- **Збережено з PH23:** mobile-шухляда (адаптована), `useSidebarStatus` (→ топ-індикатор), очищення BYOK-ключів при logout (`KeysContext`), правдиві назви BYOK.
- **Responsive (`theme/components.css`, секція Classic Console):** 900 (ховає підзаголовок), 768 (бургер+шухляда, меню/Settings на всю ширину, picker 1 колонка), 430 (ховає usage-пілюлю); таргети ≥44px, focus-visible.

## Звіти про використання (PH27/D-18; повноекранний — PH28)

Реальний self-service дашборд історії акаунта (замінює заглушку `ComingSoonModal("reports")`). **PH28 (Варіант B):** з модалки переведено у **повноекранний розділ** — рендериться в `app/page.tsx` як `<ReportsPage/>` (точно як `AdminPanel` через `AdminViewContext`), коли `store/ReportsContext.isOpen`. Повноекранні розділи **взаємовиключні**: відкриття Звітів закриває Admin і навпаки (на call-sites `AccountMenu`/`Topbar`; пріоритет у `page.tsx` — reports > admin > chat). Кнопка «Звіти» (`AccountMenu`) → `useReports().open()`. Дані — лише через `services/reportsApi.ts`, типи — `types/api.ts`.

- **`components/reports/ReportsPage.tsx`** — повноширинний розділ (`.rep-page`, max-width 1180): шапка (тайтл + «Назад» як `AdminPanel`); **тулбар** — фільтр періоду (24г/7д/30д/усе/власний + date-inputs) + **сегмент ключа доступу** (усе/наш/свій); рядок вкладок **Огляд / Розкладка / За моделями / За чатами / Журнал**. Стан періоду+ключа підняті в сторінку; зміна фільтра **remount-ить** активну вкладку через `key=${rangeKey}|${access}` → mount-once fetch (патерн `AdminPanel`, без синхронного setState — `react-hooks/set-state-in-effect`).
- **Фільтр ключа доступу (PH28):** сегмент тече у `ReportRange.access` (`app|own`) → у всі виклики `reportsApi` (summary/by-model/by-chat/timeseries/events/breakdown + CSV-лінк). Бекенд мапить `access`→`billable`.
- **`OverviewTab`** — KPI (запити, токени з «~»+бейдж «оцінка», чати, сер./день, success rate); **`MiniChart.tsx`** (inline-SVG бари=запити + лінія=токени, `role="img"`+`aria-label`, без важких залежностей — D-18/п.7); спліт-бари Single/Compare і billable/own-key.
- **`BreakdownTab` (PH28)** — акордеон-drill-down **ключ доступу → модель → чати** (`getBreakdown`), запити·токени на кожному рівні; групи-ключі розгорнуті, моделі згорнуті; a11y (`aria-expanded`/`aria-controls`, Enter/Space, focus-visible, обертання шеврона); листок-чат → відкриває чат (`setMode`+`selectChat`+`close`), ad-hoc некликабельний.
- **`ByModelTab`/`ByChatTab`** — таблиці (`scope`/`th`); за чатами рядок клікабельний (Enter/Space) → відкриває чат; видалені/ad-hoc — окремий рядок; відносний час — `utils/relativeTime`. Назви моделей — `utils/models`.
- **`ActivityLogTab`** — keyset-пагінований лог + «Показати ще» + «Експорт CSV» (`eventsCsvUrl`, серверний стрім, поважає період+ключ). Стани loading/empty/error — спільний `RepState`.
- **i18n** — ключі `reports.*` (вкладки/період/KPI/колонки/бейджі/розкладка/ключ доступу/назад) у паритеті uk/pl/en. **CSS** — секція «USAGE REPORTS» (`theme/components.css`, `rep-*` на токенах): `.rep-page`/тулбар/вкладки/акордеон; responsive 768/430 (спліти 1 колонка, таблиці — горизонтальний скрол усередині `rep-table-wrap`, вкладки — скрол у рядку).

## Golden Rules (обов'язкові)

**Заборонено:** дублювати JSX, стилі, кольори, тексти; писати `fetch` у компонентах.
**Дозволено:** reusable-компоненти, services-шар, design tokens, локалізація, типізовані інтерфейси.

- Колонки Compare будуються через `map()` — **без копіювання JSX** на кожну модель.
- Будь-яка нова фіча інтегрується **без переписування** наявних компонентів.

## Дизайн

- Мінімалізм, багато вільного простору; натхнення — ChatGPT, але **не копія**.
- Головний акцент UX — **Compare Mode**.
- **Show All Responses** відкриває модальне вікно з 3 колонками (провайдер, модель, час, оцінка + кнопка вибору).
- **Error/fallback-банер:** якщо Gemini-суддя недоступний — показати *«Gemini Judge недоступний. Використано Fallback Selector.»*

## Борг / розбіжності з первісним планом

- Первісний план передбачав `src/` та `.ts/.tsx` усюди й сервіси `providerApi.ts`, `selectorApi.ts`, `preferencesApi.ts`. Реально: без `src/`, змішані `.js/.jsx/.ts`, є лише `chatApi.js` + `compareApi.js`.
- `CompareHeader` згаданий у плані, але у компонентах відсутній.
- Винести API base URL у `.env` (зараз хардкод).

> Рішення «доводити фронтенд до TS-плану чи зафіксувати поточний стан як норму» — D-7 у [10-open-decisions.md](10-open-decisions.md).
