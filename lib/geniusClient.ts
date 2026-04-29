import * as cheerio from 'cheerio'
import type { LyricsData } from './types'

const BASE = 'https://api.genius.com'

function authHeaders() {
  return { Authorization: `Bearer ${process.env.GENIUS_API_KEY}` }
}

async function searchGenius(query: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`, {
      headers: authHeaders(),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.response?.hits ?? []
  } catch {
    return []
  }
}

async function getArtistTopSongs(artistId: number): Promise<any[]> {
  try {
    const res = await fetch(
      `${BASE}/artists/${artistId}/songs?sort=popularity&per_page=5`,
      { headers: authHeaders() }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.response?.songs ?? []
  } catch {
    return []
  }
}

async function scrapeLyrics(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) return ''
    const html = await res.text()
    const $ = cheerio.load(html)
    const parts: string[] = []
    $('[data-lyrics-container="true"]').each((_, el) => {
      $(el).find('br').replaceWith('\n')
      parts.push($(el).text().trim())
    })
    const raw = parts.join('\n\n')

    // Genius prepends metadata (contributor counts, translation links, description)
    // before the lyrics. Strip everything before the first structural section tag.
    const tagMatch = raw.search(/\[(?:Verse|Chorus|Intro|Outro|Bridge|Hook|Pre-Chorus|Post-Chorus|Refrain)\b/)
    const lyrics = tagMatch !== -1 ? raw.slice(tagMatch).trim() : raw.trim()

    return lyrics.slice(0, 3000)
  } catch {
    return ''
  }
}

export async function fetchLyricsData(
  artist: string,
  song?: string
): Promise<LyricsData> {
  const hits = await searchGenius(artist)
  if (!hits.length) return { artistLyrics: [], geniusMiss: true }

  const artistId: number | undefined = hits[0]?.result?.primary_artist?.id
  if (!artistId) return { artistLyrics: [], geniusMiss: true }

  const topSongs = await getArtistTopSongs(artistId)
  const artistLyrics = (
    await Promise.all(topSongs.slice(0, 3).map((s: any) => scrapeLyrics(s.url)))
  ).filter(Boolean)

  let songLyrics: string | undefined
  if (song) {
    const songHits = await searchGenius(`${artist} ${song}`)
    if (songHits.length) {
      const lyr = await scrapeLyrics(songHits[0].result.url)
      if (lyr) songLyrics = lyr
    }
  }

  const miss = artistLyrics.length === 0 && !songLyrics
  return { artistLyrics, songLyrics, geniusMiss: miss || undefined }
}
