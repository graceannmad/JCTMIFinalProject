import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs/promises'
import * as path from 'path'

const anthropic = new Anthropic()

const PROMPT = `This is a page from a medieval troubadour or trouvère poetry anthology.
The page may contain:
- Poems in Old French, Occitan, or Provençal
- English translations (facing page or below)
- A mix of original and translation
- Scholarly notes in English

Extract every poem or verse passage you can find, regardless of language.
If there is an English translation, extract the English. If only the original language exists, extract that.
Include song titles, poet names as part of the title if visible.

For each poem or stanza group, output using EXACTLY this format:
===POEM===
TITLE: [poem title and/or poet name if visible, e.g. "BERNART DE VENTADORN — Can vei la lauzeta"]
TEXT:
[poem or stanza text, one line per line]
===END===

Extract everything — even partial poems or single stanzas. If truly nothing is found, output NONE.`

async function main() {
  const filePath = path.join(process.cwd(), 'corpus', 'raw', 'troubadour_p1c.pdf')
  const buffer = await fs.readFile(filePath)
  const base64 = buffer.toString('base64')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
        { type: 'text', text: PROMPT }
      ]
    }]
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''
  console.log('--- RAW RESPONSE (first 2000 chars) ---')
  console.log(text.slice(0, 2000))
  console.log('---')

  const chunks: Array<{ poet: string; poemTitle: string; text: string; sourcePage: number }> = []
  const blocks = text.match(/===POEM===([\s\S]*?)===END===/g) ?? []

  for (const block of blocks) {
    const titleMatch = block.match(/TITLE:\s*(.+)/)
    const textMatch = block.match(/TEXT:\s*\n([\s\S]*?)===END===/)
    if (titleMatch && textMatch) {
      chunks.push({
        poet: 'troubadour',
        poemTitle: titleMatch[1].trim(),
        text: textMatch[1].trim(),
        sourcePage: 1,
      })
    }
  }

  console.log(`\nExtracted ${chunks.length} chunk(s):`)
  chunks.forEach((c, i) => console.log(`  ${i + 1}. ${c.poemTitle}`))

  const outPath = path.join(process.cwd(), 'corpus', 'reviewed', 'troubadour_p1c.json')
  await fs.writeFile(outPath, JSON.stringify(chunks, null, 2))
  console.log(`\nSaved ${chunks.length} chunks to corpus/reviewed/troubadour_p1c.json`)
}

main().catch(err => { console.error(err); process.exit(1) })
