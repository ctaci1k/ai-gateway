---
plan: 001-frontend-foundation-refactor
status: done
updated: 2026-05-29
---

# Frontend foundation refactor — тема, i18n, стан, структура

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **18** — усі кроки виконані; план `done`.
- Наступний крок: — (PH5 завершено; далі PH6 / план 004 — TypeScript migration).
- Заблоковано: ні.
- Змінені файли: `theme/{tokens.css,tokens.ts}` (старі `theme/*.ts` видалено), `app/globals.css`, `app/layout.js`, `i18n/{index.ts,messages/{en,uk,pl}.json}` (старі flat dicts видалено), `store/{ThemeContext,LanguageContext}.jsx`, `layouts/MainLayout.jsx`, усі `components/**`, `features/{chat,compare}/*`, `app/page-old.js` видалено, `eslint.config.mjs` (ignore design-reference). Імпорти cross-dir → `@/`.
- Відкриті питання/рішення: pixel-match — план 006 (PH7); TS-міграція — план 004 (PH6).

---

## Навіщо (приземлено на код — не вигадано)

Поточні «тема» та «i18n» — **нефункціональні фасади**:

**Тема:**
- `theme/*.ts` (`colors/spacing/radius/shadows/typography`) **ніким не імпортуються**.
- `store/ThemeContext` тримає `theme="dark"`, але `useTheme` **ніде не споживається** і нічого не застосовує.
- `app/globals.css` — **дефолтний шаблон Next** (світла тема + `prefers-color-scheme`, шрифт Arial).
- Компоненти фарбуються **захардкодженими Tailwind-класами** (`border-gray-800`, `text-gray-400`, `bg-transparent`).
- **3 конфліктні джерела кольору** (theme/colors.ts ≠ globals.css ≠ inline-класи). → змінити «фон/кнопки/текст в одному місці» **неможливо**.

**i18n:**
- Функції `t()` **не існує** (немає жодного i18n-хелпера/лоадера).
- `store/LanguageContext` тримає лише рядок `language="en"`, **без `t`**, словники `i18n/*.json` (≈6 ключів) **не завантажуються**.
- `LanguageSwitcher` — кнопки EN/PL/UA **без onClick** (не працюють).
- Увесь UI-текст **захардкоджений англійською** в компонентах.

**Структура/інше:**
- `app/layout.js`: metadata «Create Next App», `<html lang="en">` хардкод, шрифти Geist (треба Plus Jakarta Sans + JetBrains Mono).
- `app/page-old.js` — мертвий код з 10 прямими `fetch()`.
- Alias `@/*` оголошено в `jsconfig`, але імпорти — довгі відносні (`../../...`).
- Немає станів **empty/error** (лише `loading`); a11y-прогалини (кнопки/інпути без `aria`/`label`); магічні константи (`w-72`).

## Мета

1. **Тема керується з ОДНОГО місця** і легко перемикається: семантичні токени → CSS-змінні → Tailwind → компоненти. Зміна теми = зміна `data-theme` (або значень токенів) в одному файлі/місці, без правок по всіх компонентах.
2. **Мова легко й доступно перемикається**: реальний `t()`, робочий `LanguageSwitcher`, повні словники uk/pl/en, увесь текст через `t()`.
3. **Стан — у `store/`**, з персистом (тема й мова переживають перезавантаження).
4. **Чиста структура**, без антипатернів, без мертвого коду.

## Обсяг

**IN:** токен-система + теми, i18n-рушій, переведення наявних компонентів на токени + `t()`, прибирання антипатернів фронтенду, чистка структури.
**OUT:** pixel-match макета й нова верстка → план **003**; бекенд → план **002**; UI налаштувань теми (settings) → не зараз (за вимогою власника). Для теми зараз робимо **інфраструктуру + дефолт dark**; UI-перемикач теми не обов'язковий (мова — обов'язково робочий перемикач).

## Цільова архітектура (стисло)

**Токени (єдине джерело — CSS-змінні, бо вмикають рантайм-перемикання):**
- `theme/tokens.css`: два шари.
  - *Primitive* (сира палітра): `--violet-500:#8b5cf6` тощо.
  - *Semantic* (ролі, лише їх вживають компоненти): `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-card`, `--color-text`, `--color-text-muted`, `--color-text-subtle`, `--color-border`, `--color-border-strong`, `--color-accent`, `--color-accent-contrast`, `--color-success`, `--radius`, …
  - Теми: `:root,[data-theme="dark"]{…}` (значення = палітра макета: `--bg:#07080d`, `--accent:#8b5cf6` — з `frontend/design-reference/ai-gateway/NOTES.md`) та `[data-theme="light"]{…}` (світлий набір — щоб перемикання працювало).
- Tailwind v4 `@theme` у `globals.css` мапить семантичні токени на utility (`bg-surface`, `text-muted`, `border-default`, `text-accent`, `font-sans`, `font-mono`).
- Канонічний `theme/tokens.ts` — типізовані константи **імен** семантичних токенів (щоб не було дрейфу); старі `theme/{colors,spacing,...}.ts` прибрати або звести до ре-експорту.

**i18n:**
- `i18n/messages/{uk,pl,en}.json` — namespaced ключі, **повний паритет**.
- `i18n/index.(ts)`: `createTranslator(locale, dict)` → `t(key, vars?)` з інтерполяцією `{var}` + fallback (locale → дефолт → ключ); метадані локалей (`code`, `label`).
- `store/LanguageContext`: тримає `lang`, персист `localStorage`, ініт із storage/браузера, синхронізує `document.documentElement.lang`, віддає `useI18n() → { t, lang, setLang, locales }`.

