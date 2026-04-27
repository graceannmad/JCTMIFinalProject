import { NextRequest, NextResponse } from "next/server"
import type { LyricsData, ApiError } from "@/lib/types"

export async function POST(req: NextRequest): Promise<NextResponse<LyricsData | ApiError>> {
  const body = await req.json() as { artist?: string; song?: string }

  if (!body.artist) {
    return NextResponse.json(
      { error: "artist is required", code: "VALIDATION" },
      { status: 400 }
    )
  }

  // Phase 2: Genius API integration implemented here
  return NextResponse.json(
    { error: "Lyrics API not yet implemented — coming in Phase 2", code: "UNKNOWN" },
    { status: 501 }
  )
}
