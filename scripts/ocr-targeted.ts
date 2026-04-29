/**
 * Targeted re-OCR for specific files with custom prompts.
 * Usage: npx tsx scripts/ocr-targeted.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs/promises'
import * as path from 'path'

const anthropic = new Anthropic()
const RAW_DIR = path.join(process.cwd(), 'corpus', 'raw')
const REVIEWED_DIR = path.join(process.cwd(), 'corpus', 'reviewed')

const TARGETS: Array<{ filename: string; poetId: string; sourcePage: number; prompt: string }> = [
  {
    filename: 'ben-elazar_p2.pdf',
    poetId: 'ben-elazar',
    sourcePage: 2,
    prompt: `This is a page from a medieval Hebrew love story written in rhymed prose (maqama style).
The narrative contains embedded poems and verse passages, typically introduced by phrases such as:
"he/she said in verse:", "spoke these lines:", "recited:", "said:", followed by poetic text.
The verse passages are often visually indented, structured as lines or couplets, or formatted differently from the prose.

Extract EVERY verse or poem passage you can find, even short ones of 2-4 lines.
For each poem, the title should be the speaker or narrative context (e.g. "Sahar's lament", "The beloved's reply").
Do NOT include the prose narrative itself — only the verse passages within it.

Return a JSON array:
  [{ "poemTitle": "string", "text": "string" }]
Return [] only if there is truly no verse on this page.
Return only the JSON array — no explanation, no markdown fences.`,
  },
  {
    filename: 'troubadour_p1c.pdf',
    poetId: 'troubadour',
    sourcePage: 1,
    prompt: `This is a page from an anthology of medieval troubadour or trouvère poetry.
Pages may show the original Old French or Occitan alongside an English translation,
OR may show only the English translation, OR only the original language.

Extract the ENGLISH translation text for each poem on this page.
If a poem has both original and English translation, extract only the English.
If the page has only Old French/Occitan with no English translation, return [].
Preserve poem titles and stanza breaks.

Return a JSON array:
  [{ "poemTitle": "string", "text": "string" }]
Return [] if no English translation text is present.
Return only the JSON array — no explanation, no markdown fences.`,
  },
]

async function ocrFileWithPrompt(filePath: string, prompt: string): Promise<Array<{poemTitle: string; text: string}>> {
  const ext = path.extname(filePath).toLowerCase()
  const buffer = await fs.readFile(filePath)
  const base64 = buffer.toString('base64')

  const contentBlock = ext === '.pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: ext === '.png' ? 'image/png' : 'image/jpeg', data: base64 } }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] as any }],
  })

  const rawText = response.content.find(b => b.type === 'text')?.text ?? '[]'
  const text = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch {
    console.error(`  Could not parse JSON. Raw: ${text.slice(0, 200)}`)
    return []
  }
}

async function main() {
  await fs.mkdir(REVIEWED_DIR, { recursive: true })

  for (const target of TARGETS) {
    const filePath = path.join(RAW_DIR, target.filename)
    const outPath = path.join(REVIEWED_DIR, target.filename.replace(/\.[^.]+$/, '.json'))

    console.log(`Processing ${target.filename}...`)
    const chunks = await ocrFileWithPrompt(filePath, target.prompt)

    const output = chunks.map(c => ({
      poet: target.poetId,
      poemTitle: c.poemTitle,
      text: c.text,
      sourcePage: target.sourcePage,
    }))

    await fs.writeFile(outPath, JSON.stringify(output, null, 2))
    console.log(`  → ${chunks.length} chunk(s) extracted`)
    if (chunks.length > 0) {
      chunks.forEach((c, i) => console.log(`     ${i+1}. ${c.poemTitle}`))
    }
  }
  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
