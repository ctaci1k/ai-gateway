---
plan: 018-final-ux-polish
status: done
updated: 2026-05-31 (крок 9 — план завершено)
---

# PH18 — Фінальний поліш: BYOK-тексти, скрол, ліміти, картка акаунта

> Завершальна партія дрібних, але важливих правок UX після PH17 (BYOK + живі
> ліміти). Усі рішення власника вже ухвалені (нижче). Enterprise-рівень: без
> заглушок/TODO/напівфіч. Кроки атомарні, бекенд → фронтенд, гейти після кожного.
> Коміт/пуш — лише на пряме прохання власника.

## СТАН (читається першим у новій сесії)
- Останній виконаний крок: **9** — доки оновлено (03 стрім-`reason`+вікно; 05 ліміт власного ключа; 08 секція PH18; 10 D-13); фінальні гейти BE(128)+FE зелені; live-smoke (uvicorn boot+`/providers/info`+`/auth/me` вікно; next dev root 200) пройдено. **План завершено, status: done.**
- Наступний крок: — (немає; PH18 завершено).
- Заблоковано: **ні**.
- Змінені файли: FE — `i18n/messages/{en,pl,uk}.json` (1,3,5), `theme/components.css` (2,4,5), `components/chat/MessageScroll.tsx` (новий, 5), `features/chat/ChatPage.tsx`+`features/compare/ComparePage.tsx` (5), `components/account/LimitBanner.tsx` (6). BE — `services/quota_service.py`, `memory/usage_repository.py`, `tests/test_admin_quotas.py` (6); `seed_accounts.py` (форматування, щоб black-гейт зелений).
- Відкриті питання/рішення: після виконання внести **D-13** у `docs/10-open-decisions.md`.

---

## Ухвалені рішення (власник, 2026-05-31) — внести як D-13

- **Білінг моделі судді в Single = Варіант A.** На **своєму** ключі ми ліміти **не списуємо** взагалі; списуємо **лише** за використання **вбудованих** AI (ключі застосунку). Вбудований суддя (Qwen) у Single **не пропонується**; якщо користувач вписав **свою** модель у поле «Суддя» — вона з'являється чіпом у Single з позначкою «ваша / без обмежень». (Узгоджує суперечність D-12-текстів.)
- **Ліміти власного ключа невидимі нам.** Усередині ключа користувача можуть бути власні ліміти провайдера. Коли провайдер віддає rate-limit/quota на BYOK-моделі — показуємо **окреме, грамотне** повідомлення («ліміти вашого ключа вичерпано — перевірте у своєму акаунті провайдера»), чітко відмінне від нашого `quota_exceeded`.
- **Ім'я автора — латиницею в усіх мовах:** «**Stanislav Byndas**».
- **Хвилинний ліміт — повний скид:** після завершення хвилинного вікна (від 1-го запиту) лічильник повертається **повністю до ліміту** (напр. одразу 5), а не +1 поштучно. Фіксоване вікно, узгоджене між enforcement і відображенням.

---

## Контекст із коду (ground truth, звірено 2026-05-31 — підтвердити перед змінами)