**Стан:** провайдери у `store/` (`Theme`, `Language`, `ChatMode`); тема пише `data-theme` на `<html>` + персист; коректне вкладення провайдерів.

---

## Кроки

### A. Токен-система та тема
- [x] 1. Створити `theme/tokens.css`: primitive-палітра + semantic-токени + набори `[data-theme="dark"]` (= палітра макета) і `[data-theme="light"]`.
- [x] 2. Переписати `app/globals.css`: імпорт `tokens.css`; Tailwind v4 `@theme` → семантичні CSS-змінні; базові `body` bg/text/font із токенів; прибрати дефолтну палітру шаблону та Arial.
- [x] 3. Шрифти: у `layout.js` замінити Geist на **Plus Jakarta Sans** + **JetBrains Mono** (`next/font/google`), віддати як CSS-змінні, змапити в `@theme` (`--font-sans`, `--font-mono`).
- [x] 4. Переписати `store/ThemeContext`: стан `'dark'|'light'`, запис `data-theme` на `document.documentElement`, персист `localStorage`, ініт зі storage/системи, `useTheme()` + перелік тем. (Без settings-UI.)
- [x] 5. Прибрати дрейф токенів: видалити невживані `theme/{colors,spacing,radius,shadows,typography}.ts` або звести до `theme/tokens.ts` (типізовані імена семантичних токенів). Жодного «другого джерела» кольорів.

### B. i18n-рушій
- [x] 6. Реструктурувати словники: `i18n/messages/{uk,pl,en}.json`, namespaced ключі, повний паритет; додати ВСІ рядки, знайдені в компонентах.
- [x] 7. Створити `i18n/index.ts`: `createTranslator` + `t(key, vars)` (інтерполяція + fallback) + метадані локалей.
- [x] 8. Переписати `store/LanguageContext`: `lang` + персист + ініт + синхронізація `<html lang>`, експорт `useI18n() → {t, lang, setLang, locales}`.

### C. Міграція компонентів (без зміни розкладки)
- [x] 9. `LanguageSwitcher`: зробити робочим (через `useI18n`, перемикає `lang`, active-стан, a11y: `aria-pressed`/клавіатура), текст через `t()`.
- [x] 10. Перевести **весь** UI-текст на `t()` у: `PromptInput`, `ComparePage`, `ChatModeSelector`, `ProfileCard`, `AccountCard`, `NewChatButton`, `ChatList`, `MessageList`, `MessageBubble`, `SelectorBanner`, `StatusBanner`, `ErrorBanner`, `CompareModal`, `ModelScoreCard`, `ManualSelectionButton`, `ChatPage` (+ ключі в словники).
- [x] 11. Перевести **всі** захардкоджені кольори (`*-gray-*`, `bg-transparent` тощо) на семантичні класи/токени в усіх компонентах і `layouts/*`. Хардкоду кольорів не лишається.
- [x] 12. Винести магічні константи (ширина сайдбару тощо) у токени/спільні константи.

### D. Стан, структура, чистка
- [x] 13. Додати стани **loading / empty / error** у `ChatPage`, `ComparePage`, `CompareModal` (зараз лише `loading`).
- [x] 14. Видалити мертвий код: `app/page-old.js`.
- [x] 15. Полагодити `layout.js`: коректні `metadata` (назва/опис), `lang` із провайдера, охайне форматування.
- [x] 16. Уніфікувати імпорти на `@/` alias; прогнати ESLint/формат; узгодити стиль.
- [x] 17. Перевірити вкладення провайдерів і персист (тема + мова переживають reload).

### E. Перевірка
- [x] 18. `next build` зелений; перемикання мови оновлює **весь** текст і персиститься; зміна теми (через `data-theme`/тимчасовий тогл) ре-темізує **весь** застосунок з одного місця; немає помилок у консолі; grep не знаходить хардкод кольорів/тексту в компонентах.

---

## Перевірка (Definition of Done)
- [x] Зміна **одного** місця (значень токенів / `data-theme`) ре-темізує весь застосунок — перевірено.
- [x] Перемикання мови оновлює весь видимий текст; `lang` персиститься; `<html lang>` коректний.
- [x] У компонентах **немає** хардкоду кольорів і тексту (grep чистий); немає `fetch` у компонентах; текст лише через `t()`.
- [x] Словники uk/pl/en у повному паритеті.
- [x] Стани loading/empty/error наявні у відповідних екранах.
- [x] `page-old.js` видалено; `layout.js` metadata коректні; шрифти = Jakarta + JetBrains.
- [x] `next build` зелений; режими Single/Compare працюють без регресій.
- [x] Цей план: `status: done`, усі `[x]`, «СТАН» актуальний.

## Ризики / нотатки
- Tailwind v4 використовує `@theme` у CSS (не `tailwind.config`); токени мапимо там.
- Канон кольору — **CSS-змінні** (вмикають рантайм-тему); TS — лише типізовані імена, не значення.
- Не чіпати розкладку/верстку під макет — це план 003 (щоб не змішати «систему» і «візуал»).
- Контракти даних брати з [../03-api-contracts.md](../03-api-contracts.md) / [../04-data-models.md](../04-data-models.md).
