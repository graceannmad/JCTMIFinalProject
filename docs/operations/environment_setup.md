# Environment Setup — JCTMI Final Project

**Last updated:** 2026-04-27

---

## Local Development

### Prerequisites

- Node.js v18+ (v20 recommended)
- npm v9+
- Git

### First-time setup

```bash
git clone https://github.com/[your-username]/jctmi-final-project.git
cd jctmi-final-project
npm install
cp .env.local.example .env.local
# Fill in all 4 API keys in .env.local
npm run dev
```

Open `http://localhost:3000`

### `.env.local` (never commit this file)

```
ANTHROPIC_API_KEY=sk-ant-...
GENIUS_API_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

### Dev bypass mode

Add `?bypass=true` to any URL to skip all external API calls and return fixture data from `/fixtures/demo-result.json`. Use this to iterate on UI without burning API quota.

```
http://localhost:3000?bypass=true
```

---

## API Keys — Setup Instructions

### Anthropic (Claude API)
1. Go to console.anthropic.com
2. Settings → API Keys → Create Key
3. Copy to `ANTHROPIC_API_KEY`

### Genius API
1. Go to genius.com/api-clients
2. Create a new API client
3. Copy the "Client Access Token" to `GENIUS_API_KEY`

### Spotify Web API
1. Go to developer.spotify.com/dashboard
2. Create an app (any name/description, set redirect URI to `http://localhost:3000`)
3. Copy Client ID → `SPOTIFY_CLIENT_ID`
4. Copy Client Secret → `SPOTIFY_CLIENT_SECRET`
5. Note: client credentials flow is used — no user login required

---

## Production (Vercel)

### Environment Variables

Set once in Vercel dashboard: Project → Settings → Environment Variables

| Variable | Scope |
|----------|-------|
| `ANTHROPIC_API_KEY` | Production, Preview |
| `GENIUS_API_KEY` | Production, Preview |
| `SPOTIFY_CLIENT_ID` | Production, Preview |
| `SPOTIFY_CLIENT_SECRET` | Production, Preview |

### Deployment

Push to `main` → Vercel auto-deploys. No manual steps required.

Verify after each deploy:
```
GET https://[project].vercel.app/api/health
```
Expected: `{ "ok": true, "ts": ... }`

---

## OCR Pipeline (one-time, run locally)

Used to process scanned PDFs into `corpus.json`. Re-run when adding new scans.

### Setup

```bash
# No additional install needed — uses the same ANTHROPIC_API_KEY from .env.local
```

### File naming convention

Name input files: `[poet-id]_p[page-number].[ext]`

Examples:
```
corpus/raw/judah-halevi_p342.pdf
corpus/raw/judah-halevi_p343.pdf
corpus/raw/ibn-gabirol_p015.jpg
```

Poet ID must match an entry in `/data/poets.json`.

### Run

```bash
npx ts-node scripts/ocr.ts
```

Output: `/corpus/reviewed/[filename].txt` — review before committing.

### Review checklist before committing to corpus.json

- [ ] English text only (no Hebrew or Arabic characters)
- [ ] Poem title present
- [ ] Stanza breaks preserved
- [ ] Poet ID matches a `poets.json` entry
- [ ] No footnote text mixed into poem body

### Merge reviewed text into corpus.json

```bash
npx ts-node scripts/build-corpus.ts
# Reads all /corpus/reviewed/*.txt → merges into /data/corpus.json
```

---

## Infrastructure by Phase

| Phase | What's provisioned |
|-------|-------------------|
| 1 | Vercel project created, GitHub connected, env vars set |
| 2 | No new infrastructure — all external APIs accessed with existing keys |
| 3 | No new infrastructure |
| 4 | No new infrastructure — fixture cache added to repo |

---

## Configuration by Phase

| Phase | New env vars | New static files |
|-------|-------------|-----------------|
| 1 | All 4 API keys | `/fixtures/demo-result.json`, `/data/poets.json` skeleton, `/data/corpus.json` skeleton |
| 2 | None | `/data/corpus.json` (real OCR data), `/data/poets.json` (real profiles) |
| 3 | None | None |
| 4 | None | `/fixtures/lyrics/[artist].json` (pre-cached lyrics for demo) |
