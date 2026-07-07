import StorageListShell from './_components/StorageListShell'
import { getStorageLocationsList } from '@/app/actions/senaite-import'

export default async function StorageListPage() {
  const storageLocations = await getStorageLocationsList()
  return <StorageListShell initialStorageLocations={storageLocations} />
}
