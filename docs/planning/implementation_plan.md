# Implementation Plan — JCTMI Final Project

**Status:** Approved  
**Author:** Grace  
**Last updated:** 2026-04-27  
**Demo deadline:** Wednesday 2026-04-29  

---

## Timeline Summary

| Phase | Focus | Day | Risk |
|-------|-------|-----|------|
| 1 | Scaffold + Deploy + Dev Tooling | Sunday Apr 27 | Low |
| 2 | AI Pipeline + All Integrations + Corpus | Sunday–Monday Apr 27–28 | **High** |
| 3 | Quiz UI + Results Page + Full Integration | Monday Apr 28 | Medium |
| 4 | Visual Design + Polish + Demo Prep | Tuesday Apr 29 | Low |

**Critical rule:** Phase 2 (AI pipeline) ships before any UI work begins. The bypass mode (`?bypass=true`) exists precisely so Phase 3 UI work can proceed against fixture data if Phase 2 runs long.

## Dependency Map

```
Phase 1: Foundation
    ↓
Phase 2: AI Pipeline   ← HIGHEST RISK — gating dependency for everything else
    ↓
Phase 3: Quiz UI + Integration
    ↓
Phase 4: Design + Demo Prep
```

---

## Phase 1: Foundation

**Goal:** App deployed and live on Vercel. Dev environment fast to iterate in. Bypass mode working.

### A. Deliverables

| Task | Complexity | PRD Ref |
|------|-----------|---------|
| `[ ]` Create Next.js 15 project (TypeScript, Tailwind, App Router) | S | §8 Constraints |
| `[ ]` Push to GitHub, connect to Vercel, verify first auto-deploy | S | §8 Constraints |
| `[ ]` Set all 4 env vars in Vercel dashboard + `.env.local` for dev | S | §4 Integrations |
| `[ ]` `GET /api/health` returns `{ ok: true, ts }` | S | §7 Success Criteria |
| `[ ]` Dev bypass: `?bypass=true` returns fixture JSON, skips all external APIs | S | §8 Constraints |
| `[ ]` `/fixtures/demo-result.json` — hand-authored placeholder `ResultsPayload` | S | §9 Out of Scope |
| `[ ]` `/data/poets.json` skeleton — 2–3 entries, placeholder `voiceDescription` | S | §3 Functional |
| `[ ]` `/data/corpus.json` skeleton — a few manually typed poem lines per poet | S | §3 Functional |
| `[ ]` TypeScript strict mode configured | S | §8 Constraints |
| `[ ]` Minimal landing page (text only — proves app loads) | S | §6 UX |

### B. Acceptance Criteria

- `https://[project].vercel.app` loads without error
- `GET /api/health` returns `{ ok: true }` on deployed Vercel URL
- `npm run build` succeeds with zero TypeScript errors
- `/?bypass=true` returns fixture data without calling Genius, Claude, or Spotify
- All 4 environment variables readable by API routes on Vercel

### C. Deployment Plan

1. `npx create-next-app@latest jctmi --typescript --tailwind --app`
2. Push to GitHub
3. vercel.com → New Project → import repo → deploy
4. Vercel dashboard → Settings → Environment Variables → add:
   - `ANTHROPIC_API_KEY`
   - `GENIUS_API_KEY`
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
5. Confirm auto-deploy triggered and passed
6. Hit `https://[project].vercel.app/api/health` → verify `{ ok: true }`

**Rollback:** Delete Vercel project, re-import from GitHub.

### D. Testing Plan

- Visit deployed URL → no error, page loads
- `GET /api/health` in browser → `{ ok: true }`
- `npm run build` locally → zero TypeScript errors
- `/?bypass=true` → fixture result renders (even if unstyled)

### E. Go/No-Go Gate

- [ ] App live on Vercel URL
- [ ] Health check passes on deployed URL
- [ ] Build succeeds with zero TypeScript errors
- [ ] Bypass mode works — fixture loads without external API calls

---

## Phase 2: AI Pipeline + All Integrations + Corpus

**Goal:** `POST /api/generate` returns a real `ResultsPayload` with verified Spotify URLs. Real poet corpus loaded from OCR'd text. This is the highest-risk phase — complete before touching UI.

### A. Deliverables

