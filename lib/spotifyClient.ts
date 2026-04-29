// Module-level token cache — survives across requests in the same Vercel function instance
let cachedToken: { value: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value
  }
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify token fetch failed: ${res.status}`)

  const data = await res.json()
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.value
}

// Check whether the Spotify track's artist(s) reasonably match the claimed artist.
// Uses substring matching in both directions to handle partial names and features.
function artistMatches(claimed: string, spotifyArtists: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const claimedNorm = norm(claimed)
  return spotifyArtists.some(a => {
    const aNorm = norm(a)
    return aNorm.includes(claimedNorm) || claimedNorm.includes(aNorm)
  })
}

// Returns the direct Spotify track URL if the track exists AND the artist matches,
// or null if not found or the artist is wrong.
export async function verifyTrack(
  title: string,
  artist: string
): Promise<string | null> {
  try {
    const token = await getToken()

    // Attempt 1: field-qualified search (most precise)
    const q1 = encodeURIComponent(`track:${title} artist:${artist}`)
    const res1 = await fetch(
      `https://api.spotify.com/v1/search?q=${q1}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res1.ok) {
      const d1 = await res1.json()
      const track = d1.tracks?.items?.[0]
      if (track) {
        const spotifyArtists: string[] = track.artists.map((a: { name: string }) => a.name)
        if (artistMatches(artist, spotifyArtists)) {
          return track.external_urls.spotify
        }
      }
    }

    // Attempt 2: broad search — only accept if artist still matches
    const q2 = encodeURIComponent(`${title} ${artist}`)
    const res2 = await fetch(
      `https://api.spotify.com/v1/search?q=${q2}&type=track&limit=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res2.ok) {
      const d2 = await res2.json()
      const tracks: any[] = d2.tracks?.items ?? []
      for (const track of tracks) {
        const spotifyArtists: string[] = track.artists.map((a: { name: string }) => a.name)
        if (artistMatches(artist, spotifyArtists)) {
          return track.external_urls.spotify
        }
      }
    }

    return null
  } catch {
    return null
  }
}
