# Architecture — JCTMI Final Project

**Status:** Approved  
**Author:** Grace  
**Last updated:** 2026-04-27  

---

## 1. System Overview

**Style:** Full-stack Next.js monorepo — React frontend + serverless API routes — deployed as a single unit to Vercel. No separate backend service. No database.

**Four runtime components:**
```
[Browser: React Quiz UI]
        ↓  fetch
[Vercel: Next.js API Routes]
        ↓              ↓              ↓
  [Genius API]   [Claude API]   [Spotify API]

[corpus.json] ← bundled into serverless function at deploy time
[poets.json]  ←
```

**One offline component (run once before deploy):**
```
[Scanned PDFs] → [OCR Script: Claude Vision] → [corpus.json committed to repo]
```

The corpus is pre-processed offline, committed to the repo as a JSON file, and bundled into the Vercel deployment at build time. No vector DB server, no runtime embedding step. See ADR-001 for this decision.

---

## 2. Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | Type safety across frontend + backend in one codebase |
| Framework | Next.js 15 (App Router) | API routes + React in one deploy; Vercel-native; beginner-friendly |
| Styling | Tailwind CSS | Fast responsive layout; custom medieval aesthetic via CSS variables |
| AI model | claude-sonnet-4-6 | Best quality for literary matching and poet-voice generation |
| Lyrics | Genius API (REST) | Free tier; accurate lyrics; artist catalog search |
| Verification | Spotify Web API (client credentials) | Track search + direct URL; no user OAuth needed (see ADR-002) |
| Corpus storage | `corpus.json` bundled in repo | 25 pages fits in Claude context window — no vector DB at this scale (see ADR-001) |
| OCR | Claude Vision API (offline script) | Handles variable layouts; extracts English-only (see ADR-003) |
| Hosting | Vercel (free tier) | Auto-deploy from GitHub; HTTPS automatic; no config needed |

---

## 3. Data Architecture

**No database.** All data is either static (committed to repo) or ephemeral (lives only within a single request/response cycle).

### Static files (committed to repo)

**`/data/corpus.json`** — OCR'd poem text, tagged by poet:
```ts
type CorpusChunk = {
  poet: string       // "Judah Halevi"
  poemTitle: string  // "The Sensitive Doe"
  text: string       // English translation text
  sourcePage: number // for attribution
}
```

**`/data/poets.json`** — Hand-authored poet profiles:
```ts
type PoetProfile = {
  id: string
  name: string
  dates: string
  context: string          // historical background paragraph
  voiceDescription: string // persona notes fed into system prompt
  portraitUrl?: string
}
```

### Request-scoped types (no persistence)

```ts
type QuizInput = {
  artist: string
  song: string
  lyricChoice: string    // Q3 selected option text
  excerptChoice: string  // Q4 selected option (pre-seeded from corpus)
  moodChoice: string     // Q5
}

type LyricsData = {
  artistLyrics: string[]  // top songs from artist's catalog
  songLyrics?: string     // specific song lyrics
}

type PlaylistItem = {
  title: string
  artist: string
  spotifyUrl: string
  justification: string   // poet-voice narration
  poemReference?: string  // quote from corpus
}

type ResultsPayload = {
  poet: PoetProfile
  matchExplanation: string  // first-person poet voice
  historicalContext: string
  playlist: PlaylistItem[]
}
```

### Data flow

```
User fills quiz
  → /api/lyrics: fetch Genius (artist catalog + specific song)
  → /api/generate: 
      [corpus.json + poets.json loaded from disk]
      → Claude Call 1: match user signals to poet
      → Claude Call 2: generate playlist in poet's voice
      → Spotify: verify each song in parallel, get track URLs
      → retry failed verifications (max 2 per song)
  → ResultsPayload returned to browser
  → No data stored anywhere
```

---

## 3b. AI/ML Architecture

### Context strategy (see ADR-001)

For the MVP corpus of ~25 pages (~20,000 tokens of English text), the entire corpus is included in every matching call. This fits comfortably within Claude's 200k context window and eliminates the need for a vector DB at this scale.

