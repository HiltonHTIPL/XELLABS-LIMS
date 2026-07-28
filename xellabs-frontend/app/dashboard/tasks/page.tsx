import { getTasks, getTaskAssignments } from '@/app/actions/tasks'
import { getStaffUsers } from '@/app/actions/users'
import TasksShell from './_components/TasksShell'

export default async function TasksPage() {
  const [tasks, assignments, users] = await Promise.all([
    getTasks(),
    getTaskAssignments(),
    getStaffUsers(),
  ])
  return <TasksShell initialTasks={tasks} initialAssignments={assignments} users={users} />
}
