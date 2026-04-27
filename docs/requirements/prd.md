# PRD — JCTMI Final Project

**Status:** Draft  
**Author:** Grace  
**Last updated:** 2026-04-26  
**Deadline:** 2026-04-29 (Wednesday — live in-class demo)

---

## 1. Overview

**Product:** JCTMI Final Project — a web app that analyzes a user's favorite contemporary music lyrics, matches them to a medieval Iberian/Sephardic love poet whose writing style resonates most closely, and generates a curated playlist delivered in that poet's modern-English voice.

**Target audience:** College students and general curious users. Immediate use: live in-class demo for a Jewish Culture in Translation in Medieval Iberia course (Wednesday April 29, 2026).

**Problem:** Medieval Iberian poetry is academically rich but personally remote. Most people have no way in. This app creates a personal bridge — your music taste is the entry point.

**Value proposition:** You discover a 1,000-year-old poet who thinks about love the way you do, and they build you a playlist.

---

## 2. Users & Stakeholders

| Role | Description | Count | Technical level |
|------|-------------|-------|-----------------|
| Quiz user | Classmates interacting live during demo, then general public through May | ~30 demo day; ~few hundred total | Non-technical |
| Professor | Evaluating the project as a graded deliverable | 1 | Academic, non-technical |
| Developer | Grace — sole builder and maintainer | 1 | Developer |

No login required. All sessions are anonymous and stateless.

---

## 3. Functional Requirements

### Music Taste Quiz (MVP — primary path)

**Quiz input (~5 questions, quick and fun):**
- Q1: Enter your favorite **artist**
- Q2: Enter a specific **song** you love (can be by any artist)
- Q3: Pick the **lyric** that resonates most (multiple choice, ~4 options drawn from well-known contemporary songs)
- Q4: Pick the **poetry excerpt** that resonates most (multiple choice, ~4 options drawn from the poets' corpus)
- Q5: Mood/vibe question (e.g., "how do you feel when you're in love?" — ~4 options) — exact wording TBD

**Lyrics retrieval:**
- After Q1 + Q2: system fetches lyrics for the entered artist's top songs and the specific entered song via Genius API
- If Genius match fails, gracefully degrade (skip that input; proceed with remaining quiz signals)

**AI matching:**
- Claude analyzes the fetched lyrics plus quiz answers against the RAG corpus of poet writings
- Determines which poet's themes, imagery, and emotional register most closely align with the user's signals
- Returns matched poet with confidence reasoning

**Playlist generation and verification:**
- Claude generates a playlist of 8–10 songs reflecting the matched poet's sensibility
- Each proposed song is verified against the Spotify Web API (track search) before being shown to the user
- Songs that cannot be verified are regenerated (up to 2 retries per song) before the result is presented
- Each verified song also yields a direct Spotify track URL for linking

**Results page:**
- Matched poet name and portrait/illustration (if available)
- "Why you were matched" paragraph written in the poet's first-person modern-English voice
- Brief historical context about the poet (dates, cultural context, significance)
- Playlist of 8–10 verified songs curated to reflect the **poet's** sensibility (not a mirror of the user's existing taste)
- Each song: title, artist, 2–3 sentence justification in the poet's voice, optional reference to one of the poet's own poems, direct Spotify track link

### Medieval Poetry Quiz (deferred — post-Wednesday)
Same structure but inverted: user picks favorite poems/excerpts → matched to a contemporary music artist/genre → recommended playlist.

---

## 4. Non-Functional Requirements

**Authentication:** None. Fully public, no login.

**Compliance:** None. No sensitive personal data collected. No accounts created.

**Data handling:** Stateless — no user data persisted after session. Genius API responses and AI outputs are generated per-request and not stored.

**Scale:** Support ~30 simultaneous users during the class demo. Site stays live through end of May. No growth projections beyond that.

**Performance:** AI playlist generation (including Spotify verification) may take 15–30 seconds. A loading/progress state is required so users know it's working. Quiz question transitions should feel instant.

**Cost:** No hard budget constraint. Claude API ~$0.05–0.15 per session; Genius API free tier; Spotify API free tier. Total demo day cost: negligible.

**Responsive design:** Must work on both laptops and phones. Mobile-first layout.

**Integrations:**

| System | Purpose | Auth method |
|--------|---------|-------------|
| Genius API | Fetch song lyrics by artist/song name | API key (free developer account) |
| Anthropic Claude API | Lyric analysis, poet matching, playlist generation, poet-voice narration | API key |
| Spotify Web API | Verify generated song titles exist; retrieve direct track URLs | Client credentials flow (no user OAuth) |
| ChromaDB | Local vector store for RAG corpus | None (embedded, local) |
| Vercel | Hosting + CI/CD from GitHub | GitHub OAuth |

---

## 5. AI/ML Behavior Requirements

**Matching logic:**
- Input signals: fetched lyrics from user's artist catalog + specific song, selected lyric resonance answer, selected poetry excerpt answer, mood/vibe answer
- Retrieval: embed input signals → query ChromaDB corpus → retrieve top-K chunks across all poets → poet with highest semantic similarity wins
- Tiebreaker: Claude makes a judgment call and explains the choice in the poet's voice

