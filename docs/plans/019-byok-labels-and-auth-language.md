---
plan: 019-byok-labels-and-auth-language
status: done
updated: 2026-05-31 (крок 6 — план завершено)
---

# PH19 — BYOK-мітки «AI 1/2/3», картка акаунта, мова на вході (default EN)

> Партія дрібних UX-правок після PH18. Enterprise-рівень: без заглушок/TODO/
> напівфіч. Кроки атомарні, бекенд→фронтенд (тут — майже все FE), гейти після
> кожного. Коміт/пуш — лише на пряме прохання власника.
>
> **Контекст рішення власника (2026-05-31):** обсяг перейменування відповідачів
> на «AI 1/2/3 (типово: …)» — **лише вікно BYOK**. Суддя всюди лишається
> «типово: Qwen». Compare-картки, перемикач Single, банер судді — **правдиві
> назви** (Llama/GLM/DeepSeek). Це **уточнює** D-11, а не скасовує його →
> внести як **D-14** у `docs/10-open-decisions.md` на кроці 6.

---

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **6** — docs/08 (секція PH19) + docs/10 (D-14) оновлено; план завершено, `status: done`.
- Наступний крок: — (немає; PH19 завершено).
- Заблоковано: **ні**.
- Змінені файли: `frontend/components/keys/KeysModal.tsx`, `frontend/i18n/messages/{en,pl,uk}.json` (крок 1); `frontend/theme/components.css` (крок 2); `frontend/components/common/LanguageToggle.tsx` (новий), `frontend/components/sidebar/LanguageSwitcher.tsx`, `frontend/components/auth/AuthScreen.tsx` (крок 3).
- Відкриті питання/рішення: внести **D-14** у `docs/10` (крок 6). Поза обсягом — див. блок «СВІДОМО ПОЗА ОБСЯГОМ».

---

## Контекст із коду (ground truth, звірено 2026-05-31)

- **BYOK-мітки відповідачів.** `frontend/components/keys/KeysModal.tsx`:
  - рядок судді показує `keys.judge` + `<span class="keys-default">` з
    `t("keys.defaultName", { name: judgeModelName(JUDGE_MODEL) ?? "Qwen" })` (ряд ~193–197);
  - рядки відповідачів: `const label = r.custom ? t("keys.customResponder") : responderLabel(r.slot)`
    (ряд ~223) → зараз показують **правдиву** назву (Llama 3.3 70B / GLM-4.7 /
    DeepSeek V3.1) **без** підпису «типово». Дефолтні (не-custom) слоти йдуть
    першими у фіксованому порядку (`DEFAULT_RESPONDER_SLOTS` у `store/KeysContext.tsx`),
    custom — після них.
  - `responderLabel` — з `frontend/utils/models.ts` (`RESPONDER_LABELS`,
    groq→«Llama 3.3 70B», cerebras→«GLM-4.7», sambanova→«DeepSeek V3.1»).
  - i18n уже є: `keys.defaultName="default: {name}"`, `keys.customResponder="Added model"`.
    Бракує ключа для узагальненої назви слота (напр. `keys.responderSlot="AI {n}"`).
  - CSS: `.keys-row-head`/`.keys-slot`/`.keys-default` у `theme/components.css`.
  - **`responderLabel` НЕ чіпати** — він використовується ще в `CompareFailedCard`,
    `SelectorBanner`, `ModelSwitcher` (там назви лишаються правдивими, D-14).

- **Картка акаунта.** `frontend/components/sidebar/ProfileCard.tsx`: структура
  `.acct` → `.acct-av` (іконка) + `.acct-name` (username|`profile.title`) + `.acct-logout`.
  CSS `.acct` має `align-items:center` (вертикально вже по центру). Після PH18/7
  `.acct-name` отримав `flex:1; text-align:center; …` → ім'я центрується в усьому
  рядку (виглядає неохайно). Треба: ім'я **поряд з іконкою**, по центру **відносно
  іконки** (вертикально), не по центру всього вікна; «Вийти» лишається праворуч
  (`.acct-logout { margin-left:auto }`). Прибрати `flex:1; text-align:center`,
  лишити обрізку довгого імені (`min-width:0` + ellipsis).

- **Екран входу.** `frontend/components/auth/AuthScreen.tsx` — повноекранний
  (`app/page.tsx` рендерить `<AuthScreen/>` коли не автентифіковано). Зараз **немає**
  перемикача мов (у Sidebar є `components/sidebar/LanguageSwitcher.tsx`: caption
  `sidebar.language` + кнопки `locales` з `useI18n().setLang`). На вході сайдбара
  немає → потрібен окремий компактний перемикач на самій картці входу.

- **Мова за умовчанням.** `frontend/store/LanguageContext.tsx::detectInitialLocale`:
  `localStorage(STORAGE_KEY)` → інакше **browser language** (`navigator.language`)
  → інакше `DEFAULT_LOCALE`. `DEFAULT_LOCALE="en"` (`i18n/index.ts`). Тобто новий
  користувач з uk/pl-браузером бачить uk/pl, а не EN. Вимога власника: нові
  користувачі **завжди EN**, далі вибір зберігається (localStorage уже працює).
  Виправлення: прибрати крок browser-detection (нові → `DEFAULT_LOCALE`).

---

## Кроки (атомарні; гейти після кожного)

