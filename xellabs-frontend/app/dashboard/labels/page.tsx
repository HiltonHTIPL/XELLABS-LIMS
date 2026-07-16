import { listLabels } from '@/app/actions/labels'
import LabelsShell from './_components/LabelsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listLabels()
  return <LabelsShell rows={rows} />
}
