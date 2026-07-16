import { listLabDepartments, listManagerOptions } from '@/app/actions/lab-departments'
import LabDepartmentsShell from './_components/LabDepartmentsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, managers] = await Promise.all([listLabDepartments(), listManagerOptions()])
  return <LabDepartmentsShell rows={rows} managers={managers} />
}
