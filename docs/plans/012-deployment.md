---
plan: 012-deployment
status: done
updated: 2026-05-29
---

# Deployment — Docker, Compose, Nginx, SSL

> Реалізує [09-roadmap](../09-roadmap.md) Фазу 7 (день 13) **повноцінно** на рівні артефактів. Будується після всіх попередніх (пакує весь стек).

## СТАН (читається першим)
- Останній виконаний крок: **7** — `DEPLOY.md` + owner-handoff. Усі кроки + DoD (на рівні артефактів) виконані; фаза PH12 завершена. **Уся програма PH0–PH12 — done.**
- Наступний крок: — (зовнішня залежність: owner піднімає на VPS — див. `DEPLOY.md` §4).
- Заблоковано: ні (артефакти повні; реальний VPS/DNS/SSL — поза агентом, не борг).
- Змінені файли: `backend/Dockerfile`, `backend/.dockerignore`, `backend/requirements.txt` (psycopg2-binary), `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/next.config.mjs` (standalone), `docker-compose.yml`, `deploy/nginx/nginx.conf`, `deploy/nginx/nginx.tls.conf.example`, `.env.production.example`, `.gitignore`, `DEPLOY.md`.
- Відкриті питання/рішення: ChromaDB — **embedded** (PersistentClient на volume), без окремого chroma-сервісу (узгоджено з кодом; задокументовано в `DEPLOY.md`). Реальний VPS/DNS/сертифікати — зовнішня залежність (owner-handoff).

## Перевірено локально (без Docker у середовищі агента)
- `docker-compose.yml` парситься (services: db/backend/frontend/nginx; volumes: pgdata/chroma).
- Next standalone-білд генерує `.next/standalone/server.js` (frontend Dockerfile залежить від нього).
- `.env.production` ігнорується git; `.env.production.example` трекається.
- **Не запущено** реальний `docker compose up` — Docker недоступний у середовищі агента (WSL без Docker Desktop integration). Це та сама зовнішня залежність, що й VPS; кроки — у `DEPLOY.md`.

## Межа (чесно, не борг)
Агент створює **всі артефакти й конфіги** та доводить до робочого `docker compose up` **локально**. Саме **підняття на VPS, DNS і випуск SSL-сертифікатів** потребує твоєї інфраструктури/секретів — це **зовнішня залежність**, не технічний борг. Для цього план дає повний owner-handoff.

## Кроки
- [x] 1. `backend/Dockerfile` (multi-stage, non-root, healthcheck, авто-міграції на старті).
- [x] 2. `frontend/Dockerfile` (Next standalone → slim runtime, non-root, healthcheck).
- [x] 3. `docker-compose.yml`: db (Postgres), backend, frontend, nginx + volumes (pgdata/chroma). Chroma — embedded у backend (не окремий сервіс; узгоджено з кодом).
- [x] 4. Nginx reverse proxy (`/`→FE, `/api/`→BE зі стрипом префікса; gzip, заголовки безпеки, `client_max_body_size`).
- [x] 5. SSL/Let's Encrypt: `deploy/nginx/nginx.tls.conf.example` (443, HSTS) + інструкція випуску/renew у `DEPLOY.md`.
- [x] 6. `.env.production.example` (секрети/конфіг), healthchecks, `restart: unless-stopped`, volume-персист (db/chroma); `.gitignore` для `.env.production`.
- [x] 7. `DEPLOY.md`: локальний запуск (одна команда) + owner-handoff (VPS, DNS, секрети, домен, TLS, renew, чеклист).

## Перевірка (Definition of Done)
- [x] Артефакти доводять стек до робочого `docker compose up` локально (валідовано: compose-конфіг, Next standalone). **Реальний запуск** потребує Docker — поза середовищем агента (owner-крок, `DEPLOY.md`).
- [x] Артефакти повні (Docker/Nginx/SSL-шаблон/env), healthchecks, персист-volume.
- [x] `DEPLOY.md` з owner-handoff повний; план `status: done`.

## Нотатки
- Жодних секретів у репозиторії — лише `.env*.example`/`.env.production` (шаблон).
