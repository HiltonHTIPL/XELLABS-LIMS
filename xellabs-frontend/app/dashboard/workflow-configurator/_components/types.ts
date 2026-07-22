export type StageType = 'standard' | 'verification' | 'approval' | 'terminal'

export type Stage = {
  // Real Sample.STATUS value (lims/models.py) this stage represents — the
  // workflow's stages are sourced from the sample lifecycle, never invented.
  statusKey: string
  name: string
  description: string
  stageType: StageType
  allowedActions: string[]
  // Exception/branch stages (e.g. Rejected) don't sit on the main happy-path —
  // they can be entered from one or more of the statusKeys listed here.
  isBranch?: boolean
  branchFrom?: string[]
}

export type ESignatureStep = {
  id: string
  label: string
  afterStatusKey: string
  requiredRoles: string[]
  order: 'sequential' | 'parallel'
}

export type WorkflowSettings = {
  name: string
  version: string
  status: 'draft' | 'active'
  requireSignatureReason: boolean
  notifyOnStageEntry: boolean
  allowParallelReview: boolean
  // statusKey -> expected turnaround time in hours
  stageSlaHours: Record<string, number>
}

// role -> the action labels that role may perform
export type PermissionsMatrix = Record<string, string[]>
