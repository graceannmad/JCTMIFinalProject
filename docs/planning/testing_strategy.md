# Testing Strategy — JCTMI Final Project

**Last updated:** 2026-04-27

The architecture (Section 8: Testability) established that this project uses **no automated test suite** for the MVP. The testing strategy is: isolate external services behind thin client modules, use bypass mode for rapid UI iteration, and rely on manual testing before demo. This is appropriate for a 3-day class project.

---

## Test Pyramid

For this project, the pyramid is inverted from a standard production app:

```
Manual end-to-end testing  ← PRIMARY investment
API-level manual testing   ← Secondary
No automated unit tests    ← Deferred post-Wednesday
```

**Why:** The highest risk is the AI pipeline producing good results — this requires manual inspection of output quality (does the poet voice sound right? are the matches good?). No automated test can measure this. Automated unit tests for a 3-day project would slow down delivery without adding meaningful safety.

---

## External Service Isolation

All three external services are wrapped in thin client modules. This enables:
- Swapping for fixture data during development without code changes
- Bypassing all external calls via `?bypass=true`

| Module | Purpose | Bypass behavior |
|--------|---------|----------------|
| `/lib/geniusClient.ts` | Genius API lyrics | `?bypass=true` skips entirely |
| `/lib/spotifyClient.ts` | Spotify track search + URL | `?bypass=true` skips entirely |
| `/lib/claudeClient.ts` | Claude API tool use calls | `?bypass=true` skips entirely |

**Dev fixture files:**
- `/fixtures/demo-result.json` — complete `ResultsPayload`, used by `?bypass=true`
- `/fixtures/lyrics/[artist-name].json` — pre-cached lyrics per artist (also used as rate-limit fallback on demo day)

---

## Phase-by-Phase Testing

### Phase 1

**What to test:**
- Deployed URL loads without error
- `GET /api/health` returns `{ ok: true }` on Vercel URL (not localhost)
- `npm run build` passes with zero TypeScript errors
- `/?bypass=true` renders fixture data without calling any external API (check Vercel function logs to confirm no outbound calls)

**Test data:** Hand-authored `/fixtures/demo-result.json`

**Regression checks:** None (first phase)

---

### Phase 2

**What to test manually (API level):**

| Test | Input | Expected |
|------|-------|----------|
| Lyrics — known artist | `{ artist: "Frank Ocean" }` | Returns `artistLyrics[]` with content |
| Lyrics — unknown artist | `{ artist: "xyzzy99999" }` | Returns `{ artistLyrics: [], geniusMiss: true }`, HTTP 200 |
| Generate — full input | Valid `QuizInput` + lyrics | `ResultsPayload` with all required fields |
| Generate — genius miss | `QuizInput` + `{ artistLyrics: [], geniusMiss: true }` | Still returns `ResultsPayload` (quiz-only match) |
| Generate — timing | Any valid input | Response within 35s |
| Spotify URLs | Inspect 3 `spotifyUrl` values from generate response | All open real Spotify tracks |

**Poet voice quality checks (manual inspection):**
- `matchExplanation`: first-person? sounds like the poet? references their writing style?
- `justification` fields: do they connect the song to the poet's themes?
- `poemReference` fields: are they real quotes from the corpus?

**OCR review (for each reviewed file in `/corpus/reviewed/`):**
- English text only — no Hebrew or Arabic characters
- Poem title present at top of chunk
- Stanza breaks preserved (blank lines between stanzas)
- `poet` field in corpus.json matches a valid `poets.json` id

**Regression checks:**
- `GET /api/health` still passes after Phase 2 deploy
- `?bypass=true` still works (no regression to bypass mode)

---

### Phase 3

**What to test manually (full flow):**

| Test | Steps | Expected |
|------|-------|----------|
| Desktop full flow | Open site on Chrome, complete all 5 questions | Results page loads with poet, explanation, playlist |
| Mobile full flow | Open site on iPhone Safari, complete all 5 questions | Same — layout correct, no overflow |
| Tap target check | Tap all interactive elements on mobile | All respond correctly, no mis-taps on adjacent elements |
| Genius miss flow | Enter artist not on Genius | Graceful note shown; result still generated |
| Network failure | Disconnect wifi after submitting quiz | Error state shown with retry button — not blank screen |
| Spotify links | Click 3 playlist links | Each opens the correct track in Spotify |
| Fixture regression | Load `/?bypass=true` | Fixture result renders correctly |

**Test data:** Use real artists across tests. Suggested: try at least one mainstream artist (Taylor Swift), one indie artist (Phoebe Bridgers), one international artist.

**Regression checks:**
- Phase 1: health check still passes
- Phase 2: `POST /api/generate` still returns valid result (API didn't break during UI build)
- Phase 1: `?bypass=true` still functional

---

### Phase 4 (Pre-Demo Checklist)

Run this the morning of the demo, from the deployed production URL:

```
[ ] GET /api/health → { ok: true }
[ ] Complete full quiz (5 questions) → results load
[ ] Complete quiz 5 times with different artists → at least 3 different poets matched
[ ] All Spotify links open correct tracks
[ ] Complete full quiz on phone → layout correct, no overflow
[ ] ?bypass=true → demo result loads instantly (< 1s)
[ ] Disconnect wifi, enter a pre-cached artist → lyrics load from fixture, result generates
[ ] Share URL with one other person → test on their device
[ ] Site loads in < 3s on mobile (Chrome DevTools → Network → Fast 3G throttle)
```

**If any item fails:**
- Spotify links broken → check Spotify token expiry, redeploy
- Wrong poet always matched → review corpus quality and `voiceDescription` prompts
- Mobile layout broken → check Tailwind responsive classes
- Bypass not working → check `/fixtures/demo-result.json` is valid JSON

---

## AI Output Quality Criteria

These are the "eval suite" equivalents for this project. Review manually after Phase 2 and again during Phase 4 test runs.

**Matching quality (Call 1):**
- Does the matched poet feel right for the artist entered?
- Try several different musical styles — do different poets get matched?
- If the same poet is matched every time regardless of input, the corpus or prompt needs adjustment

**Playlist quality (Call 2):**
- Are songs real (verified via Spotify)?
- Do songs feel like something the poet would love — not just generic recommendations?
- Is the poet's voice consistent across the playlist narration?
- Are at least 2–3 poem references included across the full playlist?
- Does the match explanation (~150 words) feel personal and literary?

**Red flags to fix before demo:**
- Same poet matched for every input → review corpus distribution (not enough variety between poets)
- Hallucinated songs despite Spotify verification loop → review retry logic
- Poet voice breaks character ("As an AI language model…") → fix system prompt guardrail
- `justification` fields are generic / not poet-specific → improve system prompt persona encoding

---

## Environment Parity

| Aspect | Local dev | Vercel production |
|--------|-----------|-------------------|
| External APIs | Real (same keys) | Real (same keys) |
| Corpus | Same `corpus.json` | Same (bundled at build) |
| Bypass mode | Works via `?bypass=true` | Works via `?bypass=true` |
| Function timeout | No limit (Node process) | 60s (Vercel free tier) |

**Known risk:** Vercel's 60s function timeout doesn't apply locally. Always time the full pipeline against the deployed URL, not localhost.