| Task | Complexity | PRD Ref |
|------|-----------|---------|
| `[ ]` `/lib/geniusClient.ts` — search artist catalog + specific song, return lyrics | M | §4 Integrations |
| `[ ]` `/lib/spotifyClient.ts` — client credentials token (cached), track search → URL | M | §4 Integrations |
| `[ ]` `/lib/claudeClient.ts` — tool use wrapper for both Claude calls | M | §4 Integrations |
| `[ ]` `POST /api/lyrics` — proxies Genius, handles miss gracefully | S | §4 API Design |
| `[ ]` `POST /api/generate` — full orchestration pipeline | L | §3 Functional |
| `[ ]` Claude Call 1: poet matching via tool use → `{ matchedPoetId, matchReasoning }` | M | §5 AI/ML |
| `[ ]` Claude Call 2: playlist + narration via tool use → full `ResultsPayload` shape | M | §5 AI/ML |
| `[ ]` Spotify verification loop: parallel, 2 retries per song, regenerate on failure | M | §5 AI/ML |
| `[ ]` 50s internal timeout with `CLAUDE_TIMEOUT` error response | S | §4 API Design |
| `[ ]` Prompt injection protection: user inputs as tool fields only | S | §5 Security |
| `[ ]` `/scripts/ocr.ts` — Claude Vision OCR, reads `/corpus/raw/`, writes `/corpus/reviewed/` | M | §3c Architecture |
| `[ ]` Run OCR on 25 pages, review output, populate `corpus.json` | M | §8 Constraints |
| `[ ]` Populate `poets.json` with real profiles and `voiceDescription` per poet | S | §3 Data |

### B. Acceptance Criteria

- `POST /api/lyrics { artist: "Frank Ocean" }` returns lyrics within 5s
- `POST /api/lyrics` with unknown artist returns `{ artistLyrics: [], geniusMiss: true }` — not a 500
- `POST /api/generate` with valid quiz input returns complete `ResultsPayload` within 35s
- Every `spotifyUrl` in response opens a real Spotify track (manually verify 3 links)
- Claude tool use responses parse to valid TypeScript types — no unhandled exceptions
- `corpus.json` contains real OCR'd text for at least 3 poets, at least 3 chunks each
- Pipeline returns a result when `geniusMiss: true` (quiz-only matching path works)
- Vercel function logs show no unhandled errors

### C. Deployment Plan

- Push to main → Vercel auto-deploys
- No new environment variables (all set in Phase 1)
- Verify `GET /api/health` still passes post-deploy
- Test `POST /api/generate` against production URL (curl or browser fetch in devtools)

**Rollback:** Revert to Phase 1 commit — health check and bypass mode still functional.

### D. Testing Plan

**API testing (manual):**
- `POST /api/lyrics` — known artist: expect lyrics array
- `POST /api/lyrics` — unknown artist: expect `{ artistLyrics: [], geniusMiss: true }`
- `POST /api/generate` — full valid input: inspect full `ResultsPayload`, verify structure matches TypeScript types
- `POST /api/generate` — artist Genius can't find: confirm graceful miss, result still generated
- Timing: run pipeline 3 times, confirm all complete < 35s

**Poet voice quality check:**
- Read `matchExplanation` — does it sound like the poet speaking in first person?
- Read 3 playlist `justification` fields — do they reference the poet's themes?
- Confirm `poemReference` appears in at least some playlist items

**OCR review:**
- Open 5 files in `/corpus/reviewed/` — confirm English-only, no Hebrew mixed in
- Confirm poem titles preserved, stanza breaks present
- Confirm `poet` field on each chunk matches a valid `poets.json` id

### E. Go/No-Go Gate

- [ ] `POST /api/generate` returns valid `ResultsPayload` with verified Spotify URLs
- [ ] Pipeline completes in < 35s
- [ ] At least 3 poets in corpus with real OCR'd text
- [ ] Genius miss path works — no 500 error
- [ ] Zero unhandled TypeScript exceptions in Vercel logs

---

## Phase 3: Quiz UI + Results Page + Full Integration

**Goal:** A real user can open the site, complete the quiz, and see their personalized result. Works on phone and laptop.

### A. Deliverables

| Task | Complexity | PRD Ref |
|------|-----------|---------|
| `[ ]` `/app/page.tsx` — single-page progressive quiz, one question at a time | L | §6 UX |
| `[ ]` Q1: artist free-text input + submit | S | §3 Functional |
| `[ ]` Q2: song free-text input + submit | S | §3 Functional |
| `[ ]` Q3–Q5: multiple choice card components (tap/click to select) | S | §3 Functional |
| `[ ]` Q4 excerpt options seeded from `corpus.json` at build time | S | §3 Functional |
| `[ ]` Progress indicator ("Question 2 of 5") | S | §6 UX |
| `[ ]` Animated slide transition between questions | S | §6 UX |
| `[ ]` Full-screen loading overlay with placeholder animation + rotating flavor text | M | §6 UX |
| `[ ]` Results section: poet name + portrait placeholder | S | §3 Functional |
| `[ ]` Results section: match explanation (poet voice) | S | §3 Functional |
| `[ ]` Results section: historical context | S | §3 Functional |
| `[ ]` Results section: playlist cards (title, artist, justification, poem ref, Spotify link) | M | §3 Functional |
| `[ ]` Mobile-responsive layout — all screens usable at 375px width | M | §4 NFR |
| `[ ]` Error state: message + retry button if generation fails or times out | S | §9 Failure Modes |
| `[ ]` Graceful Genius miss: small note if artist lyrics couldn't be fetched | S | §9 Failure Modes |

### B. Acceptance Criteria