**Poet voice:**
- All user-facing poet text (match explanation, playlist intro, per-song justifications) must be written in **first-person modern English** as the poet speaking directly to the user
- Tone: warm, literary, slightly formal but not stuffy — feels like a brilliant friend from another era
- Must reference the poet's actual works where relevant (sourced from RAG corpus)
- Must never break the persona to explain it is an AI

**Playlist generation guardrails:**
- Songs must be real, verified tracks — confirmed via Spotify API before display
- Songs that fail Spotify verification are regenerated (max 2 retries per song)
- Songs should reflect the poet's thematic sensibility, not just mirror the user's input
- Songs should lean toward tracks the average user may not already know (avoid obvious top-40)
- Poet voice should reference at least 2–3 of their own poems across the full playlist

**Edge cases:**
- Genius API can't find the artist/song → skip that input, note it gracefully, proceed with remaining signals
- All Spotify retries fail for a song → omit that slot rather than show an unverified title
- Two poets score similarly → Claude picks one and acknowledges the close match in the explanation
- User enters a very mainstream artist → still valid input; use their lyrical themes normally

---

## 6. UX & Interaction Requirements

**Quiz flow:** Single-page progressive reveal. One question at a time with animated transition between questions. Progress indicator (e.g., "Question 3 of 5"). No back button for MVP.

**Input fields:** Q1 and Q2 are free-text with a submit button. Q3–Q5 are tap/click multiple choice cards.

**Loading state:** After the final question, full-screen loading state with a thematic animation (candle, manuscript, calligraphy, etc.) and rotating flavor text ("consulting the archives…", "the poets are deliberating…"). Estimated wait: 15–30 seconds.

**Results page:** Scrollable single page. Sections: poet match → why you matched → historical context → playlist. Each playlist entry is a card with song info, justification, poem reference, and Spotify track link.

**Responsive:** Mobile-first. Cards stack vertically on phones; optional 2-column on desktop.

**Visual design:** Medieval Iberian aesthetic — parchment textures, deep jewel tones (burgundy, gold, deep teal), calligraphic or serif typography, subtle ornamental dividers. Should feel like a beautifully designed literary object, not a generic SaaS app.

**Accessibility:** Sufficient color contrast. Tap targets ≥ 44px on mobile.

---

## 7. Success Criteria

**Demo day (Wednesday April 29):**
- Every classmate who opens the site on their phone or laptop can complete the quiz without assistance
- AI-generated and Spotify-verified playlist loads successfully for each user within 30 seconds
- The poet voice feels charming and recognizable as that poet to the professor
- Zero crashes or unverified song titles shown during the class period

**Project overall (through May):**
- Medieval poetry quiz path built and working
- RAG corpus expanded beyond 25 pages
- Direct Spotify track links resolve correctly for all playlist songs

---

## 8. Constraints

- **Deadline:** Wednesday April 29, 2026 — 3 days from now. Hard deadline.
- **Team:** One developer (Grace)
- **Budget:** Minimal (student project) — free tiers where possible
- **Tech:** No mandates imposed externally. Recommending Next.js + Vercel for ease of deployment.
- **Corpus size:** Starting with ~25 pages of OCR'd poet writings. Hundreds more pages available to expand later.

---

## 9. Out of Scope

- Medieval poetry quiz path (deferred — post-Wednesday)
- Save, export, or share playlist
- Spotify OAuth or user playlist creation in Spotify (deferred — Spotify track search and verification IS in scope)
- User accounts, login, or session persistence
- Full RAG corpus (start with ~25 pages; expand later)
- Any backend database (no user data stored)
- Multi-language UI (English only)

---

## 10. Risks & Assumptions

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Genius API free tier rate limits during class demo (~30 concurrent users) | Medium | High | Pre-fetch and cache lyrics for likely demo artists during setup; test rate limits before demo day |
| OCR quality too poor for useful RAG chunks | Medium | High | OCR 25 pages before architecture starts; validate quality before building RAG pipeline |
| Claude generation + Spotify verification takes >30s | Medium | Medium | Optimize prompt structure; show animated loading state; pre-generate a sample result as demo fallback |
| Free text artist input doesn't match Genius API | Medium | Low | Graceful fallback — skip that signal, proceed with other quiz answers |
| Wednesday deadline not achievable at full scope | High | Medium | Medieval poetry path already deferred; Spotify OAuth already deferred; scope is tightly contained |

**Assumptions:**
- Spotify Web API client credentials flow allows track search without user login (confirmed — it does)
- Genius API free tier sufficient for ~30 users in one hour
- 25 pages of OCR'd text provides enough signal for meaningful differentiation between poets
- Claude with Spotify verification produces zero hallucinated song titles in the final output

---

## 11. Open Questions

| Question | Owner | Target |
|----------|-------|--------|
| Final list of poets (confirmed: Judah Halevi, Ibn Gabirol, Troubadour corpus, Tahkemoni/al-Harizi — others TBD) | Grace | Before architecture |
| Exact wording of Q5 (mood/vibe question) | Grace | Before build |
| OCR quality validation — run sample before committing to RAG approach | Grace | Day 1 of build |
| Genius API rate limit behavior — test before demo day | Grace | Before deploy |
