import Anthropic from '@anthropic-ai/sdk'
import type { CorpusChunk, PoetProfile, QuizInput, LyricsData, PlaylistItem, ResultsPayload } from './types'

const anthropic = new Anthropic()

const matchPoetTool: Anthropic.Tool = {
  name: 'match_poet',
  description: 'Return the matched poet and reasoning for the match.',
  input_schema: {
    type: 'object',
    properties: {
      matchedPoetId: {
        type: 'string',
        description: 'The id field of the matched poet.',
      },
      matchReasoning: {
        type: 'string',
        description: '2-3 sentences explaining the match. Third person, internal use.',
      },
    },
    required: ['matchedPoetId', 'matchReasoning'],
  },
}

const generatePlaylistTool: Anthropic.Tool = {
  name: 'generate_playlist',
  description: 'Return match explanation, historical context, and playlist in the poet\'s first-person voice.',
  input_schema: {
    type: 'object',
    properties: {
      matchExplanation: {
        type: 'string',
        description: '~150 words in first-person poet voice explaining why the user was matched.',
      },
      historicalContext: {
        type: 'string',
        description: '2-3 sentences of historical context about the poet.',
      },
      playlist: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            artist: { type: 'string' },
            justification: {
              type: 'string',
              description: '2-3 sentences in poet first-person voice.',
            },
            poemReference: {
              type: 'string',
              description: 'Optional short quote from one of the poet\'s own poems.',
            },
          },
          required: ['title', 'artist', 'justification'],
        },
        minItems: 8,
        maxItems: 10,
      },
    },
    required: ['matchExplanation', 'historicalContext', 'playlist'],
  },
}

function buildCorpusContext(corpus: CorpusChunk[], poets: PoetProfile[]): string {
  return poets
    .map(p => {
      const chunks = corpus.filter(c => c.poet === p.id)
      const excerpts = chunks
        .map(c => `[${c.poemTitle}]\n${c.text}`)
        .join('\n\n---\n\n')
      return `=== ${p.name} (id: ${p.id}) ===\n${excerpts}`
    })
    .join('\n\n\n')
}

export async function matchPoet(
  quiz: QuizInput,
  lyrics: LyricsData,
  corpus: CorpusChunk[],
  poets: PoetProfile[]
): Promise<{ matchedPoetId: string; matchReasoning: string }> {
  const corpusContext = buildCorpusContext(corpus, poets)
  const poetIds = poets.map(p => p.id).join(', ')

  const lyricsContext = [
    lyrics.songLyrics ? `Specific song lyrics the user entered:\n${lyrics.songLyrics}` : null,
    lyrics.artistLyrics.length
      ? `Lyrics from user's favorite artist's catalog:\n${lyrics.artistLyrics.slice(0, 2).join('\n\n---\n\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const userContext = `
Favorite artist: ${quiz.artist}
A song they love: ${quiz.song}
Lyric that resonated with them: "${quiz.lyricChoice}"
Poetry excerpt that resonated: "${quiz.excerptChoice}"
How they feel when in love: "${quiz.moodChoice}"
${lyricsContext ? `\n${lyricsContext}` : ''}
`.trim()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are a scholar of medieval Iberian poetry. Analyze the user's musical taste and determine which of the following medieval poets their sensibility most closely matches.

Valid poet IDs: ${poetIds}

${corpusContext}`,
    messages: [
      {
        role: 'user',
        content: `Which poet best matches this user? Use the match_poet tool.\n\n${userContext}`,
      },
    ],
    tools: [matchPoetTool],
    tool_choice: { type: 'tool', name: 'match_poet' },
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return tool use for poet matching')
  }

  const input = toolUse.input as { matchedPoetId: string; matchReasoning: string }
  // Guard against hallucinated poet IDs
  const valid = poets.find(p => p.id === input.matchedPoetId)
  return { matchedPoetId: valid ? input.matchedPoetId : poets[0].id, matchReasoning: input.matchReasoning }
}

export async function generatePlaylist(
  poet: PoetProfile,
  corpus: CorpusChunk[],
  quiz: QuizInput,
  lyrics: LyricsData
): Promise<Omit<ResultsPayload, 'poet'>> {
  const poetChunks = corpus.filter(c => c.poet === poet.id)
  const poetExcerpts = poetChunks
    .map(c => `"${c.poemTitle}":\n${c.text}`)
    .join('\n\n')

  const userTaste = [
    `Favorite artist: ${quiz.artist}`,
    `A song they love: ${quiz.song}`,
    `A lyric that speaks to them: "${quiz.lyricChoice}"`,
    `How they feel about love: "${quiz.moodChoice}"`,
    lyrics.songLyrics ? `Lyrics from their song:\n${lyrics.songLyrics.slice(0, 500)}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are ${poet.name}, the medieval Iberian poet (${poet.dates}). ${poet.voiceDescription}

Your own poems:
${poetExcerpts}

Speak directly to this modern person in warm, first-person modern English — as a brilliant friend from another era. Reference your own poems naturally. Never break character or mention being an AI. Choose real, existing songs with exact titles and artist names.`,
    messages: [
      {
        role: 'user',
        content: `Build a playlist of 8-10 songs for this person, curated through your poetic sensibility — not just a mirror of their taste. Choose songs they may not know yet. Use the generate_playlist tool.\n\n${userTaste}`,
      },
    ],
    tools: [generatePlaylistTool],
    tool_choice: { type: 'tool', name: 'generate_playlist' },
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return tool use for playlist generation')
  }

  const result = toolUse.input as {
    matchExplanation: string
    historicalContext: string
    playlist: Array<{
      title: string
      artist: string
      justification: string
      poemReference?: string
    }>
  }

  return {
    matchExplanation: result.matchExplanation,
    historicalContext: result.historicalContext,
    playlist: result.playlist.map(item => ({
      ...item,
      spotifyUrl: '', // filled in by Spotify verification step
      poemReference: item.poemReference ?? null,
    })),
  }
}

export async function regenerateSongs(
  poet: PoetProfile,
  failedTitles: string[],
  count: number
): Promise<Array<{ title: string; artist: string; justification: string; poemReference?: string }>> {
  if (count === 0) return []

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are ${poet.name}. ${poet.voiceDescription} Return only a valid JSON array, no other text.`,
    messages: [
      {
        role: 'user',
        content: `These songs could not be found on Spotify: ${failedTitles.join(', ')}. Suggest ${count} different real replacement songs. Return a JSON array where each object has: title, artist, justification (2-3 sentences in your voice), and optionally poemReference.`,
      },
    ],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? (JSON.parse(match[0]) as Array<{ title: string; artist: string; justification: string; poemReference?: string }>) : []
  } catch {
    return []
  }
}
