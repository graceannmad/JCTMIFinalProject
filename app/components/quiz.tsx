'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ResultsPayload } from '@/lib/types'
import corpusData from '@/data/corpus.json'
import poetsData from '@/data/poets.json'

// ─── Quiz content ────────────────────────────────────────────────────────────

// Three pools for Q3 — one is picked randomly each session
const LYRIC_POOLS = [
  [
    { text: '"I will follow you into the dark"', attribution: 'Death Cab for Cutie' },
    { text: '"Love is a losing game"', attribution: 'Amy Winehouse' },
    { text: '"We found love in a hopeless place"', attribution: 'Rihanna' },
    { text: '"I was enchanted to meet you"', attribution: 'Taylor Swift' },
  ],
  [
    { text: '"I\'ll be the last shred of truth in the lost myth of true love"', attribution: 'Hozier' },
    { text: '"I\'ve been thinkin\' \'bout you, do you think about me still?"', attribution: 'Frank Ocean' },
    { text: '"Used to be my baby, you look like my lover but you act like my enemy"', attribution: 'SZA' },
    { text: '"When the world is cold, I will feel a glow just thinking of you"', attribution: 'Frank Sinatra' },
  ],
  [
    { text: '"How long will I love you? As long as stars are above you"', attribution: 'Ellie Goulding' },
    { text: '"All of me loves all of you, all your curves and all your edges"', attribution: 'John Legend' },
    { text: '"I need you to be here, not right now but always"', attribution: 'Daniel Caesar' },
    { text: '"I may not always love you, but long as there are stars above you, you never need to doubt it"', attribution: 'The Beach Boys' },
  ],
]

// Poet display names lookup
const POET_NAMES: Record<string, string> = Object.fromEntries(
  poetsData.map((p: { id: string; name: string }) => [p.id, p.name])
)

// Extract a clean single-thought excerpt from a corpus chunk
function getExcerpt(text: string, maxLen = 170): string {
  // Strip section tags like [Verse 1], [Chorus]
  const cleaned = text.replace(/\[.*?\]\n?/g, '').trim()
  if (cleaned.length <= maxLen) return cleaned
  const trimmed = cleaned.slice(0, maxLen)
  // End at the last natural break after at least 60 chars
  const breaks = ['\n', '. ', '? ', '! ', ', ']
    .map(sep => trimmed.lastIndexOf(sep))
    .filter(i => i > 60)
  const breakAt = breaks.length ? Math.max(...breaks) + 1 : trimmed.length
  return trimmed.slice(0, breakAt).trim()
}

// Build Q4 options by sampling one chunk from each of 4 randomly chosen poets
function pickExcerptOptions(): Array<{ text: string; attribution: string }> {
  type Chunk = { poet: string; text: string; poemTitle?: string }
  const usable = (corpusData as Chunk[]).filter(c => {
    const clean = c.text.replace(/\[.*?\]\n?/g, '').trim()
    return clean.length >= 60
  })

  // Group by poet
  const byPoet: Record<string, Chunk[]> = {}
  for (const chunk of usable) {
    if (!byPoet[chunk.poet]) byPoet[chunk.poet] = []
    byPoet[chunk.poet].push(chunk)
  }

  // Shuffle poets and pick 4
  const poets = Object.keys(byPoet).sort(() => Math.random() - 0.5).slice(0, 4)

  return poets.map(poetId => {
    const chunks = byPoet[poetId]
    const chunk = chunks[Math.floor(Math.random() * chunks.length)]
    const excerpt = getExcerpt(chunk.text)
    return {
      text: `"${excerpt}"`,
      attribution: POET_NAMES[poetId] ?? poetId,
    }
  })
}

const MOOD_OPTIONS = [
  'Aching and overwhelmed — love is a tide that carries me',
  "Playful and chasing — love is a game I want to win",
  "Philosophical and restless — love is a question I can't stop asking",
  'All-in and ecstatic — love is a religion and I am devoted',
]

const LOADING_LINES = [
  'Consulting the archive…',
  'The poets are deliberating…',
  'Listening to your music…',
  'Searching across the centuries…',
  'Reading between the lines…',
  'Your poet is being found…',
  'Preparing your playlist…',
  'Almost there…',
]