- [ ] **0. Bootstrap + план.** Прочитати CLAUDE.md, docs/README, docs/08, docs/10,
  цей план; звірити «Контекст із коду» з реальним кодом. Без змін коду. ✅ зроблено.

- [x] **1. BYOK-мітки відповідачів «AI 1/2/3 (типово: …)».** У `KeysModal.tsx`
  дефолтні (не-custom) рядки відповідачів показують узагальнену назву
  `t("keys.responderSlot", { n })` (n=1..3 у порядку слотів) + підпис
  `<span class="keys-default">{t("keys.defaultName", { name: responderLabel(slot) })}</span>`
  (дзеркалить рядок судді). Custom-рядки лишаються `keys.customResponder`. Суддя —
  без змін («типово: Qwen»). i18n: додати `keys.responderSlot` (uk/pl/en, паритет;
  напр. «AI {n}»). За потреби — дрібний CSS у `.keys-row-head` (узгодити з рядком
  судді). `responderLabel`/інші екрани **не** чіпати (D-14). Гейти FE.

- [x] **2. Картка акаунта — ім'я поряд з іконкою.** `ProfileCard.tsx` структуру
  лишити (іконка + ім'я + «Вийти»). У `theme/components.css` `.acct-name`:
  прибрати `flex:1; text-align:center`; лишити `min-width:0` + обрізку
  (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`), вирівнювання —
  ліворуч поряд з іконкою (вертикально по центру через `.acct{align-items:center}`).
  «Вийти» праворуч (`.acct-logout{margin-left:auto}`). Звірити, що довге ім'я не
  ламає картку. Гейти FE.

- [x] **3. Перемикач мов на екрані входу.** Додати компактний перемикач мов на
  картку `AuthScreen.tsx`, розміщений охайно (напр. угорі картки/над заголовком
  або у кутку), стилі — лише через design tokens. Без дублювання логіки: або
  винести спільний презентаційний перемикач (компактний варіант), яким
  користуються і Sidebar, і Auth, або зробити `AuthScreen`-локальний рядок кнопок
  на тих самих `locales`/`setLang` зі `store/LanguageContext`. Тексти — через
  `t("key")` (нові ключі за потреби, паритет uk/pl/en); a11y (`aria-pressed`,
  доступні мітки). Без `fetch` у компоненті. Гейти FE.

- [x] **4. Мова за умовчанням = English для нових користувачів.**
  `LanguageContext.tsx::detectInitialLocale`: прибрати крок визначення за
  `navigator.language` → нові користувачі (немає `localStorage`) отримують
  `DEFAULT_LOCALE` (EN); збережений вибір і далі застосовується й персиститься.
  Прибрати невживані імпорти, що лишилися (напр. `isLocale`, якщо більше не
  потрібен). Гейти FE (за потреби — короткий unit-тест на детект-логіку).

- [x] **5. Гейти + live.** Перезапустити FE-гейти
  (tsc/eslint/prettier/vitest/build; i18n паритет uk/pl/en). Live (npm dev + uvicorn):
  у вікні BYOK три відповідачі — «AI 1/2/3» з підписом «типово: реальна модель»,
  суддя — «типово: Qwen»; Compare-картки/перемикач Single/банер судді — правдиві
  назви; картка акаунта — ім'я поряд з іконкою + «Вийти» праворуч; на екрані входу
  є перемикач мов; новий користувач (очищений localStorage) стартує з EN, після
  вибору мова зберігається.

- [x] **6. Доки + D-14.** Оновити `docs/08-current-state.md` (секція PH19),
  `docs/10-open-decisions.md` (**D-14**: BYOK-мітки «AI 1/2/3», уточнення D-11;
  default-мова EN). За потреби — `docs/06-frontend-architecture.md` (поведінка
  default-мови). Виставити `status: done`, усі `[x]`, «СТАН» актуальний.

---

## СВІДОМО ПОЗА ОБСЯГОМ цього плану
- **Перевірка валідації доданої моделі** (порожні поля → видаляються на Save;
  невалідні → повертаються й «горять» червоним). Власник: «це вже повинно було
  бути реалізовано, я ще не перевіряв — це наступний крок, зараз не стосується».
  → Не кодуємо тут; винести в **окремий наступний план** (verification/QA BYOK
  Save). Поточний код: `KeysModal.save()` → `useKeys().saveAndValidate` (пер-ключова
  валідація, неробочі лишаються червоними) — перевірити окремо.

---

## Перевірка (Definition of Done)
- [x] BYOK-вікно: 3 відповідачі = «AI 1/2/3» + підпис «типово: реальна модель»;
      суддя = «типово: Qwen»; паритет uk/pl/en.
- [x] Поза BYOK (Compare-картки, перемикач Single, банер судді) назви лишились
      правдивими (Llama/GLM/DeepSeek) — D-11 не порушено (D-14).
- [x] Картка акаунта: ім'я поряд з іконкою (по центру відносно іконки), «Вийти»
      праворуч; довге ім'я обрізається, картку не ламає.
- [x] Екран входу має охайний перемикач мов (tokens, i18n, a11y); без дублювання логіки.
- [x] Новий користувач за умовчанням — англійська; вибір далі зберігається (localStorage).
- [x] Зелено FE (tsc/eslint/prettier/vitest/build); docs (08/10) оновлені; D-14 внесено; live пройдено.
- [x] Golden rules: без хардкоду кольорів/текстів; без `fetch` у компонентах;
      стан — через store/; стани UI loading/empty/error враховані.
