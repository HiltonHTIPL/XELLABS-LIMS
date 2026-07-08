import { getResults } from '@/app/actions/results'
import ResultsShell from './_components/ResultsShell'

export default async function ResultsPage() {
  const results = await getResults()
  return <ResultsShell initialResults={results} />
}
