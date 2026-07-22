import type { PermissionsMatrix, Stage } from './types'

// Roles that have at least one of this stage's allowed actions granted.
export function rolesForStage(stage: Stage, matrix: PermissionsMatrix): string[] {
  return Object.entries(matrix)
    .filter(([, actions]) => actions.some(a => stage.allowedActions.includes(a)))
    .map(([role]) => role)
}

export function roleInitials(role: string): string {
  return role.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
