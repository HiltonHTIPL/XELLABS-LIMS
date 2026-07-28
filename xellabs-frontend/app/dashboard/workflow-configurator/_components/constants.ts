import type { Stage, ESignatureStep, StageType, WorkflowSettings, PermissionsMatrix } from './types'

export const STAGE_TYPE_LABEL: Record<StageType, string> = {
  standard: 'Standard',
  verification: 'Verification',
  approval: 'Approval',
  terminal: 'Terminal',
}

export const STAGE_ICON: Record<StageType, string> = {
  standard: 'description',
  verification: 'shield',
  approval: 'verified',
  terminal: 'check_circle',
}

// Left accent bar + icon color per stage type — keeps the canvas legend and
// the config drawer visually consistent.
export const STAGE_ACCENT: Record<StageType, string> = {
  standard: '#0154FC',
  verification: '#D97706',
  approval: '#0F9D58',
  terminal: '#6B7280',
}

export const STAGE_BG: Record<StageType, string> = {
  standard: '#EEF2FF',
  verification: '#FFF7E6',
  approval: '#E9FBF0',
  terminal: '#F3F4F6',
}

export const ROLE_OPTIONS = ['Analyst', 'Reviewer', 'Lab Manager', 'Admin', 'Authorized Signatory']

export const ACTION_OPTIONS = [
  'View Details', 'View Results', 'Edit Results', 'Enter Results', 'Log Receipt',
  'Request Changes', 'View Report', 'Download COA', 'View Archive', 'View Reason',
]

// Seeded 1:1 from Sample.STATUS in xellabs-backend/lims/models.py — the only
// thing that should ever change this list is a new status added there.
export const INITIAL_STAGES: Stage[] = [
  { statusKey: 'registered', name: 'Sample Registered', description: 'Sample is registered in the system.', stageType: 'standard', allowedActions: ['View Details'] },
  { statusKey: 'received', name: 'Sample Received', description: 'Sample is received in the lab.', stageType: 'standard', allowedActions: ['View Details', 'Log Receipt'] },
  { statusKey: 'in_progress', name: 'In Progress', description: 'Analysis is in progress.', stageType: 'standard', allowedActions: ['Enter Results'] },
  { statusKey: 'results_pending', name: 'Results Pending', description: 'Results are entered and awaiting review.', stageType: 'standard', allowedActions: ['View Results', 'Edit Results'] },
  { statusKey: 'reviewed', name: 'Reviewed', description: 'Results reviewed, pending final approval.', stageType: 'verification', allowedActions: ['View Results', 'Request Changes'] },
  { statusKey: 'published', name: 'Published', description: 'Results approved and released to the client.', stageType: 'approval', allowedActions: ['View Report', 'Download COA'] },
  { statusKey: 'disposed', name: 'Disposed', description: 'Sample lifecycle completed and archived.', stageType: 'terminal', allowedActions: ['View Archive'] },
  {
    statusKey: 'rejected', name: 'Rejected', description: 'Sample or results rejected out of the normal flow.',
    stageType: 'terminal', allowedActions: ['View Reason'],
    isBranch: true, branchFrom: ['received', 'in_progress', 'results_pending', 'reviewed'],
  },
]

export const INITIAL_ESIGS: ESignatureStep[] = [
  { id: 'esig-1', label: 'Verification Approval', afterStatusKey: 'reviewed', requiredRoles: ['Reviewer'], order: 'sequential' },
  { id: 'esig-2', label: 'Final Approval', afterStatusKey: 'published', requiredRoles: ['Lab Manager'], order: 'sequential' },
]

export const INITIAL_SETTINGS: WorkflowSettings = {
  name: 'Sample Lifecycle Workflow',
  version: 'v1.0',
  status: 'draft',
  requireSignatureReason: true,
  notifyOnStageEntry: true,
  allowParallelReview: false,
  stageSlaHours: {
    received: 4,
    in_progress: 24,
    results_pending: 8,
    reviewed: 4,
    published: 2,
  },
}

// Seeded defaults only — fully editable in the Permissions tab.
export const INITIAL_PERMISSIONS: PermissionsMatrix = {
  Analyst: ['View Details', 'Log Receipt', 'Enter Results', 'View Results'],
  Reviewer: ['View Details', 'View Results', 'Edit Results', 'Request Changes'],
  'Lab Manager': ['View Details', 'View Results', 'View Report', 'Download COA', 'View Archive'],
  Admin: [...ACTION_OPTIONS],
  'Authorized Signatory': ['View Report', 'Download COA', 'View Reason'],
}
