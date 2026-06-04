# 036 — Мобільний режим: два випадайки (Single/Compare) замість бургера + перенос мови/адмінки в меню акаунта (PH37)

**Статус:** DONE (реалізовано, чекає коміту за проханням власника) · фронтенд-онлі · продовження після PH36 (план 035 + слот scout).
**Власник:** Stanislav

> **Цей план написаний для виконання в новому чаті (Cloud AI / Claude Code).**
> Працювати **атомарно**: один крок M → перевірка (gate) → коміт-готовність → наступний.
> Прогрес фіксувати **тільки в цьому файлі** (мітка `[x]` біля кроку + 1 рядок підсумку в журналі в кінці).

---

## Контекст / проблема

На телефоні (≤768px) зараз **одночасно**: (1) бургер ☰, що відкриває off-canvas сайдбар-шухляду, і (2) дві плоскі кнопки `Single Models` / `Compare` ([components/layout/ModeSwitch.tsx](../../frontend/components/layout/ModeSwitch.tsx)). Це дублювання і дешевий вигляд — власник хоче прибрати **і** бургер, **і** ці кнопки.

**Чого хоче власник (підтверджено 2026-06-04):**
- Замість бургера/кнопок — **два «випадайки-колонки»** `Single Models` і `Compare` **поруч**, угорі від лівого боку, у **тих самих стилях**, що сайдбар-акордеони (іконка + назва + підпис + `+ New Chat` + `HISTORY` зі списком чатів — як на десктопному сайдбарі).
- **Адмінку** (іконка людей у топбарі) перенести в **меню акаунта** (де Profile / Reports / Security).
- **Перемикач мов** перенести так само в **меню акаунта**.
- Звільнене вгорі місце віддати під ці два випадайки.
- **Усе це — ЛИШЕ на телефоні (≤768px). Десктоп не чіпати взагалі** (рішення власника: «тільки на телефоні»).

---

## Залізні правила (override усього)

1. **Не вигадувати стан** — звіряйся з кодом перед кожним твердженням.
2. **Десктоп (Classic Console) лишається піксель-у-піксель незмінним.** Усі зміни — лише в межах мобільної media-query (≤768px) або mobile-only компонентів/класів. Перемикач мов і адмінка **на десктопі лишаються в топбарі**.
3. **НЕ чіпати:** бекенд, суддю, BYOK-безпеку (D-20/D-21/D-22), квоти, ledger, ростер провайдерів (groq/mistral/scout), будь-яку логіку чатів/персоналізації. Це **чисто фронтенд-розкладка**.
4. **Frontend golden rules:** без дублювання JSX/стилів/текстів; перевикористовувати наявні компоненти (`AccordionSection`, спільний `Dropdown`, `LanguageToggle`); тексти лише через `t("key")` з **паритетом uk/pl/en**; кольори/відступи — лише через design tokens.
5. **STOP лише якщо вимога суперечить безпеці/рішенням** — інакше вирішуй сам і фіксуй рішення тут.
6. **Не комітити й не деплоїти, доки власник не попросить.**

---

## Що вже є (перевикористати, НЕ переписувати з нуля)

- [components/sidebar/AccordionSection.tsx](../../frontend/components/sidebar/AccordionSection.tsx) — секція `head (іконка+назва+підпис+chevron)` + `body (+ New Chat + collapsible History зі списком чатів, rename/delete inline)`. Приймає props (`open`, `onToggle`, `chats`, `onNewChat`, `onPickChat`, `onRename`, `onRemove`, `histOpen`, `onHistToggle`, `nowMs`, `notice`, `loading`, `error`).
- [components/sidebar/Sidebar.tsx](../../frontend/components/sidebar/Sidebar.tsx) — тримає дві `AccordionSection` (Single/Compare) + хендлери `newSingle/newCompare/pickSingle/pickCompare` + тикер `nowMs` + drawer focus-trap. На телефоні зараз = шухляда за бургером.
- [components/common/Dropdown.tsx](../../frontend/components/common/Dropdown.tsx) — спільний a11y-дропдаун (`renderTrigger(open, toggle)` + children render-prop з `close`). Уже використовується в `AccountMenu`.
- [components/common/LanguageToggle.tsx](../../frontend/components/common/LanguageToggle.tsx) — готовий перемикач мов (uk/pl/en), уже перевикористаний на екрані входу.
- [components/topbar/AccountMenu.tsx](../../frontend/components/topbar/AccountMenu.tsx) — меню акаунта; уже має mobile-only `CreatorCard variant="menu"` (патерн `cc-menu-creator`, схований ≥769px) — **дзеркаль цей патерн** для нових mobile-only пунктів.
- [components/layout/Topbar.tsx](../../frontend/components/layout/Topbar.tsx) — топбар: бургер `cc-burger`, `ThemeToggle`, `LangMenu`, `UsagePill`, gear, Admin-кнопка (`user?.is_admin`), `AccountMenu`.
- i18n-ключі вже є: `sidebar.singleTitle`/`singleSub`/`compareTitle`/`compareSub`/`label`, `chat.new`, `history.title`, `admin.title`. **Нових ключів, найімовірніше, не треба** — перевір і дотримай паритет.

