export type PoetProfile = {
  id: string
  name: string
  dates: string
  context: string
  voiceDescription: string
  portraitUrl: string | null
}

export type CorpusChunk = {
  poet: string
  poemTitle: string
  text: string
  sourcePage: number
}

export type QuizInput = {
  artist: string
  song: string
  lyricChoice: string
  excerptChoice: string
  moodChoice: string
}

export type LyricsData = {
  artistLyrics: string[]
  songLyrics?: string
  geniusMiss?: boolean
}

export type PlaylistItem = {
  title: string
  artist: string
  spotifyUrl: string
  justification: string
  poemReference?: string | null
}

export type ResultsPayload = {
  poet: PoetProfile
  matchExplanation: string
  historicalContext: string
  playlist: PlaylistItem[]
}

export type ApiError = {
  error: string
  code: "GENIUS_MISS" | "CLAUDE_TIMEOUT" | "SPOTIFY_ALL_FAILED" | "VALIDATION" | "UNKNOWN"
}
