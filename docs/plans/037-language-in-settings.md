# 037 — Перемикач мов → третя секція в Налаштуваннях (PH38)

**Статус:** DONE (код, M1–M7 гейти зелено) · чекає коміт/деплой за проханням власника · фронтенд-онлі · продовження після PH37 (мобільні випадайки в топбарі).
**Власник:** Stanislav

> **Цей план написаний для виконання в новому чаті (Cloud AI / Claude Code).**
> Працювати **атомарно**: один крок M → перевірка (gate) → коміт-готовність → наступний.
> Прогрес фіксувати **тільки в цьому файлі** (мітка `[x]` біля кроку + 1 рядок підсумку в журналі в кінці).

---

## Контекст / проблема

Перемикач мов зараз виглядає негарно **і на компʼютері, і на телефоні**:
- **Десктоп:** топбар має `LangMenu` — пілюлю з прапором + chevron ([components/topbar/LangMenu.tsx](../../frontend/components/topbar/LangMenu.tsx)).
- **Телефон (≤768px, PH37):** прапор-пілюля прибрана з топбару, а замість неї в меню акаунта (`cc-menu-mobileonly`) сидить ряд плоских пілюль `LanguageToggle` (EN/PL/UA) — теж дешево виглядає.

**Чого хоче власник (підтверджено 2026-06-04):**
- Прибрати перемикач мов **і** з топбару (десктоп), **і** з мобільного меню акаунта.
- Зробити вибір мови **третьою секцією в Налаштуваннях** (поряд із «Критерії суддівства» та «API-ключі»), у **тій самій стилістиці**, що інші секції: іконка + назва в лівому списку секцій, а в тілі — акуратний список мов (прапор + рідна назва, активна позначена ✓).
- Усе в **одній стилістиці**. Вибір застосовується одразу (мова вже персиститься в `localStorage`, кнопка «Зберегти» не потрібна).
- Налаштування відкриваються тією самою шестернею в топбарі (вона лишається і на десктопі, і на телефоні) → секція мов доступна однаково всюди.

---

## Залізні правила (override усього)

1. **Не вигадувати стан** — звіряйся з кодом перед кожним твердженням.
2. **Десктоп і телефон — однакова стилістика секції.** Жодних окремих «мобільних пілюль». Перемикач мов живе **лише** в Налаштуваннях.
3. **НЕ чіпати:** бекенд, суддю, BYOK-безпеку (D-20/D-21/D-22), квоти, ledger, ростер провайдерів (groq/mistral/scout), логіку чатів/персоналізації. Це **чисто фронтенд**.
4. **Frontend golden rules:** без дублювання JSX/стилів/текстів; перевикористовувати наявні settings-класи (`settings-section-body`, `settings-h`, `settings-desc`, `settings-nav-item`); прапори/назви мов — **з одного джерела** (`LOCALES`); тексти лише через `t("key")` з **паритетом uk/pl/en**; кольори/відступи — лише через design tokens.
5. **Екран входу (`AuthScreen`) лишає свій `LanguageToggle`** — там користувач ще не залогінений, Налаштування недоступні. **Не чіпати login.**
6. **STOP лише якщо вимога суперечить безпеці/рішенням** — інакше вирішуй сам і фіксуй рішення тут.
7. **Не комітити й не деплоїти, доки власник не попросить.**

---

## Що вже є (перевикористати, НЕ переписувати з нуля)

- [components/settings/SettingsModal.tsx](../../frontend/components/settings/SettingsModal.tsx) — модалка з лівим списком секцій (`settings-nav` → `settings-nav-item` з іконкою+назвою) і тілом (`settings-content`). Масив `sections` + рендер `section === "..."`.
- [store/SettingsContext.tsx](../../frontend/store/SettingsContext.tsx) — `SettingsSection = "judge" | "keys"`; `open(section?)`, `setSection`.
- [components/settings/JudgePromptSection.tsx](../../frontend/components/settings/JudgePromptSection.tsx) — взірець секції: `settings-section-body` → `settings-h` (заголовок) + `settings-desc` (опис) + контент. **Дзеркаль цю структуру** для секції мов.
- [components/topbar/LangMenu.tsx](../../frontend/components/topbar/LangMenu.tsx) — наявний дропдаун мов із мапами `FLAGS`/`NAMES` (🇬🇧/🇵🇱/🇺🇦, English/Polski/Українська) і рядком `cc-menu-item is-sel` (прапор + назва + ✓). **Звідси беремо прапори/назви** (переносимо в `LOCALES`) і **видаляємо** сам файл.
- [store/LanguageContext.tsx](../../frontend/store/LanguageContext.tsx) + [i18n/index.ts](../../frontend/i18n/index.ts) — `lang`, `setLang` (миттєво застосовує + персиститься в `localStorage` + ставить `<html lang>`), `locales: LOCALES` (`{code,label}` для en/pl/uk). `setLang` **уже** робить усе — секція лише викликає його.
- [components/common/LanguageToggle.tsx](../../frontend/components/common/LanguageToggle.tsx) — лишається для `AuthScreen`. **Не видаляти.**
- i18n: вже є `settings.nav.judge`/`settings.nav.keys`, `settings.title`, `sidebar.language`. **Нові ключі** додати: `settings.nav.language`, `settings.language.title`, `settings.language.desc` (паритет uk/pl/en).