- **BYOK-тексти:** i18n-ключі `keys.notePartial` (містить «…і лише якщо це не суддя») та `keys.noteJudgeSingle` у `frontend/i18n/messages/{en,pl,uk}.json`; рендеряться у `frontend/components/keys/KeysModal.tsx` (блок `.keys-notes`). Чіп судді в Single додається у `ModelSwitcher.tsx` лише коли `judgeActive` (тобто користувач вписав свій ключ судді) — вбудований Qwen у Single **вже** не показується. Зелена плашка для нього — `KeysStatusBanner.tsx` (`singleProvider === JUDGE_SLOT → judgeActive`).
- **Скролбар BYOK:** `.keys-dialog { overflow-y:auto }` у `frontend/theme/components.css` (дефолтний скрол). Тематичний тонкий скрол уже є — клас `.thin-scroll` (≈ряд 447–466) + токени `--scrollbar-thumb`/`--scrollbar-thumb-hover` (`theme/tokens.css`); `.msgs` його використовує.
- **Ім'я автора:** `author.name` у `i18n/messages/uk.json` = «Станіслав Биндас» (кирилиця), pl/en — свої. Рендер — `frontend/components/sidebar/AuthorCard.tsx`.
- **Банер лімітів:** `frontend/components/account/LimitBanner.tsx` + CSS `.limit-banner`/`.limit-banner-body`/`.limit-row`/`.limit-reset` у `theme/components.css` (≈ряд 1215+). `.limit-row` має `justify-content: space-between`; довгі pl/uk тексти + `white-space:nowrap` на `.limit-reset` вилазять за межі сайдбара.
- **Скрол-контейнер чату:** єдиний `.msgs` (Single — `features/chat/ChatPage.tsx`; Compare — `features/compare/ComparePage.tsx`). Поле вводу — `components/chat/PromptInput.tsx` всередині `ChatContainer`. Зараз кнопки «вниз» немає; авто-скролу на сабміті немає.
- **Хвилинне вікно:** `backend/services/quota_service.py` — наразі **ковзне** 60с-вікно (`count_since(now-60s)`, `earliest_since`), що відновлює слоти поштучно. `/auth/me` (`schemas/auth.py::MeResponse`) віддає `remaining_this_minute`/`minute_resets_in_seconds`. FE-тикер — `LimitBanner.tsx` (1с, refetch на 0). `UsageRepository` рахує з `usage_events`. **Без нових таблиць.**
- **Картка акаунта:** `frontend/components/sidebar/ProfileCard.tsx` — `.acct` з `acct-av` (іконка), `acct-name` (username), `acct-sub` (`t("profile.subtitle")` = «Мультимодельний асистент»), `acct-logout`. Мертві(?) ключі: `profile.subtitle`, `account.subtitle` — звірити вживання перед видаленням.
- **Помилки BYOK-моделі:** Compare — `failed_providers[].reason` (`rate_limited`/`timeout`/`empty_response`/`unavailable`) із `classify_provider_failure` (`provider_service.py`); рендер — `CompareFailedCard.tsx` (має `useKeys().byokModelId`, тож знає BYOK-слот). Single — стрім віддає термінальну подію `{type:"error", content}` (`routes/chat.py::chat_stream`) **без** коду/reason; FE `ComposerContext.sendMessage` кладе текст у `error`, показує `ErrorBanner` у `ChatPage`. `KeysContext.isOwnKey(slot)` дозволяє відрізнити свій ключ на FE.

---

## Кроки (атомарні; гейти після кожного)

- [x] **0. Bootstrap + план.** Прочитати CLAUDE.md, docs/README, docs/08, docs/10, цей план; звірити «Контекст із коду» з реальним кодом. Без змін коду.

- [x] **1. BYOK-тексти (Варіант A).** Переписати `keys.notePartial`/`keys.noteJudgeSingle` (uk/pl/en) так, щоб НЕ суперечили: на своєму ключі будь-яка модель у Single — без списання; ліміти списуються лише за вбудовані AI; вбудований суддя в Single не пропонується, своя модель у полі «Суддя» доступна в Single як «ваша/без обмежень»; Compare безлімітний лише коли всі учасники на своїх ключах. Прибрати фразу «…і лише якщо це не суддя». Гейти FE (tsc/eslint/prettier/vitest/build; i18n паритет).

- [x] **2. Тематичний скролбар BYOK.** Додати `.thin-scroll` (або застосувати ті ж правила) до `.keys-dialog`. Лише CSS/клас. Гейти FE.

- [x] **3. Ім'я автора латиницею.** `author.name` = «Stanislav Byndas» у `i18n/messages/{uk,pl,en}.json`. Гейти FE (паритет).

- [x] **4. Банер лімітів — без переповнення (PL/UK).** Полагодити `.limit-row`/`.limit-reset`/`.limit-banner-body` (перенос рядків / `flex-wrap` / `min-width:0` / зняти `white-space:nowrap` де треба), щоб довгі pl/uk тексти лишались у межах сайдбара. За потреби — дрібна правка структури `LimitBanner.tsx`. Звірити всі 3 мови. Гейти FE.

