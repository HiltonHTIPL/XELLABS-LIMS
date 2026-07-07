export type StaffRole = 'admin' | 'lab_manager' | 'analyst' | 'reviewer' | 'receptionist'

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin:        'Administrator',
  lab_manager:  'Lab Manager',
  analyst:      'Analyst',
  reviewer:     'Reviewer',
  receptionist: 'Receptionist',
}
