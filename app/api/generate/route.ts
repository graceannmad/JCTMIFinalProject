import { NextRequest, NextResponse } from "next/server"
import type { ResultsPayload, ApiError } from "@/lib/types"
import demoResult from "@/fixtures/demo-result.json"

export async function POST(req: NextRequest): Promise<NextResponse<ResultsPayload | ApiError>> {
  // Bypass mode: return fixture without calling any external APIs
  const bypass = req.nextUrl.searchParams.get("bypass") === "true"
  if (bypass) {
    return NextResponse.json(demoResult as ResultsPayload)
  }

  // Phase 2: real pipeline implemented here
  return NextResponse.json(
    { error: "Pipeline not yet implemented — coming in Phase 2", code: "UNKNOWN" },
    { status: 501 }
  )
}
