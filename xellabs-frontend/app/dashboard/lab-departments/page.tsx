import { listLabDepartments, listManagerOptions } from '@/app/actions/lab-departments'
import { listLabContactDepartments } from '@/app/actions/lab-contacts'
import LabDepartmentsShell from './_components/LabDepartmentsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, managers, contactDepartments] = await Promise.all([
    listLabDepartments(), listManagerOptions(), listLabContactDepartments(),
  ])
  return <LabDepartmentsShell rows={rows} managers={managers} contactDepartments={contactDepartments} />
}
