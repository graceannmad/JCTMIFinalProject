# API Contracts — JCTMI Final Project

All routes are Next.js API routes. All external API keys are server-side only and never exposed to the browser.

---

## `GET /api/health`

**Purpose:** Liveness check. Run before demo to confirm deployment is healthy.

**Request:** No body.

**Response `200`:**
```json
{ "ok": true, "ts": 1745712000000 }
```

---

## `POST /api/lyrics`

**Purpose:** Proxy to Genius API. Keeps `GENIUS_API_KEY` server-side.

**Request:**
```ts
{
  artist: string   // required — e.g. "Frank Ocean"
  song?: string    // optional — e.g. "Ivy"
}
```

**Response `200`:**
```ts
{
  artistLyrics: string[]   // lyrics of up to 5 top songs from the artist
  songLyrics?: string      // lyrics of the specific song, if provided and found
  geniusMiss?: boolean     // true if the artist couldn't be found on Genius
}
```

**Response `400`:**
```json
{ "error": "artist is required", "code": "VALIDATION" }
```

**Response `500`:**
```json
{ "error": "Genius API request failed", "code": "GENIUS_MISS" }
```

**Notes:**
- If `artist` is found but `song` is not, returns `artistLyrics` only — not an error.
- If `artist` is not found, returns `{ artistLyrics: [], geniusMiss: true }` — not a 500. Callers should proceed with quiz-only signals.

---

## `POST /api/generate`

**Purpose:** Full pipeline — poet matching, playlist generation, and Spotify verification. Returns the complete results payload.

**Request:**
```ts
{
  quizInput: {
    artist: string
    song: string
    lyricChoice: string    // text of selected option from Q3
    excerptChoice: string  // text of selected option from Q4
    moodChoice: string     // text of selected option from Q5
  },
  lyrics: {
    artistLyrics: string[]
    songLyrics?: string
    geniusMiss?: boolean
  }
}
```

**Response `200`:**
```ts
{
  poet: {
    id: string
    name: string
    dates: string
    context: string
    voiceDescription: string
    portraitUrl?: string
  },
  matchExplanation: string   // ~150 words, first-person poet voice
  historicalContext: string  // 2–3 sentences
  playlist: Array<{
    title: string
    artist: string
    spotifyUrl: string       // direct Spotify track URL, always verified
    justification: string    // 2–3 sentences, poet voice
    poemReference?: string   // optional quote from poet's own work
  }>                         // 6–10 items
}
```

**Response `408` (timeout):**
```json
{ "error": "Generation timed out. Please try again.", "code": "CLAUDE_TIMEOUT" }
```

**Response `500`:**
```json
{ "error": "...", "code": "CLAUDE_TIMEOUT" | "SPOTIFY_ALL_FAILED" | "UNKNOWN" }
```

**Internal pipeline (not visible to client):**
```
1. Load corpus.json + poets.json from disk
2. Claude Call 1: match user signals → { matchedPoetId, matchReasoning }
3. Claude Call 2: generate playlist in poet voice → { matchExplanation, historicalContext, playlist[] }
4. For each playlist item (parallel):
     → Spotify search by "title artist"
     → found: attach spotifyUrl
     → not found: retry with artist-only search
     → still not found: flag for regeneration
5. If any flagged: Claude Call 2b → regenerate dropped slots → re-verify
6. If >2 consecutive failures: omit slot, return shorter playlist
7. Return ResultsPayload
```

**Timeout:** Internal hard limit of 50s (Vercel free tier max is 60s).

**Notes:**
- `playlist` may contain fewer than 8 items if Spotify verification repeatedly fails — this is not an error.
- `spotifyUrl` is always a verified direct track URL — never a search query.

---

## External API Reference

### Genius API
- **Base URL:** `https://api.genius.com`
- **Auth:** `Authorization: Bearer ${GENIUS_API_KEY}` header
- **Key endpoints:**
  - `GET /search?q={artist+song}` — find song by title/artist
  - `GET /songs/{id}` — get song metadata including lyrics URL

### Spotify Web API
- **Base URL:** `https://api.spotify.com/v1`
- **Auth:** Client credentials flow — `POST https://accounts.spotify.com/api/token` with `grant_type=client_credentials`
- **Token:** Cached per server instance, refreshed when expired
- **Key endpoint:**
  - `GET /search?q={title+artist}&type=track&limit=1` — verify track exists, get Spotify URL

### Anthropic Claude API
- **SDK:** `@anthropic-ai/sdk`
- **Model:** `claude-sonnet-4-6`
- **Key parameters:**
  - `max_tokens: 2048` (Call 1), `4096` (Call 2)
  - Tool use for structured output on both calls
  - No streaming for MVP