// ─── Types ───────────────────────────────────────────────────────────────────

type Answers = Partial<{
  artist: string
  song: string
  lyricChoice: string
  excerptChoice: string
  moodChoice: string
}>

type Stage = 'landing' | 0 | 1 | 2 | 3 | 4 | 'loading' | 'results' | 'error'

// ─── Sub-components ──────────────────────────────────────────────────────────

function Ornament() {
  return (
    <p className="text-center tracking-widest text-xl" style={{ color: 'var(--color-gold)' }}>
      ── ✦ ──
    </p>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm uppercase tracking-widest font-medium" style={{ color: 'var(--color-label)' }}>
      {children}
    </p>
  )
}

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex justify-center gap-2 mb-8">
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full transition-all duration-300"
          style={{
            backgroundColor: i <= current ? 'var(--color-burgundy)' : 'var(--color-parchment-dark)',
            transform: i === current ? 'scale(1.4)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}

function TextQuestion({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  hint,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  hint?: string
}) {
  return (
    <div className="space-y-6">
      <label className="block text-2xl md:text-3xl font-light leading-relaxed text-center" style={{ color: 'var(--color-ink)' }}>
        {label}
      </label>
      {hint && (
        <p className="text-center text-base opacity-60" style={{ color: 'var(--color-ink)' }}>{hint}</p>
      )}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && value.trim() && onSubmit()}
        placeholder={placeholder}
        autoFocus
        className="w-full border-b-2 bg-transparent py-3 px-1 text-xl text-center outline-none transition-colors duration-200"
        style={{
          borderColor: 'var(--color-gold)',
          color: 'var(--color-ink)',
          fontFamily: 'var(--font-cormorant), Georgia, serif',
        }}
      />
      <div className="flex justify-center">
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="px-10 py-3 text-lg font-medium rounded-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
          style={{ backgroundColor: 'var(--color-burgundy)', color: '#f5ead8' }}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

function CardQuestion({
  label,
  options,
  onSelect,
  showAttribution = false,
}: {
  label: string
  options: Array<{ text: string; attribution?: string } | string>
  onSelect: (value: string) => void
  showAttribution?: boolean
}) {
  const [selected, setSelected] = useState<number | null>(null)

  function handleSelect(i: number) {
    setSelected(i)
    const opt = options[i]
    const value = typeof opt === 'string' ? opt : opt.text
    setTimeout(() => onSelect(value), 240)
  }

  return (
    <div className="space-y-6">
      <p className="text-2xl md:text-3xl font-light leading-relaxed text-center" style={{ color: 'var(--color-ink)' }}>
        {label}
      </p>
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt, i) => {
          const text = typeof opt === 'string' ? opt : opt.text
          const attribution = typeof opt === 'string' ? undefined : opt.attribution
          const isSelected = selected === i
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className="w-full text-left p-4 rounded-sm border transition-all duration-200 min-h-[44px]"
              style={{
                borderColor: isSelected ? 'var(--color-burgundy)' : 'var(--color-parchment-dark)',
                backgroundColor: isSelected ? 'rgba(107,39,55,0.06)' : 'rgba(255,248,238,0.6)',
                color: 'var(--color-ink)',
              }}
            >
              <span className="text-lg leading-relaxed italic">{text}</span>
              {showAttribution && attribution && (
                <span className="block text-sm mt-1 not-italic opacity-80">{attribution}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LoadingScreen() {
  const [lineIdx, setLineIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setLineIdx(i => (i + 1) % LOADING_LINES.length)
        setFade(true)
      }, 300)
    }, 2800)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center space-y-10">
      <div className="candle-container">
        <div className="candle-flame" />
        <div className="candle-body" />
      </div>
      <div
        className="text-xl font-light italic transition-opacity duration-300"
        style={{ color: 'var(--color-ink)', opacity: fade ? 0.8 : 0 }}
      >
        {LOADING_LINES[lineIdx]}
      </div>
    </div>
  )
}

function ResultsView({ result, onReset }: { result: ResultsPayload; onReset: () => void }) {
  const { poet, matchExplanation, historicalContext, playlist } = result
  return (
    <main className="max-w-2xl mx-auto px-5 py-14 space-y-12">
      {/* Poet match header */}
      <div className="text-center space-y-3">
        <SectionLabel>Your poet</SectionLabel>
        <h1 className="text-5xl md:text-6xl font-light italic" style={{ color: 'var(--color-burgundy)' }}>
          {poet.name}
        </h1>
        <p className="text-base opacity-80">{poet.dates}</p>
      </div>

      <Ornament />

      {/* Match explanation */}
      <section className="space-y-4">
        <SectionLabel>A message from {poet.name}</SectionLabel>
        <p className="text-xl font-light leading-relaxed italic" style={{ color: 'var(--color-ink)' }}>
          {matchExplanation}
        </p>
      </section>

      <Ornament />

      {/* Historical context */}
      <section className="space-y-4">
        <SectionLabel>Who was {poet.name}?</SectionLabel>
        <p className="text-lg leading-relaxed" style={{ color: 'var(--color-ink)' }}>
          {historicalContext}
        </p>
      </section>

      <Ornament />

      {/* Playlist */}
      <section className="space-y-5">
        <SectionLabel>Your playlist, curated by {poet.name}</SectionLabel>
        {playlist.map((item, i) => (
          <div
            key={i}
            className="p-5 rounded-sm border space-y-3"
            style={{
              borderColor: 'var(--color-parchment-dark)',
              backgroundColor: 'rgba(201,168,76,0.04)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-medium leading-snug" style={{ color: 'var(--color-ink)' }}>
                  {item.title}
                </p>
                <p className="text-base opacity-60">{item.artist}</p>
              </div>
              <a
                href={item.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm px-3 py-1.5 rounded-full border font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
                style={{ borderColor: 'var(--color-teal)', color: 'var(--color-teal)' }}
              >
                Spotify
              </a>
            </div>
            <p className="text-base leading-relaxed italic opacity-80" style={{ color: 'var(--color-ink)' }}>
              {item.justification}
            </p>
            {item.poemReference && (
              <p
                className="text-sm opacity-60 border-l-2 pl-3 leading-relaxed"
                style={{ borderColor: 'var(--color-gold)', color: 'var(--color-ink)' }}
              >
                {item.poemReference}
              </p>
            )}
          </div>
        ))}
      </section>

      <div className="text-center pt-4 pb-10">
        <button
          onClick={onReset}
          className="text-base underline underline-offset-4 opacity-50 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-ink)' }}
        >
          Take the quiz again
        </button>
      </div>
    </main>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuizApp({ bypassResult }: { bypassResult?: ResultsPayload }) {
  const [stage, setStage] = useState<Stage>(bypassResult ? 'results' : 'landing')
  const [answers, setAnswers] = useState<Answers>({})
  const [inputVal, setInputVal] = useState('')
  const [result, setResult] = useState<ResultsPayload | null>(bypassResult ?? null)
  const [errorMsg, setErrorMsg] = useState('')
  const [animating, setAnimating] = useState(false)
  // Picked once at mount — different each session
  const [lyricOptions] = useState(() => LYRIC_POOLS[Math.floor(Math.random() * LYRIC_POOLS.length)])
  const [excerptOptions] = useState(() => pickExcerptOptions())

  function advance(nextStage: Stage) {
    setAnimating(true)
    setTimeout(() => {
      setStage(nextStage)
      setInputVal('')
      setAnimating(false)
    }, 200)
  }

  const runPipeline = useCallback(async (finalAnswers: Answers) => {
    advance('loading')
    try {
      const lyricsRes = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: finalAnswers.artist, song: finalAnswers.song }),
      })
      const lyrics = lyricsRes.ok ? await lyricsRes.json() : { artistLyrics: [], geniusMiss: true }

      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizInput: {
            artist: finalAnswers.artist ?? '',
            song: finalAnswers.song ?? '',
            lyricChoice: finalAnswers.lyricChoice ?? '',
            excerptChoice: finalAnswers.excerptChoice ?? '',
            moodChoice: finalAnswers.moodChoice ?? '',
          },
          lyrics,
        }),
      })

      if (!generateRes.ok) throw new Error('Generation failed')
      const data: ResultsPayload = await generateRes.json()
      setResult(data)
      setStage('results')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStage('error')
    }
  }, [])

  function handleMoodSelect(value: string) {
    const finalAnswers = { ...answers, moodChoice: value }
    setAnswers(finalAnswers)
    runPipeline(finalAnswers)
  }

  function reset() {
    setAnswers({})
    setInputVal('')
    setResult(null)
    setErrorMsg('')
    setStage('landing')
  }

  const wrapperClass = `transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`

  if (stage === 'results' && result) return <ResultsView result={result} onReset={reset} />
  if (stage === 'loading') return <LoadingScreen />

  if (stage === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center space-y-6">
        <p className="text-2xl" style={{ color: 'var(--color-ink)' }}>{errorMsg}</p>
        <button
          onClick={reset}
          className="px-8 py-3 border-2 text-base font-medium rounded-sm hover:opacity-80"
          style={{ borderColor: 'var(--color-burgundy)', color: 'var(--color-burgundy)' }}
        >
          Try again
        </button>
      </div>
    )
  }

  if (stage === 'landing') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
        <div className={`max-w-xl mx-auto space-y-8 ${wrapperClass}`}>
          <p className="text-2xl tracking-widest" style={{ color: 'var(--color-gold)' }}>✦ ✦ ✦</p>
          <h1 className="text-5xl md:text-6xl font-light italic" style={{ color: 'var(--color-burgundy)' }}>
            The Poet&apos;s Ear
          </h1>
          <p className="text-2xl md:text-3xl font-light leading-relaxed" style={{ color: 'var(--color-ink)' }}>
            Your music speaks a language older than you know.
            <br />
            <span className="italic">Find the medieval poet who speaks it too.</span>
          </p>
          <Ornament />
          <p className="text-lg leading-relaxed opacity-75" style={{ color: 'var(--color-ink)' }}>
            Tell us who you listen to. We&apos;ll find you a poet from 11th‑century
            Al‑Andalus who thought about love exactly the way you do — and they&apos;ll
            build you a playlist.
          </p>
          <button
            onClick={() => advance(0)}
            className="mt-4 px-10 py-4 text-xl font-medium rounded-sm border-2 transition-all duration-200 hover:opacity-80"
            style={{ borderColor: 'var(--color-burgundy)', color: 'var(--color-burgundy)' }}
          >
            Begin the Quiz
          </button>
          <p className="text-sm opacity-70" style={{ color: 'var(--color-ink)' }}>Five questions · Two minutes</p>
        </div>
      </main>
    )
  }

  const qIndex = stage as number

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <div className={`w-full max-w-lg mx-auto space-y-8 ${wrapperClass}`}>
        <ProgressDots current={qIndex} />

        <p className="text-center text-sm uppercase tracking-widest font-medium" style={{ color: 'var(--color-label)' }}>
          Question {qIndex + 1} of 5
        </p>

        {qIndex === 0 && (
          <TextQuestion
            label="Who is your favourite artist right now?"
            placeholder=""
            value={inputVal}
            onChange={setInputVal}
            onSubmit={() => {
              setAnswers(a => ({ ...a, artist: inputVal.trim() }))
              advance(1)
            }}
          />
        )}

        {qIndex === 1 && (
          <TextQuestion
            label="Name a song you keep coming back to."
            placeholder="Any song, any artist…"
            hint="It doesn't have to be by the same artist."
            value={inputVal}
            onChange={setInputVal}
            onSubmit={() => {
              setAnswers(a => ({ ...a, song: inputVal.trim() }))
              advance(2)
            }}
          />
        )}

        {qIndex === 2 && (
          <CardQuestion
            label="Which lyric speaks to you most?"
            options={lyricOptions}
            onSelect={v => {
              setAnswers(a => ({ ...a, lyricChoice: v }))
              advance(3)
            }}
            showAttribution
          />
        )}

        {qIndex === 3 && (
          <CardQuestion
            label="Which line of poetry reaches you?"
            options={excerptOptions}
            onSelect={v => {
              setAnswers(a => ({ ...a, excerptChoice: v }))
              advance(4)
            }}
            showAttribution
          />
        )}

        {qIndex === 4 && (
          <CardQuestion
            label="When you are in love, you feel —"
            options={MOOD_OPTIONS}
            onSelect={handleMoodSelect}
          />
        )}
      </div>
    </main>
  )
}
