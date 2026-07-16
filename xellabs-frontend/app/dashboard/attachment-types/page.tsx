import { listAttachmentTypes } from '@/app/actions/attachment-types'
import AttachmentTypesShell from './_components/AttachmentTypesShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const rows = await listAttachmentTypes()
  return <AttachmentTypesShell rows={rows} />
}