---

## Кроки

### M1 — Єдине джерело прапорів + рідних назв мов у `LOCALES`
**Мета:** прибрати дубль мап `FLAGS`/`NAMES` (зараз у `LangMenu`) — секція мов має брати їх з одного місця (golden rule).
**Файли:** `frontend/i18n/index.ts`.
- [x] Розширити `LocaleMeta`: додати `flag: string` і `nativeName: string`.
- [x] Заповнити `LOCALES`: `en → {label:"EN", flag:"🇬🇧", nativeName:"English"}`, `pl → {label:"PL", flag:"🇵🇱", nativeName:"Polski"}`, `uk → {label:"UA", flag:"🇺🇦", nativeName:"Українська"}`.
- **Gate:** `tsc --noEmit` + `vitest` зелено (можливо доведеться оновити `i18n/index.test.ts`, якщо він перевіряє форму `LOCALES`).

### M2 — Іконка «глобус» для секції мов
**Мета:** у списку секцій кожна має іконку (judge=`IconSparkle`, keys=`IconGear`); мові потрібна своя.
**Файли:** `frontend/components/icons/Icons.tsx`.
- [x] Додати `IconGlobe` (простий inline-SVG `currentColor`, як решта іконок — коло + меридіани/паралелі). Жодних нових залежностей.
- **Gate:** `tsc` зелено.

### M3 — Нова секція `LanguageSection` (стиль як у Judge/Keys)
**Файли:** новий `frontend/components/settings/LanguageSection.tsx`; i18n `en/pl/uk`.
- [x] `LanguageSection`: `div.settings-section-body` → `h3.settings-h` = `t("settings.language.title")` + `p.settings-desc` = `t("settings.language.desc")`, далі **radiogroup** зі списку `locales`: кожен рядок = кнопка (прапор + `nativeName` + ✓ на активній), `role="menuitemradio"`/`aria-checked`, `onClick={() => setLang(loc.code)}`. Активний рядок підсвічений (клас на кшталт `settings-lang-item is-sel`). **Без кнопки «Зберегти»** — `setLang` застосовує миттєво.
- [x] Додати i18n-ключі (паритет uk/pl/en):
  - `settings.nav.language` — «Language» / «Język» / «Мова».
  - `settings.language.title` — напр. «Interface language» / «Język interfejsu» / «Мова інтерфейсу».
  - `settings.language.desc` — короткий опис (1 речення), напр. «Choose the language of the interface. Applies immediately.» + pl/uk.
- **Gate:** `tsc`+`vitest`+`eslint`+`prettier`; i18n-паритет.

### M4 — Підключити секцію в `SettingsContext` + `SettingsModal`
**Файли:** `store/SettingsContext.tsx`; `components/settings/SettingsModal.tsx`.
- [x] `SettingsContext`: розширити `SettingsSection` до `"judge" | "keys" | "language"`.
- [x] `SettingsModal`: додати третій пункт у масив `sections` — `{ id:"language", label:t("settings.nav.language"), icon:<IconGlobe size={16}/> }`; додати рендер `{section === "language" && <LanguageSection />}`. Імпортувати `IconGlobe` + `LanguageSection`.
- **Gate:** `tsc`+`eslint`+`prettier`; у Налаштуваннях зʼявляється третя секція «Мова», перемикання працює, активна підсвічена.

