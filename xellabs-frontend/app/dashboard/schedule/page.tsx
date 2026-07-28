import { getTestSchedule } from '@/app/actions/schedule'
import { getInventoryReadiness } from '@/app/actions/inventory-dashboard'
import ScheduleShell from './_components/ScheduleShell'

export default async function SchedulePage() {
  const [schedule, readiness] = await Promise.all([
    getTestSchedule(),
    getInventoryReadiness(),
  ])
  return <ScheduleShell schedule={schedule} readiness={readiness} />
}
