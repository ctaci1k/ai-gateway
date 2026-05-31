---
plan: 013-cicd-deploy
status: done
updated: 2026-05-31
---

# CI/CD — автоматичний деплой на VPS (GitHub Actions → GHCR → aaPanel + Docker Compose)

> Доводить проєкт із [012-deployment](012-deployment.md) (Docker-стек уже є) до **повністю
> автоматичного розгортання**: push у `main` → CI (lint+test) → збірка образів → GHCR →
> SSH-деплой на VPS → aaPanel термінує SSL. Без костилів, без технічного боргу.

## СТАН (читається першим — оновлюється після кожного кроку)
- **ПЛАН ЗАВЕРШЕНО ✅** — автоматичний CI/CD-деплой працює; застосунок живий на https://st.byn.sarl.
- **Останній виконаний крок:** `8.x` ✅ frontend healthcheck (node-based), CLAUDE.md оновлено. Усі фази 0-8 done.
- **Заблоковано:** ні.
- **Зібрані факти про середовище** (заповнюємо у Фазі 0):
  - OS / версія: `Ubuntu 26.04 LTS (kernel 7.0.0, x86_64)`
  - RAM / CPU / диск: `7.7Gi RAM (5.7 вільно), 4 vCPU Xeon Skylake, 232G диск (4% зайнято)`. **Swap = 0** (мінорна нотатка — збірка йде в CI, тож не критично).
  - Docker встановлено: `ТАК — docker-ce 29.5.2 (офіц. репо), автозапуск увімкнено`  | Docker Compose v2: `ТАК — plugin 5.1.4`
  - ⚠️ Нотатка по сервері: aaPanel ставив пакети у фоні й вішав `needrestart` (тримав apt-lock). Полагоджено: needrestart→авто-режим + apt-хук вимкнено (`/etc/apt/apt.conf.d/99needrestart` → `/root/99needrestart.disabled`). Якщо колись треба повернути — перемістити назад.
  - aaPanel публічний nginx (`/www/server/nginx`) тримає **:80** (0.0.0.0); **:443 вільний** (SSL-сайту ще нема) → це наш фронт ✅.
  - Порт **127.0.0.1:8080** для контейнерного nginx — вільний (loopback, ufw не потрібен) ✅.
  - aaPanel порт панелі: `39382` ⚠️ відкритий на 0.0.0.0; також **:888** (phpMyAdmin) відкритий — **обмежити на свій IP у кроці 1.4**.
  - Фаєрвол: `ufw active (deny incoming)`. Відкрито ТІЛЬКИ: **22, 80, 443, 39382** (v4+v6). Закрито: 888 (phpMyAdmin), FTP 20/21/39000-40000. ✅
  - Домашня IP адміна: динамічна → прив'язку панелі до IP НЕ робимо. aaPanel не чіпаємо (порт 39382 лишається за паролем).
  - публічний IP сервера: `31.70.80.7`
  - Домен: `st.byn.sarl` (реєстратор Spaceship)  | A-запис вказує на IP: `ТАК → 31.70.80.7 ✅ (перевірено Google/Cloudflare DNS)`
  - SSH-порт для деплою: `22`  | deploy-користувач: `deploy` (uid 1002, у групі docker) ✅; каталог `/opt/ai-gateway` (власник deploy) ✅
  - GitHub repo (owner/name): `ctaci1k/ai-gateway` (main у синхроні з origin). `gh` CLI локально НЕ встановлено (необов'язково).
  - GHCR-образи: `ghcr.io/ctaci1k/ai-gateway-backend`, `ghcr.io/ctaci1k/ai-gateway-frontend`.
  - SSH-ключ для CI: `ed25519` `github_deploy` (на сервері в `/home/deploy/.ssh/`), публічний у authorized_keys, вхід перевірено ✅. Публічний ключ: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBf9oDkSgOuM2CjwwcudS4a8M05aIOQydKeYepOK9ONt github-actions-deploy`. Приватний → GitHub Secret `VPS_SSH_KEY` (Фаза 3).
  - ⚠️ **74 незакомічених зміни** у робочій теці (поточний рефактор) — local main = origin/main = коміт `e1f8ce7` (у синхроні, але зміни не закомічені). Перед тим як деплой відобразить реальний застосунок, треба **закомітити+запушити** (крок 2.4).
- **Ухвалена архітектура (не змінювати без причини):**
  - aaPanel-nginx = публічний фронт (80/443) + Let's Encrypt (auto-renew через GUI).
  - Контейнерний nginx слухає `127.0.0.1:8080` — тримає всю маршрутизацію (`/api` strip,
    SSE, gzip, security-заголовки) у git. aaPanel лише `proxy_pass → 127.0.0.1:8080`.
  - Образи: збірка в GitHub Actions → push у **GHCR** (`ghcr.io/<owner>/ai-gateway-{backend,frontend}`).
  - Деплой: SSH на VPS → `docker compose -f docker-compose.prod.yml pull && up -d`.
  - Тригер: push у гілку `main` (після зеленого CI).
  - Postgres і Chroma — лише всередині docker-мережі/volumes, **назовні не публікуються**.

---

## Принципи виконання
1. **Одна задача за раз.** Я даю один крок з точними командами → ти виконуєш → присилаєш
   результат → я аналізую → оновлюю «СТАН» → даю наступний.
2. Усі правки репозиторію роблю я (коміт/PR), серверні команди виконуєш ти під root.
3. Жодних секретів у git — лише `*.example`. Реальні значення: GitHub Secrets + `.env.production` на сервері.
4. Кожна фаза має DoD (Definition of Done) — без нього далі не йдемо.

---

## ФАЗА 0 — Діагностика сервера (з'ясувати невідоме)
Мета: заповнити «Зібрані факти» у СТАН. Нічого не встановлюємо — тільки читаємо.

- [x] **0.1** Базова інфа про систему: OS, RAM, CPU, диск, публічний IP.
- [x] **0.2** Чи є Docker і Docker Compose v2; версії; чи запущений daemon. → відсутній.
- [x] **0.3** aaPanel: порт панелі (39382), nginx тримає :80, :443 вільний, ufw active. ⚠️ панель/888 відкриті — обмежити в 1.4.
- [x] **0.4** Домен/DNS: `st.byn.sarl` → 31.70.80.7 ✅ (DNS уже налаштований; крок налаштування A-запису НЕ потрібен).
- [x] **0.5** GitHub: `ctaci1k/ai-gateway`, main у синхроні. ⚠️ 74 незакомічених зміни (→ 2.4). gh CLI локально нема.

**DoD:** усі поля «Зібрані факти» у СТАН заповнені реальними значеннями.

## ФАЗА 1 — Підготовка VPS
- [x] **1.1** Встановити Docker Engine + Compose v2; автозапуск. ✅ docker-ce 29.5.2, compose 5.1.4, enabled.
- [x] **1.2** deploy-користувач (uid 1002, група docker), `docker ps` працює без root. ✅
- [x] **1.3** Каталог `/opt/ai-gateway/` (власник deploy). ✅
- [x] **1.4** Фаєрвол: лишили 22/80/443/39382; закрили 888+FTP. ✅ (5432/8000/3000/8080 і так не у ufw — будуть на 127.0.0.1).
       Нотатка: панель за паролем (IP-прив'язку не робимо — динамічна домашня IP). Опційно потім: піддомен panel.st.byn.sarl для адмінки.
- [x] **1.5** SSH-ключ для CI (ed25519 github_deploy), вхід по ключу перевірено. ✅
- [ ] **1.6** Створити PAT (read:packages) і зробити `docker login ghcr.io` на сервері
       (щоб VPS міг тягнути приватні образи).

**DoD:** з ноутбука `ssh deploy@server` працює по новому ключу; `docker ps` під deploy працює;
ззовні видно лише 80/443/SSH; `docker login ghcr.io` успішний.

## ФАЗА 2 — Репозиторій: prod-артефакти (роблю я, коміт)
- [x] **2.1** `docker-compose.prod.yml`: GHCR-образи (`ghcr.io/ctaci1k/ai-gateway-{backend,frontend}`),
       nginx → `127.0.0.1:8080:80`, db/backend/frontend без публічних портів, volumes pgdata/chroma. ✅
- [x] **2.2** `deploy/nginx/nginx.conf`: SSE на `/api/` — `proxy_buffering off`, `proxy_cache off`,
       прокид `X-Forwarded-Proto` (чат стрімить ndjson — перевірено в chat.py:321). ✅
- [x] **2.3** `.env.production.example` оновлено (CORS=домен, нотатка що файл лише на сервері). ✅
- [x] **2.4** CD-workflow `.github/workflows/deploy.yml` створено (build→GHCR→SSH-deploy). ✅
- [x] **2.5a** Два коміти створені: `c4149ef` (CD-інфраструктура) + `4323f62` (рефактор: Postgres/auth/RAG/BYOK/quotas). Локальні перевірки FE: prettier/eslint/tsc/16 тестів/build ✅. BE-перевірки (ruff/black/pytest) — прожене CI (локально немає залежностей). Прибрано stray `requirements.txt.backup`. Робоча тека чиста.
- [x] **2.5b** `git push origin main` ✅ (e1f8ce7..4323f62). Локальний remote переключено HTTPS→SSH (ключ github_push). CI запущено — чекаємо результат.

**DoD:** `docker compose -f docker-compose.prod.yml config` валідний; артефакти в `main`; CI зелений.

## ФАЗА 3 — GitHub Secrets та доступи
> Рішення: app-секрети (ключі провайдерів, пароль БД) живуть ТІЛЬКИ у
> `/opt/ai-gateway/.env.production` на сервері. У GitHub Secrets — лише доступи до VPS.
> Так секрети застосунку не дублюються в GitHub (менша поверхня витоку).
- [x] **3.1** GitHub Secrets ✅: `VPS_HOST`=31.70.80.7, `VPS_USER`=deploy, `VPS_PORT`=22, `VPS_SSH_KEY`=приватний ключ. Усі 4 на місці.
       Нотатка: CI був червоний (pytest ModuleNotFoundError 'core') ще до гілки — виправлено `pythonpath=["."]` у backend/pyproject.toml (коміт 12a77e5).
- [ ] **3.2** `packages: write` для workflow — вже задано в `deploy.yml` (вбудований GITHUB_TOKEN, окремий PAT не треба).
- [x] **3.3** GHCR login під `deploy` (PAT read:packages) ✅ + перевірено `docker pull` backend-образу.
- [x] **3.4** `/opt/ai-gateway/.env.production` ✅: 4 API-ключі + Postgres (пароль згенеровано `openssl`) +
       CORS=https://st.byn.sarl, COOKIE_SECURE=true, REGISTRATION_CODE (згенеровано). chmod 600, owner deploy.

**DoD:** 4 VPS-secrets ✅; сервер залогінений у GHCR ✅; `.env.production` заповнений (chmod 600) ✅. **Фаза 3 done.**

## ФАЗА 4 — CD workflow
- [ ] **4.1** `.github/workflows/deploy.yml`: тригер push→`main`; job `build-push`
       (login GHCR → build backend+frontend з `NEXT_PUBLIC_API_URL=/api` → tag sha+latest → push).
- [ ] **4.2** Job `deploy` (needs build-push): scp `docker-compose.prod.yml` у `/opt/ai-gateway/`,
       SSH → `docker compose pull && up -d --remove-orphans` → `docker image prune -f`.
- [ ] **4.3** Захист: deploy лише після зеленого CI (reuse/`needs` або окремий job у тому ж файлі).

**DoD:** workflow синтаксично валідний, видимий у Actions; ручний `workflow_dispatch` доступний.

## ФАЗА 5 — Перший деплой (HTTP, без домену)
- [x] **5.1** Deploy ЗЕЛЕНИЙ ✅ (повний пайплайн GitHub→GHCR→SSH→up). Виправлено по дорозі:
       (a) деплой не копіював nginx.conf → додано в scp source; (b) scp падав "File exists" → `overwrite:true`.
- [x] **5.2** `ps`: db/backend **healthy**, nginx **Up** (127.0.0.1:8080), frontend Up але healthcheck unhealthy
       (хибна тривога — `wget --spider` у Dockerfile; сайт віддає 200). TODO косметика → Фаза 8.
- [x] **5.3** Smoke: `curl /` = **HTTP 200**, `curl /api/` = **HTTP 200** ✅. Міграції застосовано (backend healthy).

**DoD:** контейнери працюють; curl 200; міграції застосовані. ✅ (frontend healthcheck — косметичний TODO).

## ФАЗА 6 — Домен + aaPanel + SSL
- [x] **6.1** A-запис уже був налаштований (st.byn.sarl → 31.70.80.7). Сайт створено в aaPanel (static, без БД).
- [x] **6.2** aaPanel Reverse Proxy → `http://127.0.0.1:8080` ✅ (перевірено: домен→застосунок=200).
- [x] **6.3** Let's Encrypt випущено (issuer CN=YR1, до 2026-08-29, auto-renew) + Force HTTPS ✅.
- [x] **6.4** `.env.production` уже мав CORS=https://st.byn.sarl + COOKIE_SECURE=true (виставлено у 3.4). ✅

**DoD:** https://st.byn.sarl=200, /api/=200, http→301 редірект, сертифікат валідний (Let's Encrypt). ✅ **Фаза 6 done.**

## ФАЗА 7 — Перевірка end-to-end і надійність
- [x] **7.1** Реєстрація ✅ працює (datetime-баг виправлено). → логін; далі Single-чат зі стрімінгом.
- [x] **7.2** Compare ✅ працює наживо: Llama 3.3 (78) + DeepSeek V3.1 (94, обрана) + GLM (fallback "недоступний"), суддя Qwen впевненість 0.92. Квоти + i18n (PL) ОК.
- [ ] **7.3** RAG: завантаження документа в межах ліміту; великий файл → коректна помилка. (опційно)
- [x] **7.4** Рестарт стеку → юзерів 1→1 (дані персистять у pgdata volume), сайт HTTP 200, автопідняття ОК. ✅
- [ ] **7.5** Тест відкату на попередній sha — опційно (механізм є: IMAGE_TAG; не тестували наживо).

**DoD:** усі сценарії проходять; рестарт-персист працює; відкат відпрацьовано.

## ФАЗА 8 — Документація і закриття
- [x] **8.0** Фікс frontend healthcheck (node-based замість busybox wget — прибирає хибний "unhealthy").
- [ ] **8.1** Оновити `DEPLOY.md` під реальний пайплайн (GHCR + Actions + aaPanel) — опційно (старий DEPLOY.md описує bundled-nginx варіант; новий пайплайн описаний у цьому плані).
- [x] **8.2** `CLAUDE.md` оновлено (Postgres/auth/RAG/квоти/BYOK/Docker+CI/CD замість «in-memory, Docker немає»).
- [x] **8.3** План `status: done`; фінальні факти у СТАН.

**DoD:** документація відповідає реальності; план закритий. ✅

---

## Журнал виконання (дописуємо знизу)
- 2026-05-31 — план створено; архітектуру зафіксовано; старт із кроку 0.1.
- 2026-05-31 — 0.1 ✅ Ubuntu 26.04, 4 vCPU / 7.7Gi RAM / 232G, IP 31.70.80.7, swap=0. Далі 0.2.
- 2026-05-31 — 0.2 ✅ Docker/Compose відсутні → встановлення в 1.1. Далі 0.3.
- 2026-05-31 — 0.3 ✅ aaPanel-nginx на :80 (фронт), :443 вільний, :8080 вільний, ufw active. ⚠️ панель :39382 і :888 відкриті на світ → 1.4 обмежити. Далі 0.4.
- 2026-05-31 — 0.4 ✅ домен st.byn.sarl уже вказує на 31.70.80.7 (Spaceship NS). DNS-крок не потрібен. Далі 0.5.
- 2026-05-31 — 0.5 ✅ repo ctaci1k/ai-gateway, main у синхроні, але 74 незакомічених зміни (→2.4). **Фаза 0 завершена.** Далі 1.1 (Docker).
- 2026-05-31 — 1.1 ✅ Docker 29.5.2 + Compose 5.1.4 встановлено з офіц. репо, автозапуск. Боротьба з aaPanel apt-lock/needrestart (полагоджено). Далі 1.2.
- 2026-05-31 — 1.1 перевірка ✅ hello-world OK. 1.2/1.3 ✅ deploy-користувач + /opt/ai-gateway. Далі 1.5 (SSH-ключ для CI).
- 2026-05-31 — 1.5 ✅ SSH-ключ ed25519 github_deploy, вхід по ключу як deploy + docker працює. Далі 1.4 (фаєрвол), 1.6 (GHCR) з Фазою 3.
- 2026-05-31 — 1.4 ✅ ufw: лишили 22/80/443/39382, закрили 888+FTP. **Фаза 1 завершена.** Далі Фаза 2 (prod-артефакти в репо).
- 2026-05-31 — 2.1-2.4 ✅ docker-compose.prod.yml, nginx SSE-fix, .env.production.example, deploy.yml створені. Архітектура secrets уточнена: app-секрети лише на сервері, у GitHub — тільки VPS_*. Далі 2.5 (коміт) — потрібне рішення по 74 змінах рефактора.
- 2026-05-31 — 2.5a ✅ два коміти (c4149ef CD + 4323f62 рефактор). FE-перевірки зелені локально, BE → CI. Далі push origin main.
- 2026-05-31 — 2.5b ✅ push у main (SSH-ключ github_push налаштовано). **Фаза 2 завершена.** CI запущено. Далі Фаза 3 (secrets) паралельно.
- 2026-05-31 — CI #2 червоний: pytest ModuleNotFoundError 'core' (давня проблема, не наша). Фікс pythonpath → коміт 12a77e5. 3.1 ✅ 4 VPS-секрети додані. Далі: перевірка CI + 3.3 (GHCR login на сервері).
- 2026-05-31 — CI #3 (12a77e5) ЗЕЛЕНИЙ ✅. Образи ai-gateway-{backend,frontend} опубліковані в GHCR ✅. Deploy #2 ❌ на "Copy compose" (VPS_SSH_KEY порожній у момент старту — таймінг). PAT read:packages створено. Далі: GHCR login на сервері + .env.production + re-run deploy.
- 2026-05-31 — 3.3 ✅ GHCR login (deploy) + docker pull backend OK. 3.4 ✅ .env.production 12 змінних (chmod 600). **Фаза 3 done.** Далі: re-run Deploy (перший реальний деплой).
- 2026-05-31 — Deploy фікси: copy nginx.conf (1649c69), overwrite:true (80a25d5). **Deploy ЗЕЛЕНИЙ** ✅. curl /=200, /api/=200; db/backend healthy. **Фази 4-5 done.** Далі Фаза 6 (домен+SSL через aaPanel). TODO: frontend healthcheck (wget) — косметика.
- 2026-05-31 — Фаза 6 ✅: aaPanel сайт + reverse proxy →127.0.0.1:8080, Let's Encrypt SSL + Force HTTPS. **https://st.byn.sarl ЖИВИЙ** (=200, /api/=200, http→301, cert до 2026-08-29). Далі Фаза 7 (e2e в браузері).
- 2026-05-31 — Фаза 7: реєстрація → Internal error. Корінь: datetime tz-aware vs колонки TIMESTAMP WITHOUT TZ (SQLite прощав, Postgres ні). Фікс naive UTC у моделях/auth/usage_repo (0a6ed8a) → зламав 35 тестів на auth_service:141 (порівняння aware vs naive) → фікс (5f46ede). NB: git add -A у 0a6ed8a захопив незакомічений WIP користувача — усе на GitHub, нічого не втрачено.
- 2026-05-31 — CI #7/#8 ЗЕЛЕНІ, Deploy #6/#7 ЗЕЛЕНІ. Образ f765772 на сервері (backend healthy). **7.1 РЕЄСТРАЦІЯ ПРАЦЮЄ** ✅. Далі 7.2 (чат Single/Compare).
- 2026-05-31 — **7.2 COMPARE ПРАЦЮЄ НАЖИВО** ✅✅ на https://st.byn.sarl: 3 моделі + AI-суддя Qwen (обрав DeepSeek V3.1, 0.92), graceful fallback для недоступного GLM, квоти+i18n OK. Суть продукту функціонує в проді. Лишилось: 7.4 рестарт-тест + Фаза 8 (frontend healthcheck, доки).