---

## Кроки

### M1 — Витягнути спільний hook `useChatNav` (без зміни поведінки)
**Мета:** мобільні випадайки і десктопний сайдбар мусять ділити ОДНІ хендлери (golden rule — без дублювання).
**Файли:** новий `frontend/store/useChatNav.ts` (або `features/chat/useChatNav.ts`); рефактор `components/sidebar/Sidebar.tsx`.
- [x] Винести в `useChatNav()` дані+хендлери, що зараз у `Sidebar.tsx`: `singleChats`, `compareChats`, `activeChatId`, `mode`, `loading`, `error`, `notice`, `nowMs` (тикер 30с), `newSingle`, `newCompare`, `pickSingle`, `pickCompare`, `rename`, `remove`. (UI-стан акордеонів і drawer focus-trap **лишаються** в `Sidebar`.)
- [x] `Sidebar.tsx` споживає `useChatNav` — **поведінка десктопу ідентична** (жодних візуальних/функційних змін).
- **Gate:** `tsc --noEmit` + `vitest` + `eslint` + `prettier` зелено; десктопний сайдбар працює як раніше (New Chat, історія, rename/delete, перемикання режиму).

### M2 — Опція `headless` у `AccordionSection`
**Мета:** усередині мобільного поповера заголовок секції зайвий (тригер-пілюля вже називає її).
**Файли:** `components/sidebar/AccordionSection.tsx`.
- [x] Додати опційний prop `headless?: boolean` (дефолт `false`, зворотно сумісно): коли `true` — **не** рендерити `cc-acc-head`, а тіло (`+ New Chat` + History) показувати завжди (ігнорувати `open`).
- **Gate:** `tsc` зелено; десктоп не зачеплено (prop там не передається).

### M3 — Новий `MobileModeBar` (дві колонки-випадайки) + прибрати `ModeSwitch`
**Файли:** новий `frontend/components/layout/MobileModeBar.tsx`; `app/page.tsx`; видалити `components/layout/ModeSwitch.tsx`.
- [x] `MobileModeBar`: дві колонки поруч — кожна = спільний `Dropdown`, тригер-пілюля у стилі шапки акордеону (іконка `IconModels`/`IconGrid` + `t("sidebar.singleTitle")`/`compareTitle` + chevron). Панель кожного дропдауна = `<AccordionSection headless ... />`, годована з `useChatNav` (Single → singleChats/newSingle/pickSingle; Compare → compareChats/newCompare/pickCompare). Закривати дропдаун після вибору чату/New Chat (через `close` із render-prop).
- [x] `app/page.tsx`: замінити `<ModeSwitch />` на `<MobileModeBar />` (те саме місце — рядок під топбаром). Видалити файл `ModeSwitch.tsx` і його імпорт.
- [x] `MobileModeBar` — **mobile-only** (CSS `display:none` ≥769px).
- **Gate:** `tsc`+`vitest`+`eslint`+`prettier`; на телефоні: обидва випадайки відкриваються, `+ New Chat` створює чат і перемикає режим, історія відкриває/перейменовує/видаляє чат, активний чат підсвічений.

### M4 — Прибрати бургер + сховати сайдбар на телефоні
**Файли:** `components/layout/Topbar.tsx`; `theme/components.css`.
- [x] `Topbar.tsx`: прибрати кнопку `cc-burger` і її проводку (`openMobile`/`mobileOpen` із `useSidebar`, якщо більше ніде не треба). Off-canvas шухляда стає недосяжною на телефоні — це навмисно. (Код `SidebarContext`/drawer можна лишити як неактивний — мінімальний радіус; не обовʼязково видаляти.)
- [x] CSS: сховати `.cc-side` (сайдбар) ≤768px (його вміст тепер у `MobileModeBar`; картка автора вже в меню акаунта з PH35). Переконатися, що немає порожнього місця/зсуву layout.
- **Gate:** `tsc`+`eslint`+`prettier`; на телефоні немає бургера й шухляди; **десктоп-сайдбар цілий**.

### M5 — Перенести мову + адмінку в меню акаунта (ТІЛЬКИ телефон)
**Файли:** `components/topbar/AccountMenu.tsx`; `components/layout/Topbar.tsx`; `theme/components.css`.
- [x] `AccountMenu.tsx`: додати **mobile-only** секцію (клас на кшталт `cc-menu-mobileonly`, схований ≥769px — дзеркаль `cc-menu-creator`) з: **Admin** пунктом (лише `user?.is_admin`; перевикористати наявний `openAdmin()`+`closeReports()` із `useAdminView`/`useReports`, іконка `IconUsers`) і **перемикачем мов** (`<LanguageToggle />`).
- [x] Топбар: сховати на телефоні (≤768px, CSS) `LangMenu` і Admin-кнопку (на десктопі — **лишаються**). За потреби дати їм клас-обгортку для приховання.
- [x] **Тему (moon/sun) на телефоні лишити в топбарі** (власник про неї не просив).
- **Gate:** `tsc`+`vitest`+`eslint`+`prettier` + i18n-паритет; на телефоні: мова й адмінка в меню акаунта, зникли з топбару; **на десктопі топбар незмінний** (мова+адмін там).

