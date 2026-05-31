---
plan: 013-cicd-deploy
status: in-progress
updated: 2026-05-31
---

# CI/CD — автоматичний деплой на VPS (GitHub Actions → GHCR → aaPanel + Docker Compose)

> Доводить проєкт із [012-deployment](012-deployment.md) (Docker-стек уже є) до **повністю
> автоматичного розгортання**: push у `main` → CI (lint+test) → збірка образів → GHCR →
> SSH-деплой на VPS → aaPanel термінує SSL. Без костилів, без технічного боргу.

## СТАН (читається першим — оновлюється після кожного кроку)
- **Поточний крок:** `2.5` (рішення про коміт 74 змін рефактора) → потім Фаза 3 (secrets).
- **Останній виконаний крок:** `2.1-2.4` ✅ (усі prod-артефакти створені: compose.prod, nginx SSE, env, deploy.yml).
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
- [ ] **2.5** Закомітити+запушити деплой-артефакти (рішення по 74 змінах рефактора — див. нижче).

**DoD:** `docker compose -f docker-compose.prod.yml config` валідний; артефакти в `main`; CI зелений.

## ФАЗА 3 — GitHub Secrets та доступи
> Рішення: app-секрети (ключі провайдерів, пароль БД) живуть ТІЛЬКИ у
> `/opt/ai-gateway/.env.production` на сервері. У GitHub Secrets — лише доступи до VPS.
> Так секрети застосунку не дублюються в GitHub (менша поверхня витоку).
- [ ] **3.1** GitHub Secrets (Settings → Secrets and variables → Actions): `VPS_HOST`=31.70.80.7,
       `VPS_USER`=deploy, `VPS_PORT`=22, `VPS_SSH_KEY`=приватний ключ `/home/deploy/.ssh/github_deploy`.
- [ ] **3.2** `packages: write` для workflow — вже задано в `deploy.yml` (вбудований GITHUB_TOKEN, окремий PAT не треба).
- [ ] **3.3** (=крок 1.6) На сервері `docker login ghcr.io` під `deploy` через PAT (read:packages) —
       щоб VPS міг тягнути приватні образи з GHCR.
- [ ] **3.4** Створити `/opt/ai-gateway/.env.production` на сервері з реальними значеннями
       (вручну, один раз; права 600; у git не потрапляє).

**DoD:** 4 VPS-secrets на місці; сервер залогінений у GHCR; `.env.production` заповнений (chmod 600).

## ФАЗА 4 — CD workflow
- [ ] **4.1** `.github/workflows/deploy.yml`: тригер push→`main`; job `build-push`
       (login GHCR → build backend+frontend з `NEXT_PUBLIC_API_URL=/api` → tag sha+latest → push).
- [ ] **4.2** Job `deploy` (needs build-push): scp `docker-compose.prod.yml` у `/opt/ai-gateway/`,
       SSH → `docker compose pull && up -d --remove-orphans` → `docker image prune -f`.
- [ ] **4.3** Захист: deploy лише після зеленого CI (reuse/`needs` або окремий job у тому ж файлі).

**DoD:** workflow синтаксично валідний, видимий у Actions; ручний `workflow_dispatch` доступний.

## ФАЗА 5 — Перший деплой (HTTP, без домену)
- [ ] **5.1** Запустити деплой (push або `workflow_dispatch`); простежити логи Actions.
- [ ] **5.2** На сервері: `docker compose -f docker-compose.prod.yml ps` — усі healthy.
- [ ] **5.3** Smoke-тест локально на сервері: `curl -I http://127.0.0.1:8080/` і `.../api/`.

**DoD:** усі контейнери healthy; curl повертає 200/redirect; міграції застосовані.

## ФАЗА 6 — Домен + aaPanel + SSL
- [ ] **6.1** (Якщо треба) налаштувати A-запис домену на IP; дочекатися пошир.
- [ ] **6.2** У aaPanel створити сайт (домен) → Reverse Proxy → `http://127.0.0.1:8080`.
- [ ] **6.3** Випустити Let's Encrypt у aaPanel; увімкнути Force HTTPS; перевірити auto-renew.
- [ ] **6.4** Виставити `CORS_ALLOW_ORIGINS=https://домен`, `COOKIE_SECURE=true` у `.env.production`;
       передеплоїти/перезапустити backend.

**DoD:** `https://домен` відкривається з валідним сертифікатом; HTTP→HTTPS редірект працює.

## ФАЗА 7 — Перевірка end-to-end і надійність
- [ ] **7.1** Реєстрація → логін; Single-чат зі стрімінгом (SSE не буферизується).
- [ ] **7.2** Compare (groq+cerebras+sambanova → gemini-суддя); ручний перевибір моделі.
- [ ] **7.3** RAG: завантаження документа в межах ліміту; великий файл → коректна помилка.
- [ ] **7.4** Перезавантаження сервера → стек піднявся сам (`restart: unless-stopped`); дані на місці.
- [ ] **7.5** Тест відкату: задеплоїти попередній sha-тег і повернутися назад.

**DoD:** усі сценарії проходять; рестарт-персист працює; відкат відпрацьовано.

## ФАЗА 8 — Документація і закриття
- [ ] **8.1** Оновити `DEPLOY.md` під реальний пайплайн (GHCR + Actions + aaPanel).
- [ ] **8.2** Виправити застарілий `CLAUDE.md` (там «Docker немає» — неправда).
- [ ] **8.3** Позначити цей план `status: done`; зафіксувати фінальні факти у СТАН.

**DoD:** документація відповідає реальності; план закритий.

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
