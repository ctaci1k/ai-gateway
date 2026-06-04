# 038 — Телефон: фікс зуму на фокусі поля + повна назва режиму у випадайку (PH39)

**Статус:** PLANNED · фронтенд-онлі · продовження після PH38 (мова → секція Налаштувань).
**Власник:** Stanislav

> **Цей план написаний для виконання в новому чаті (Cloud AI / Claude Code).**
> Працювати **атомарно**: один крок M → перевірка (gate) → коміт-готовність → наступний.
> Прогрес фіксувати **тільки в цьому файлі** (мітка `[x]` біля кроку + 1 рядок підсумку в журналі в кінці).

---

## Контекст / проблема

Дві мобільні (≤768px) проблеми, обидві **чисто фронтенд**:

### P1 — небажаний зум при фокусі на полі вводу
На телефоні при тапі в поле (логін/реєстрація, інпут чату, перейменування чату, поля Налаштувань/BYOK/Admin) браузер **автозумить** сторінку. Це стандартна поведінка iOS Safari / мобільного Chrome: вони зумлять до фокусованого `<input>`/`<textarea>`, якщо його `font-size < 16px`. У нас усі текст-поля менші за 16px:
- `.auth-input` — **14px** ([components.css:941](../../frontend/theme/components.css#L941)) — логін/реєстрація.
- `.composer-input` — **14px** ([components.css:676](../../frontend/theme/components.css#L676)) — інпут чату.
- `.settings-textarea` — **12.5px** ([components.css:3411](../../frontend/theme/components.css#L3411)) — критерії судді.
- `.cc-hrow-edit` — **12.5px** ([components.css:2956](../../frontend/theme/components.css#L2956)) — інлайн-перейменування чату.
- `.keys-input` — **13px** ([components.css:1974](../../frontend/theme/components.css#L1974)) — BYOK-ключі.
- `.admin-input` — **13px** ([components.css:1492](../../frontend/theme/components.css#L1492)) — адмін-панель.
- (плюс будь-які інші текст-поля <16px, які виявить grep — напр. BYOK-блок ~2155).

Viewport ([app/layout.tsx:50](../../frontend/app/layout.tsx#L50)) — `width=device-width, initial-scale=1`, зум **дозволено навмисно** (PH23/E3). Попередній фікс `text-size-adjust` (з минулого деплою) — про інше (роздування тексту в ландшафті), на focus-zoom **не впливає**.

**⚠️ Підводний камінь (специфічність):** базового правила `input{}`/`textarea{}` у CSS **немає** — кожне поле несе свій `font-size` через **клас**. Тому правило `@media (max-width:768px){ input,textarea{font-size:16px} }` **НЕ спрацює**: голий `input` (специфічність 0,0,1) програє класовому `.composer-input` (0,1,0). Перевизначати треба **тими самими класами**.

### P2 — мобільні випадайки «Single/Compare»: повна назва не видна
На телефоні два тригери [MobileModeBar](../../frontend/components/layout/MobileModeBar.tsx) сидять у 64px-топбарі поруч з іконками. На 360–430px місця обмаль, `.lab` тригера — однорядковий з ellipsis ([components.css:3637](../../frontend/theme/components.css#L3637)) → видно лише «Sin…»/«Com…». Усередині попапа назви теж **немає**: у `headless`-режимі [AccordionSection пропускає шапку](../../frontend/components/sidebar/AccordionSection.tsx#L175) (`{!headless && <head/>}`) і одразу рендерить «+ New Chat». Тобто повну назву режиму ніде не прочитати.

**Чого хоче власник (підтверджено 2026-06-04):** **тільки на телефоні** показати **повну назву режиму** («Single Models» / «Compare») **перед кнопкою «+ New Chat»** усередині випадайка, щоб було зрозуміло, де ти. Компактний тригер у топбарі лишити як є.

---

## Залізні правила (override усього)

1. **Не вигадувати стан** — звіряйся з кодом перед кожним твердженням.
2. **Чистий фронтенд.** **НЕ чіпати:** бекенд, суддю, BYOK-безпеку (D-20/D-21/D-22), квоти, ledger, ростер провайдерів (groq/mistral/scout), логіку чатів/персоналізації. Міграцій і нових секретів **нема**.
3. **Десктоп не чіпати.** P2-фікс — **тільки** мобільний попап (`headless`-гілка `AccordionSection`); десктопний сайдбар (не-headless) та десктоп-чат лишаються **без змін**.
4. **Зум користувача лишається дозволеним.** P1 фіксимо **через font-size ≥16px**, а **НЕ** через `maximum-scale`/`user-scalable=no` (це вимкнуло б пінч-зум → регрес доступності й реверс свідомого рішення PH23/E3). Viewport у `layout.tsx` **не чіпати**.
5. **Frontend golden rules:** без дублювання JSX/стилів/текстів; кольори/відступи — лише через design tokens; тексти лише через `t("key")`. Для P2 **нових i18n-ключів не потрібно** — назви вже є (`sidebar.singleTitle`/`sidebar.singleSub`/`sidebar.compareTitle`/`sidebar.compareSub`); якщо все ж додаєш ключ — **паритет uk/pl/en**.
6. **STOP лише якщо вимога суперечить безпеці/рішенням** — інакше вирішуй сам і фіксуй рішення тут.
7. **Не комітити й не деплоїти, доки власник не попросить.**

---

## Що вже є (перевикористати, НЕ переписувати з нуля)

- [theme/components.css](../../frontend/theme/components.css) — усі стилі; є медіазапит `@media (max-width: 768px) { … }` (там, де живуть мобільні правила топбару/mmbar — район рядків ~3600+). Нові мобільні правила класти **в наявний** `≤768px`-блок, не плодити нових медіазапитів без потреби.
- [components/sidebar/AccordionSection.tsx](../../frontend/components/sidebar/AccordionSection.tsx) — `headless?: boolean`. У headless шапка (`cc-acc-head`) **пропускається**, тіло (`cc-acc-body`) рендериться завжди. Пропси `label` + `sub` **уже передаються** з `MobileModeBar` — їх і використати для заголовка попапа.
- [components/layout/MobileModeBar.tsx](../../frontend/components/layout/MobileModeBar.tsx) — передає в `AccordionSection` `label={col.title}` (повна назва) і `sub={col.sub}`. **Нічого тут міняти не треба** (хіба що косметика), бо дані вже йдуть.
- i18n: `sidebar.singleTitle`/`singleSub`/`compareTitle`/`compareSub` — повні назви/підписи режимів (паритет уже є).

---

## Кроки

### M1 — P1: прибрати автозум на фокусі (font-size ≥16px на телефоні)
**Мета:** при фокусі в будь-яке поле на телефоні сторінка **не зумиться**; пінч-зум лишається дозволеним.
**Файли:** `frontend/theme/components.css` (viewport `layout.tsx` **НЕ чіпати**).
- [x] `grep` усі текст-поля з `font-size < 16px` (стартовий перелік: `.auth-input`, `.composer-input`, `.settings-textarea`, `.cc-hrow-edit`, `.keys-input`, `.admin-input` + усе, що знайдеться навколо BYOK ~2155 / комбобокс ключів). Звести в один перелік класів **текст-полів** (input type=text/email/password/search, textarea). Чекбокси/радіо/кнопки — ігнорувати.
- [x] У **наявному** `@media (max-width: 768px)`-блоці додати одне правило, що перевизначає ці класи на `font-size: 16px` (саме **класами**, щоб виграти специфічність — див. підводний камінь вище). Приклад:
  ```css
  @media (max-width: 768px) {
    .auth-input,
    .composer-input,
    .settings-textarea,
    .cc-hrow-edit,
    .keys-input,
    .admin-input {
      font-size: 16px;
    }
  }
  ```
  (доповни перелік усіма знайденими класами; коментар — навіщо саме 16px).
- **Gate:** `tsc`+`eslint`+`prettier` зелено. Візуально на телефоні/емуляторі 360/390/430px: тап у поле логіну, в інпут чату, у перейменування чату, у поле Налаштувань/BYOK — **сторінка не зумиться**; верстка полів не ламається (нічого не вилазить, висоти ок). Пінч-зум усе ще працює.

### M2 — P2: повна назва режиму у мобільному попапі (перед «+ New Chat»)
**Мета:** відкривши випадайк Single/Compare на телефоні, користувач одразу бачить повну назву режиму над кнопкою «+ New Chat». Десктоп — без змін.
**Файли:** `frontend/components/sidebar/AccordionSection.tsx`; `frontend/theme/components.css`.
- [x] У `AccordionSection`, **тільки коли `headless`**, на початку `cc-acc-body` (перед кнопкою `cc-newchat`) відрендерити нелічильний рядок-заголовок з повною назвою: `label` (обовʼязково) + опційно `sub` дрібним. Напр. `headless && <div className="cc-mmpop-head"><span>{label}</span><small>{sub}</small></div>`. Десктоп (не-headless) **не чіпати** — він і так має `cc-acc-head`.
- [x] CSS: додати `.cc-mmpop-head` (+ `small`) у токенах, дзеркалячи типографіку `.cc-acc-head .lab` (вага/розмір/колір `--fg`/`--subtle`), з акуратним відступом перед «+ New Chat». Нового по мінімуму; жодних хардкод-кольорів.
- **Gate:** `tsc`+`eslint`+`prettier` зелено. Візуально на телефоні: відкриваєш кожен випадайк → видно повну «Single Models» / «Compare» (+підпис) **над** «+ New Chat». Десктопний сайдбар і десктоп-чат — **візуально незмінні** (headless там не використовується).

### M3 — Гейти + готовність
- [x] `frontend` (`cd frontend`): `npx tsc --noEmit`, `npx vitest run`, `npx eslint .`, `npx prettier --check .` — зелено; `npm run build` ок.
- [x] i18n паритет uk/pl/en (актуально, лише якщо в M2 додавав нові ключі; за планом — не додаєш). → Нових ключів не додавав, N/A.
- [ ] Ручний чек-лист (телефон 360/390/430px): (P1) жодне поле більше не зумить сторінку на фокусі, пінч-зум працює; (P2) обидва випадайки показують повну назву режиму перед «New Chat». Десктоп — без візуальних змін.
- **Gate:** усе зелено; коміт-готовність.

---

## Чого НЕ робимо
- Не чіпаємо бекенд, суддю, BYOK, квоти, ростер, логіку чатів. Міграцій/секретів нема.
- Не чіпаємо viewport (`layout.tsx`) і **не** вимикаємо зум користувача.
- Не чіпаємо десктопний сайдбар/чат і компактний тригер `MobileModeBar` (його ellipsis лишається — повну назву тепер дає попап).
- Не вводимо нові залежності.
- Не комітимо й не деплоїмо до прохання власника.

---

## Як виконувати (інструкція для Cloud AI / Claude Code)

1. **Стартова локація:** репозиторій `ai-gateway`; для гейтів працюй у теці `frontend` (`cd frontend`).
2. **Прочитай спершу:** `CLAUDE.md`, цей план повністю, і для контексту секцію PH37 у `docs/08-current-state.md` (мобільний топбар + `MobileModeBar`) та `docs/10-open-decisions.md` (D-17 Налаштування). Golden rules — у `CLAUDE.md` (п.5).
3. **Працюй атомарно:** один крок M (M1→M3) → прогони **Gate** → коміт-готовність → познач `[x]` і 1 рядок у журналі в кінці цього файлу → наступний крок. Не змінюй більше, ніж описано в кроці.
4. **Гейти (frontend, `cd frontend`):** `npx tsc --noEmit` · `npx vitest run` · `npx eslint .` · `npx prettier --check .`; перед фінальною готовністю — `npm run build`.
5. **Бекенд не чіпається** — його тести не запускай без потреби.
6. **Прогрес — ТІЛЬКИ в цьому файлі** (журнал у кінці + мітки `[x]`).
7. **Не комітити/не деплоїти** до явного прохання власника. Коли попросить — див. «Деплой» нижче.
8. **Локальний перегляд:** фронт `cd frontend && npx next dev -p 3000`; бекенд `cd backend && ./venv/bin/python -m uvicorn main:app --port 8000` (dev-БД — SQLite, Postgres не потрібен). Перевіряти **з телефона по локальному IP** або через DevTools device-emulation (бажано реальний iOS — focus-zoom видно тільки на справжньому мобільному рушії).

---

## Деплой (щоб оновилося на сервері st.byn.sarl)

> Деплой — **тільки** коли власник попросить. Чистий фронтенд: **нових секретів і міграцій нема**.

CI/CD: **push у `main`** → CI (lint+test) → Deploy (build образів → GHCR → scp compose+nginx на VPS → SSH `docker compose pull && up -d`). Прод — `ai.st.byn.sarl` (за aaPanel-nginx :443).

Кроки:
1. Переконатися, що гейти M3 зелені локально.
2. Закомітити батч у `main` (приклад повідомлення):
   ```
   PH39: mobile input zoom + full mode name in the mobile mode popover

   - Stop iOS/Android focus-zoom: bump mobile text fields to 16px (≤768px),
     targeting the actual field classes (no viewport/zoom change)
   - Show the full mode name (Single Models / Compare) above "+ New Chat"
     inside the mobile mode popover (headless AccordionSection); desktop unchanged

   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```
3. `git push origin main`.
4. **Стежити без `gh`-CLI** (його тут нема): полінг прода — корінь `https://ai.st.byn.sarl` → 200; як маркер «новий образ доїхав» можна порівнювати хеш JS-чанків з `curl -s https://ai.st.byn.sarl | grep -oE '/_next/static/chunks/[A-Za-z0-9._-]+\.js'` (зміниться, коли свіжий фронтенд живий); бекенд лишається 200 на `/api/providers/info` (ростер groq/mistral/scout).
5. **Кеш HTML в aaPanel (відома граблі):** якщо після деплою фронт старий — **ВЛАСНИК** на сервері: `rm -rf /www/server/nginx/proxy_cache_dir/* && nginx -s reload`; користувачам `Ctrl+Shift+R`. (На PH38 свіжий HTML віддавався одразу — `Cache-Control: no-store` — кеш чистити не довелось; але тримай це в голові.)
6. **Перевірка на проді:** з телефона `https://ai.st.byn.sarl` → тап у поля **не зумить**; випадайки Single/Compare показують повну назву над «New Chat».

> Жодних змін секретів/env, БД-міграцій, бекенду — деплой суто з новими образами фронтенду (бекенд незмінний).

---

## Журнал виконання (заповнювати під час роботи)

| Крок | Статус | Підсумок (1 рядок) |
|---|---|---|
| M1 P1: font-size 16px ≤768px (no focus-zoom) | ✅ | grep дав 6 текст-полів (.auth-input/.composer-input/.settings-textarea/.cc-hrow-edit/.keys-input/.admin-input; --sm/--model/--url успадковують базу, .keys-select — native picker, виключено); правило `font-size:16px` додано в наявний @media(max-width:768px) блок (≈2349) класами для специфічності; viewport/пінч не чіпано; tsc+eslint+prettier зелено |
| M2 P2: full mode name in mobile popover | ✅ | AccordionSection: лише `headless` → `.cc-mmpop-head` (label + опц. sub) на початку cc-acc-body перед «+ New Chat»; CSS `.cc-mmpop-head` дзеркалить типографіку `.cc-acc-head .lab` (13.5/700/--fg, sub 10.5/600/--subtle), токени-кольори; десктоп/не-headless та компактний тригер без змін; нових i18n-ключів нема; tsc+eslint+prettier+vitest(40) зелено |
| M3 gates | ✅ | tsc + vitest(40) + eslint + prettier + `npm run build` — усе зелено; нових i18n-ключів нема (паритет N/A); ручний телефон-чек лишається власнику. Коміт-готовність; не комічено/не деплоєно (чекаю прохання) |
