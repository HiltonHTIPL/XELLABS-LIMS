import { listLabContacts, listLabContactDepartments } from '@/app/actions/lab-contacts'
import LabContactsShell from './_components/LabContactsShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, departments] = await Promise.all([listLabContacts(), listLabContactDepartments()])
  return <LabContactsShell rows={rows} departments={departments} />
}