**Migration path:** When corpus exceeds ~75 pages, switch to pre-computed embeddings (Voyage AI) stored as a JSON file in the repo. At query time, embed the user's signals and run cosine similarity to select top-K chunks. No infrastructure changes required — same flat-file approach, just with a retrieval step added.

### Two-call AI pipeline

**Call 1 — Poet Matching**
- **System prompt:** Literary analyst role + full corpus (all chunks, tagged by poet)
- **User message:** Fetched lyrics + all quiz answers
- **Output:** Structured JSON via Claude tool use:
  ```ts
  { matchedPoetId: string, matchReasoning: string }
  ```
- Tool use guarantees parseable output — no regex on prose.

**Call 2 — Playlist Generation + Narration**
- **System prompt:** Matched poet's persona (name, dates, voiceDescription, sample lines from their corpus chunks)
- **User message:** User's musical taste summary + playlist instruction
- **Output:** Structured JSON via Claude tool use:
  ```ts
  {
    matchExplanation: string
    historicalContext: string
    playlist: Array<{
      title: string
      artist: string
      justification: string
      poemReference?: string
    }>
  }
  ```
- Constraint in prompt: songs must be real tracks with exact title and artist name.

### Spotify verification loop

```
for each song in playlist (run in parallel):
  call Spotify search API
  → found → attach spotifyUrl, mark verified
  → not found → retry with artist-only search
  → still not found → flag for regeneration

if any songs flagged:
  Call 2b: "These songs weren't found on Spotify: [list].
            Replace them with verified alternatives."
  re-verify replacements

if >2 consecutive failures → omit slot, return shorter playlist
```

### Token budget per session

| Component | Tokens |
|-----------|--------|
| Corpus context (25 pages) | ~20,000 |
| System prompts (both calls) | ~1,500 |
| User input + lyrics | ~2,000 |
| Responses (both calls) | ~2,000 |
| **Total** | **~25,500** |

At claude-sonnet-4-6 pricing: ~**$0.08–0.12 per session**.

### Prompt injection protection

User-supplied text (artist name, song title, quiz answers) is passed only as tool input fields — never string-concatenated into system prompt instructions.

---

## 3c. OCR Pipeline (Offline, One-Time)

Location: `/scripts/ocr.ts`  
Run: locally before deploy, re-run when new scans are added.

```
Input:  /corpus/raw/[poet-name]_p[N].pdf  (any layout)
Output: /data/corpus.json

For each PDF page (rendered as image):
  → Claude Vision with prompt:
      "Extract only the English text from this page.
       Ignore any Hebrew or Arabic text.
       Preserve poem titles and stanza breaks.
       Return empty string if no English text is present."
  → Append chunk to corpus with poet tag (from filename)
  → Review output in /corpus/reviewed/ before committing
```

**Layout-agnostic:** Claude Vision handles two-column bilingual, single-column English, and any other format without special-casing. See ADR-003.

**Filename convention:** `[poet-id]_p[page-number].[ext]`  
Example: `judah-halevi_p342.pdf`, `ibn-gabirol_p015.jpg`

---

## 4. API Design

All routes are Next.js API routes (server-side). API keys never reach the browser.

### `POST /api/lyrics`
Proxies Genius API. Keeps `GENIUS_API_KEY` server-side.

