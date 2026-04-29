import QuizApp from '@/app/components/quiz'
import type { ResultsPayload } from '@/lib/types'
import demoResult from '@/fixtures/demo-result.json'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ bypass?: string }>
}) {
  const params = await searchParams
  const bypass = params.bypass === 'true'

  return <QuizApp bypassResult={bypass ? (demoResult as ResultsPayload) : undefined} />
}
