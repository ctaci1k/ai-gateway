---
plan: 000-deep-refactor-program
status: done
updated: 2026-05-29
---

# Повний глибокий рефактор — майстер-програма

> Єдина точка входу для **повного** рефактору проєкту: повний інвентар антипатернів + цільова професійна структура + усі під-плани з порядком виконання. Це **карта**; виконавчі кроки — у під-планах `001…006`.
> Метод планування — **rolling-wave**: найближчі плани (001–003) деталізовані покроково; пізніші (004–006) — чіткі за метою/обсягом/DoD, покрокова деталізація фіналізується перед стартом фази (щоб не планувати на застарілому ґрунті).

## СТАН (читається першим)
- Останній виконаний крок: **уся програма PH0–PH12 завершена** ✅ (див. GLOBAL STATE у [EXECUTE.md](EXECUTE.md)).
- Наступний крок: — (лишилась зовнішня залежність — owner піднімає на VPS за `../../DEPLOY.md`).
- Заблоковано: ні.
- Змінені файли: усі під-плани 001–012 — `status: done`; код BE+FE + артефакти деплою. Тести: BE 76 (pytest), FE 7 (vitest). CI зелений локально.
- Відкриті питання/рішення: усі за [../10-open-decisions.md](../10-open-decisions.md) (блокерів немає).

> ⚙️ **Виконання — через [EXECUTE.md](EXECUTE.md)** (безперервний режим, лінійний порядок для одного агента, єдиний якір відновлення). Цей файл (000) — карта/інвентар; EXECUTE — операційний runbook.

---

## 1. Принципи (як робимо)
- **Не вигадуємо стан** — інвентар нижче приземлений на код / [../08-current-state.md](../08-current-state.md).
- **Без зміни поведінки без оновлення контрактів** ([../03-api-contracts.md](../03-api-contracts.md), [../04-data-models.md](../04-data-models.md)).
- **Без напівфіч/заглушок** — кожна фаза доводиться до DoD.
- **Атомарні кроки + персист прогресу** у файлі плану (відновлення сесії).
- **Семантика, не хардкод** (токени, `t()`, типи, конфіг із `.env`).

## 2. Цільова професійна структура

### Backend (еволюція, не переїзд заради переїзду)
```
backend/
├── main.py                 # FastAPI factory: middleware, error handlers, routers
├── core/                   # ★ нове
│   ├── config.py           # Pydantic Settings (ключі, CORS origins, ліміти) ← .env
│   ├── logging.py          # структуроване логування
│   └── errors.py           # типи помилок + хендлери → уніфіковане тіло {error:{code,message}}
├── api/ (routes/)          # ТОНКІ роутери, по концерну: chat / preferences / providers / memory
├── schemas/                # request + ★ RESPONSE моделі (chat, selector, common: ErrorResponse)
├── services/               # orchestrator, provider_service (true-async)
├── providers/              # base (★ спільний json-clean) + concrete (груповий код прибрати)
├── selector/               # judge + fallback + parser + prompt (★ один ALLOWED_MODELS)
├── memory/                 # chat buffer (seam під персист — Фази 4–5 roadmap)
├── tests/                  # ★ pytest
├── requirements.txt        # ★ або pyproject.toml (зараз ВІДСУТНІ)
├── .env.example            # ★ (зараз ВІДСУТНІЙ)
└── README.md               # ★ запуск/конфіг
```

### Frontend (структура вже близька — доводимо до пуття)
```
frontend/
├── app/                    # layout (коректні metadata/шрифти), page; видалити page-old.js
├── layouts/                # MainLayout, ChatLayout (на токенах)
├── components/             # презентаційні; лише семантичні класи + t()
├── features/               # chat, compare (loading/empty/error)
├── services/               # ★ типізовані, base URL з .env, обробка помилок
├── store/                  # Theme/Language/ChatMode (★ персист, реально підключені)
├── theme/                  # ★ tokens.css (єдине джерело) + tokens.ts (типи імен)
├── i18n/                   # ★ messages/{uk,pl,en}.json + index (t, локалі)
├── types/                  # ★ реальні типи під дані /chat (не декоративні)
├── hooks/ · utils/         # спільна логіка
└── design-reference/       # макет (референс для фази 006)
```

