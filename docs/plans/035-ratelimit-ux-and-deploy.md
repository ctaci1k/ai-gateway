# 035 — Rate-limit UX («безкоштовна модель досягла ліміту») + деплой (PH36)

**Статус:** PLANNED · продовження після PH35 (план 034).
**Власник:** Stanislav

> **Цей план написаний для виконання в новому чаті (Cloud AI / Claude Code).**
> Працювати **атомарно**: один крок R → перевірка (gate) → коміт-готовність → наступний.
> Прогрес фіксувати **тільки в цьому файлі** (мітка `[x]` біля кроку + 1 рядок підсумку).

---

## ✅ ВЖЕ ЗРОБЛЕНО (PH35 / план 034) — НЕ ВІДКАТУВАТИ, НЕ ПЕРЕРОБЛЯТИ

Заміна провайдерів-відповідачів + мобільний UX **уже виконана й гейти зелені** (BE 222 + ruff/black; FE tsc/vitest 40/eslint/prettier; i18n паритет). **Код НЕ закомічено й НЕ задеплоєно.** Конкретно:

- **Ростер відповідачів = `groq` (Llama 3.3 70B) + `mistral` (Mistral Small) + `gemini` (Gemini 2.0 Flash).**
  - Cerebras (5 req/min) і SambaNova (20 req/добу) прибрано (занадто жорсткі ліміти).
  - NVIDIA NIM спершу обрали, але **відкинули** (ненадійний доступ/реєстрація за фідбеком власника).
  - **Слот 3 = Google Gemini через OpenAI-сумісний ендпоінт** (`providers/gemini_responder.py`, base `https://generativelanguage.googleapis.com/v1beta/openai/`), модель `gemini-2.0-flash` (free 15 req/min + 1500 req/добу). **Переюзає наявний `GEMINI_API_KEY`** (той самий, що embeddings; інша модель → окремий rate-bucket).
  - Цей `gemini`-responder **ОКРЕМИЙ** від легасі `providers/gemini_provider.py` (genai SDK, лише опційний суддя при `SELECTOR_PROVIDER="gemini"`, неактивний).
- **Суддя — Groq · `qwen/qwen3-32b` — НЕ ЧІПАВСЯ.** Безпека D-20/D-21/D-22, квоти, `billable`, one-row-per-turn ledger, winner-логіка — без змін.
- **Env:** власник **уже додав `MISTRAL_API_KEY`** у свій env-файл (лише значення, без коментарів). `GEMINI_API_KEY` уже існував (embeddings) → новий ключ для слота 3 НЕ потрібен. `GROQ_API_KEY` на місці. Старі `CEREBRAS_*`/`SAMBANOVA_*` ігноруються (`extra="ignore"`).
- **Мобільний UX:** `ModeSwitch.tsx` (2 кнопки режимів ≤768px) + `CreatorCard variant="menu"` у `AccountMenu` (мобільна картка автора між Security і Logout). Десктоп не чіпано.
- **Деталі:** [08-current-state.md](../08-current-state.md) (PH35) і [10-open-decisions.md](../10-open-decisions.md) (D-25). Журнал плану — [034-providers-swap-and-mobile-ux.md](034-providers-swap-and-mobile-ux.md).

**→ Жодного кроку з блоку «ВЖЕ ЗРОБЛЕНО» НЕ повторювати. Лише кроки R нижче + деплой.**

---

## Залізні правила (override усього)

1. **Не вигадувати стан** — звіряйся з кодом перед кожним твердженням.
2. **НЕ чіпати:** суддю (Groq·`qwen/qwen3-32b`), шифрування BYOK (D-20), маски ключів (D-21), slot-vs-model (D-22). Plaintext-ключ / KEK — ніколи в логах/відповідях/ledger.
3. **Мінімальний радіус:** не ламати квоти, `billable`, one-row-per-turn ledger, winner-логіку, логіку вибору переможця суддею.
4. **Frontend golden rules:** без дублювання JSX/стилів/текстів; тексти лише через `t("key")` з **паритетом uk/pl/en**; кольори/відступи через design tokens.
5. **STOP лише якщо вимога суперечить безпеці/рішенням** — інакше вирішуй сам і фіксуй рішення тут.
6. **Жодного `docker compose down -v`.** Жодних деструктивних дій з БД.
7. **Не комітити й не деплоїти, доки власник не попросить.**

