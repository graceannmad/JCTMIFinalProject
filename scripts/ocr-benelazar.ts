import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs/promises'
import * as path from 'path'

const anthropic = new Anthropic()

const PROMPT = `This is a page from a medieval Hebrew love story called the story of Sahar and Kima, written in rhymed prose (maqama style).
Poems and verse passages are embedded in the narrative, introduced by phrases like "he/she said in verse", "spoke:", "recited:", "said:", or the text shifts into clearly structured verse lines.

For each verse passage you find, output it using EXACTLY this format with no variation:
===POEM===
TITLE: [speaker or context, e.g. "Sahar's lament" or "Kima's reply" or "Poem of thanksgiving"]
TEXT:
[poem text here, one line per line]
===END===

Extract ALL verse passages, even short ones of 2-4 lines. Do not include prose narrative. If no verse found, output the word NONE.`

async function main() {
  const filePath = path.join(process.cwd(), 'corpus', 'raw', 'ben-elazar_p2.pdf')
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
  console.log('--- RAW RESPONSE ---')
  console.log(text.slice(0, 1500))
  console.log('---')

  // Parse delimited blocks — avoids all JSON escaping issues
  const chunks: Array<{ poet: string; poemTitle: string; text: string; sourcePage: number }> = []
  const blocks = text.match(/===POEM===([\s\S]*?)===END===/g) ?? []

  for (const block of blocks) {
    const titleMatch = block.match(/TITLE:\s*(.+)/)
    const textMatch = block.match(/TEXT:\s*\n([\s\S]*?)===END===/)
    if (titleMatch && textMatch) {
      chunks.push({
        poet: 'ben-elazar',
        poemTitle: titleMatch[1].trim(),
        text: textMatch[1].trim(),
        sourcePage: 2
      })
    }
  }

  console.log(`\nExtracted ${chunks.length} chunk(s):`)
  chunks.forEach((c, i) => console.log(`  ${i + 1}. ${c.poemTitle}`))

  const outPath = path.join(process.cwd(), 'corpus', 'reviewed', 'ben-elazar_p2.json')
  await fs.writeFile(outPath, JSON.stringify(chunks, null, 2))
  console.log(`\nSaved to corpus/reviewed/ben-elazar_p2.json`)
}

main().catch(err => { console.error(err); process.exit(1) })
