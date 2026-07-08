import { getApprovals } from '@/app/actions/approvals'
import ApprovalsShell from './_components/ApprovalsShell'

export default async function ApprovalsPage() {
  const approvals = await getApprovals()
  return <ApprovalsShell initialApprovals={approvals} />
}
