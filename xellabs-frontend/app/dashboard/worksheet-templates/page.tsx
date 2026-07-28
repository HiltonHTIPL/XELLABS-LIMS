import {
  listWorksheetTemplates,
  listInstrumentOptions,
  listMethodOptions,
  listServiceOptions,
  listReferenceDefinitionOptions,
} from '@/app/actions/worksheet-templates'
import WorksheetTemplatesShell from './_components/WorksheetTemplatesShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, instruments, methods, services, referenceDefinitions] = await Promise.all([
    listWorksheetTemplates(),
    listInstrumentOptions(),
    listMethodOptions(),
    listServiceOptions(),
    listReferenceDefinitionOptions(),
  ])
  return (
    <WorksheetTemplatesShell
      rows={rows}
      instruments={instruments}
      methods={methods}
      services={services}
      referenceDefinitions={referenceDefinitions}
    />
  )
}
