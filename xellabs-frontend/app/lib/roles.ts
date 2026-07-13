export type StaffRole = 'admin' | 'lab_manager' | 'analyst' | 'reviewer' | 'receptionist'

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin:        'Administrator',
  lab_manager:  'Lab Manager',
  analyst:      'Analyst',
  reviewer:     'Reviewer',
  receptionist: 'Receptionist',
}

// The exact SENAITE roles a user can be granted directly — mirrors
// core/senaite_service.py's SENAITE_USER_ROLES (single source of truth on
// the backend; kept here just as the fixed column order for the UI table).
export const SENAITE_USER_ROLES = [
  'Analyst', 'Client', 'LabClerk', 'LabManager', 'Preserver', 'Publisher',
  'RegulatoryInspector', 'Sampler', 'SamplingCoordinator', 'Verifier', 'Manager',
] as const
