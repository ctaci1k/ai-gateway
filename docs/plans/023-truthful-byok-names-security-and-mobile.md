---
plan: 023-truthful-byok-names-security-and-mobile
status: done
updated: 2026-05-31
---

# PH23 — Правдиві назви BYOK · очищення ключів при виході · мобільна версія + згортання сайдбара

> Партія: (A) правдиві назви BYOK-моделей і судді скрізь; (B) очищення BYOK-ключів
> при logout/login (безпека); (C) єдина система статус-індикаторів; (D) згортання
> сайдбара (desktop рейл + mobile шухляда, ChatGPT-стиль); (E) повний responsive;
> (F) доки + гейти + деплой. Enterprise: без заглушок/TODO/напівфіч. Кроки атомарні,
> гейти після кожного. Коміт/пуш — у фіналі (деплой автоматичний з push origin main).

## Ухвалені рішення власника (2026-05-31)
- **Згортання сайдбара — і на компʼютері, і на телефоні** (як ChatGPT): desktop —
  кнопка згортає у вузький рейл з іконками/квадратиками; mobile — бургер + висувна
  шухляда поверх контенту з backdrop.
- **Кольорові квадратики — ЛИШЕ коли згорнуто.** Розгорнуто — повні банери/картки.
- **Автор:** розгорнуто — «Stanislav Byndas»; згорнуто — квадратик «SB».
- **Статуси — єдина система** (один store/util): повні банери у розгорнутому,
  компактні квадратики у згорнутому, без дублювання логіки.
- Квадратики (згорнуто): обмежений акаунт = **червоний**; частковий набір ключів
  (Compare, не всі свої) = **червоний** (окремий); свій ключ (Single connected /
  Compare всі свої) = **зелений**; BYOK-кнопка = квадратик «**API**»; мова —
  **ховається** у згорнутому. Кожен квадратик має tooltip + `aria-label`.

## Контекст із коду (ground truth, звірено 2026-05-31)
- **Compare-назва BYOK-слота:** `components/compare/CompareColumn.tsx:40` —
  `name = RESPONDER_LABELS[provider] ?? model ?? provider` → для **перевизначеного**
  дефолтного слота (напр. `sambanova`) показує реєстрову «DeepSeek V3.1», а не
  введений `model_id`. Треба показувати `useKeys().byokModelId(provider)` коли слот
  на своєму ключі (як `CompareFailedCard.tsx:28`). `CompareTurn.tsx` передає
  `provider`/`model` у колонки.
- **Назва судді — хардкод у топбарі:** `components/chat/TopbarModeContext.tsx:33`
  бере **FE-константу** `JUDGE_MODEL` (`utils/judge.ts`, =`qwen/qwen3-32b`) і не
  реагує на BYOK-суддю. Треба: коли активний BYOK-суддя — показувати
  `byokModelId(JUDGE_SLOT)`. SelectorBanner/ManualSelectionButton беруть **реальний**
  `selector_metadata.selector_model` (бекенд репортить BYOK-суддю) — там ОК, лише
  звірити. Інші хардкоди `Qwen`/`JUDGE_MODEL` — проаудитити (`grep`).
- **Logout не чистить ключі:** `store/AuthContext.tsx::logout` = `logoutRequest()` +
  `setUser(null)`; `sessionStorage` (`byok-keys-v1`) не чіпається; `KeysContext` не
  реагує на зміну юзера → у тій самій вкладці чужий акаунт успадковує ключі (діра).
  **`KeysProvider` вкладений у `AuthProvider`** (`app/layout.tsx:47-48`) → може читати
  `useAuth()` і скидатись на зміну user.id.
- **Статус-компоненти:** `components/keys/KeysStatusBanner.tsx` (зелена/червона плашка
  BYOK) + `components/account/LimitBanner.tsx` (банер лімітів). Рендеряться в
  `components/sidebar/Sidebar.tsx` (`.sidebar`, фіксована ширина `--sidebar-width`).
- **Банер лімітів вилазить:** `.limit-reset { white-space: nowrap }`
  (`theme/components.css` ~ряд 1255) → довгий «скидування о 00 за польським часом»
  не переноситься. Треба дозволити перенос (прибрати nowrap / wrap донизу).
- **Адаптиву немає:** єдиний media-query `@media (max-width:1180px)` (modal-grid).
  `.app { display:flex; width:100vw; height:100vh }`, сайдбар фіксований; Compare —
  `grid-template-columns: repeat(3,1fr)` без рефлоу; немає бургера/шухляди.
