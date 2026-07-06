import { getStorageLocations } from '@/app/actions/storage'
import StorageShell from './_components/StorageShell'

export default async function StoragePage() {
  const locations = await getStorageLocations()
  return <StorageShell initialLocations={locations} />
}