---

## Мета (нова вимога власника)

Коли запит падає через **rate-limit вбудованої (безкоштовної, на ключах застосунку) моделі**, «червоне» повідомлення має пояснювати користувачу **простими словами**, що:

- це **тимчасовий ліміт безкоштовної моделі** (за хвилину), не помилка нашого сервісу;
- треба **трохи зачекати**, і чат **знову відповідатиме**;
- це **обмеження провайдера безкоштовного API** (модель працює на безкоштовних API-ключах), тож **не залежить від нас**;
- перепрошуємо за незручність.

**Важлива межа (не плутати дві різні речі):**
- **App-key (вбудований) rate-limit** = безкоштовна модель досягла ліміту провайдера → **нове, «дружнє» повідомлення** (цей план).
- **Own-key (BYOK) rate-limit** = ліміт ВЛАСНОГО ключа користувача → **уже є** окреме повідомлення `errors.ownKeyRateLimited` / `compare.fail.ownKeyRateLimited` (D-13) — **НЕ чіпати**.
- **Наш request-quota** (`quota_exceeded`, ліміти акаунта) — **окреме**, не чіпати.

---

## Кроки

### R1 — Compare: «червона» картка провайдера (app-key rate-limit)
**Файли:** `frontend/i18n/messages/{en,uk,pl}.json`. Логіка вже коректна: `components/compare/CompareFailedCard.tsx` мапить `rate_limited` (built-in) → `compare.fail.rateLimited`, а own-key → `compare.fail.ownKeyRateLimited` (рядки 13–38). **Міняємо лише текст built-in-ключа.**
- [x] Переписати `compare.fail.rateLimited` (3 мови) на дружнє пояснення (приблизний зміст):
  - **uk:** «Безкоштовна модель тимчасово досягла ліміту запитів за хвилину. Зачекайте трохи — невдовзі вона знову відповідатиме. Це обмеження безкоштовного API провайдера, не нашого сервісу. Перепрошуємо за незручність.»
  - **en:** «This free model hit its per-minute request limit. Please wait a bit — it will answer again shortly. This is the free API provider's limit, not our service. Sorry for the inconvenience.»
  - **pl:** «Darmowy model chwilowo osiągnął limit zapytań na minutę. Poczekaj chwilę — wkrótce znów odpowie. To limit darmowego API dostawcy, nie naszej usługi. Przepraszamy za niedogodności.»
- [x] **НЕ чіпати** `compare.fail.ownKeyRateLimited` (це BYOK-ключ користувача).
- **Gate:** FE `tsc --noEmit` + i18n parity (`i18n/index.test.ts`) зелено; у Compare-картці впалого app-key responder з `reason="rate_limited"` показується новий текст 3 мовами.

### R2 — Single: дружнє повідомлення для app-key rate-limit
**Файли:** `frontend/store/ComposerContext.tsx` (рядки ~177–190), `frontend/i18n/messages/{en,uk,pl}.json`.
Зараз: own-key rate-limit → `errors.ownKeyRateLimited`; **built-in rate-limit падає в `else` → показує сирий `err.message`** (немає дружнього тексту).
- [x] Додати i18n-ключ `errors.rateLimited` (3 мови) — той самий зміст, що R1 (можна трохи довший, бо це банер, не картка).
- [x] У `catch` додати гілку **перед** загальним `else`: `else if (reason === "rate_limited") setError({ messageKey: "errors.rateLimited" })`. (Own-key гілка `ownKeyRateLimited` лишається вище — не чіпати.)
- **Gate:** FE `tsc` + `vitest` + i18n parity зелено; у Single при built-in `rate_limited` показується новий локалізований текст, при own-key — старий `errors.ownKeyRateLimited`.

### R3 — Перевірка контракту reason-кодів (без змін коду, якщо все ок)
- [x] Звірити, що backend `services/provider_service.py::classify_provider_failure` для 429/«rate»/«quota»/«too many»/«queue» повертає `"rate_limited"` (уже так — рядки 99–106). Жодних змін у бекенді не потрібно — це лише FE-копірайт.
- [x] Переконатися, що `is_byok` коректно розрізняє app-key vs own-key у Compare (`CompareFailedCard` уже читає `failed.is_byok`, рядок 33) і Single (`byokModelId(provider) !== null`, `ComposerContext` рядок 180). **Не міняти логіку.**
- **Gate:** grep — жодного нового хардкоду; reason-коди не зламані; BE pytest без змін лишається зеленим (нічого не міняли).

