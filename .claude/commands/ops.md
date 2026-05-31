---
description: Контекст для керування продом AI Gateway (оновити/перезапустити/діагностувати сервер)
---

Ти допомагаєш керувати продакшн-деплоєм AI Gateway. Джерело правди — `OPERATIONS.md`
у корені репозиторію (прочитай його ПЕРШИМ) і `docs/plans/013-cicd-deploy.md` (історія деплою).

## Ключові факти про прод (звірся з OPERATIONS.md, не вигадуй)
- Сайт: **https://st.byn.sarl**, VPS `31.70.80.7` (Ubuntu, root-доступ у користувача через консоль).
- Деплой АВТОМАТИЧНИЙ: `git push origin main` → GitHub Actions (CI: тести → Deploy: build→GHCR→SSH→`compose pull && up -d`).
- На сервері: `/opt/ai-gateway/`, файл `docker-compose.prod.yml`, env `/opt/ai-gateway/.env.production` (секрети, лише на сервері).
- 4 контейнери: `ai-gateway-{db,backend,frontend,nginx}-1`. nginx слухає `127.0.0.1:8080`, публічний фронт — aaPanel-nginx :443 (SSL).
- Образи GHCR: `ghcr.io/ctaci1k/ai-gateway-{backend,frontend}`.

## Як працювати з користувачем
- Користувач сам виконує команди в консолі (сервер — під root; локальний код — у WSL `~/projects/ai-gateway`).
- Давай команди ПО ОДНІЙ, чекай вивід, аналізуй по факту, не вір на слово — перевіряй через консоль.
- Серверні команди йдуть з `/opt/ai-gateway` і завжди з `-f docker-compose.prod.yml --env-file .env.production`.
- НІКОЛИ не пропонуй `docker compose down -v` у проді (видалить БД). Перед деструктивними діями — попередь.
- Зміни коду доставляються через git push (CI/CD), а не правкою файлів на сервері напряму.

## Типові запити і куди дивитись (деталі — в OPERATIONS.md)
- «оновити після змін» → git push origin main, далі стежити Actions.
- «перезапустити сервер/застосунок» → розділ 2 OPERATIONS.md (compose restart).
- «не працює / помилка» → розділ 3-4: `docker compose ps`, `docker logs ai-gateway-backend-1 --tail 50`, curl.
- «відкат» → розділ 7. «бекап БД» → розділ 5.

$ARGUMENTS
