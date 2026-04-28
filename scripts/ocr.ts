/**
 * OCR pipeline — run locally before deploy when adding new scans.
 *
 * Usage:
 *   npx tsx scripts/ocr.ts
 *
 * Input:  /corpus/raw/[poet-id]_p[page].pdf  (or .jpg / .png)
 * Output: /corpus/reviewed/[filename].json   (review before committing)
 *
 * After reviewing, run:
 *   npx tsx scripts/build-corpus.ts
 * to merge reviewed files into /data/corpus.json
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs/promises'
import * as path from 'path'

const anthropic = new Anthropic()
const RAW_DIR = path.join(process.cwd(), 'corpus', 'raw')
const REVIEWED_DIR = path.join(process.cwd(), 'corpus', 'reviewed')

type OcrChunk = { poemTitle: string; text: string }

const EXTRACT_PROMPT = `Extract only the actual poem text from this document page.
Rules:
- English text only — ignore all Hebrew, Arabic, or other non-English text completely.
- Poems and verse only — skip introductions, prefaces, scholarly commentary, footnotes, page numbers, headings, and bibliographic information.
- If a page has both a preamble/introduction AND poems, extract only the poems.
- If a page is entirely introductory prose with no poems, return an empty array.
- Preserve poem titles and stanza breaks (blank lines between stanzas).
- If multiple poems appear on the same page, return each as a separate array element.
Return a JSON array where each element represents one poem or section:
  { "poemTitle": "string", "text": "string" }
If no poem text is found, return [].
Return only the JSON array — no explanation, no markdown.`

async function ocrFile(filePath: string): Promise<OcrChunk[]> {
  const ext = path.extname(filePath).toLowerCase()
  const buffer = await fs.readFile(filePath)
  const base64 = buffer.toString('base64')

  let contentBlock: Anthropic.MessageParam['content'][number]

  if (ext === '.pdf') {
    contentBlock = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    } as any
  } else {
    const mediaType =
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      'image/webp'
    contentBlock = {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    }
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: [contentBlock, { type: 'text', text: EXTRACT_PROMPT }] as any,
    }],
  })

  const rawText = response.content.find(b => b.type === 'text')?.text ?? '[]'
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const text = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? (JSON.parse(match[0]) as OcrChunk[]) : []
  } catch {
    console.error(`  ⚠ Could not parse JSON from Claude response for ${path.basename(filePath)}`)
    console.error('  Raw response:', text.slice(0, 200))
    return []
  }
}

function poetIdFromFilename(filename: string): string {
  // Expects: [poet-id]_p[N].ext  e.g. judah-halevi_p342.pdf
  return filename.split('_')[0]
}

function pageNumFromFilename(filename: string): number {
  const match = filename.match(/_p(\d+)\./)
  return match ? parseInt(match[1], 10) : 0
}

async function main() {
  await fs.mkdir(REVIEWED_DIR, { recursive: true })

  const files = (await fs.readdir(RAW_DIR)).filter(f =>
    ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(f).toLowerCase())
  )

  if (!files.length) {
    console.log('No files found in corpus/raw/ — add scanned PDFs or images and re-run.')
    return
  }

  console.log(`Found ${files.length} file(s) to process.\n`)

  for (const filename of files) {
    const filePath = path.join(RAW_DIR, filename)
    const outPath = path.join(REVIEWED_DIR, filename.replace(/\.[^.]+$/, '.json'))

    // Skip if already reviewed
    try {
      await fs.access(outPath)
      console.log(`  ✓ ${filename} — already reviewed, skipping`)
      continue
    } catch { /* not yet processed */ }

    // Warn on large files before attempting
    const stat = await fs.stat(filePath)
    const sizeMB = stat.size / (1024 * 1024)
    if (sizeMB > 18) {
      console.log(`  ⚠ ${filename} — ${sizeMB.toFixed(1)}MB, likely too large. Skipping. Split into smaller files and retry.`)
      continue
    }

    console.log(`  Processing ${filename} (${sizeMB.toFixed(1)}MB)...`)
    const poetId = poetIdFromFilename(filename)
    const sourcePage = pageNumFromFilename(filename)

    let chunks: OcrChunk[]
    try {
      chunks = await ocrFile(filePath)
    } catch (err: any) {
      if (err?.status === 413 || err?.message?.includes('too_large')) {
        console.log(`  ⚠ ${filename} — too large for API (${sizeMB.toFixed(1)}MB). Split into smaller files and retry.`)
      } else {
        console.log(`  ✗ ${filename} — error: ${err?.message ?? err}`)
      }
      continue
    }

    const output = chunks.map(c => ({
      poet: poetId,
      poemTitle: c.poemTitle,
      text: c.text,
      sourcePage,
    }))

    await fs.writeFile(outPath, JSON.stringify(output, null, 2))
    console.log(`  ✓ ${filename} → ${chunks.length} chunk(s) extracted`)
  }

  console.log('\nDone. Review files in corpus/reviewed/ then run: npx tsx scripts/build-corpus.ts')
}

main().catch(err => {
  console.error('OCR script failed:', err)
  process.exit(1)
})
