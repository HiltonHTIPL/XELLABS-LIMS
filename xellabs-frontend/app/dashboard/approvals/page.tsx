import { getApprovals, reconcileSampleApprovals } from '@/app/actions/approvals'
import { getSession } from '@/app/lib/session'
import ApprovalsShell from './_components/ApprovalsShell'

export default async function ApprovalsPage() {
  // Materialise approvals for any sample SENAITE now reports as "verified"
  // before listing — this is what makes worksheet-verified samples appear here.
  await reconcileSampleApprovals()
  const [approvals, session] = await Promise.all([getApprovals(), getSession()])
  return (
    <ApprovalsShell
      initialApprovals={approvals}
      currentUserId={session?.userId ?? ''}
    />
  )
}
