import { NextRequest, NextResponse } from 'next/server'
import type { LyricsData, ApiError } from '@/lib/types'
import { fetchLyricsData } from '@/lib/geniusClient'

export async function POST(
  req: NextRequest
): Promise<NextResponse<LyricsData | ApiError>> {
  const body = (await req.json()) as { artist?: string; song?: string }

  if (!body.artist?.trim()) {
    return NextResponse.json(
      { error: 'artist is required', code: 'VALIDATION' },
      { status: 400 }
    )
  }

  try {
    const data = await fetchLyricsData(body.artist.trim(), body.song?.trim())
    return NextResponse.json(data)
  } catch {
    // Always return a usable response — caller proceeds with geniusMiss: true
    return NextResponse.json({ artistLyrics: [], geniusMiss: true })
  }
}
