import { NextRequest, NextResponse } from 'next/server'
import type { ResultsPayload, ApiError, QuizInput, LyricsData } from '@/lib/types'
import { matchPoet, generatePlaylist, regenerateSongs } from '@/lib/claudeClient'
import { verifyTrack } from '@/lib/spotifyClient'
import corpusData from '@/data/corpus.json'
import poetsData from '@/data/poets.json'
import demoResult from '@/fixtures/demo-result.json'

export async function POST(
  req: NextRequest
): Promise<NextResponse<ResultsPayload | ApiError>> {
  // Bypass mode: return fixture without any external API calls
  if (req.nextUrl.searchParams.get('bypass') === 'true') {
    return NextResponse.json(demoResult as ResultsPayload)
  }

  let body: { quizInput: QuizInput; lyrics: LyricsData }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION' },
      { status: 400 }
    )
  }

  const { quizInput, lyrics } = body

  // Hard timeout just under Vercel's 60s free-tier limit
  const TIMEOUT_MS = 50_000
  let timedOut = false
  const timeoutHandle = setTimeout(() => { timedOut = true }, TIMEOUT_MS)

  try {
    // Step 1: Match user to a poet
    const { matchedPoetId } = await matchPoet(quizInput, lyrics, corpusData, poetsData)
    if (timedOut) throw new Error('timeout')

    const poet = poetsData.find(p => p.id === matchedPoetId) ?? poetsData[0]

    // Step 2: Generate playlist in poet's voice
    const generated = await generatePlaylist(poet, corpusData, quizInput, lyrics)
    if (timedOut) throw new Error('timeout')

    // Step 3: Verify all songs on Spotify in parallel
    const withVerification = await Promise.all(
      generated.playlist.map(async item => {
        const spotifyUrl = await verifyTrack(item.title, item.artist)
        return { ...item, spotifyUrl: spotifyUrl ?? '' }
      })
    )
    if (timedOut) throw new Error('timeout')

    const verified = withVerification.filter(item => item.spotifyUrl)
    const failed = withVerification.filter(item => !item.spotifyUrl)

    // Step 4: Regenerate failed slots (once)
    let finalPlaylist = verified
    if (failed.length > 0 && !timedOut) {
      const replacements = await regenerateSongs(poet, failed.map(f => f.title), failed.length)
      const reverified = await Promise.all(
        replacements.map(async item => {
          const spotifyUrl = await verifyTrack(item.title, item.artist)
          return { ...item, spotifyUrl: spotifyUrl ?? '', poemReference: item.poemReference ?? null }
        })
      )
      finalPlaylist = [...verified, ...reverified.filter(r => r.spotifyUrl)]
    }

    clearTimeout(timeoutHandle)

    return NextResponse.json({
      poet,
      matchExplanation: generated.matchExplanation,
      historicalContext: poet.context,
      playlist: finalPlaylist,
    })
  } catch (err) {
    clearTimeout(timeoutHandle)
    const isTimeout =
      timedOut || (err instanceof Error && err.message === 'timeout')
    return NextResponse.json(
      {
        error: isTimeout
          ? 'Generation timed out — please try again.'
          : 'Something went wrong — please try again.',
        code: isTimeout ? 'CLAUDE_TIMEOUT' : 'UNKNOWN',
      },
      { status: isTimeout ? 408 : 500 }
    )
  }
}
