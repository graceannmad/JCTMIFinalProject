# ADR-002: Spotify Track Search as Hallucination Guard

**Status:** Accepted  
**Date:** 2026-04-27  

---

## Context

Claude generates a playlist of 8–10 songs that a medieval poet would recommend. Large language models occasionally hallucinate song titles — generating plausible-sounding but non-existent tracks. For a class project where the professor is evaluating quality, showing a fake song title would be an obvious failure. We need a way to guarantee every displayed song is real and findable.

## Decision

After Claude generates each playlist item, **verify the song against the Spotify Web API** before showing it to the user. Songs that cannot be verified are regenerated (up to 2 retries). Songs that still fail after retries are omitted rather than displayed unverified.

Use Spotify's **client credentials flow** — app-level authentication that requires no user login or OAuth callback.

## Rationale

**Eliminates hallucinated song titles.** A Spotify track search confirms the song exists in Spotify's catalog. If Claude invents a title, it won't match — it gets dropped and replaced.

**Free side effect: direct track URLs.** The Spotify search response includes a direct track URL (`external_urls.spotify`). This upgrades the "Spotify link" feature from a generic search query to a direct link to the exact track — better UX at no extra cost.

**Client credentials is the right scope.** We only need track search — no user data, no playlist creation. Client credentials (app-level auth) is appropriate and avoids the OAuth redirect flow entirely.

**Parallel verification keeps latency low.** All 8–10 songs are verified concurrently. Spotify's search endpoint is fast (~200–500ms). The verification step adds ~1–2s to the total pipeline.

## Tradeoffs

**Against Spotify verification:**
- Adds ~1–2s to generation pipeline
- Requires Spotify developer account setup (one-time, free)
- A song that exists but has unusual spelling in Spotify may fail verification incorrectly (mitigated by artist-only fallback search)

**Against prompt engineering only:**
- LLMs hallucinate. Prompt engineering reduces but does not eliminate hallucination. For a live demo, even one fake song title is a visible failure.

## Implementation Notes

**Search query strategy:**
1. First attempt: `q="title artist"&type=track&limit=1`
2. Fallback: `q="artist"&type=track&limit=5`, check if any title fuzzy-matches

**Token caching:** The Spotify client credentials token (valid 1 hour) should be cached at the module level in the serverless function to avoid re-fetching on every verification call within a session.

**Failure handling:** If a song slot fails both attempts, it is flagged. After all parallel verifications, flagged slots are sent back to Claude as: "These songs weren't found on Spotify: [list]. Please suggest verified alternatives." The replacements are then re-verified. If a slot fails again, it is omitted — the playlist returns 6–9 songs rather than 8–10.

## Consequence

Every `spotifyUrl` in the `ResultsPayload` is a verified direct Spotify track link. The UI can display these as deep links without risk of 404s or fake titles. The playlist may occasionally contain fewer than 8 items if verification repeatedly fails, which is acceptable.
