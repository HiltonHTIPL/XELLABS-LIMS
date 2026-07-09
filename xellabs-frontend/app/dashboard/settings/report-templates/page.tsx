import { getTemplates, getDefaultFields } from '@/app/actions/reports'
import ReportTemplateShell from './_components/ReportTemplateShell'

export default async function ReportTemplatePage() {
  const [templates, defaultFields] = await Promise.all([
    getTemplates(),
    getDefaultFields(),
  ])

  return (
    <ReportTemplateShell
      initialTemplates={templates}
      defaultFields={defaultFields}
    />
  )
}
