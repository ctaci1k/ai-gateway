# AI Gateway — дизайн-референс (handoff з Claude Design)

Джерело: експорт із claude.ai/design. Це **прототип** (HTML/CSS/JS на UMD React + Babel), не продакшн-код. Мета — відтворити **візуал** у нашому Next.js-фронтенді, а не копіювати структуру прототипу.

## Файли
- `AI Gateway.html` — точка входу (підключає jsx нижче).
- `app.jsx` — уся UI-логіка (Sidebar, ChatView, ResponsesModal).
- `styles.jsx` — `window.APP_CSS` (повний CSS, **джерело істини** для стилів).
- `icons.jsx` — line-іконки (SVG).
- `tweaks-panel.jsx` — ⚠️ **риштування прототипу** (живий перемикач стилів). У продукт **НЕ** йде.
- `screenshots/` — фінальні рендери (chatfinal.png, modal3.png — найактуальніші).
- `chat-transcript.md` — діалог із дизайн-асистентом (намір користувача).
- `HANDOFF-README.md` — інструкція handoff від Claude Design.

## Дизайн-токени (CSS variables) → мапити на `frontend/theme/*`
```
--bg #07080d   --panel #0f111a   --panel-2 #13151f   --sidebar #0b0d14   --card #11131d
--border rgba(148,163,184,0.12)   --border-strong rgba(148,163,184,0.20)
--text #e8eaf2   --text-2 #9298ac   --text-3 #686e83
--accent #8b5cf6 (violet)   --radius 14px
Шрифти: 'Plus Jakarta Sans' (UI), 'JetBrains Mono' (числа/моно)
Статус-дот: #2fd27a (online)
```
Тема **темна**, акцент — фіолетовий, **лише** на активному елементі сайдбару.

## Структура → відповідність нашим компонентам
| Дизайн (app.jsx) | Наш компонент |
|---|---|
| `Sidebar` (acct, proj-dropdown, items, New Chat, System Log) | `components/sidebar/*` (Sidebar, ProfileCard/AccountCard, ChatModeSelector, ChatList, NewChatButton) |
| `acct` "Ihor Shevchenko" | `ProfileCard` — текст-заглушка, замінити на "product by…" |
| `topbar` "AI Gateway v1.0 — Multi-Model Response System" | `components/chat/StatusBanner` / топбар у `MainLayout` |
| `ChatView` (банер, Show All, msgs, composer) | `features/chat` + `components/chat/*` (ChatContainer, MessageList, MessageBubble, PromptInput) |
| банер "Gemini Judge is unavailable…" | `components/selector/SelectorBanner` + `components/chat/ErrorBanner` |
| `ResponsesModal` (3 картки, score-bar, winner, CTA) | `components/compare/*` (CompareModal, CompareColumn, ModelScoreCard, ManualSelectionButton) |
| `MODELS` mock (groq/cerebras/sambanova, winner, score, time, tokens) | реальні дані з `/chat` (`all_responses`, `selector_scores`, `selected_model`) |

## CTA-логіка картки (важливо)
- Переможець (Gemini): `Selected by Gemini Judge` (зірка, акцент).
- Інша «впевнена» відповідь: `Confirm This Response` (зелений).
- Решта: `Change to This Response` (нейтральний). → це наш ручний вибір (персоналізація, `/preferences/manual-selection`).

## Адаптив
- `.modal-grid`: 3 колонки; ≤1180px → 1 колонка.

## Golden rules при реалізації (з docs/06)
Без хардкоду кольорів (лише токени), без дублювання JSX (картки через `map()`), тексти через `t("key")` (i18n), без `fetch` у компонентах.
