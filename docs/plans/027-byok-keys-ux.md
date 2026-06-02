---
plan: 027-byok-keys-ux
status: done
updated: 2026-06-02
---

# PH29 — BYOK «API-ключі»: UX base URL (Select), суддя+Clear, інфо-підказки, чесні тексти

> Власник: «незрозуміло, звідки брати base URL — це незручно». Рішення архітектора:
> base URL більше **не вільний текст наосліп**, а **Select з готовими, перевірено
> сумісними endpoint'ами** (+ «Власний…»), доданий і до **судді**; у судді —
> кнопка **«Очистити»** (повернути типове); кастомні AI 4/AI 5 — лишають
> **«Видалити»**; додаємо **інфо-кнопки (ⓘ)**: де взяти ключ і що саме вводити в
> «ID моделі» + як це повʼязано з base URL. Тексти-підказки переписуємо під реальні
> поля. **Це переважно фронтенд** — бекенд уже приймає `base_url` для будь-якого
> слота (PH22) і для судді (`build_transient_judge`).

## Чому саме так (ухвалені рішення архітектора)
1. **Base URL = курований Select, не вільний рядок.** Користувач не має вгадувати
   URL. Показуємо список перевірених OpenAI-сумісних endpoint'ів + «Власний…»
   (тоді відкривається текстове поле — поточна поведінка як fallback).
2. **Дефолтні слоти (groq/cerebras/sambanova):** Select за умовчанням = «Типовий
   ендпоінт провайдера» (= порожній `baseUrl`, бекенд бере фіксований). Інший
   пресет/власний — перевизначає (PH22 уже підтримує).
3. **Суддя теж отримує Select base URL** (зараз у судді поля base URL немає вза­галі;
   `JudgeKey` не має `baseUrl`). Дефолт судді — Groq-ендпоінт.
4. **Кнопка «Очистити» праворуч у судді** (дзеркалить «Видалити» кастомних рядків):
   чистить key/model/baseUrl → суддя повертається до вбудованого (Qwen на Groq).
5. **Інфо-кнопки (ⓘ)** на «API-ключ» (де взяти + що це) і «ID моделі» (як вибрати,
   що має збігатися з каталогом провайдера, парність із base URL). Спільний a11y
   `InfoTip` (button + popover, Esc/click-out, `aria-describedby`).
6. **Тексти під реальні поля.** Переписати `keys.intro`/`keys.notes*` і плейс­холдери
   так, щоб відповідали трьом полям (Base URL Select / API-ключ / ID моделі) і
   ролям слотів (дефолт = опційне перевизначення; кастом = повний сумісний
   ендпоінт; суддя = опційний).

## Контекст із коду (ground truth — звір перед кроком)
- **FE форма:** `components/keys/KeysForm.tsx` — рядок судді (лише `apiKey`+`modelId`,
  **без base URL**), дефолтні слоти (`baseUrl` як **текст**, placeholder
  `keys.baseUrlOptional`), кастомні (`baseUrl` текст, обовʼязковий, +«Видалити»).
  `KeyInput` — масковане поле з show/hide.
- **FE стан:** `store/KeysContext.tsx` — `ResponderKey{slot,baseUrl,apiKey,modelId,
  custom,active}`; **`JudgeKey{apiKey,modelId,active}` — без `baseUrl`** (додати);
  `ByokPayload.judge{base_url?,api_key,model_id}` (бекенд приймає base_url судді);
  `buildPersistedState`/`byokPayload`/`saveAndValidate`/`sanitizeLoadedState` — не
  дублювати логіку, лише розширити judge.baseUrl.
- **BE (без змін):** `services/provider_service.py::DEFAULT_BASE_URLS` =
  groq `https://api.groq.com/openai/v1`, cerebras `https://api.cerebras.ai/v1`,
  sambanova `https://api.sambanova.ai/v1`; `_transient_base_url` (дефолтний слот:
  base_url або фіксований ендпоінт; кастом потребує base_url); `build_transient_
  judge` (judge base_url або Groq). Валідація — `POST /keys/validate`.
- **i18n** — flat `t()` (паритет uk/pl/en); без `fetch` у компонентах; кольори/
  відступи — токени; стан — `store/`.

## Каталог base URL (курований список для Select)
**Вбудовані / перевірені (наші відповідачі):**
| Провайдер | base URL |
|---|---|
| Groq | `https://api.groq.com/openai/v1` |
| Cerebras | `https://api.cerebras.ai/v1` |
| SambaNova | `https://api.sambanova.ai/v1` |

**Сумісні (OpenAI-compatible, перевір актуальність перед релізом):**
| Провайдер | base URL |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Together AI | `https://api.together.xyz/v1` |
| Fireworks AI | `https://api.fireworks.ai/inference/v1` |
| DeepSeek | `https://api.deepseek.com` |
| Mistral | `https://api.mistral.ai/v1` |
| xAI (Grok) | `https://api.x.ai/v1` |
| Google Gemini (OpenAI-сумісн.) | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Perplexity | `https://api.perplexity.ai` |
| Ollama (локально) | `http://localhost:11434/v1` |

