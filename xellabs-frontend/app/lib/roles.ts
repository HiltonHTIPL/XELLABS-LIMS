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

// Same correspondence as senaite.ts's mapSenaiteRole() (which only ever
// picks ONE "primary" role for display), but here every match is kept —
// a user checked as both LabManager and Verifier in the SENAITE role matrix
// should see nav/admin sections gated on EITHER role, not just whichever one
// mapSenaiteRole() would have picked first.
const SENAITE_TO_STAFF_ROLE: Record<string, StaffRole> = {
  'Site Administrator': 'admin',
  Manager: 'manager',
  LabManager: 'lab_manager',
  Publisher: 'publisher',
  Verifier: 'verifier',
  Reviewer: 'verifier',
  Analyst: 'analyst',
  Sampler: 'sampler',
  LabClerk: 'lab_clerk',
  Client: 'client',
}

/** Every StaffRole a user's raw SENAITE roles correspond to (not just one) —
 * use this for nav/page visibility checks instead of a single mapped role,
 * so someone checked as multiple SENAITE roles sees everything either grants. */
export function mapSenaiteRolesAll(senaiteRoles: string[] | undefined): StaffRole[] {
  if (!senaiteRoles?.length) return []
  const out = new Set<StaffRole>()
  for (const r of senaiteRoles) {
    const mapped = SENAITE_TO_STAFF_ROLE[r]
    if (mapped) out.add(mapped)
  }
  return [...out]
}
