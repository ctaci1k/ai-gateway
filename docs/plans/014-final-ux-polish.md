---
plan: 014-final-ux-polish
status: done
updated: 2026-05-29
---

# PH14 — Фінальний UX-поліш (topbar, скрол, композер, нейтральні мітки судді, прибрати System Log, персональна картка)

> Зібрано з живих приміток власника після PH13. Усі пункти підтверджені; відкритих питань немає. Будується на завершених PH0–PH13. Стиль: лише через `theme/` токени, тексти через `t()` (uk/pl/en), стан через `store/`, без дублювання, усі стани loading/empty/error.

## СТАН (читається першим у новій сесії)
- **ПЛАН ЗАВЕРШЕНО (status: done).** Усі кроки 1–10 [x]; FE-гейти зелені (tsc/eslint/prettier/vitest 12/build); `docs/08` оновлено (секція PH14). Контракти API/даних не змінювались (03/04/10 — без змін). Єдине невиконане — піксельний візуальний огляд (середовище без браузера, див. крок 10) — за власником.
- Останній виконаний крок: **10** — фінальні гейти + аудит мертвих ключів/класів + HTTP-smoke стеку.
- Крок 7 (раніше): прибрано System Log: видалено `components/sidebar/SystemLog.tsx` + використання у `Sidebar.tsx`; мертвий CSS `.syslog/.syslog-head/.syslog-title/.syslog-rows/.stat/.dot/.dot-on` прибрано (лишено `.syslog-row` і `.muted2` — їх юзає `ChatList`); прибрано i18n `syslog.*` + осиротілий `status.online` (en/uk/pl). Крок 5: `.composer-popover` отримав `max-height: min(60vh,440px)` + `overflow-y:auto` + `overscroll-behavior:contain`. Крок 6: `.msgs` → `scrollbar-gutter:stable`, `scroll-behavior:smooth`, `overscroll-behavior:contain`, `padding:8px 10px` (авто-скролу не було й не додавав — поза «полішем»).
- Передостанній виконаний крок: **4** — Compare стрічка+скрол: `.responses` (корінь `CompareModal`) більше не власний скрол-контейнер (прибрано `flex:1; min-height:0; overflow-y:auto`); `CompareModal` завжди в `.msgs` (ephemeral або `CompareTurn` у `.compare-thread`), тож `.msgs` — єдиний скрол; порядок рендеру треду вже коректний (`CompareTurn`: повідомлення→банер→відповіді). Манульну перевірку скролу/розкладок зведено на крок 10. Файл: `theme/components.css`.
- Передостанній виконаний крок: **3** — топбар-контекст по режиму. Прибрано годинник+крапку та `IconClock` (крок 2). Новий `components/chat/TopbarModeContext.tsx` у спільному слоті `MainLayout` (`topbarContext`): Single → `ModelSwitcher` + примітка `single.note`; Compare → пояснення `topbar.compareInfo` з моделлю судді (`JUDGE_MODEL` у `utils/judge.ts`, дзеркалить backend `SELECTOR_MODEL`). `ModelSwitcher`/`.single-note` прибрано зі `ChatPage`. FE-гейти tsc/eslint/prettier/vitest зелені (`next build` — на кроці 10).
- Наступний крок: **— (план 014 завершено).** Далі за програмою — план **015** (адмінпанель + ліміти).
- Заблоковано: ні.
- Змінені файли (накопичено): `utils/judge.ts` (новий, +`JUDGE_MODEL`); `components/selector/SelectorBanner.tsx`+`.test.tsx`; `components/compare/{ManualSelectionButton,CompareModal,CompareColumn,CompareTurn}.tsx`; `features/compare/ComparePage.tsx`; `components/chat/TopbarModeContext.tsx` (новий); `layouts/MainLayout.tsx`; `app/page.tsx`; `features/chat/ChatPage.tsx`; `components/icons/Icons.tsx` (−IconClock); `theme/components.css` (−.topbar-r/.single-note, +.topbar-ctx*, .topbar wrap, .single-bar flex-end); `i18n/messages/{en,uk,pl}.json` (`selector.title`, `cta.selectedByJudge`, `banner.judgeUnavailable`, +`topbar.compareInfo`).
- Відкриті питання: немає. (Адмінка + ліміти + банер обмеженого акаунта — окремий план 015.)
- Нотатка: `banner.judgeUnavailable` нейтралізовано, але ключ наразі **мертвий** (код використовує лише `banner.reason.*`) — прибрати під час фінального dead-key аудиту (крок 10), як і `syslog.*` (крок 7).