> **Anthropic (Claude)** — НЕ кладемо у Select: його API не є chat/completions-
> сумісним так само, як решта (інший формат), тож через цей BYOK-механізм він не
> запрацює без окремого адаптера. Якщо знадобиться — окремий план.

Зберігаємо як єдину FE-константу `BYOK_BASE_URLS` (масив `{label,url,group}`),
дзеркало бекендових дефолтів. Дублювання URL — лише тут.

---

## Кроки (атомарні; FE-гейти tsc/eslint/prettier/vitest/build + i18n паритет)

### Блок A — дані/константи
- [x] **A1. `BYOK_BASE_URLS`** — нова FE-константа (`utils/byokEndpoints.ts` або в
  `KeysContext`): курований список `{label,url,group:"builtin"|"compatible"}` за
  каталогом вище. Хелпери: `presetForUrl(url)`/`isKnownUrl(url)`.
- [x] **A2. `JudgeKey.baseUrl`** — додати поле в `KeysContext` (дефолт `""`);
  прокинути у `byokPayload` (`judge.base_url` лише якщо непорожнє), у
  `buildPersistedState`/`sanitizeLoadedState`/`saveAndValidate`. Без зміни логіки
  активації. Тести `KeysContext.test.ts` оновлено (+ кейс legacy-нормалізації).

### Блок B — компонент Select + InfoTip
- [x] **B1. `BaseUrlSelect`** (`components/keys/BaseUrlSelect.tsx`) — `<select>` з
  опціями каталогу (групи optgroup «Вбудовані»/«Сумісні») + «Типовий ендпоінт»
  (лише для дефолтних слотів) + «Власний…»; вибір «Власний…» показує текстове поле
  (поточний інпут). value=url; для дефолтного слота «Типовий» → `baseUrl=""`. a11y
  (label, keyboard — нативний select). + опційний слот `info` для ⓘ біля підпису.
- [x] **B2. `InfoTip`** (`components/common/InfoTip.tsx`) — кнопка ⓘ + popover
  (Esc/click-out/focus, `aria-describedby`/`role="note"`), на токенах. Переюзовний.

### Блок C — інтеграція у форму
- [x] **C1. Суддя:** додано `BaseUrlSelect` (опція «Вбудований суддя (Groq)») + ⓘ
  біля Base URL/«API-ключ»/«ID моделі»; праворуч у `keys-row-head` — кнопка
  **«Очистити»** (`keys.clear`) → чистить judge.{apiKey,modelId,baseUrl}, `active=false`,
  скидає judge-результат і ремаунтить select (нюанс custom-mode).
- [x] **C2. Дефолтні слоти:** текстовий base URL замінено на `BaseUrlSelect`
  (дефолт «Типовий ендпоінт провайдера»); ⓘ біля Base URL/API-ключ/«ID моделі».
- [x] **C3. Кастомні AI 4/5:** `BaseUrlSelect` (без «Типовий»; за умовч. «Власний…»);
  **«Видалити»** лишено; ⓘ біля полів.
- [x] **C4. Тексти:** переписано `keys.intro` під 3 поля; прибрано мертвий
  `keys.baseUrlOptional`; нові ключі `keys.clear`, `keys.baseUrlSelect`,
  `keys.baseUrlBuiltin`, `keys.baseUrlCompatible`, `keys.useDefaultEndpoint`,
  `keys.useDefaultEndpointJudge`, `keys.customEndpoint`, `keys.infoLabel`,
  `keys.info.apiKey/modelId/baseUrl` — паритет uk/pl/en (vitest parity ✓).

### Блок D — CSS + a11y + гейти + доки + деплой
- [x] **D1. CSS** — `.keys-select`/`.keys-info`/`.keys-infotip`/`.keys-info-popover`/
  `.keys-clear`/`.keys-field`/`.keys-field-label`/`.keys-head-right` на токенах;
  `.keys-fields` → вертикальна колонка (адаптив 360/430 без скролу), таргети
  select/input/key ≥44px, focus-visible.
- [x] **D2. Гейти** — tsc/eslint/prettier/vitest(27)/build зелені; i18n паритет;
  `store/KeysContext.test.ts` оновлено під judge.baseUrl (+legacy-нормалізація).
  Бекенд — без змін (вже приймав judge `base_url`: KeyValidateEntry+is_judge,
  ByokJudge, build_transient_judge).
- [x] **D3. Доки+деплой** — `docs/06`, `docs/08` (секція PH29), `docs/10` (нотатка
  під D-12/BYOK). `status: done`. Коміт + `git push origin main`.

## Ревізія PH29.1 — фідбек власника (Design X = максимальне спрощення)