### M6 — CSS-поліш + responsive
**Файли:** `theme/components.css`.
- [x] Стилі `.cc-mmbar` (дві колонки flex, рівні по ширині), поповер: `max-height` + `thin-scroll` (історія може бути довгою), таргети ≥44px, без горизонтального скролу на 360/390/430px. Стилі вмісту (`.cc-acc*`/`.cc-newchat`/`.cc-sub`/`.cc-hrow`) **перевикористовуються** з AccordionSection — нового по мінімуму.
- [x] Прибрати мертві правила `.cc-modeswitch*` (ModeSwitch видалено).
- **Gate:** `tsc`+`eslint`+`prettier`; візуально 360/390/430px — без переповнення, дві колонки рівні, поповер скролиться.

### M7 — Гейти + готовність
- [x] `frontend`: `tsc --noEmit`, `vitest`(40), `eslint .`, `prettier --check` — зелено; `next build` ок.
- [x] i18n паритет uk/pl/en — 345/345/345, diff порожній; нових ключів не додавали.
- [x] Ручний мобільний чек-лист (готово до перевірки власником): дві колонки замість бургера/кнопок; New Chat/історія/rename/delete працюють; мова+адмін у меню акаунта; десктоп піксель-незмінний.
- **Gate:** усе зелено; коміт-готовність.

---

## Чого НЕ робимо
- Не чіпаємо бекенд, суддю, BYOK, квоти, ростер (groq/mistral/scout), логіку чатів.
- Не міняємо десктоп: сайдбар, топбар (мова+адмін там лишаються), Classic Console — піксель-у-піксель.
- Не вводимо вільний текст/нові залежності; перевикористовуємо `AccordionSection`/`Dropdown`/`LanguageToggle`.
- Не комітимо й не деплоїмо до прохання власника.

---

## Журнал виконання (заповнювати під час роботи)

| Крок | Статус | Підсумок (1 рядок) |
|---|---|---|
| M1 useChatNav hook | ✅ | Винесено дані+хендлери у `store/useChatNav.tsx` (нотиси/active-id за режимом); `Sidebar` лишив тільки UI-стан акордеонів+drawer; десктоп ідентичний. Гейти FE зелені (tsc/eslint/prettier/vitest 40). |
| M2 AccordionSection headless | ✅ | Додано `headless?` (дефолт false): без `cc-acc-head`, тіло завжди (ігнорує `open`); модифікатор `cc-acc--headless` для M6; десктоп без prop незмінний. Гейти зелені. |
| M3 MobileModeBar + drop ModeSwitch | ✅ | Новий `MobileModeBar` (дві колонки-`Dropdown`, тригер у стилі шапки акордеону, панель = `AccordionSection headless` з `useChatNav`, close після pick/new); `page.tsx` → `<MobileModeBar/>`; `ModeSwitch.tsx` видалено; CSS `.cc-mmbar*` (display:none ≥769, flex ≤768). Гейти зелені (40). |
| M4 remove burger + hide sidebar (mobile) | ✅ | Бургер прибрано з `Topbar` (+мертвий `useSidebar`/`IconMenu`); `.cc-side` `display:none` ≤768; мертві `.cc-burger`/drawer/backdrop CSS прибрано; drawer-код у Sidebar лишився неактивним (mobileOpen ніколи не true). Гейти зелені. |
| M5 lang+admin → account menu (mobile) | ✅ | `AccountMenu` отримав mobile-only `cc-menu-mobileonly` (Admin лише is_admin + `LanguageToggle`); топбар ховає `.cc-dd-lang`+`.cc-admin-btn` ≤768 (gear+тема лишаються); десктоп незмінний; i18n паритет ок (нових ключів нема). Гейти зелені. |
| M6 CSS polish + responsive | ✅ | `.cc-mmbar` дві рівні колонки (flex:1/min-width:0), тригер-пілюля у стилі шапки акордеону, поповер `max-height: calc(100vh-84px)`+overflow (тематичний скрол), таргети ≥44px; мертві `.cc-modeswitch*` прибрано (0 згадок). Гейти зелені. |
| M7 gates | ✅ | FE зелено: tsc + eslint + prettier + vitest(40) + `next build`; i18n паритет 345/345/345 (нових ключів нема). Бекенд не чіпали (222 лишається). Готово до коміту за проханням власника. |