### `POST /api/generate`
Orchestrates the full pipeline: Claude matching → playlist generation → Spotify verification.  
Internal timeout: 50s (under Vercel's 60s free-tier function limit).

### `GET /api/health`
Simple liveness check. Use before demo to confirm deployment is healthy.

See `api_contracts.md` for full request/response schemas.

**Consistent error format across all routes:**
```ts
{ error: string, code: "GENIUS_MISS" | "CLAUDE_TIMEOUT" | "SPOTIFY_ALL_FAILED" | "UNKNOWN" }
```

---

## 5. Security

| Concern | Approach |
|---------|----------|
| API keys | Vercel environment variables only — never in client bundle |
| External API calls | Server-side only via API routes — browser never calls Genius/Claude/Spotify directly |
| Prompt injection | User text passed as tool input fields, not concatenated into system prompt |
| CORS | Next.js same-origin default; no public API consumers |
| User data | None collected or stored |

**Environment variables required in Vercel dashboard:**
- `ANTHROPIC_API_KEY`
- `GENIUS_API_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

---

## 6. Infrastructure & Deployment

**Deployment:** Push to `main` → Vercel auto-deploys.

```
GitHub (main) → Vercel build → https://[project].vercel.app
```

- Single environment (production) — no staging needed for class project
- HTTPS automatic via Vercel
- Environment variables set once in Vercel dashboard

**Vercel free tier limits vs. expected usage:**

| Limit | Free tier | Expected |
|-------|-----------|----------|
| Bandwidth | 100 GB/month | <1 GB |
| Function invocations | 100k/month | <1k |
| Function duration | 60s max | ~25–30s |
| Build minutes | 6k/month | <10 |

All well within free tier. ✓

---

## 7. Observability

Appropriate for a class project:
- **Vercel function logs** (built-in dashboard) — pipeline step logging at key points
- **`console.log` checkpoints:** lyrics fetched, poet matched, playlist generated, N/M songs verified
- **`GET /api/health`** — run before demo to confirm live deployment
- **Vercel Analytics** (optional, free) — page views and performance

---

## 8. Testability

Given the 3-day deadline, the strategy is: **isolate external services, test manually before demo**.

- All external calls wrapped in thin client modules (`/lib/geniusClient.ts`, `/lib/spotifyClient.ts`, `/lib/claudeClient.ts`) — easy to swap for stubs
- `?bypass=true` query param in dev mode: skips Genius/Spotify calls, returns fixture data from `/fixtures/` — iterate on UI without burning API quota
- Before demo: run full quiz manually 5+ times on phone and laptop with different inputs
- Pre-generate one complete result, save as `/fixtures/demo-result.json` — instant fallback if generation is slow during live demo

No automated test suite for MVP. Acceptable for a class project deadline.

---

## 9. Failure Modes & Resilience

| Dependency | Failure | User impact | Fallback |
|-----------|---------|-------------|----------|
| Genius API — artist not found | No lyrics | Reduced match quality | Proceed with quiz-only signals; note gracefully in UI |
| Genius API — rate limited during demo | All lyrics fail | Quiz-only matching | Pre-cache lyrics for 5 expected demo artists as static JSON in `/fixtures/lyrics/` |
| Claude API — timeout | No result | Loading screen hangs | 50s timeout → error page with retry button |
| Claude API — malformed tool output | Unparseable result | Generation fails | Retry once; show error on second failure |
| Spotify — song not found after 2 retries | Slot dropped | Shorter playlist | Omit slot; return 6–9 songs rather than 8–10 |
| Spotify — all songs fail | No playlist | Bad experience | Regenerate playlist once; show error if still failing |
| Vercel cold start | ~1–2s extra on first request | Slight delay | Warm up by loading the page before demo starts |

**Pipeline timing budget (must stay under Vercel's 60s limit):**

| Step | Time |
|------|------|
| Genius fetch | ~3s |
| Claude Call 1 (matching) | ~5–8s |
| Claude Call 2 (playlist) | ~8–12s |
| Spotify verification (parallel) | ~5s |
| **Total** | **~21–28s** ✓ |

---

## 10. Cost Analysis

| Service | Rate | Demo day (30 users) | Through May (200 users) |
|---------|------|--------------------|-----------------------|
| Claude API | ~$0.10/session | ~$3.00 | ~$20.00 |
| Genius API | Free | $0 | $0 |
| Spotify API | Free | $0 | $0 |
| Vercel | Free tier | $0 | $0 |
| **Total** | | **~$3.00** | **~$20.00** |

---

## 11. Known Tradeoffs & Technical Debt

| Tradeoff | Decision | When to revisit |
|----------|----------|-----------------|
| Context stuffing vs. vector DB | Context stuffing for MVP | When corpus > ~75 pages (see ADR-001) |
| No streaming | Single request + loading animation | If 30s wait feels too long in user testing |
| No automated tests | Manual testing only | Before adding post-Wednesday features |
| Single production environment | Deploy directly to prod | If project grows beyond class scope |
| Corpus bundled in repo | Simple, works for small corpus | When corpus becomes too large to commit (>50MB) |