### M5 — Прибрати мову з топбару (десктоп) і меню акаунта (телефон)
**Файли:** `components/layout/Topbar.tsx`; `components/topbar/AccountMenu.tsx`; видалити `components/topbar/LangMenu.tsx`; `theme/components.css`.
- [x] `Topbar.tsx`: прибрати `<LangMenu />` і його імпорт. (Тема/шестерня/usage/акаунт/admin — без змін.)
- [x] `AccountMenu.tsx`: з `cc-menu-mobileonly` прибрати мовний блок (`cc-menu-cap` «Language» + `cc-menu-lang` + `<LanguageToggle/>`) і **імпорт `LanguageToggle`**. **Admin-пункт лишити**; тепер `cc-menu-mobileonly` рендериться лише коли `is_admin` (інакше блок порожній).
- [x] Видалити файл `LangMenu.tsx` (невикористаний; ніде не імпортується — перевірено grep).
- [x] CSS: прибрано мертві правила `.cc-langpill*` (вкл. focus-visible + 430px), `.cc-dd-lang*` (вкл. `@media ≤768`), `.cc-menu-lang`, а також осиротілі `.cc-menu-flag` і `.cc-menu-item.is-sel`/`.chk` (їх використовував лише `LangMenu`). Коментарі топбару/медіа оновлено під PH38.
- **Gate:** `tsc`+`eslint`+`prettier`; на десктопі топбар без мовної пілюлі; на телефоні в меню акаунта лише Admin (без мови); жодних dangling-імпортів; десктоп-чат і решта топбару незмінні.

### M6 — CSS-стиль секції мов (у токенах, як решта Налаштувань)
**Файли:** `theme/components.css`.
- [x] Стилі `.settings-lang-list` / `.settings-lang-item` (рядок: прапор + назва ліворуч, ✓ праворуч; hover; активний `is-sel` у `--accent`/`--soft`; таргети ≥44px). Перевикористати наявні settings-токени/патерни; нового по мінімуму. Узгоджено з виглядом інших секцій.
- **Gate:** `tsc`+`eslint`+`prettier`; візуально 360/390/430px і десктоп — секція виглядає як решта Налаштувань, без переповнення.

### M7 — Гейти + готовність
- [x] `frontend`: `tsc --noEmit`, `vitest`(40), `eslint .`, `prettier --check .` — зелено; `npm run build` ок (Next 16.2.6, Compiled successfully).
- [x] i18n паритет uk/pl/en (нові ключі присутні в усіх трьох — перевірено grep + vitest parity-тест).
- [ ] Ручний чек-лист (за власником): у Налаштуваннях третя секція «Мова», перемикання застосовується миттєво й переживає перезавантаження; мова зникла з топбару й мобільного меню; екран входу лишив свій перемикач; десктоп решта — незмінні.
- **Gate:** усе зелено; коміт-готовність.

---

## Чого НЕ робимо
- Не чіпаємо бекенд, суддю, BYOK, квоти, ростер, логіку чатів. Міграцій нема.
- Не чіпаємо `AuthScreen`-перемикач (login лишається з `LanguageToggle`).
- Не вводимо нові залежності; прапори/назви — лише з `LOCALES`.
- Не комітимо й не деплоїмо до прохання власника.

---

## Як виконувати (інструкція для Cloud AI / Claude Code)

1. **Стартова локація:** репозиторій `ai-gateway`, працюй у теці `frontend` для гейтів (`cd frontend`).
2. **Прочитай спершу:** `CLAUDE.md`, цей план повністю, і для контексту секцію PH37 у `docs/08-current-state.md` (мобільний топбар) + `docs/10-open-decisions.md` (D-14/D-17 — мова за умовчанням EN, Налаштування). Golden rules — у `CLAUDE.md` (п.5).
3. **Працюй атомарно:** один крок M (M1→M7) → прогони його **Gate** → доведи до коміт-готовності → познач `[x]` і 1 рядок у журналі в кінці цього файлу → наступний крок. Не змінюй більше, ніж описано в кроці.
4. **Гейти (frontend, `cd frontend`):**
   - `npx tsc --noEmit`
   - `npx vitest run`
   - `npx eslint .`
   - `npx prettier --check .`
   - i18n-паритет: усі нові ключі є в `en.json`, `pl.json`, `uk.json` (однаковий набір ключів).
   - перед фінальною готовністю — `npm run build`.
5. **Бекенд не чіпається** — його тести (222) не запускай без потреби; цей план backend не торкається.
6. **Прогрес — ТІЛЬКИ в цьому файлі** (журнал у кінці + мітки `[x]`).
7. **Не комітити/не деплоїти** до явного прохання власника. Коли попросить — див. розділ «Деплой» нижче.
8. **Якщо локально треба глянути вигляд:** фронт `cd frontend && npx next dev -p 3000`; бекенд (за потреби) `cd backend && ./venv/bin/python -m uvicorn main:app --port 8000`. Settings → третя секція «Мова».

