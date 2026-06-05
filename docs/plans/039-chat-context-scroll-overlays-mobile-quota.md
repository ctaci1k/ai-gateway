# 039 — Контекст діалогу + скрол питання вгору + закриття оверлеїв + мобільні ліміти з кольоровою рамкою (PH40)

**Статус:** PLANNED · фронтенд + **точкова бекенд-частина (тільки контекст діалогу)** · продовження після PH39.
**Власник:** Stanislav

> **Цей план написаний для виконання в новому чаті (Cloud AI / Claude Code).**
> Працювати **атомарно**: один крок M → перевірка (gate) → коміт-готовність → наступний.
> Прогрес фіксувати **тільки в цьому файлі** (мітка `[x]` біля кроку + 1 рядок підсумку в журналі в кінці).

---

## Контекст / проблема

Чотири незалежні проблеми, виявлені на проді/локально. Три — чистий фронтенд, одна (контекст діалогу) — бекенд + трохи фронтенду.

### P1 — Звіти/Адмін закриваються лише кнопкою «Назад»
Коли відкрито **Звіти** ([app/page.tsx:41](../../frontend/app/page.tsx#L41) → `<ReportsPage/>`, кнопка «Назад» [ReportsPage.tsx:68](../../frontend/components/reports/ReportsPage.tsx#L68) → `reports.close()`) або **Адмінпанель** ([app/page.tsx:43](../../frontend/app/page.tsx#L43) → `<AdminPanel/>`, `adminView.close()`), вони закриваються **тільки** через «Назад». Натискання «Новий чат» чи вибір чату з історії **не закриває** ці оверлеї, бо `newSingle/newCompare/pickSingle/pickCompare` ([useChatNav.tsx:72-89](../../frontend/store/useChatNav.tsx#L72)) їх не чіпають.

**Чого хоче власник:** оверлеї (Звіти, Адмін) мають закриватися **тільки** при натисканні **«Новий чат»** (Single або Compare) **або** при виборі **конкретного чату з історії**. Клік по зоні під моделлю/порівнянням або по **картці автора** — **нічого не закриває**. (Кнопку «Назад» лишаємо як є.)

### P2 — після надсилання питання скрол летить у самий низ
[MessageScroll.tsx:68-71](../../frontend/components/chat/MessageScroll.tsx#L68): при новому питанні (`scrollSignal`) завжди `scrollToBottom`. У Compare відповіді йдуть стовпчиком → користувача кидає в кінець останньої відповіді. Незручно (особливо на телефоні).

**Чого хоче власник:** після надсилання скролити так, щоб **блок щойно надісланого питання був прикріплений до ВЕРХУ** видимої області чату, а нижче — список відповідей з першої. Якщо контент не влазить — просто не докручує далі (питання лишається зверху). **Скрізь** (десктоп і телефон).

### P3 — немає памʼяті контексту в межах чату (БЕКЕНД)
Оркестратор шле провайдерам **тільки поточне питання** ([orchestrator_service.py:31-45](../../backend/services/orchestrator_service.py#L31) → `execute_many(message=responder_message)`); Single-шлях так само ([chat.py:294-320](../../backend/routes/chat.py#L294) → `generate_stream(message=responder_message)`). Історія діалогу провайдерам **не передається** («rolling history» [chat.py:163](../../backend/routes/chat.py#L163) — це лише для персоналізації/селектора). Тому 2-е, 3-є… питання відповідаються «з нуля», без памʼяті про попередні.

**Чого хоче власник:** у межах **одного** чату наступні питання мають **враховувати попередні питання й відповіді** (повноцінна памʼять діалогу: на 5-му питанні модель памʼятає 1-ше). При **новому** чаті — порожньо (свіжо).

### P4 — ліміти зникають на телефоні; потрібна кольорова рамка (зел./оранж./черв.) на десктопі ТА телефоні
Пілюля «X/N» — [UsagePill.tsx](../../frontend/components/topbar/UsagePill.tsx). На телефоні ≤430px її **сховано** ([components.css:3744](../../frontend/theme/components.css#L3744) `.cc-usage{display:none}`). Червоний `cc-usage--danger` лише при 0 залишку. Токени `--warning`/`--danger`/`--success` є ([tokens.css:34-37,80-83](../../frontend/theme/tokens.css#L34)).

**Чого хоче власник:**
1. **Повернути** пілюлю «X/N» на телефоні.
2. **Перемикач теми на телефоні** перенести **праворуч від кнопки акаунта** (крайній справа). На десктопі тема лишається на своєму місці (без змін).
3. **Кольорова рамка** — на **обох** (десктоп і телефон), за **відсотком денного залишку** (працює для будь-якого ліміту: 10/20/50/54…):
   - **≥ 70%** залишку → 🟢 зелений (`--success`)
   - **40%–70%** → 🟠 оранжевий (`--warning`)
   - **< 40%** (вкл. 0) → 🔴 червоний (`--danger`)
   - Розрахунок: `pct = remaining_today / max_requests_per_day * 100`.

---

## Залізні правила (override усього)

1. **Не вигадувати стан** — звіряйся з кодом перед кожним твердженням ([docs/08-current-state.md](../08-current-state.md)).
2. **Бекенд чіпаємо ТІЛЬКИ для P3 (контекст діалогу).** **НЕ чіпати:** логіку судді/вибору переможця, безпеку BYOK (D-20/D-21/D-22), квоти/ledger/`usage_events`, ростер провайдерів (groq/mistral/scout), персоналізацію/селектор. **Міграцій БД немає** (історія транзитна, передається в запиті; нічого не зберігаємо понад наявні per-turn повідомлення). **Нових секретів/env немає.**
3. **Десктоп:** P4-кольори застосовуються й на десктопі (свідомо), але **без поломки** десктоп-розкладки; перенесення теми — **тільки телефон** (через CSS `order` у `@media`, JSX не переставляти). P1/P2 десктоп-візуал не ламають.
4. **Frontend golden rules:** без дублювання JSX/стилів/текстів; кольори/відступи — лише через design tokens; тексти лише через `t("key")`; нові ключі — паритет uk/pl/en.
5. **STOP лише якщо вимога суперечить безпеці/рішенням** — інакше вирішуй сам і фіксуй рішення тут.
6. **Не комітити й не деплоїти, доки власник не попросить.**

---

## Що вже є (перевикористати, НЕ переписувати з нуля)

- [store/useChatNav.tsx](../../frontend/store/useChatNav.tsx) — `newSingle/newCompare/pickSingle/pickCompare`; спільний для сайдбару й MobileModeBar. Сюди додаємо закриття оверлеїв (P1).
- [store/ReportsContext.tsx](../../frontend/store/ReportsContext.tsx) (`close()`), [store/AdminViewContext.tsx](../../frontend/store/AdminViewContext.tsx) (`close()`).
- [components/chat/MessageScroll.tsx](../../frontend/components/chat/MessageScroll.tsx) — спільний скрол-контейнер Single+Compare (P2).
- [components/topbar/UsagePill.tsx](../../frontend/components/topbar/UsagePill.tsx), [theme/components.css](../../frontend/theme/components.css) (`.cc-usage*`, мобільний `@media (max-width:768px)` ~3578, ≤430px ~3739), [theme/tokens.css](../../frontend/theme/tokens.css) (`--success/--warning/--danger`) (P4).
- Бекенд (P3): [routes/chat.py](../../backend/routes/chat.py) (Single-шлях `generate()` ~294 + Compare через оркестратор), [services/orchestrator_service.py](../../backend/services/orchestrator_service.py), [services/provider_service.py](../../backend/services/provider_service.py) (`execute_many` ~213, `_safe_generate` ~339, `generate_stream`), [providers/openai_compatible.py](../../backend/providers/openai_compatible.py) (`generate`/`generate_full`/`generate_stream`).
- Фронт-надсилання: [services/chatApi.ts](../../frontend/services/chatApi.ts) (`/chat/stream`, Single), [services/compareApi.ts](../../frontend/services/compareApi.ts) (`/chat`, Compare).

---

## Кроки

### M1 — P1: закривати Звіти/Адмін через «Новий чат» і вибір історії
**Мета:** відкривши Звіти або Адмін, користувач повертається в чат, **тільки** натиснувши «Новий чат» (Single/Compare) або обравши чат з історії. Клік по картці автора / зоні чату — **нічого не закриває**.
**Файли:** `frontend/store/useChatNav.tsx` (за потреби — прокинути `close` з контекстів).
- [x] У `useChatNav` під'єднати `useReports()` і `useAdminView()`; у **всіх чотирьох** `newSingle/newCompare/pickSingle/pickCompare` на початку викликати `reports.close()` + `adminView.close()` (ідемпотентно — якщо вже закрито, нічого не стається).
- [x] Переконатися, що закриття **не** чіпляється до жодних інших обробників (картка автора, зона під моделлю/порівнянням) — лише до цих 4 функцій.
- **Gate:** `tsc`+`eslint`+`prettier`+`vitest` зелено. Вручну: відкрив Звіти → «Новий чат» (Single і Compare) → повернувся в чат; відкрив Адмін → клік на конкретний чат з історії → відкрився той чат; клік по **картці автора** і по зоні чату при відкритих Звітах/Адміні → **нічого не закривається**. Десктоп і телефон.

### M2 — P2: після надсилання прикріплювати питання до ВЕРХУ (скрізь)
**Мета:** після надсилання щойно надіслане питання — вгорі видимої області, відповіді нижче з першої; довгі відповіді не «висмикують» питання вниз.
**Файли:** `frontend/components/chat/MessageScroll.tsx` (+ ChatPage/ComparePage — дати якір на останнє питання).
- [x] Замість `scrollToBottom` на `scrollSignal` — скролити **останнє питання користувача до верху** `.msgs`. Реалізовано **повністю в MessageScroll** через селектор `.msg-user` (його рендерять і Single, і Compare через `MessageBubble role="user"`), тож ChatPage/ComparePage **не чіпав** (DRY). Якоримо за **ідентичністю елемента** (новий vs попередній) — так розрізняємо щойно надіслане питання: Single комітить його в тому ж батчі (layout-ефект якорить одразу), Compare — після мережі (MutationObserver якорить, коли зʼявилось).
- [x] Зберегти «липне до низу лише якщо вже внизу»: після якоря `atBottomRef=false`, тож стрім не висмикує питання; кнопка `scroll-bottom` працює (scrollToBottom незмінний).
- **Gate:** `tsc`+`eslint`+`prettier`+`vitest` зелено. Вручну (Single і Compare; десктоп і телефон 360/390/430px): надсилаєш питання → **питання зверху**, відповіді під ним з першої; під час стрімінгу питання не зникає вгору; «scroll to bottom» працює.

### M3 — P4: мобільні ліміти + перенесення теми + триколірна рамка (десктоп і телефон)
**Мета:** пілюля «X/N» видима й на телефоні; на телефоні тема — праворуч від акаунта; рамка пілюлі зелена/оранжева/червона за відсотком денного залишку — на обох платформах.
**Файли:** `frontend/components/topbar/UsagePill.tsx`, `frontend/theme/components.css`, за потреби `frontend/theme/tokens.css`.
- [x] **Логіка кольору** (UsagePill): `pct = (remaining_today / max_requests_per_day) * 100` із захистом `perDay != null && perDay > 0`. Класи: `≥70`→`cc-usage--good`, `40–70`→`cc-usage--warn`, `<40`→`cc-usage--danger`. Фолбек `exhausted→danger`, коли денного ліміту немає (хвилинний-only). Число пілюлі — за наявною логікою. `cc-usage--ok` не чіпав. className зібрано через масив+filter(Boolean).join.
- [x] **CSS кольорів:** додано `.cc-usage--good`/`.cc-usage--warn` (текст/рамка/фон через `--success`/`--warning`/нові `--success-surface`/`--warning-surface` з паритетом light/dark у tokens.css); без хардкоду.
- [x] **Телефон — показати пілюлю:** у ≤430px замінив `.cc-usage{display:none}` на `padding:0 9px` (видима + компактніша, щоб кластер вліз у 360px).
- [x] **Телефон — тема праворуч від акаунта:** у `@media (max-width:768px)` додано `.cc-theme{order:1}` (решта `order:0` → тема крайня справа після акаунта). JSX не переставляв → десктоп без змін.
- **Gate:** `tsc`+`eslint`+`prettier`+`vitest` зелено. Вручну: на телефоні видно «X/N»; тема — крайня справа, праворуч від акаунта; рамка змінює колір зел.→оранж.→черв. при зменшенні денного залишку (перевірити на користувачі з різним `max_per_day`, напр. 10 і 50). Десктоп: тема на місці, рамка теж кольорова, розкладка ціла.

### M4 — P3: памʼять контексту діалогу в межах чату (БЕКЕНД + фронт)
**Мета:** у межах одного чату моделі бачать попередні ходи (user+assistant) і тримають тему; новий чат = порожній контекст.

**Дизайн (ухвалено власником/архітектором):**
- **Джерело історії — фронт надсилає** масив `history: [{role:"user"|"assistant", content:string}, …]` разом із повідомленням (фронт уже має ходи в стані; не залежимо від збереження; працює і для Single, і для Compare).
- **Хід асистента в Compare** = **обрана суддею/найкраща** відповідь того ходу (та, що бачив користувач як переможця). Single = відповідь моделі.
- **Ліміт контексту:** останні **N = 10 ходів**; на бекенді **клампити** (відкинути зайве, обрізати кожне повідомлення до `MAX_MESSAGE_LENGTH`) — захист токен-бюджету.
- **Обгортки:** RAG-augmentation і language-directive застосовуються **лише до поточного** питання (`responder_message`); історія йде окремо, неперероблена.
- **Суддя — без змін** (оцінює поточне питання + кандидатів; історію не отримує).

- [x] **Схема запиту:** додано `ChatTurn{role: Literal["user","assistant"], content}` + `history: list[ChatTurn] = []` (Field max_length=100 як DoS-guard) у `ChatRequest` (спільна для `/chat` і `/chat/stream`).
- [x] **Провайдери** (openai_compatible.py): `generate`/`generate_full`/`generate_stream` приймають `history`; спільний `_build_messages` → `[*history, {"role":"user","content":message}]`. Контракт оновлено й у `base_provider.py` (abstract + дефолтний generate_full) — інакше тест-фейки на базі падали.
- [x] **provider_service** (`execute_many`/`_safe_generate`/`generate_stream`): `history` прокинуто до кожного провайдера.
- [x] **orchestrator_service** (`process_chat`): додано `history`, передано в `execute_many` (raw, без RAG/мови).
- [x] **routes/chat.py:** `_clamp_history()` (останні 10 ходів = 20 повідомлень, обрізка до `max_message_length`); передано в Compare (`process_chat`) і Single (`generate_stream`). Імпорт `get_settings`, `ChatTurn`.
- [x] **Фронт:** спільний util `utils/chatHistory.ts` (`buildChatHistory` + `HISTORY_MAX_TURNS=10`, Compare/Single з `best_response`); тип `ChatTurn` у api.ts; `chatApi.ts`/`compareApi.ts` шлють `history`; ComposerContext (Single, з `activeChat`) і useCompare (Compare, з `activeChat`) збирають історію; новий чат → `[]`.
- [x] **Тести:** BE — `_build_messages` prepend, `execute_many` прокидає history (capturing mock), `_clamp_history` (кламп+обрізка); FE — `buildChatHistory` (Compare→winning, кламп N, skip incomplete, новий чат порожньо). Контракт у docs/03 оновлено.
- **Gate:** BE `pytest` (+ `ruff`/`black`) зелено; FE `tsc`+`vitest`+`eslint`+`prettier` зелено. Вручну: у чаті 1-ше питання → відповідь; 2-ге питання розвиває тему, **не** згадуючи деталей → відповіді враховують 1-ше; новий чат → контекст порожній (тему не памʼятає). Перевірити Single і Compare.

### M5 — Гейти + готовність
- [x] **Frontend** (`cd frontend`): `tsc --noEmit`, `vitest run` (44 тести), `eslint .`, `prettier --check .` — зелено; `npm run build` ок.
- [x] **Backend** (`cd backend`): `pytest` (225 passed) зелено; `ruff check .` + `black --check .` зелено. **Міграцій немає**.
- [x] i18n паритет uk/pl/en — N/A (нових ключів не додавав; P4 на наявних design tokens).
- [ ] Ручний чек-лист (десктоп + телефон 360/390/430px): P1/P2/P3/P4 — потребує ручної перевірки на dev-сервері/девайсі (власник).
- **Gate:** усе зелено; коміт-готовність.

---

## Чого НЕ робимо
- Не чіпаємо суддю/вибір переможця, BYOK-безпеку, квоти/ledger, ростер, персоналізацію/селектор.
- Контекст (P3) — **без БД-міграцій і без збереження понад наявні per-turn повідомлення**; історія транзитна (в запиті).
- Не переставляємо JSX топбару (десктоп лишається), тему на телефоні рухаємо лише CSS-`order`.
- Не вводимо нові залежності, секрети, env.
- Не комітимо й не деплоїмо до прохання власника.

---

## Як виконувати (інструкція для Cloud AI / Claude Code)
1. **Стартова локація:** репозиторій `ai-gateway`. Гейти фронту — у `frontend` (`cd frontend`), бекенду — у `backend` (`cd backend`).
2. **Прочитай спершу:** `CLAUDE.md`, цей план повністю, і для контексту: `docs/08-current-state.md` (PH-секції про чат/оркестратор, топбар/UsagePill, Звіти/Адмін), `docs/03-api-contracts.md` (`/chat`, `/chat/stream`), `docs/10-open-decisions.md` (D-3, D-10, D-13, D-18). Golden rules — у `CLAUDE.md` (п.5).
3. **Працюй атомарно:** M1→M5, по одному кроку → **Gate** → коміт-готовність → познач `[x]` і 1 рядок у журналі → наступний. Не змінюй більше, ніж описано в кроці.
4. **Гейти:** Frontend — `npx tsc --noEmit` · `npx vitest run` · `npx eslint .` · `npx prettier --check .` · `npm run build`. Backend (тільки якщо чіпав, тобто M4) — `pytest` · `ruff`/`black`.
5. **Прогрес — ТІЛЬКИ в цьому файлі** (журнал у кінці + мітки `[x]`).
6. **Не комітити/не деплоїти** до явного прохання власника. Коли попросить — див. «Деплой».
7. **Локальний перегляд:** фронт `cd frontend && npx next dev -p 3000`; бекенд `cd backend && ./venv/bin/python -m uvicorn main:app --port 8000` (dev-БД — SQLite). Перевіряти з телефона по локальному IP або через DevTools device-emulation.

---

## Деплой (щоб оновилося на сервері st.byn.sarl)
> Деплой — **тільки** коли власник попросить. **Нових секретів і міграцій немає.** Цей батч зачіпає й **бекенд** (P3), тож CI пересоберає обидва образи.

CI/CD: **push у `main`** → CI (lint+test) → Deploy (build образів backend+frontend → GHCR → scp compose/nginx → SSH `docker compose pull && up -d`). Прод — `ai.st.byn.sarl`.

Кроки:
1. Гейти M5 зелені локально (фронт + бекенд).
2. Закомітити батч у `main` (приклад):
   ```
   PH40: chat context memory + question-to-top scroll + overlay close on new-chat/history + mobile quota tri-color pill

   - Keep per-chat conversation context: send recent turns (compare → winning
     answer) to responders; new chat stays fresh (backend + FE assembly)
   - Scroll the just-sent question to the top of the feed (single & compare)
   - Close Reports/Admin overlays on New Chat / history pick (author card & chat
     area do nothing)
   - Mobile: show usage pill, move theme toggle right of account; tri-color
     (green/orange/red) usage frame by % of daily quota, desktop + mobile

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```
3. `git push origin main`.
4. **Стежити без `gh`-CLI:** полінг `https://ai.st.byn.sarl` → 200; маркер свіжого фронту — зміна хешу JS/CSS-чанка; бекенд лишається 200 на `/api/providers/info`.
5. **Кеш aaPanel:** наразі кеш сайту **вимкнено вручну в aaPanel** (фікс PH39.x проти міжкористувацького витоку — `x-cache` зник). Ця зміна **не в репозиторії**; якщо хтось увімкне кеш назад — повернеться баг із чужими акаунтами. Стале HTML не очікується.
6. **Перевірка на проді:** P1–P4 за ручним чек-листом M5; контекст діалогу тримається в межах чату.

---

## Журнал виконання (заповнювати під час роботи)

| Крок | Статус | Підсумок (1 рядок) |
|---|---|---|
| M1 P1: close Reports/Admin via New Chat / history pick | ✅ | `leaveOverlays()` (reports.close+adminView.close) на старті 4 nav-функцій у useChatNav; картка автора/зона чату не чіпаються. Гейти tsc/eslint/prettier/vitest зелені. |
| M2 P2: scroll just-sent question to top (everywhere) | ✅ | MessageScroll якорить останнє `.msg-user` до верху за ідентичністю елемента (layout-ефект для Single + MutationObserver для Compare); ChatPage/ComparePage не змінювались (DRY). atBottom=false після якоря → стрім не висмикує. Гейти зелені. |
| M3 P4: mobile usage pill + theme right-of-account + tri-color frame | ✅ | UsagePill: триколір за % денного залишку (good/warn/danger, фолбек на exhausted); нові токени --success/-warning-surface; ≤430px пілюля видима (padding 0 9px); ≤768px `.cc-theme{order:1}` (тема справа від акаунта, JSX без змін). Гейти tsc/eslint/prettier/vitest зелені. |
| M4 P3: per-chat conversation context (backend + FE) | ✅ | Транзитна history: ChatRequest.history → _clamp_history (10 ходів, обрізка) → orchestrator/provider_service → openai_compatible._build_messages (prepend); base_provider контракт оновлено. FE: спільний buildChatHistory (Single+Compare, best_response), chatApi/compareApi шлють history, ComposerContext/useCompare збирають з activeChat. Суддя/квоти/міграції не чіпались. BE pytest 225 + ruff/black зелено; FE tsc/eslint/prettier/vitest(44) зелено. |
| M5 gates (FE + BE) | ✅ | FE: tsc + vitest(44) + eslint + prettier + `npm run build` зелено. BE: pytest(225) + ruff + black зелено. Міграцій/нових env немає; нових i18n-ключів немає. Лишився ручний чек-лист на девайсі (власник). Готово до коміту за проханням. |
