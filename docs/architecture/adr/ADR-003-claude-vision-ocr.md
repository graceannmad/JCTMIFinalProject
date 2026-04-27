# ADR-003: Claude Vision for OCR over Tesseract

**Status:** Accepted  
**Date:** 2026-04-27  

---

## Context

The corpus consists of scanned pages from printed books containing medieval poetry translations. The scans vary in layout: some pages are two-column bilingual (Hebrew on left, English on right), others are single-column English translation, and other formats may exist. We need to extract only the English text from each page, preserving poem titles and stanza structure.

## Decision

Use the **Claude Vision API** in an offline script (`/scripts/ocr.ts`) to extract English text from each page image. Do not use Tesseract or any other traditional OCR tool.

## Rationale

**Layout-agnostic by design.** Traditional OCR tools (Tesseract, AWS Textract) read text in raster order — top to bottom, left to right. For a two-column bilingual page, this produces interleaved Hebrew and English that requires significant post-processing to untangle. For other layouts, similar problems arise. Claude Vision understands page layout semantically and can be instructed to extract only the desired column/language regardless of format — no special-casing per layout type.

**English-only extraction.** A single prompt instruction — "ignore Hebrew and Arabic text" — reliably excludes the source-language columns. Tesseract would require Hebrew and Arabic language suppression configuration, which is fragile and error-prone.

**Preserves poem structure.** Claude can be instructed to preserve titles and stanza breaks in its output. Raw OCR tools return text without structural awareness.

**Already in the stack.** The project uses the Anthropic Claude API for everything else. Using Claude Vision for OCR requires no additional dependency, no installation, and no separate API key.

**Cost is negligible.** Processing 25 pages via Claude Vision costs approximately $0.025–$0.05 total (one-time). This is a fixed cost, not per-user.

## Tradeoffs

**Against Claude Vision:**
- Small one-time cost per page (~$0.001–0.002/page)
- Requires running a local script before deploy (not automatic)
- Output must be reviewed before committing — Claude may occasionally miss footnotes or misread degraded text

**Against Tesseract:**
- Requires installation and configuration
- Poor performance on bilingual column layouts without custom zone configuration
- No semantic understanding of poem structure
- Would require post-processing to separate Hebrew from English

## Implementation Notes

**Script location:** `/scripts/ocr.ts`

**Filename convention for inputs:** `[poet-id]_p[page-number].[ext]`  
Example: `judah-halevi_p342.pdf`, `ibn-gabirol_p015.jpg`  
The poet tag is derived from the filename prefix — no manual tagging needed.

**Prompt used per page:**
```
Extract only the English text from this page.
Ignore any Hebrew or Arabic text.
Preserve poem titles and stanza breaks.
If there is no English text on this page, return an empty string.
```

**Review step:** OCR output is written to `/corpus/reviewed/[filename].txt` before being merged into `corpus.json`. Always review before committing to catch misreads or missing content.

**Re-running:** The script is idempotent — re-running on the same input produces the same output. Run it when new scans are added to `/corpus/raw/`.

## Consequence

The OCR pipeline is a manual, offline step that must be re-run when new scans are added. The resulting `corpus.json` is committed to the repo and bundled into the Vercel deployment. There is no runtime OCR step in the live app.
