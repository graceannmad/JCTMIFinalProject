# ADR-001: Context Stuffing over Vector Database for Corpus Retrieval

**Status:** Accepted  
**Date:** 2026-04-27  

---

## Context

The PRD specifies a RAG system using a corpus of ~25 pages of translated medieval poetry. The original PRD listed ChromaDB as the vector store. We need to decide how to retrieve relevant poet content at query time.

## Decision

Use **context stuffing** for the MVP: include the entire corpus in every Claude matching call, rather than using a vector database with embedding-based retrieval.

## Rationale

**ChromaDB doesn't work on Vercel.** Vercel serverless functions have an ephemeral, read-only filesystem at runtime and no persistent process. ChromaDB requires a persistent process and writable disk. It cannot be run on Vercel's free tier without a separate hosted server.

**Context stuffing is better at this scale.** 25 pages of English poetry is approximately 15,000–20,000 tokens. Claude's context window is 200,000 tokens. Including the full corpus means:
- Claude sees *all* poets' works simultaneously and can reason holistically about similarity
- No retrieval errors (wrong chunks returned, relevant chunks missed)
- No embedding quality concerns
- Simpler architecture: no embedding API, no similarity search code, no vector index

**Faster to build.** No embedding pre-compute step, no vector index, no retrieval layer. Corpus is just a JSON file loaded from disk.

## Tradeoffs

**Against context stuffing:**
- Every session pays ~20,000 input tokens for corpus context (~$0.06 extra per session)
- Doesn't scale past ~75 pages before hitting cost/latency concerns
- Not technically "RAG" in the embedding-retrieval sense

**Against vector DB (ChromaDB specifically):**
- Can't run on Vercel without a separate hosted server (infrastructure overhead)
- Adds embedding API dependency (separate key, separate cost)
- Adds retrieval code that can fail or return wrong chunks
- Overkill for 25 pages

## Migration Path

When the corpus grows beyond ~75 pages, switch to:
1. Pre-compute embeddings using **Voyage AI** (Anthropic's recommended embeddings partner)
2. Store embeddings as a JSON file committed to the repo (no server needed)
3. At query time: embed user signals → cosine similarity → select top-K chunks → pass to Claude

This requires no infrastructure changes — same flat-file approach, just with a retrieval step inserted. The Claude prompts and tool schemas remain the same.

## Consequence

The architecture uses context stuffing for MVP. The corpus JSON file is loaded in full for every `/api/generate` call. The `corpus.json` file must stay under ~200 entries to avoid context window issues.
