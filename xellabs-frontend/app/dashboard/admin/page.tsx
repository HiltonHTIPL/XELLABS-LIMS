import { getStaffUsers } from '@/app/actions/users'
import AdminShell from './_components/AdminShell'

export default async function AdminPage() {
  const users = await getStaffUsers()
  return <AdminShell initialUsers={users} />
}
