import { getContainerTypesList } from '@/app/actions/container-types'
import ContainerTypesShell from './_components/ContainerTypesShell'

export default async function ContainerTypesPage() {
  const containerTypes = await getContainerTypesList()
  return <ContainerTypesShell initialContainerTypes={containerTypes} />
}