- Full quiz completable on Chrome desktop without errors
- Full quiz completable on mobile Safari (iPhone) — tap targets ≥ 44px, no layout overflow
- Results page shows: poet name, match explanation, historical context, and all playlist cards
- Each playlist card has a Spotify link that opens a real track
- Loading state visible and animated throughout generation — no frozen screen
- Error state shows on generation failure — not a blank screen
- Q4 poetry excerpts drawn from real `corpus.json` text
- `?bypass=true` still renders fixture result (regression check)

### C. Deployment Plan

- Push to main → Vercel auto-deploys
- No new environment variables
- Verify full quiz flow on Vercel URL on phone + laptop after deploy

**Rollback:** Revert to Phase 2 commit — API still works, UI regresses to minimal landing page.

### D. Testing Plan

- Complete full quiz on Chrome desktop → results load, Spotify links work
- Complete full quiz on mobile Safari → layout correct, no overflow, tap targets usable
- Enter artist Genius can't find → graceful note shown, result still generated
- Disconnect network after submitting quiz → error state shown, not blank screen
- Click 3 Spotify links → confirm correct tracks open in Spotify
- Load `/?bypass=true` → fixture results render correctly (Phase 1 bypass mode unbroken)

### E. Go/No-Go Gate

- [ ] Full quiz → loading → results works end-to-end on phone and desktop
- [ ] All Spotify links open verified tracks
- [ ] Error state shows on failure — no blank screen
- [ ] `?bypass=true` still functional

---

## Phase 4: Visual Design + Polish + Demo Prep

**Goal:** Site looks beautiful and is hardened for the live demo. No surprises on Wednesday.

### A. Deliverables

| Task | Complexity | PRD Ref |
|------|-----------|---------|
| `[ ]` Parchment/paper background texture | S | §6 UX |
| `[ ]` Jewel tone palette: burgundy `#6B2737`, gold `#C9A84C`, deep teal `#1A5276` | S | §6 UX |
| `[ ]` Serif typography: Cormorant Garamond or IM Fell English (Google Fonts) | S | §6 UX |
| `[ ]` Ornamental dividers between results sections | S | §6 UX |
| `[ ]` Loading animation — candle, quill, or manuscript motif (CSS animation) | S | §6 UX |
| `[ ]` Poet portrait placeholders (stylized silhouettes or public domain illustrations) | S | §3 Functional |
| `[ ]` Pre-cache lyrics for 5 expected demo artists in `/fixtures/lyrics/[artist].json` | S | §10 Risks |
| `[ ]` Update `/api/lyrics` to check fixture cache first (demo rate-limit resilience) | S | §10 Risks |
| `[ ]` Finalize `/fixtures/demo-result.json` with a real, polished result | S | §10 Risks |
| `[ ]` Run 5 full end-to-end test runs with different artists | S | §7 Success Criteria |
| `[ ]` Color contrast audit on mobile | S | §6 UX |

### B. Acceptance Criteria

- Visual design uses parchment texture, jewel tones, serif typography, ornamental dividers
- Loading animation has a medieval motif
- Site loads in < 3s on mobile (Chrome DevTools Network: Fast 3G)
- At least 3 different poets appear across 5 test runs (matching varies, not stuck on one poet)
- `?bypass=true` loads demo result instantly — tested and confirmed
- Pre-cached lyrics for 5 demo artists load from fixture without calling Genius

### C. Deployment Plan

- Final push to main → verify deploy succeeds
- Hit `GET /api/health` on production URL
- Run one complete quiz from phone on the deployed URL

**Rollback:** Revert last commit if a design change breaks something.

### D. Pre-Demo Checklist (run Tuesday before class)

- [ ] `GET https://[project].vercel.app/api/health` → `{ ok: true }`
- [ ] Complete full quiz 5 times with different artists → results load each time
- [ ] At least 3 different poets matched across 5 runs
- [ ] All Spotify links open correct tracks
- [ ] Complete full quiz on phone → no layout issues
- [ ] `?bypass=true` → demo result loads instantly
- [ ] Pre-cached lyrics load when offline (disconnect wifi, enter cached artist, confirm no Genius error)
- [ ] Share URL with one other person to test on their device

### E. Go/No-Go Gate (Demo Day)

- [ ] Health check passes on production URL
- [ ] 5 complete test runs succeeded
- [ ] At least 3 different poets matched
- [ ] Full flow works on phone
- [ ] Bypass fallback ready and tested
- [ ] Pre-cached artist lyrics confirmed working

---

## CI/CD Coverage by Phase

| Phase | Automated | Manual |
|-------|-----------|--------|
| 1 | Vercel build check (TypeScript compile + Next.js build) on every push | Health check on deployed URL |
| 2 | Same | API endpoint testing, OCR output review, Vercel function log review |
| 3 | Same | Full quiz flow on phone + desktop, Spotify link verification |
| 4 | Same | Pre-demo checklist (5 full runs, phone test, bypass test) |

No GitHub Actions needed. Vercel's build step catches TypeScript errors before every deploy.
