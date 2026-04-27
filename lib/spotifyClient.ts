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
    // Refresh a minute early to avoid edge-of-expiry failures
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.value
}

// Returns the direct Spotify track URL, or null if not found
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
      const url = d1.tracks?.items?.[0]?.external_urls?.spotify
      if (url) return url
    }

    // Attempt 2: broad search fallback
    const q2 = encodeURIComponent(`${title} ${artist}`)
    const res2 = await fetch(
      `https://api.spotify.com/v1/search?q=${q2}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res2.ok) {
      const d2 = await res2.json()
      return d2.tracks?.items?.[0]?.external_urls?.spotify ?? null
    }

    return null
  } catch {
    return null
  }
}