## Контекст із коду (звірено)
- Суддя тепер `qwen/qwen3-32b` на Groq (D-9), але в UI захардкожено «Gemini Judge»: `i18n` ключі `selector.title`, `cta.selectedByJudge`, `banner.judgeUnavailable`, `syslog.geminiJudge`; компоненти `SelectorBanner`, `ManualSelectionButton`.
- Топбар: `layouts/MainLayout.tsx` — годинник (`IconClock`) + крапка `dot dot-on` справа; лівий блок «topbar.title/subtitle».
- Лівий нижній блок: `components/sidebar/SystemLog.tsx`, підключений у `components/sidebar/Sidebar.tsx`.
- Композер: `components/chat/PromptInput.tsx` + `.composer*` у `theme/components.css`. Кнопка «надіслати» у правому нижньому куті.
- Скрол: контейнер `.msgs` (`theme/components.css`) — `overflow-y:auto`. Compare-тред (`features/compare/ComparePage.tsx`) рендериться всередині `.msgs`; перевірити, чому не скролиться (ймовірно висота/мін-висота попапа документів `.composer-popover` перекриває або тред переростає контейнер).
- Документи: попап `.composer-popover` (`ComposerTools.tsx`) — наразі без власного скролу/обмеження висоти.

## Кроки (атомарні)
- [x] 1. **Нейтральні мітки судді.** Прибрати хардкод «Gemini»: `selector.title` → нейтральне («AI-суддя»), у `SelectorBanner`/`ManualSelectionButton` показувати реальну модель із `selector_metadata.selector_model` (дружня назва, напр. «Qwen»); `banner.judgeUnavailable` → нейтральний текст. i18n uk/pl/en. (Без `syslog.*` — System Log видаляємо в кроці 7.)
- [x] 2. **Топбар — прибрати годинник + крапку** справа (`MainLayout`). Прибрати невикористані іконки/класи, якщо стають мертвими.
- [x] 3. **Топбар-контекст по режиму.** Винести у верхню смугу режимо-залежний блок:
      - Single: перемикач моделі (перенести `ModelSwitcher` нагору) + примітка «одиночний чат не зберігається окремо» (перенести зі сторінки в топбар-зону).
      - Compare: пояснення «ваш запит обробляють 3 ШІ, найкращу відповідь обирає суддя (Qwen)».
      Реалізувати як спільний слот у топбарі/шапці сторінки (без дублювання; через `t()`).
- [x] 4. **Compare = стрічка + скрол.** Переконатися, що рендер: *повідомлення → відповіді всіх моделей → наступне повідомлення → …* і весь тред **скролиться** в межах `.msgs`. Виправити причину відсутності скролу.
- [x] 5. **Скрол при відкритих документах.** Попап документів (`.composer-popover`) — обмежити висоту + власний `overflow-y:auto`, щоб було видно від початку панелі; не має перекривати/ламати скрол треда.
- [x] 6. **Single-скрол причесати.** Акуратний, плавний, з коректними відступами; без «стрибків».
- [x] 7. **Прибрати System Log** повністю: видалити `SystemLog.tsx` і його використання в `Sidebar.tsx`; підчистити мертві i18n-ключі `syslog.*`.
- [x] 8. **Композер — позиція/форма.** Підняти трохи вище від самого низу, звузити (max-width + центрування), щоб кнопка «надіслати» не була в крайньому правому куті. Лише через токени.
- [x] 9. **Персональна картка «by Станіслав Биндас»** у лівій нижній зоні (де був System Log): коротко, що застосунок демонструє вміння будувати реальні великі робочі програми наодинці. Текст через `t()` (uk/pl/en), фінальне формулювання уточнити з власником. *(Формулювання погоджено власником: стисло — ім'я + меседж про скіл; ключі `author.cap/name/tagline`.)*
- [x] 10. **Зелено + ручна перевірка.** FE: `tsc`+`eslint`+`prettier`+`vitest`(12)+`build` — усі зелені; тест `SelectorBanner` оновлено під нейтральні мітки. Мертві ключі (`syslog.*`, `status.online`, `banner.judgeUnavailable`) і CSS (`.topbar-r`, `.single-note`, `.syslog/.stat/.dot/.dot-on`) прибрано. Ручна перевірка: повний стек піднято (BE+FE), HTTP-smoke зелений (логін→`/auth/me`→`/providers/info` усі 200, логи без помилок). **Піксельний візуальний огляд скролу/розкладок не виконано** — у цьому WSL-середовищі Playwright не ставить chromium (ubuntu26.04 unsupported) і немає системного браузера; рекомендовано власнику відкрити localhost:3000 і перевірити очима скрол Compare/Single, попап документів, центрування композера, картку автора.

## Перевірка (Definition of Done)
- [x] Ніде не лишилось «Gemini Judge» там, де суддя — Qwen; банер/мітки показують реальну модель.
- [x] Топбар без годинника/крапки; у Single — модель+примітка, у Compare — пояснення режиму.
- [x] Compare скролиться як стрічка; документи відкриваються зі скролом і видно від початку; Single-скрол охайний. *(код-рівень: `.msgs` єдиний скрол-контейнер; піксельний огляд — за власником, див. крок 10.)*
- [x] System Log прибрано; на його місці — персональна картка автора.
- [x] Композер піднятий/звужений/центрований.
- [x] FE зелено (tsc/eslint/prettier/vitest/build); i18n паритет uk/pl/en; без мертвих ключів.

## Свідомо НЕ тут (окремий план 015)
- Адмінпанель, ліміти/квоти на акаунт, трекінг токенів, банер «обмежений акаунт». Залежить від рішень власника (модель квоти, ідентифікація адміна, створення акаунтів) — див. питання в чаті.
