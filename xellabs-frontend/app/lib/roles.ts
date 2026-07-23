export type StaffRole =
  | 'client' | 'lab_clerk' | 'sampler' | 'analyst' | 'verifier'
  | 'lab_manager' | 'publisher' | 'manager' | 'admin'

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  client:       'Client',
  lab_clerk:    'Lab Clerk',
  sampler:      'Sampler',
  analyst:      'Analyst',
  verifier:     'Verifier',
  lab_manager:  'Lab Manager',
  publisher:    'Publisher',
  manager:      'Manager',
  admin:        'Administrator',
}

// The exact SENAITE roles a user can be granted directly — mirrors
// core/senaite_service.py's SENAITE_USER_ROLES (single source of truth on
// the backend; kept here just as the fixed column order for the UI table).
export const SENAITE_USER_ROLES = [
  'Analyst', 'Client', 'LabClerk', 'LabManager', 'Preserver', 'Publisher',
  'RegulatoryInspector', 'Sampler', 'SamplingCoordinator', 'Verifier', 'Manager',
] as const