### R4 — Гейти + готовність
- [x] `cd backend && pytest -q` + ruff + black — зелено (222 passed, ruff/black clean; бекенд не чіпали).
- [x] `frontend`: `tsc --noEmit`, `vitest` (40 passed), `eslint .`, `prettier --check` — зелено.
- [x] i18n паритет uk/pl/en (новий `errors.rateLimited`; переписаний `compare.fail.rateLimited`) — `i18n/index.test.ts` зелено.
- **Gate:** усе зелено; коміт-готовність.

### R5 — Деплой (дії власника) — env уже готовий
- [ ] **Env уже заведено:** `MISTRAL_API_KEY` власник додав; `GEMINI_API_KEY` уже був; `GROQ_API_KEY` на місці. **Нічого більше реєструвати не треба** (Gemini-слот переюзає наявний ключ).
- [ ] Merge у `main` → CI → Deploy (GHCR → VPS, `docker compose pull && up`). **Міграцій БД немає** — `alembic upgrade head` = no-op.
- [ ] Після деплою: якщо aaPanel-проксі кешує — звірити через `?v=N` (пуш `no-store` уже на місці).
- **Gate (власник):** на `https://ai.st.byn.sarl/` Compare відповідає groq/mistral/gemini; при рідкісному rate-limit безкоштовної моделі показується нове дружнє повідомлення.

---

## На майбутнє (поза цим планом, але зафіксувати)

- **Авто-ретрай/таймер на rate-limit:** показувати зворотний відлік «спробуйте за N с» і/або автоматичний повтор запиту для впалого app-key responder, щоб користувач не тиснув вручну. (Зараз — лише текст.)
- **Чому це важливо:** ростер працює на **безкоштовних** API-ключах зі спільними хвилинними/добовими лімітами; за пікового навантаження окремий слот може тимчасово відмовляти. Користувач має **розуміти, що це мине** і сервіс не зламаний. Повідомлення R1/R2 — мінімальний крок; таймер/ретрай — наступний.

---

## Журнал виконання (заповнювати під час роботи)

| Крок | Статус | Підсумок (1 рядок) |
|---|---|---|
| R1 Compare card copy | ✅ | `compare.fail.rateLimited` переписано на дружнє пояснення (en/uk/pl); own-key-ключ не чіпано; tsc+i18n parity зелено. |
| R2 Single message | ✅ | `errors.rateLimited` (en/uk/pl) + гілка `else if (reason==="rate_limited")` у `ComposerContext` catch перед загальним `else`; own-key гілка вище не чіпана; tsc+vitest(40)+i18n зелено. |
| R3 contract check | ✅ | BE `classify_provider_failure` → `rate_limited` для 429/rate/quota/too many/queue (без змін); `is_byok` розрізняє app vs own-key у Compare (рядок 33) і Single (рядок 180); жодного нового хардкоду. |
| R4 gates | ✅ | BE 222 passed + ruff/black clean (без змін); FE tsc + eslint + prettier clean, vitest 40/40, i18n parity зелено. Коміт-готовність. |
| R5 deploy (owner) | 🟡 готово для власника | Код R1–R4 готовий і всі гейти зелені. Env уже заведено (`MISTRAL_API_KEY`/`GEMINI_API_KEY`/`GROQ_API_KEY`). Очікує дій власника: commit → merge у `main` → CI/Deploy (GHCR→VPS, `docker compose pull && up`). Міграцій БД немає (alembic upgrade head = no-op). Після деплою — звірити дружнє rate-limit-повідомлення на проді. |

## Чого НЕ робимо
- Не чіпаємо суддю, шифрування BYOK, маски, slot-vs-model, квоти/`billable`/ledger/winner-логіку.
- Не переробляємо PH35 (провайдери groq/mistral/gemini + мобільний UX) — воно вже зроблене.
- Не плутаємо app-key rate-limit (нове повідомлення) з own-key BYOK (`errors.ownKeyRateLimited`, лишається) і з `quota_exceeded` (наш ліміт акаунта).
