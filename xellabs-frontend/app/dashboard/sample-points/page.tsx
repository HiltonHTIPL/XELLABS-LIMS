import { getSamplePoints, createSamplePoint } from '@/app/actions/reference-data'
import ReferenceListShell from '../_components/ReferenceListShell'

export default async function SamplePointsPage() {
  const items = await getSamplePoints()
  return (
    <ReferenceListShell
      title="Sample Points"
      subtitle="Manage the sample point options offered when building sample templates"
      entityLabel="Sample Point"
      icon="place"
      initialItems={items}
      createAction={createSamplePoint}
    />
  )
}
