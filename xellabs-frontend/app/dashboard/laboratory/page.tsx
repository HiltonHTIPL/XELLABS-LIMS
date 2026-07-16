import { getLaboratory, listLabSupervisors } from '@/app/actions/laboratory'
import LaboratoryShell from './_components/LaboratoryShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [data, supervisors] = await Promise.all([getLaboratory(), listLabSupervisors()])
  if (!data) {
    return (
      <div style={{ padding: 20 }}>
        <p className="text-sm" style={{ color: '#DC2626' }}>Unable to load laboratory information.</p>
      </div>
    )
  }
  return <LaboratoryShell data={data} supervisors={supervisors} />
}