> Власник на демо: (1) вбудовані endpoint'и не мають бути **у списку** — до
> вбудованого лише **скидання** («Очистити»); (2) «Очистити» має бути й на AI 1/2/3,
> не лише в судді; (3) «Власний…» (вільний текст) прибрати — лише вибір зі списку;
> (4) не виводити вбудовані провайдери як пункти / слово «Вбудовані»; (5) рядок із
> base URL, але без ключа+моделі **не має зберігатися**.
>
> **Уточнення власника (Варіант A):** base URL **лишається на ВСІХ рядках** (Суддя +
> AI 1/2/3 + кастомні), але **як SELECT** (вибір зі списку перевірених сумісних
> endpoint'ів; **без вбудованих у списку, без вільного тексту**). Для вбудованих
> слотів base URL **необов'язковий**: порожньо = вбудований endpoint (для AI 1/2/3
> це їхній провайдер, для судді — Groq); вибір сумісного = override; повернення до
> вбудованого — кнопкою **«Очистити»** (вбудовані не в списку → «лише скинути»).
> Кастомні AI 4/5 — base URL **обов'язковий** (вибрати зі списку) + «Видалити».
> Неповний рядок (щось є, але нема ключа+моделі) не зберігається.
> **Свідомо прибрано:** вільний текст base URL і вбудовані провайдери зі списку
> (для чужого провайдера — будь-який сумісний зі списку або AI 4/5).

- [x] **E1. Каталог** (`utils/byokEndpoints.ts`) — `BYOK_BASE_URLS` = лише сумісні
  (10 провайдерів), плаский список, прибрано built-in + поле `group`/групи.
- [x] **E2. `BaseUrlSelect`** — чистий `<select>` (каталог + disabled-плейсхолдер
  через prop `placeholder`); прибрано optgroup, default-опцію, текстове поле/
  customMode; fallback-опція для невідомого (legacy) значення. Вбудовані слоти →
  placeholder «Типовий ендпоінт» (порожньо=вбудований); кастомні → «Оберіть
  ендпоінт…». Вбудованих провайдерів у списку нема (лише override-цілі).
- [x] **E3. `KeysForm`** — base URL (SELECT) на ВСІХ рядках (Варіант A): суддя +
  AI 1/2/3 — base URL необов'язковий + ключ+модель (+ⓘ) + кнопка **«Очистити»**
  (`keys.clear`) на всіх трьох + суддя; кастомні AI 4/5 — base URL required +
  ключ+модель+ⓘ, **«Видалити»**. Inline-підказка для неповних
  (`keys.incompleteBuiltin`/`keys.incompleteCustom`).
- [x] **E4. `KeysContext.buildPersistedState`** — неповний built-in слот/суддя
  (нема ключа+моделі) бланкується назад до вбудованого (навіть якщо є лише
  base URL); повний built-in слот зберігає свій base URL override; кастомний
  неповний не валідується/не зберігається. + юніт-тести (blank half-filled +
  keep override).
- [x] **E5. i18n** — прибрано мертві (`useDefaultEndpoint*`, `baseUrlBuiltin`,
  `baseUrlCompatible`, `customEndpoint`, `baseUrl`); додано `keys.baseUrlChoose`,
  `keys.endpointDefault`, `keys.incompleteBuiltin`, `keys.incompleteCustom`;
  паритет uk/pl/en (vitest ✓).
- [x] **E6. CSS+гейти+доки+деплой** — `.keys-hint` на токенах; гейти
  tsc/eslint/prettier/**vitest(29)**/build зелені; `docs/06`/`docs/08`(PH29.1)/
  `docs/10`(D-19 нотатка); `status: done`; коміт+push.

## Definition of Done
- [x] Base URL — **Select** з готовими сумісними endpoint'ами (+«Власний…»), у т.ч.
      **у судді**; дефолтні слоти за умовч. = «Типовий ендпоінт».
- [x] У судді — кнопка **«Очистити»** (повертає типове); кастомні — **«Видалити»**.
- [x] **ⓘ-підказки** на «API-ключ» і «ID моделі» (+ Base URL) (де взяти, що вводити,
      парність із base URL); тексти-нотатки переписані під реальні поля.
- [x] Ключі й далі лише в `sessionStorage`, не в БД/логах; FE-гейти зелені; i18n
      паритет; docs оновлені; задеплоєно.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **E6 (PH29.1, Варіант A)** — ревізія за фідбеком
  власника: base URL — **SELECT на всіх рядках** (вбудовані: необов'язковий,
  порожньо=вбудований, «Очистити»=скид; кастомні: required, «Видалити»), каталог
  без built-in-провайдерів і без «Власний…»/вільного тексту, неповні рядки не
  зберігаються. Гейти tsc/eslint/prettier/vitest(29)/build зелені; доки 06/08/10;
  `status: done`; коміт+push.
- Наступний крок: **— (план завершено)**.
- Змінені файли: `utils/byokEndpoints.ts` (новий), `components/keys/BaseUrlSelect.tsx`
  (новий), `components/common/InfoTip.tsx` (новий), `components/keys/KeysForm.tsx`,
  `store/KeysContext.tsx`, `store/KeysContext.test.ts`, `i18n/messages/{uk,pl,en}.json`,
  `theme/components.css`, `docs/06/08/10`.
- Заблоковано: **ні**. Відкрите питання (нотатка на майбутнє): актуальність
  third-party base URL у каталозі звіряти перед кожним релізом (provider docs).