---

## Деплой (щоб оновилося на сервері st.byn.sarl)

> Деплой — **тільки** коли власник попросить. Це чистий фронтенд: **нових секретів і міграцій БД нема**.

CI/CD влаштовано так: **push у `main`** → CI (`.github/workflows/ci.yml`: lint+test) → якщо зелено, Deploy (`.github/workflows/deploy.yml`: build образів → GHCR → scp compose+nginx на VPS → SSH `docker compose pull && up -d`). Прод — `ai.st.byn.sarl` (за aaPanel-nginx :443).

Кроки:
1. Переконатися, що всі гейти M7 зелені локально (інакше CI впаде — деплой не запуститься).
2. Закомітити батч у `main` (приклад повідомлення):
   ```
   PH38: move language switcher into Settings (third section)

   - New LanguageSection in Settings (flag + native name list); applies immediately
   - Remove LangMenu from the topbar (desktop) and the language block from the
     mobile account menu; delete LangMenu; AuthScreen keeps its LanguageToggle
   - Flags/native names consolidated into LOCALES (single source); add IconGlobe
   - i18n parity uk/pl/en; desktop chrome otherwise unchanged

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```
3. `git push origin main`.
4. **Стежити за деплоєм без `gh`-CLI** (його тут нема): полінг публічного прода. Маркер для фронтенд-зміни менш очевидний, ніж для бекенду, тож:
   - Найпростіше — відкрити **GitHub → Actions** і дочекатися зелених CI + Deploy для свого коміту.
   - Або перевірити, що бекенд-контейнер не зламано: `curl -s -o /dev/null -w '%{http_code}' https://ai.st.byn.sarl/api/providers/info` → **200** (і список лишається groq/mistral/scout).
5. **Кеш HTML в aaPanel (відома граблі).** Після вдалого деплою фронт може показувати стару сторінку, бо aaPanel-nginx кешує HTML. Контейнерний nginx уже віддає HTML з `Cache-Control: no-store`, але вже закешований запис чистить **ВЛАСНИК** на сервері:
   ```bash
   rm -rf /www/server/nginx/proxy_cache_dir/* && nginx -s reload
   ```
   (через aaPanel-термінал або SSH). Користувачам — жорсткий перезавантаж `Ctrl+Shift+R`.
6. **Перевірка на проді:** відкрити `https://ai.st.byn.sarl` → шестерня (Settings) → має бути третя секція **«Мова»**; перемикання застосовується миттєво й переживає reload; мови зникли з топбару й мобільного меню акаунта.

> Жодних змін секретів/env, БД-міграцій, бекенду — деплой суто з новими образами фронтенду (і незмінним бекендом).

---

## Журнал виконання (заповнювати під час роботи)

| Крок | Статус | Підсумок (1 рядок) |
|---|---|---|
| M1 LOCALES: flag+nativeName | ✅ | `LocaleMeta` +flag/+nativeName; `LOCALES` заповнено з одного джерела; tsc+vitest(40) зелено. |
| M2 IconGlobe | ✅ | `IconGlobe` (коло+екватор+меридіан, currentColor) у Icons.tsx; tsc зелено. |
| M3 LanguageSection + i18n | ✅ | `LanguageSection` дзеркалить Judge (settings-section-body/-h/-desc) + radiogroup із LOCALES (flag+nativeName+✓), миттєвий setLang без Save; +3 ключі en/pl/uk; tsc/eslint/prettier/vitest(40) зелено. |
| M4 wire SettingsContext+Modal | ✅ | `SettingsSection` +"language"; SettingsModal: 3-й nav-пункт (IconGlobe) + рендер `<LanguageSection/>`; tsc/eslint/prettier зелено. |
| M5 remove lang from topbar+menu, drop LangMenu | ✅ | Прибрано `<LangMenu/>` з Topbar + мовний блок з AccountMenu (mobileonly тепер лише admin); видалено LangMenu.tsx; підчищено мертвий CSS (langpill/dd-lang/menu-lang/menu-flag/is-sel/chk); жодних dangling; tsc/eslint/prettier/vitest(40) зелено. |
| M6 CSS section polish | ✅ | `.settings-lang-list/-item/-flag/-name/-chk` на токенах (panel-2/soft/border/accent), min-height 44px, hover + is-sel; tsc/eslint/prettier зелено. |
| M7 gates | ✅ | tsc/vitest(40)/eslint/prettier зелено; i18n паритет ok; `npm run build` ok. Готово до коміту (PH38). Чекаю прохання власника на коміт/деплой. |
