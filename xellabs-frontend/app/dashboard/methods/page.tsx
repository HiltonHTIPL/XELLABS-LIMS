import { getMethods } from '@/app/actions/methods'
import MethodsShell from './_components/MethodsShell'

export default async function MethodsPage() {
  const methods = await getMethods()
  return <MethodsShell initialMethods={methods} />
}
