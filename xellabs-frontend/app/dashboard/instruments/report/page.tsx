import SampleReportShell from './_components/SampleReportShell'

export default async function InstrumentReportPage({
  searchParams,
}: {
  searchParams: Promise<{ sample_id?: string }>
}) {
  const { sample_id } = await searchParams
  return <SampleReportShell initialSampleId={sample_id ?? ''} />
}
