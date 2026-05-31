# OPERATIONS — як керувати AI Gateway у проді

> Практичний посібник: оновити, перезапустити, продіагностувати застосунок.
> Прод живе на **https://st.byn.sarl** (VPS `31.70.80.7`).
> Архітектура й історія деплою — [docs/plans/013-cicd-deploy.md](docs/plans/013-cicd-deploy.md).

---

## 0. Як це влаштовано (1 абзац)

`браузер → aaPanel-nginx :443 (SSL) → 127.0.0.1:8080 → контейнерний nginx → frontend(:3000) + backend(:8000) → Postgres + ChromaDB`.
Образи збирає GitHub Actions і кладе в GHCR; сервер їх лише **тягне** і запускає.
4 контейнери: `ai-gateway-db-1`, `ai-gateway-backend-1`, `ai-gateway-frontend-1`, `ai-gateway-nginx-1`.

---

## 1. ОНОВИТИ застосунок після змін у коді (головний сценарій)

Деплой **автоматичний**. Усе, що треба, — запушити в `main` зі свого комп'ютера (WSL):

```bash
cd ~/projects/ai-gateway
git add .                      # або `git add -p` щоб контролювати зміни
git commit -m "опис змін"
git push origin main
```

Далі **само**: GitHub Actions проганяє тести (CI) → збирає Docker-образи → пушить у GHCR →
заходить по SSH на сервер → `docker compose pull && up -d`.

**Перевірити статус:** https://github.com/ctaci1k/ai-gateway/actions
- зелений CI + зелений Deploy = нова версія вже на сервері.
- червоний — клікнути на нього, відкрити крок із ❌, прочитати помилку.

> Деплой іде ЛИШЕ після зеленого CI. Якщо тести впали — деплою не буде (це захист).

### Ручний запуск деплою без зміни коду
GitHub → Actions → зліва **Deploy** → **Run workflow** → гілка main → Run.

---

## 2. ПЕРЕЗАПУСТИТИ застосунок (на СЕРВЕРІ, root)

Усі команди виконуються в `/opt/ai-gateway`. Без зміни коду, лише рестарт того, що вже є.

```bash
cd /opt/ai-gateway

# М'який перезапуск усіх контейнерів (даних не чіпає):
docker compose -f docker-compose.prod.yml --env-file .env.production restart

# Перезапустити лише один сервіс (напр. backend):
docker compose -f docker-compose.prod.yml --env-file .env.production restart backend

# Повністю зупинити / підняти (down НЕ видаляє дані — вони у volumes):
docker compose -f docker-compose.prod.yml --env-file .env.production down
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

> ⚠️ НІКОЛИ не додавай `-v` до `down` у проді — `down -v` ВИДАЛЯЄ volumes (усю БД!).

### Підтягнути найсвіжіші образи вручну (якщо деплой уже зібрав, а ти хочеш застосувати):
```bash
cd /opt/ai-gateway
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

---

## 3. ПЕРЕВІРИТИ що все живе (діагностика)

```bash
cd /opt/ai-gateway

# Статус контейнерів (мають бути Up / healthy):
docker compose -f docker-compose.prod.yml ps

# Сайт відповідає? (очікуємо 200)
curl -s -o /dev/null -w "site %{http_code}\n" https://st.byn.sarl/
curl -s -o /dev/null -w "api  %{http_code}\n" https://st.byn.sarl/api/

# Логи бекенду (останні 50; -f = стежити наживо, Ctrl+C вийти):
docker logs ai-gateway-backend-1 --tail 50
docker logs ai-gateway-backend-1 -f

# Логи будь-якого сервісу:
docker logs ai-gateway-frontend-1 --tail 50
docker logs ai-gateway-nginx-1 --tail 50

# Скільки користувачів у БД (швидка перевірка, що БД жива):
docker exec ai-gateway-db-1 psql -U ai_gateway -d ai_gateway -tAc "SELECT count(*) FROM users;"
```

---

## 4. ТИПОВІ ПРОБЛЕМИ

| Симптом | Що зробити |
|---|---|
| Сайт не відкривається | `docker compose ... ps` → якщо контейнер `Exited/Restarting`, дивись `docker logs <ім'я> --tail 50` |
| "Internal server error" | `docker logs ai-gateway-backend-1 --tail 50` — шукай `ERROR`/`Traceback` |
| Деплой червоний на CI | Actions → Backend/Frontend job → червоний крок → читай помилку; виправ код, знову push |
| Деплой червоний на "Pull & restart" | Зайди на сервер, виконай розділ 2 вручну й дивись помилку |
| Сертифікат протермінувався | aaPanel → Website → st.byn.sarl → SSL (auto-renew має оновлювати сам) |
| Закінчилось місце | `docker system df` → `docker image prune -f` (прибирає старі образи) |

---

## 5. БЕКАП БАЗИ ДАНИХ (рекомендовано робити періодично)

```bash
# Дамп БД у файл (на сервері):
docker exec ai-gateway-db-1 pg_dump -U ai_gateway ai_gateway > ~/aigw-backup-$(date +%Y%m%d).sql

# Відновлення з дампу (ОБЕРЕЖНО — перезапише дані):
cat ~/aigw-backup-YYYYMMDD.sql | docker exec -i ai-gateway-db-1 psql -U ai_gateway -d ai_gateway
```

---

## 6. ВАЖЛИВІ ФАЙЛИ / СЕКРЕТИ

- `/opt/ai-gateway/.env.production` — секрети застосунку (API-ключі, пароль БД, `REGISTRATION_CODE`).
  Лежить ЛИШЕ на сервері, chmod 600, у git НЕ потрапляє. Подивитись код реєстрації:
  ```bash
  grep REGISTRATION_CODE /opt/ai-gateway/.env.production
  ```
- GitHub Secrets (Settings → Secrets → Actions): `VPS_HOST/USER/PORT/SSH_KEY` — доступи до VPS.
- aaPanel: https://31.70.80.7:39382 — керує доменом, SSL, reverse-proxy на 127.0.0.1:8080.

---

## 7. ВІДКАТ на попередню версію (якщо нова зламана)

Кожен деплой тегує образи комітом (sha). Щоб відкотитись:
```bash
cd /opt/ai-gateway
export IMAGE_TAG=<короткий_sha_робочого_коміту>   # напр. f765772ae40d
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```
Дізнатись доступні теги: GitHub → Packages → ai-gateway-backend → версії.
Надійніший відкат — `git revert <поганий коміт>` + `git push` (пройде через CI/CD).