- [x] **5. Кнопка «прокрутити вниз» + авто-скрол.** Новий компонент `components/chat/ScrollToBottom.tsx` (+ за потреби хук `useStickToBottom`) у спільному місці над полем вводу (`ChatContainer`/`PromptInput`), спільний для Single і Compare. Поведінка: показується, лише коли `.msgs` прокручено НЕ до низу; клік → плавно вниз; після відправки нового промта — авто-скрол у самий низ (і триматись низу під час стріму, якщо користувач унизу). Стани/іконка — токени + наявний icon-set (`IconChevron`). Без дублювання між Single/Compare. i18n для aria-label. Гейти FE.

- [x] **6. Хвилинний ліміт — повний скид.** Бекенд `QuotaService`: зробити **фіксоване** хвилинне вікно — після завершення (від 1-го запиту) `remaining_this_minute` повертається до повного ліміту, не поштучно. Узгодити enforcement із цією семантикою (без нових таблиць; обчислення з `usage_events`). За потреби уточнити `minute_resets_in_seconds`. FE-тикер `LimitBanner`: на 0 — refetch і показ повного ліміту (без проміжного +1). **Тести:** оновити/додати кейс у `backend/tests/test_admin_quotas.py` (повний скид після вікна). Гейти BE (pytest/ruff/black) + FE.

- [x] **7. Картка акаунта — спрощення.** `ProfileCard`: прибрати `acct-sub` (підпис), ім'я (username) по центру, лишити іконку + «Вийти». Підправити CSS `.acct`/`.acct-name`/`.acct-logout`. Видалити мертві i18n-ключі `profile.subtitle` (і `account.subtitle`, якщо не вживається — спершу `grep`) з uk/pl/en. Гейти FE.

- [x] **8. Повідомлення про ліміт ВЛАСНОГО ключа.** Коли BYOK-модель віддає rate-limit/quota:
  - **Compare:** `CompareFailedCard` для BYOK-слота (`isOwnKey(failed.provider)` + `reason==="rate_limited"`) показує окреме повідомлення «Ліміти вашого ключа вичерпано — перевірте у своєму акаунті провайдера» замість загального.
  - **Single:** прокинути `reason` у термінальну подію стріму (`routes/chat.py::chat_stream` → `{type:"error", reason}` через `classify_provider_failure`), FE (`ComposerContext`/`ChatPage`) показує BYOK-специфічне повідомлення, якщо обрана модель — на своєму ключі (`isOwnKey`).
  - Чітко відрізняти від нашого `quota_exceeded`. i18n uk/pl/en. **Тести:** за потреби — кейс на reason у стрім-помилці. Гейти BE + FE.

- [x] **9. Доки + D-13 + зелено + live.** Оновити `docs/03` (стрім-подія `error` з `reason`, якщо додано), `docs/05`/`docs/08` (поведінка вікна, BYOK-повідомлення), `docs/10` (**D-13**). Перезапустити обидва набори гейтів. Live-сценарій (uvicorn+npm): BYOK-тексти без протиріч; скролбар у вікні ключів; ім'я автора латиницею в 3 мовах; банер лімітів не вилазить (pl/uk); кнопка «вниз» + авто-скрол; хвилинний скид до повного ліміту; картка акаунта спрощена; повідомлення про ліміт власного ключа. Виставити `status: done`.

---

## Перевірка (Definition of Done)
- [x] BYOK-тексти узгоджені (Варіант A), без фрази-протиріччя; паритет uk/pl/en.
- [x] Скролбар у вікні BYOK — тематичний тонкий (як у чаті).
- [x] Ім'я автора — «Stanislav Byndas» в усіх 3 мовах.
- [x] Банер лімітів не виходить за межі сайдбара в жодній мові (uk/pl/en), охайний.
- [x] Кнопка «вниз» по центру над інпутом: з'являється поза низом, повертає вниз; авто-скрол після відправки промта; спільна для Single і Compare; a11y.
- [x] Хвилинний ліміт після вікна скидається ПОВНІСТЮ до ліміту (не поштучно); enforcement узгоджено; тест зелений.
- [x] Картка акаунта: іконка + ім'я по центру + «Вийти»; без підпису; мертві ключі прибрані.
- [x] Ліміт власного ключа → окреме грамотне повідомлення (Compare + Single), відмінне від `quota_exceeded`; i18n.
- [x] Зелено BE+FE; docs (03/05/08/10) оновлені; D-13 внесено; live пройдено.
- [x] Стани UI loading/empty/error; без хардкоду кольорів/текстів; без fetch у компонентах; стан — у store/.
