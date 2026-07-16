import {
  listInterpretationTemplates, listSampleTypeOptions, listAnalysisTemplateOptions,
} from '@/app/actions/interpretation-templates'
import InterpretationTemplatesShell from './_components/InterpretationTemplatesShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [rows, sampleTypes, analysisTemplates] = await Promise.all([
    listInterpretationTemplates(),
    listSampleTypeOptions(),
    listAnalysisTemplateOptions(),
  ])
  return <InterpretationTemplatesShell rows={rows} sampleTypes={sampleTypes} analysisTemplates={analysisTemplates} />
}
