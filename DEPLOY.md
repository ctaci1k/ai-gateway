# Deployment (PH12)

Full containerized stack: **Postgres + backend (FastAPI) + frontend (Next.js) + nginx**.
ChromaDB runs **embedded** inside the backend (persisted to a Docker volume), so
there is no separate vector-DB service.

```
browser ──▶ nginx :80/:443 ──┬─▶ frontend :3000   (/)
                             └─▶ backend  :8000   (/api/* → prefix stripped)
backend ──▶ postgres :5432 (volume: pgdata)
backend ──▶ ChromaDB (embedded, volume: chroma)
```

## 1. Local run (single command)

Requires Docker + Docker Compose v2.

```bash
cp .env.production.example .env.production
# edit .env.production: real provider API keys + a strong POSTGRES_PASSWORD.
# For local HTTP testing set COOKIE_SECURE=false.

docker compose --env-file .env.production up --build
```

Open **http://localhost** — the SPA loads, the API is reachable under `/api`
(same origin, so cookies/CSRF work without CORS). Register an account and use
Single / Compare / Documents (RAG).

- Migrations run automatically on backend startup (`alembic upgrade head`).
- Data persists in the `pgdata` and `chroma` named volumes across restarts.
- `docker compose --env-file .env.production down` stops; add `-v` to wipe data.

### Notes
- `NEXT_PUBLIC_*` are baked at **build** time. The frontend image is built with
  `NEXT_PUBLIC_API_URL=/api` (same-origin via nginx). To point the SPA at a
  different API origin, change the `frontend.build.args` in `docker-compose.yml`
  and rebuild.
- `client_max_body_size` (nginx) is aligned with `RAG_MAX_FILE_BYTES`; raise both
  together for larger uploads.

## 2. Production over HTTPS (owner handoff)

The repo contains **every artifact** needed. The steps below require resources
only the owner controls — a server, a domain, and DNS — so they are an
**external dependency, not project debt**.

1. **Provision a VPS** (e.g. Ubuntu) with Docker + Docker Compose v2; open ports
   80 and 443.
2. **DNS**: point your domain's A/AAAA record at the server IP.
3. **Secrets**: create `.env.production` from the template with real provider
   keys, a strong `POSTGRES_PASSWORD`, `CORS_ALLOW_ORIGINS=https://your-domain`,
   and `COOKIE_SECURE=true`.
4. **TLS certificate** (Let's Encrypt / certbot):
   ```bash
   # one-off issuance using the standalone challenge (stop nginx first or use webroot)
   docker run --rm -p 80:80 \
     -v ./letsencrypt:/etc/letsencrypt \
     certbot/certbot certonly --standalone -d your-domain.example \
     --email you@example.com --agree-tos --no-eff-email
   ```
   Then switch nginx to TLS:
   - copy `deploy/nginx/nginx.tls.conf.example` → `deploy/nginx/nginx.conf`,
     replacing `your-domain.example`;
   - in `docker-compose.yml`, add `"443:443"` to the nginx `ports` and mount the
     cert volume: `- ./letsencrypt:/etc/letsencrypt:ro` and
     `- ./certbot-webroot:/var/www/certbot`.
5. **Launch**: `docker compose --env-file .env.production up -d --build`.
6. **Renew**: certbot certs last 90 days — add a cron job:
   `docker run --rm -v ./letsencrypt:/etc/letsencrypt certbot/certbot renew`
   followed by `docker compose exec nginx nginx -s reload`.

## 3. Operations

- **Logs**: `docker compose logs -f backend` (structured JSON lines).
- **Migrations** (manual): `docker compose exec backend alembic upgrade head`.
- **Backups**: dump Postgres (`pg_dump`) and archive the `chroma` volume.
- **Healthchecks**: backend `GET /`, frontend `GET /`, db `pg_isready` — visible
  in `docker compose ps`.

## 4. Owner checklist (TODO — external)

- [ ] VPS provisioned (Docker + Compose, ports 80/443 open).
- [ ] Domain + DNS A record → server IP.
- [ ] `.env.production` filled with real keys + strong DB password; `COOKIE_SECURE=true`.
- [ ] TLS certificate issued (certbot) and nginx switched to `nginx.tls.conf`.
- [ ] `docker compose --env-file .env.production up -d --build` and smoke-tested.
- [ ] Certificate auto-renewal cron in place.
