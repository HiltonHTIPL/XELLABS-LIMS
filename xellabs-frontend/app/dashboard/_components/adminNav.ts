// Single source of truth for "Administration" sub-sections — consumed by both
// the sidebar's Administration nav group and the /dashboard/admin grid page.
// Add a new admin section here once; it shows up in both places automatically.
export type AdminSection = { label: string; href: string; icon: string; roles: string[] | null }

export const ADMIN_SECTIONS: AdminSection[] = [
  { label: 'Users',        href: '/dashboard/admin/users',   icon: 'group',       roles: ['admin', 'lab_manager'] },
  { label: 'Sample Types', href: '/dashboard/sample-types', icon: 'category',   roles: ['admin', 'lab_manager'] },
  { label: 'Sample Templates', href: '/dashboard/sample-templates', icon: 'view_list', roles: ['admin', 'lab_manager'] },
  { label: 'Container Types', href: '/dashboard/container-types', icon: 'inventory_2', roles: ['admin', 'lab_manager'] },
  { label: 'Sample Containers', href: '/dashboard/sample-containers', icon: 'science', roles: ['admin', 'lab_manager'] },
  { label: 'Preservations', href: '/dashboard/preservations', icon: 'ac_unit', roles: ['admin', 'lab_manager'] },
  { label: 'Sample Points', href: '/dashboard/sample-points', icon: 'place', roles: ['admin', 'lab_manager'] },
  // Analysis Profiles now lives as a tab inside the Analyses page — route still
  // works standalone (unlinked from nav) for any existing direct links.
  { label: 'Analyses',     href: '/dashboard/analyses',     icon: 'biotech',    roles: ['admin', 'lab_manager'] },
  { label: 'Specifications', href: '/dashboard/specifications', icon: 'rule',    roles: ['admin', 'lab_manager'] },
  { label: 'Dynamic Analysis Specifications', href: '/dashboard/dynamic-analysis-specifications', icon: 'dynamic_feed', roles: ['admin', 'lab_manager'] },
  { label: 'Analysis Requests', href: '/dashboard/analysis-requests', icon: 'assignment_turned_in', roles: ['admin', 'lab_manager', 'analyst', 'reviewer'] },
  { label: 'Results',      href: '/dashboard/results',      icon: 'science',     roles: ['admin', 'lab_manager', 'analyst', 'reviewer'] },
  { label: 'Tasks',        href: '/dashboard/tasks',        icon: 'checklist',   roles: null },
  { label: 'Chain of Custody', href: '/dashboard/chain-of-custody', icon: 'link', roles: ['admin', 'lab_manager', 'analyst', 'reviewer', 'client'] },
  { label: 'Approvals',    href: '/dashboard/approvals',    icon: 'fact_check',  roles: ['admin', 'lab_manager', 'reviewer'] },
  { label: 'Audit Trail',  href: '/dashboard/audit-trail',  icon: 'history',     roles: ['admin', 'lab_manager'] },
  { label: 'Master Data Import', href: '/dashboard/master-data-import', icon: 'upload_file', roles: ['admin', 'lab_manager'] },
  { label: 'Instrument Register', href: '/dashboard/instruments', icon: 'build_circle', roles: ['admin', 'lab_manager'] },
  { label: 'Instrument List', href: '/dashboard/instrument-list', icon: 'precision_manufacturing', roles: ['admin', 'lab_manager'] },
  { label: 'Storage List', href: '/dashboard/storage-list', icon: 'inventory_2', roles: ['admin', 'lab_manager'] },
  { label: 'Report Templates', href: '/dashboard/settings/report-templates', icon: 'description', roles: ['admin'] },
  { label: 'Data Analytics', href: '/dashboard/analytics', icon: 'insights', roles: ['admin', 'lab_manager', 'analyst'] },
]