- **Картка автора:** `components/sidebar/AuthorCard.tsx` (`author.cap`/`author.name`/
  `author.tagline`). **Профіль:** `ProfileCard.tsx` (іконка + ім'я + «Вийти»).
- Стан — через `store/`; тексти — `t()`; кольори/відступи — токени `theme/`.

---

## Кроки (атомарні; гейти FE після кожного: tsc/eslint/prettier/vitest/build; i18n паритет)

### Блок A — правдиві назви BYOK скрізь
- [x] **A1. Compare-картка показує BYOK model_id.** `CompareColumn` бере
  `useKeys().byokModelId(provider) ?? RESPONDER_LABELS[provider] ?? model ?? provider`
  для назви (як `CompareFailedCard`). Перевірити `CompareTurn` (передача props) і що
  `model_id` нижче (`.rcard-model`) лишається. Гейти FE.
- [x] **A2. Назва судді відображає BYOK скрізь.** `TopbarModeContext` показує
  `byokModelId(JUDGE_SLOT) ?? judgeModelName(JUDGE_MODEL)`. Проаудитити `grep`
  «JUDGE_MODEL»/«Qwen»/judgeModelName: усюди, де суддя статичний, врахувати активний
  BYOK-суддя. SelectorBanner/ManualSelectionButton — звірити (мають бути на реальному
  `selector_metadata`). Гейти FE.

### Блок B — безпека: очищення ключів при logout/login
- [x] **B1. `KeysContext` скидається на зміну користувача.** Додати `clearKeys()`
  (скидає стан у дефолт + `sessionStorage.removeItem("byok-keys-v1")`). `KeysProvider`
  читає `useAuth().user?.id`; коли id змінюється (logout → null, або інший user) —
  викликає `clearKeys()` (через відстеження попереднього id, без setState-in-effect
  пастки). Гарантує: новий/інший акаунт **ніколи** не успадковує чужі ключі. Гейти FE
  (+ за потреби тест на скидання).

### Блок C — згортання сайдбара (інфраструктура) + мобільна шухляда
- [x] **C1. Store згортання.** Новий `store/SidebarContext` (або розширити наявний):
  `collapsed` (desktop, персист `localStorage`), `mobileOpen` (ефемерний). Дії:
  `toggleCollapsed`, `openMobile`, `closeMobile`. SSR-safe гідрація (як LanguageContext).
- [x] **C2. Desktop: кнопка згортання + вузький рейл.** Кнопка-тогл (іконка, `t()`
  aria) у сайдбарі/топбарі; `.sidebar--collapsed` → вузька ширина (токен
  `--sidebar-width-collapsed`), контент у компактному вигляді. Плавна анімація
  (token-driven). Стан `collapsed` з C1.
- [x] **C3. Mobile: бургер + висувна шухляда.** На вузьких екранах сайдбар прихований;
  бургер у топбарі (`MainLayout`) відкриває шухляду поверх контенту + `backdrop`
  (клік/Esc закриває; focus-trap; `aria-modal`). Закриття після вибору пункту.
  Тексти/іконки — `t()`/icon-set; без дублювання з desktop-рейлом.

### Блок D — єдина система статус-індикаторів (банери / квадратики)
- [x] **D1. Єдине джерело статусів.** `store`/`util` що обчислює стан з наявних
  контекстів (Keys/Auth/ChatMode/Composer): `limitedAccount`, `partialKeys`,
  `ownKey` (single connected / compare all-own). Без дублювання логіки з нинішніх
  `KeysStatusBanner`/`LimitBanner` (рефакторити їх на це джерело).
- [x] **D2. Рендер за станом сайдбара.** Розгорнуто — повні банери (як зараз, але з
  єдиного джерела). Згорнуто — **компактні квадратики**: обмежений акаунт = червоний,
  частковий набір = червоний (окремий), свій ключ = зелений; кожен із tooltip +
  `aria-label` (i18n). Кольори — лише токени (`--danger`, `--ok`/green token).
- [x] **D3. Автор, BYOK, мова у згорнутому.** Автор: розгорнуто «Stanislav Byndas»,
  згорнуто квадратик «SB». BYOK-кнопка: згорнуто квадратик «API» (відкриває те саме
  вікно ключів). Мова (`LanguageSwitcher`): **ховається** у згорнутому. ProfileCard/
  ChatList — компактний вигляд у рейлі (іконки/обрізка). Без дублювання JSX (спільні
  презентаційні частини).
- [x] **D4. Банер лімітів не вилазить.** Прибрати `white-space:nowrap` з `.limit-reset`
  (дозволити перенос донизу); звірити всі 3 мови (uk/pl/en) у вузькому сайдбарі й на
  телефоні — нічого не виходить за межі.

### Блок E — повний responsive
- [x] **E1. Брейкпоінти телефону.** Додати media-queries (≈768/640/430px) у
  `theme/components.css`: топбар (бургер, компактні відступи/шрифти), `.app` (шухляда
  замість фіксованого сайдбара), модалки (`keys-dialog`, admin) на всю ширину,
  банери. Перевірити 360/390/430px.
- [x] **E2. Compare reflow.** `.responses`/`repeat(3,1fr)` → на вузьких екранах
  **1 колонка** (стек), картки на всю ширину, скрол `.msgs` як стрічка. Композер,
  заголовки, бейджі — адаптивні. Без горизонтального оверфлоу.
- [x] **E3. viewport + дрібниці.** Переконатись, що `app/layout.tsx` має коректний
  `viewport` (Next default або явний `width=device-width, initial-scale=1`). A11y:
  таргети ≥44px, фокус видимий. Прогнати всі FE-гейти.

### Блок F — доки + гейти + деплой
- [x] **F1. Доки.** `docs/06-frontend-architecture.md` (адаптив, згортання, статус-
  система), `docs/08-current-state.md` (секція PH23), `docs/10-open-decisions.md` (D-16).
  `status: done`, усі `[x]`, «СТАН» актуальний.
- [x] **F2. Деплой.** Коміт + `git push origin main` (тригерить CI → Docker → деплой).
  Перевірити GitHub Actions (зелений CI + Deploy) і `curl -s -o /dev/null -w "%{http_code}"
  https://st.byn.sarl/` = 200. Бекенд НЕ змінюється — перезапуск не потрібен (але якщо
  щось бекендне додасться — `docker compose -f docker-compose.prod.yml --env-file
  .env.production restart backend` на сервері, виконує власник).

---

## Перевірка (Definition of Done)
- [x] У Compare перевизначений дефолтний слот показує введений `model_id`, не «DeepSeek».
- [x] Назва судді скрізь (топбар + банери) = реальний BYOK-суддя, коли він активний;
      інакше — дефолтний (Qwen). Жодного хардкоду, що ігнорує BYOK.
- [x] Logout/зміна акаунта в тій самій вкладці **очищає** BYOK-ключі (новий акаунт — без чужих).
- [x] Сайдбар згортається на компʼютері (рейл з квадратиками) і має бургер-шухляду на телефоні.
- [x] Квадратики лише у згорнутому: обмежений=червоний, частковий=червоний, свій=зелений,
      «SB», «API»; мова прихована; tooltip+aria; кольори через токени.
- [x] Банер лімітів не вилазить за сайдбар у жодній мові (uk/pl/en), переноситься донизу.
- [x] Телефон (360/390/430px): немає горизонтального скролу; Compare у 1 колонку; модалки
      на всю ширину; топбар/композер/банери адаптивні; таргети ≥44px.
- [x] Зелено FE (tsc/eslint/prettier/vitest/build); i18n паритет uk/pl/en; docs (06/08[/05])
      оновлені; задеплоєно (CI+Deploy зелені, сайт 200).
- [ ] Golden rules: без дублювання JSX/стилів/кольорів/текстів; тексти `t()`; без `fetch`
      у компонентах; кольори/відступи — токени; стан — store/; стани UI loading/empty/error;
      a11y (focus-trap шухляди, aria, Esc); секрети не логуються.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **D4** — блоки C+D зроблені (взаємозалежні: сайдбар-рендер+CSS,
  один гейт у кінці, усе зелене). C1: `store/SidebarContext` (collapsed персист localStorage +
  mobileOpen ефемерний, SSR-safe). C2: `SidebarToggle` (desktop колапс / mobile close) + рейл
  через CSS у `@media(min-width:769px)` (ховає текст, показує `.rail-only`), токен
  `--sidebar-width-collapsed`. C3: бургер у `MainLayout` + drawer `@media(max-width:768px)` +
  backdrop, focus-trap (видимі focusables), Esc, close-on-nav (mode/chat/admin). D1:
  `store/sidebarStatus.ts::useSidebarStatus` — єдине джерело; `KeysStatusBanner`/`LimitBanner`
  рефакторено на нього. D2: `StatusSquares`+`SidebarSquare` (червоний обмежений/частковий,
  зелений свій; tooltip+aria, токени). D3: «SB»/«API» квадратики, мова `.sb-lang` ховається.
  D4: `.limit-reset` без nowrap (перенос донизу). i18n +11 ключів × uk/pl/en (паритет ок).
  Блок E зроблено: mobile-діалоги на всю ширину (bottom-sheet), 44px-таргети, явний viewport,
  Compare 1 колонка (`.modal-grid`), `overflow-wrap:anywhere` для довгих BYOK-`model_id`,
  focus-visible-кільця. Блок F1: docs 06/08/10 оновлені, `status: done`. Усі гейти зелені (FE
  tsc/eslint/prettier/vitest 22/build), i18n паритет uk/pl/en.
  **F2 — задеплоєно:** коміт `2bb2447` на main; CI **success**, Deploy **success**;
  сайт https://st.byn.sarl/ = **200** до/під час/після деплою. Бекенд не змінювався.
- Наступний крок: **— план завершено (усі кроки [x], status: done, задеплоєно).**
- Заблоковано: **ні**.
- Змінені файли (накопич.): CompareColumn, TopbarModeContext, KeysContext(+test),
  store/SidebarContext, store/sidebarStatus, components/sidebar/{Sidebar,SidebarToggle,SidebarSquare,
  StatusSquares,LanguageSwitcher}, components/keys/KeysStatusBanner, components/account/LimitBanner,
  layouts/MainLayout, app/layout, components/icons/Icons, theme/{tokens,components}.css, i18n×3.
- Відкриті питання/рішення: немає (4 рішення власника зафіксовані вище).
