# Deploying Tribhoomi

Two proven shapes. **Option A is recommended**: one container, one URL, free, and the AI
model works because Hugging Face Spaces give 16 GB RAM. Option B splits frontend and backend
across Vercel and Render.

Before either: push the repo to GitHub (see "Step 0").

## Step 0 — put the code on GitHub (once)

```bash
cd "/home/krish/Desktop/Tribhoomi web app"
git status                      # the repo is already initialised with one commit
gh auth login                   # or create the repo in the browser
gh repo create tribhoomi --public --source=. --push
```

`frontend/.env.local` (your Cesium token) is git-ignored and never pushed. Tokens are set on
the host instead (next steps).

## Option A — Hugging Face Space (single Docker container, recommended)

1. Go to https://huggingface.co/new-space → name `tribhoomi`, SDK **Docker**, hardware
   **CPU basic (free)**, visibility Public. Create.
2. Push this repo to the Space:
   ```bash
   git remote add hf https://huggingface.co/spaces/<your-hf-username>/tribhoomi
   git push hf main --force
   ```
   The root `Dockerfile` and the front-matter at the top of `README.md` (sdk: docker, app_port: 7860)
   are what the Space needs.
3. In the Space → **Settings → Variables and secrets** add a **Variable** (not secret, it is
   public in the browser anyway):
   - `NEXT_PUBLIC_CESIUM_TOKEN` = your Cesium ion token
   - `NEXT_PUBLIC_PUBLIC_URL` = `https://<your-hf-username>-tribhoomi.hf.space` (makes QR codes point at the live site)
   Save; the Space rebuilds. Variables are passed as Docker build args, which the Dockerfile declares.
4. First build takes ~10–15 minutes (installs CPU torch). Then open
   `https://<your-hf-username>-tribhoomi.hf.space`. The first AI run downloads the model (~15 MB).
5. Add a Variable `AI` = `1` to include the AI footprint model (the Space has enough RAM). Without it the build skips torch and the AI page reports "model unavailable".

Notes: the SQLite database is created and seeded on first start and lives inside the
container, so it resets whenever the Space restarts or sleeps (free Spaces sleep after 48 h of
inactivity; the first visit wakes it in ~1 minute). That is fine for a demo: every restart is
a clean demo state.

## Option A2 — Vercel frontend + the Hugging Face Space as backend

Want a `*.vercel.app` URL and the full app (AI included)? Deploy Option A first; the Space's
URL also serves the API (`https://<you>-tribhoomi.hf.space/api/health`). Then on Vercel:
import the repo, Root Directory `frontend`, and set `API_URL` to the Space URL (no trailing
slash) plus `NEXT_PUBLIC_CESIUM_TOKEN` and `NEXT_PUBLIC_PUBLIC_URL` (= the Vercel URL).

## AI footprint page on a small host

The free Render tier cannot hold PyTorch, so without a key the AI page reports "Disabled on this
server". Add ONE environment variable to the service and redeploy:

- **`GEMINI_API_KEY`** (recommended) - a free key from https://aistudio.google.com/apikey. The backend
  sends the aerial image to Google Gemini, which returns building outlines; Tribhoomi turns them into
  footprints with areas. Optional `GEMINI_MODEL` (default `gemini-3.8-flash`) if Google renames models.
- `HF_TOKEN` - a Hugging Face "read" token; used only when no Gemini key is set.

Paste the key with no quotes and no trailing Enter (the app trims both anyway). Order of preference:
local PyTorch, then Gemini, then Hugging Face. Locally the SegFormer model runs on CPU in ~3 s.
Note: a general vision model's outlines can vary slightly between runs, unlike the fixed SegFormer model.

## Why not Vercel for the backend?

Vercel runs serverless functions with a read-only, wiped-between-calls filesystem: the SQLite
registry would lose changes, and the AI model's dependencies exceed the function size limit.
Moving to hosted Postgres and dropping the AI would make it possible, but it is not worth the
risk for the demo.

## Option C — Render, one free service, no card (no AI page)

`render.yaml` builds the root Dockerfile with `AI=0`. Everything except the AI footprint
page works on one URL. Free instances sleep after 15 min idle (first request ~1 min).

1. Push the repo to GitHub (Step 0).
2. https://dashboard.render.com → New → **Blueprint** → connect the repo → Apply.
3. Service → Environment: add `NEXT_PUBLIC_PUBLIC_URL` = `https://tribhoomi.onrender.com`
   (or whatever name Render gave) and `NEXT_PUBLIC_CESIUM_TOKEN` = your token, then
   **Manual Deploy → Clear build cache & deploy** so they are baked into the frontend build.

## Option B — Vercel (frontend) + Render (backend)

Backend on Render (free tier: 512 MB RAM, so AI is disabled with `AI=0`):
1. https://dashboard.render.com → New → **Blueprint** → connect the GitHub repo. It reads
   `render.yaml` and creates `tribhoomi-api`. Deploy. Note the URL, e.g. `https://tribhoomi-api.onrender.com`.
2. Free Render services sleep after 15 min idle; the first request takes ~50 s. For a demo,
   open the API URL a minute before you present.

Frontend on Vercel:
1. https://vercel.com/new → import the GitHub repo → **Root Directory: `frontend`** →
   Framework Next.js (auto).
2. Environment variables:
   - `API_URL` = the Render URL (no trailing slash) — Next.js proxies `/api/*` there server-side
   - `NEXT_PUBLIC_CESIUM_TOKEN` = your Cesium ion token
   - `NEXT_PUBLIC_PUBLIC_URL` = `https://<project>.vercel.app`
3. Deploy. The `postinstall` script copies Cesium's static files during `npm ci`, so nothing
   else is needed.

## Any other Docker host (Railway, Fly.io, a VPS)

```bash
docker build -t tribhoomi --build-arg NEXT_PUBLIC_CESIUM_TOKEN=<token> --build-arg NEXT_PUBLIC_PUBLIC_URL=https://your.domain .
docker run -d -p 80:7860 tribhoomi          # add -v tribhoomi-data:/data to keep the DB across restarts
```
Backend alone: `docker build -t tribhoomi-api backend` (add `--build-arg AI=0` for small hosts).

## After deploying — checklist

- `/api/health` returns `{"ok":true}`; `/api/docs` opens Swagger.
- Home map loads parcels; `/globe` shows terrain (only with the Cesium token).
- `/verify?ulpin=09-141-0018-00046-B01-F04-U03-A` shows **TAMPERED** — the seeded story.
- Scan a QR from your phone: it must open the deployed `/verify` page, not localhost.
- The role dropdown is a demo device: anyone can pick "Government". Say so if asked; real
  auth is out of scope for the prototype.
