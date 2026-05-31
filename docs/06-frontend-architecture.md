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

## Сайдбар: згортання + мобільна шухляда + статуси (PH23)

- **`SidebarContext`** (`store/SidebarContext.tsx`): `collapsed` (desktop-рейл, персист `localStorage`, SSR-safe гідрація) + `mobileOpen` (ефемерна шухляда). Дії: `toggleCollapsed`/`openMobile`/`closeMobile`.
- **Desktop-рейл — через CSS** (`@media(min-width:769px) .sidebar--collapsed`): ховає текст/банери, показує `.rail-only` квадратики; **немає дубльованого JSX** — той самий `Sidebar` рендериться в усіх трьох станах (full / rail / mobile drawer), станами керує CSS.
- **Mobile-шухляда** (`@media(max-width:768px)`): бургер у `MainLayout` (`openMobile`), `.sidebar` як off-canvas + backdrop; a11y — focus-trap (лише видимі focusables), Esc, close-on-nav (зміна mode/chat/admin/keys).
- **Єдине джерело статусів** — `store/sidebarStatus.ts::useSidebarStatus()` (`byok` ok/warn + `limited`); і повні банери (`KeysStatusBanner`/`LimitBanner`), і компактні квадратики (`StatusSquares`/`SidebarSquare`) читають **його** — без дублювання логіки. Кольори лише через токени (`--success`/`--danger`); кожен квадратик має tooltip + `aria-label`.
- **Responsive:** Compare reflow у 1 колонку (`.modal-grid`), діалоги на всю ширину (bottom-sheet), таргети ≥44px, `overflow-wrap:anywhere` для довгих BYOK-`model_id`; явний `viewport` у `app/layout.tsx`.

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
