import { getSample } from '@/app/actions/samples'
import SampleDetailClient from './_components/SampleDetailClient'

export default async function SampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sample = await getSample(id)
  return <SampleDetailClient sample={sample} uid={id} />
}
