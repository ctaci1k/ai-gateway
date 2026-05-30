# AI Gateway

**One user prompt → several AI models answer in parallel → an AI judge (Gemini) picks the best answer → personalization per user.**

This is **not** an ordinary chatbot. The primary mode is **Compare**.

- **Single** — a conversation with one model, streamed. Ephemeral by design (not persisted).
- **Compare** (primary) — `groq` + `cerebras` + `sambanova` answer in parallel, `gemini` judges, with a rule-based fallback. A manual model re-pick trains personalization.

> 📚 **Documentation is the source of truth — start at [docs/README.md](docs/README.md).**
> Keep vision ([docs/00-vision.md](docs/00-vision.md)), real state ([docs/08-current-state.md](docs/08-current-state.md)) and roadmap ([docs/09-roadmap.md](docs/09-roadmap.md)) separate.

## Tech stack

- **Backend:** Python 3.12+, FastAPI, Pydantic, asyncio; provider SDKs (`groq`, `openai` for Cerebras/SambaNova, `google-generativeai` for Gemini).
- **Frontend:** Next.js (App Router) + React + Tailwind; design tokens, i18n (uk/pl/en), progressive TypeScript.

## Project layout

```
backend/    FastAPI app — main.py, routes/, services/, providers/, selector/, memory/, schemas/, config/
frontend/   Next.js app — app/, layouts/, components/, features/, services/, store/, theme/, i18n/, types/
docs/       Structured documentation (source of truth)
```

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+ (npm)
- API keys for Groq, Cerebras, SambaNova, Gemini

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt   # add -r requirements-dev.txt for tooling/tests
cp .env.example .env              # then fill in your provider API keys
uvicorn main:app --reload --port 8000
```

The API is served at `http://127.0.0.1:8000`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local        # point NEXT_PUBLIC_API_URL at the backend
npm run dev
```

The app is served at `http://localhost:3000`.

## Configuration

| File | Purpose |
|------|---------|
| `backend/.env` | Provider API keys, CORS origins, request limits (template: `backend/.env.example`) |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` — backend base URL (template: `frontend/.env.example`) |

Never commit real `.env` files — only the `.env.example` templates are tracked.

## Quality tooling

- **Backend:** [Ruff](https://docs.astral.sh/ruff/) + [Black](https://black.readthedocs.io/) (config in `backend/pyproject.toml`); tests via `pytest`.
- **Frontend:** ESLint (`eslint.config.mjs`) + Prettier (`.prettierrc`).
- Shared editor settings in `.editorconfig`.

```bash
# backend
cd backend && ruff check . && black --check . && pytest
# frontend
cd frontend && npm run lint && npx prettier --check .
```

## Status

Active deep-refactor program is tracked in [docs/plans/EXECUTE.md](docs/plans/EXECUTE.md) (single source of progress). See [docs/08-current-state.md](docs/08-current-state.md) for the current ground truth.
