import { getSamplingDeviations, createSamplingDeviation, updateSamplingDeviation, toggleSamplingDeviationActive } from '@/app/actions/reference-data'
import ReferenceListShell from '../_components/ReferenceListShell'

export default async function SamplingDeviationsPage() {
  const items = await getSamplingDeviations()
  return (
    <ReferenceListShell
      title="Sampling Deviations"
      subtitle="Manage the sampling deviation options offered when receiving a sample"
      entityLabel="Sampling Deviation"
      icon="rule"
      initialItems={items}
      createAction={createSamplingDeviation}
      updateAction={updateSamplingDeviation}
      toggleActiveAction={toggleSamplingDeviationActive}
    />
  )
}
