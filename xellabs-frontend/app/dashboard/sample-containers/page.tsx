import { getSampleContainers, createSampleContainer } from '@/app/actions/reference-data'
import ReferenceListShell from '../_components/ReferenceListShell'

export default async function SampleContainersPage() {
  const items = await getSampleContainers()
  return (
    <ReferenceListShell
      title="Sample Containers"
      subtitle="Manage the container options offered when building sample templates"
      entityLabel="Container"
      icon="science"
      initialItems={items}
      createAction={createSampleContainer}
    />
  )
}
