import { getPreservations, createPreservation } from '@/app/actions/reference-data'
import ReferenceListShell from '../_components/ReferenceListShell'

export default async function PreservationsPage() {
  const items = await getPreservations()
  return (
    <ReferenceListShell
      title="Preservations"
      subtitle="Manage the preservation options offered when building sample templates"
      entityLabel="Preservation"
      icon="ac_unit"
      initialItems={items}
      createAction={createPreservation}
    />
  )
}