## 3. Повний інвентар антипатернів (приземлено)

Серйозність: 🔴 висока · 🟠 середня · 🟡 низька. «План» = де усувається.

### Backend
| # | Антипатерн | Доказ | Сер. | План |
|---|------------|-------|------|------|
| B1 | Помилки = HTTP 200 `{"error"}` | `routes/chat_route.py` | 🔴 | 002 |
| B2 | CORS `*` + `allow_credentials=True` | `main.py` | 🔴 | 002 |
| B3 | Single пише в пам'ять (≠ D-3) | `/chat/stream` | 🟠 | 002 |
| B4 | Синхронні SDK-виклики в `async` → блок event loop, фіктивна паралельність | усі `providers/*` | 🔴 | 003 |
| B5 | Немає response-схем (`response_model`), відповіді — сирі dict | `routes/`, нема в коді | 🟠 | 003 |
| B6 | `chat_route.py` 519 рядків: ручний unpack+repack payload | `routes/chat_route.py` | 🟠 | 003 |
| B7 | `clean_json_response` дубльовано по провайдерах | `providers/*` | 🟡 | 003 |
| B8 | `ALLOWED_MODELS` у двох місцях | `response_selector.py`, `selector_parser.py` | 🟡 | 003 |
| B9 | Крихкий парсинг JSON судді (зріз огорожі) | `gemini_provider.py` та ін. | 🟠 | 002 |
| B10 | Невживані ключі `selector_config` | `config/selector_config.py` | 🟡 | 002 |
| B11 | Глобальний in-memory стан, `maxlen=10`, без персисту/мульти-юзера | `memory/chat_buffer.py` | 🟠 | seam у 003 → roadmap 4–5 |
| B12 | Немає структурованого логування | бекенд загалом | 🟠 | 002 |
| B13 | Немає валідації лімітів / rate-limit | бекенд загалом | 🟠 | 002 |
| B14 | Роздутий стиль (3494 рядки ≈ ×2) | усі `*.py` | 🟡 | 003 + 005 |
| B15 | Конфіг не через Settings/.env | `main.py`, провайдери | 🟠 | 002 + 005 |

### Frontend
| # | Антипатерн | Доказ | Сер. | План |
|---|------------|-------|------|------|
| F1 | i18n-фасад: немає `t()`, словники не вживані, switcher без `onClick`, текст хардкод | `store/LanguageContext`, `LanguageSwitcher`, всі компоненти | 🔴 | 001 |
| F2 | Тема-фасад: токени/`useTheme` не вживані, `globals.css` = дефолт-шаблон, 3 джерела кольору | `theme/*`, `ThemeContext`, `globals.css` | 🔴 | 001 |
| F3 | Хардкод палітри (`gray-*`/`transparent`) | ~13 компонентів | 🔴 | 001 |
| F4 | Хардкод тексту | ~15 компонентів | 🔴 | 001 |
| F5 | Немає станів empty/error (лише loading) | `features/*`, `CompareModal` | 🟠 | 001 |
| F6 | a11y-прогалини (немає aria/label) | інпути/кнопки | 🟠 | 001 |
| F7 | Мертвий код `page-old.js` (прямий `fetch` ×10) | `app/page-old.js` | 🟠 | 001 |
| F8 | Дефолт metadata, `lang` хардкод, шрифти Geist | `app/layout.js` | 🟡 | 001 |
| F9 | Alias `@/` не вживається (довгі відносні імпорти) | усі імпорти | 🟡 | 001/004 |
| F10 | Змішані JS/JSX/TS; типи декоративні (`Provider`={provider,model}) | `types/*`, компоненти | 🟠 | 004 |
| F11 | Магічні константи (`w-72` тощо) | layout/компоненти | 🟡 | 001 |
| F12 | Роздуте/непослідовне форматування JSX | усі компоненти | 🟡 | 005 |
| F13 | Візуал ≠ затверджений макет | весь UI vs `design-reference/` | 🟠 | 006 |

