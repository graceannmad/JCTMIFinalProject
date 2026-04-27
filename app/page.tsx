import demoResult from "@/fixtures/demo-result.json";
import type { ResultsPayload } from "@/lib/types";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ bypass?: string }>;
}) {
  const params = await searchParams;
  const bypass = params.bypass === "true";

  if (bypass) {
    return <BypassResults result={demoResult as ResultsPayload} />;
  }

  return <LandingPage />;
}

function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
      <div className="max-w-xl mx-auto space-y-8">
        <p
          className="ornament text-2xl"
          style={{ color: "var(--color-gold)" }}
        >
          ✦ ✦ ✦
        </p>

        <h1
          className="text-5xl md:text-6xl font-light italic"
          style={{ color: "var(--color-burgundy)" }}
        >
          The Poet&apos;s Ear
        </h1>

        <p
          className="text-xl md:text-2xl font-light leading-relaxed"
          style={{ color: "var(--color-ink)" }}
        >
          Your music speaks a language older than you know.
          <br />
          <span className="italic">Find the medieval poet who speaks it too.</span>
        </p>

        <p
          className="ornament text-lg"
          style={{ color: "var(--color-gold)" }}
        >
          ── ✦ ──
        </p>

        <p
          className="text-base leading-relaxed opacity-80"
          style={{ color: "var(--color-ink)" }}
        >
          Tell us who you listen to. We&apos;ll find you a poet from
          11th‑century Al‑Andalus who thought about love exactly the way you do
          — and they&apos;ll build you a playlist.
        </p>

        {/* Quiz button — wired up in Phase 3 */}
        <button
          disabled
          className="mt-4 px-10 py-4 text-lg font-medium rounded-sm border-2 opacity-40 cursor-not-allowed"
          style={{
            borderColor: "var(--color-burgundy)",
            color: "var(--color-burgundy)",
          }}
        >
          Begin the Quiz
        </button>

        <p
          className="text-sm opacity-50"
          style={{ color: "var(--color-ink)" }}
        >
          Coming soon — or{" "}
          <a
            href="/?bypass=true"
            className="underline underline-offset-4"
            style={{ color: "var(--color-teal)" }}
          >
            preview a sample result
          </a>
        </p>

        <p
          className="ornament text-2xl"
          style={{ color: "var(--color-gold)" }}
        >
          ✦ ✦ ✦
        </p>
      </div>
    </main>
  );
}

function BypassResults({ result }: { result: ResultsPayload }) {
  const { poet, matchExplanation, historicalContext, playlist } = result;

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 space-y-12">
      <p className="text-center text-sm opacity-50" style={{ color: "var(--color-ink)" }}>
        ✦ Demo mode — sample result ✦
      </p>

      {/* Poet match */}
      <div className="text-center space-y-2">
        <p className="text-sm uppercase tracking-widest opacity-60" style={{ color: "var(--color-gold)" }}>
          Your poet
        </p>
        <h1 className="text-4xl md:text-5xl font-light italic" style={{ color: "var(--color-burgundy)" }}>
          {poet.name}
        </h1>
        <p className="text-base opacity-70">{poet.dates}</p>
      </div>

      <div className="ornament" style={{ color: "var(--color-gold)" }}>── ✦ ──</div>

      {/* Match explanation */}
      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-widest opacity-60" style={{ color: "var(--color-gold)" }}>
          A message from {poet.name}
        </h2>
        <p className="text-lg font-light leading-relaxed italic" style={{ color: "var(--color-ink)" }}>
          &ldquo;{matchExplanation}&rdquo;
        </p>
      </section>

      <div className="ornament" style={{ color: "var(--color-gold)" }}>── ✦ ──</div>

      {/* Historical context */}
      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-widest opacity-60" style={{ color: "var(--color-gold)" }}>
          Who was {poet.name}?
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-ink)" }}>
          {historicalContext}
        </p>
      </section>

      <div className="ornament" style={{ color: "var(--color-gold)" }}>── ✦ ──</div>

      {/* Playlist */}
      <section className="space-y-6">
        <h2 className="text-sm uppercase tracking-widest opacity-60" style={{ color: "var(--color-gold)" }}>
          Your playlist, curated by {poet.name}
        </h2>
        {playlist.map((item, i) => (
          <div
            key={i}
            className="p-5 rounded-sm border space-y-2"
            style={{ borderColor: "var(--color-parchment-dark)", backgroundColor: "rgba(201,168,76,0.05)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-medium" style={{ color: "var(--color-ink)" }}>
                  {item.title}
                </p>
                <p className="text-sm opacity-70">{item.artist}</p>
              </div>
              <a
                href={item.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-opacity hover:opacity-70"
                style={{ borderColor: "var(--color-teal)", color: "var(--color-teal)" }}
              >
                Spotify ↗
              </a>
            </div>
            <p className="text-sm leading-relaxed italic opacity-80" style={{ color: "var(--color-ink)" }}>
              {item.justification}
            </p>
            {item.poemReference && (
              <p className="text-xs opacity-60 border-l-2 pl-3" style={{ borderColor: "var(--color-gold)", color: "var(--color-ink)" }}>
                {item.poemReference}
              </p>
            )}
          </div>
        ))}
      </section>

      <p className="text-center text-sm opacity-40 pb-8" style={{ color: "var(--color-ink)" }}>
        <a href="/" className="underline underline-offset-4">← Back to home</a>
      </p>
    </main>
  );
}
