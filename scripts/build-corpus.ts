/**
 * Merges reviewed OCR chunks into /data/corpus.json.
 * Run after reviewing files in /corpus/reviewed/.
 *
 * Usage: npx tsx scripts/build-corpus.ts
 */

import * as fs from 'fs/promises'
import * as path from 'path'

const REVIEWED_DIR = path.join(process.cwd(), 'corpus', 'reviewed')
const OUT_FILE = path.join(process.cwd(), 'data', 'corpus.json')

async function main() {
  const files = (await fs.readdir(REVIEWED_DIR)).filter(f => f.endsWith('.json'))

  if (!files.length) {
    console.log('No reviewed files found in corpus/reviewed/')
    return
  }

  const chunks: unknown[] = []
  for (const file of files) {
    const raw = await fs.readFile(path.join(REVIEWED_DIR, file), 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) chunks.push(...parsed)
  }

  // Merge with existing corpus (keep manually authored entries, add new ones)
  let existing: any[] = []
  try {
    existing = JSON.parse(await fs.readFile(OUT_FILE, 'utf-8'))
  } catch { /* file may not exist */ }

  // Deduplicate by poemTitle + poet
  const seen = new Set(existing.map((c: any) => `${c.poet}::${c.poemTitle}`))
  const newChunks = (chunks as any[]).filter(
    c => !seen.has(`${c.poet}::${c.poemTitle}`)
  )

  const merged = [...existing, ...newChunks]
  await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2))
  console.log(`corpus.json updated: ${existing.length} existing + ${newChunks.length} new = ${merged.length} total chunks`)
}

main().catch(err => {
  console.error('build-corpus failed:', err)
  process.exit(1)
})