### Cross-cutting / репо
| # | Антипатерн | Доказ | Сер. | План |
|---|------------|-------|------|------|
| C1 | Немає `requirements.txt`/`pyproject` (залежності не зафіксовані) | `backend/` | 🔴 | 005 |
| C2 | Немає `.env.example` (конфіг недокументований) | репо | 🟠 | 005 |
| C3 | Немає кореневого README | репо | 🟡 | 005 |
| C4 | Немає тестів (FE/BE) | репо | 🟠 | 005 (+ baseline у 002) |
| C5 | Немає форматерів/лінтерів (Ruff/Black/Prettier/ESLint) | репо | 🟠 | 005 |
| C6 | Немає CI | репо | 🟡 | 005 |
| C7 | Хардкод API URL у фронтенді | `frontend/services/*` | 🟠 | 002/001 |

## 4. Карта під-планів і порядок

| План | Назва | Фаза (EXECUTE) | Залежить від |
|------|-------|----------------|--------------|
| [005](005-tooling-and-quality-gates.md) §005a | Tooling foundation (deps, .env.example, формат/лінт, README) | PH0 | — |
| [002](002-backend-core-hardening.md) | Backend correctness & security | PH1 | — |
| [003](003-backend-structural-refactor.md) | Backend structural (async, схеми, тонкі роутери, dedupe, repo-seam) | PH2 | 002 |
| [010](010-prompt-management.md) | Prompt management (YAML + версіонування) | PH3 | 003 |
| [007](007-persistence-database.md) | Persistence (БД: SQLAlchemy+Alembic) | PH4 | 003 |
| [001](001-frontend-foundation-refactor.md) | Frontend foundation (тема/i18n/state/структура) | PH5 | 002 |
| [004](004-typescript-migration.md) | TypeScript migration | PH6 | 001 |
| [006](006-design-integration.md) | Design integration (pixel-match) | PH7 | 001, 004 |
| [008](008-accounts-auth.md) | Accounts / auth (ізоляція per-user) | PH8 | 007, 006 |
| [009](009-chat-storage.md) | Chat storage (≤3) | PH9 | 007, 008 |
| [011](011-rag.md) | RAG (upload→embed→retrieve + UI) | PH10 | 007, 006 |
| [005](005-tooling-and-quality-gates.md) §005b | Quality gates (формат, pre-commit, тести, CI) | PH11 | усі |
| [012](012-deployment.md) | Deployment (Docker/Nginx/SSL артефакти) | PH12 | усі |

**Канонічний порядок виконання — у [EXECUTE.md](EXECUTE.md)** (лінійний PH0→PH12 для одного агента; паралелізм субагентів — усередині фаз).

Логіка порядку (щоб не плодити борг переробками):
- **Backend-фундамент** (PH0–PH4): інструментарій → хардening → структура → промпти → БД.
- **Frontend-фундамент + дизайн** (PH5–PH7): тема/i18n/state → TS → візуальна система.
- **Фічі поверх** (PH8–PH10): auth → збережені чати → RAG (усі — на готових фундаментах і дизайні, без переробок).
- **Фіналізація** (PH11–PH12): якість/CI → артефакти деплою.

## 5. Глобальний Definition of Done (вся програма)
- [x] Усі 🔴/🟠 антипатерни усунені або явно перенесені в roadmap із обґрунтуванням.
- [x] Тема й мова керуються з одного місця; перемикання працює (001).
- [x] Бекенд: коректні помилки/CORS/конфіг, true-async, типовані відповіді, без дублювання (002+003).
- [x] Залежності зафіксовані, `.env.example`, форматери/лінтери, базові тести (BE 76 + FE 7), CI (005).
- [x] Структура відповідає розділу 2; контракти в docs синхронні з кодом.
- [x] Усі під-плани `status: done`; цей файл — актуальний.

## 6. Обсяг = ПОВНИЙ (рішення D-8)
Раніше відкладені можливості — **БД-персист, акаунти/auth, збереження чатів, промпти/YAML, RAG, деплой** — тепер **у обсязі** (фази PH3–PH12, плани 007–012, 010). Нічого не лишається «на потім»; нуль технічного боргу (D-8 у [../10-open-decisions.md](../10-open-decisions.md)).

**Єдина зовнішня залежність (не борг):** реальне підняття на VPS, DNS і випуск SSL-сертифікатів потребують твоєї інфраструктури/секретів. Агент створює всі артефакти й доводить стек до робочого `docker compose up` локально + owner-handoff ([012](012-deployment.md)).
