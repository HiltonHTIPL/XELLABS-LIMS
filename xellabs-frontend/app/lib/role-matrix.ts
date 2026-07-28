// Reference copy of the backend's role-privilege matrix
// (core/permissions.py ACTIVITY_ROLES) — for display only, in the
// Administration "?" help panel. The backend is the enforced source of
// truth; if that matrix changes, update this list to match.
import type { StaffRole } from './roles'

export type MatrixRole = StaffRole

export const MATRIX_ROLE_ORDER: MatrixRole[] = [
  'client', 'lab_clerk', 'sampler', 'analyst', 'verifier',
  'lab_manager', 'publisher', 'manager', 'admin',
]

export const MATRIX_ROLE_SHORT_LABELS: Record<MatrixRole, string> = {
  client: 'Client', lab_clerk: 'Lab Clerk', sampler: 'Sampler', analyst: 'Analyst',
  verifier: 'Verifier', lab_manager: 'Lab Mgr', publisher: 'Publisher',
  manager: 'Manager', admin: 'Admin',
}

export type MatrixActivity = { activity: string; roles: MatrixRole[]; note?: string }

export const ROLE_ACTIVITY_MATRIX: MatrixActivity[] = [
  { activity: 'Create Client',            roles: ['client', 'lab_clerk', 'lab_manager', 'manager', 'admin'] },
  { activity: 'Register Sample',          roles: ['lab_clerk', 'lab_manager', 'manager', 'admin'] },
  { activity: 'Create Accession/Sample ID', roles: ['lab_clerk', 'lab_manager', 'manager', 'admin'] },
  { activity: 'Collect Sample',           roles: ['sampler', 'lab_manager', 'admin'], note: 'No dedicated endpoint yet' },
  { activity: 'Receive Sample',           roles: ['lab_clerk', 'admin'] },
  { activity: 'Assign Analyses',          roles: ['analyst', 'lab_manager', 'admin'] },
  { activity: 'Create Worksheet',         roles: ['analyst', 'lab_manager', 'admin'] },
  { activity: 'Assign Instrument',        roles: ['analyst', 'lab_manager', 'admin'] },
  { activity: 'Assign Method',            roles: ['analyst', 'lab_manager', 'admin'] },
  { activity: 'Add QC Samples',           roles: ['analyst', 'lab_manager', 'admin'] },
  { activity: 'Perform QC',               roles: ['analyst', 'admin'] },
  { activity: 'Import Results',           roles: ['analyst', 'admin'] },
  { activity: 'Enter Results',            roles: ['analyst', 'admin'] },
  { activity: 'Edit Results',             roles: ['analyst', 'admin'] },
  { activity: 'Verify Results',           roles: ['verifier', 'lab_manager', 'admin'] },
  { activity: 'Approve Results',          roles: ['lab_manager', 'manager', 'admin'] },
  { activity: 'Publish Results',          roles: ['lab_manager', 'publisher', 'manager', 'admin'], note: 'Fires automatically on approve' },
  { activity: 'Generate Reports',         roles: ['verifier', 'lab_manager', 'publisher', 'manager', 'admin'] },
  { activity: 'Reject Results',           roles: ['verifier', 'lab_manager', 'manager', 'admin'] },
  { activity: 'Dispose Sample',           roles: ['lab_manager', 'manager', 'admin'] },
  { activity: 'View Audit Trail',         roles: ['analyst', 'verifier', 'lab_manager', 'publisher', 'manager', 'admin'] },
  { activity: 'Configure Methods',        roles: ['lab_manager', 'manager', 'admin'] },
  { activity: 'Configure Instruments',    roles: ['lab_manager', 'manager', 'admin'] },
  { activity: 'User Management',          roles: ['admin'] },
]
