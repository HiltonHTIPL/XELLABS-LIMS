// Single source of truth for "Administration" sub-sections — consumed by both
// the sidebar's Administration nav group and the /dashboard/admin grid page.
// Add a new admin section here once; it shows up in both places automatically.
//
// `description` powers the grid card's (?) tooltip — what the section is for.
// `dependsOn` powers the grid card's tree/link-icon tooltip ("Interlinked
// with: ...") — list ONLY sections this one's create/edit form actually reads
// data from (verified in the section's own component), never a guess.
export type AdminSection = {
  label: string
  href: string
  icon: string
  roles: string[] | null
  description?: string
  dependsOn?: string[]
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { label: 'Users',        href: '/dashboard/admin/users',   icon: 'group',       roles: ['admin', 'lab_manager'],
    description: 'Manage lab staff accounts and role assignments.' },
  { label: 'Sample Types', href: '/dashboard/sample-types', icon: 'category',   roles: ['admin', 'lab_manager'],
    description: 'Define sample matrix categories (e.g. Water, Soil) used across sampling and specifications.' },
  { label: 'Sample Templates', href: '/dashboard/sample-templates', icon: 'view_list', roles: ['admin', 'lab_manager'],
    description: 'Reusable partition/container/preservation presets for creating samples faster.',
    dependsOn: ['Sample Types', 'Sample Containers', 'Preservations', 'Sample Points', 'Analyses'] },
  { label: 'Container Types', href: '/dashboard/container-types', icon: 'inventory_2', roles: ['admin', 'lab_manager'],
    description: 'Catalog of container types (bottle, vial, jar) offered when defining Sample Containers.' },
  { label: 'Sample Containers', href: '/dashboard/sample-containers', icon: 'science', roles: ['admin', 'lab_manager'],
    description: 'Physical container definitions (capacity, type, preservation) used in Sample Templates and sample receipt.',
    dependsOn: ['Container Types', 'Preservations'] },
  { label: 'Preservations', href: '/dashboard/preservations', icon: 'ac_unit', roles: ['admin', 'lab_manager'],
    description: 'Preservation methods (e.g. cold, acidified) applied to sample containers.' },
  { label: 'Sample Points', href: '/dashboard/sample-points', icon: 'place', roles: ['admin', 'lab_manager'],
    description: 'Named collection locations available when scheduling or logging samples.' },
  { label: 'Sampling Deviations', href: '/dashboard/sampling-deviations', icon: 'warning_amber', roles: ['admin', 'lab_manager'],
    description: 'Reference list of deviations recordable during sample collection/receipt.' },
  // Analysis Profiles now lives as a tab inside the Analyses page — route still
  // works standalone (unlinked from nav) for any existing direct links.
  { label: 'Analyses',     href: '/dashboard/analyses',     icon: 'biotech',    roles: ['admin', 'lab_manager'],
    description: 'Manage analysis services — the tests offered, pricing, and lab catalog.' },
  { label: 'Calculations', href: '/dashboard/calculations', icon: 'functions', roles: ['admin', 'lab_manager'],
    description: 'Define result formulas and interim fields used by Analyses.',
    dependsOn: ['Analyses'] },
  { label: 'Specifications', href: '/dashboard/specifications', icon: 'rule',    roles: ['admin', 'lab_manager'],
    description: 'Set acceptable result ranges per Sample Type and Analysis.',
    dependsOn: ['Sample Types', 'Analyses'] },
  { label: 'Dynamic Analysis Specifications', href: '/dashboard/dynamic-analysis-specifications', icon: 'dynamic_feed', roles: ['admin', 'lab_manager'],
    description: 'Rule-based specification limits that adjust per sample context.' },
  { label: 'Analysis Requests', href: '/dashboard/analysis-requests', icon: 'assignment_turned_in', roles: ['admin', 'lab_manager', 'analyst', 'reviewer'],
    description: 'View and manage submitted analysis requests.' },
  { label: 'Results',      href: '/dashboard/results',      icon: 'science',     roles: ['admin', 'lab_manager', 'analyst', 'reviewer'],
    description: 'Enter, verify, and review analysis results.' },
  { label: 'Tasks',        href: '/dashboard/tasks',        icon: 'checklist',   roles: null,
    description: 'Track lab tasks and assignments across the workflow.' },
  { label: 'Chain of Custody', href: '/dashboard/chain-of-custody', icon: 'link', roles: ['admin', 'lab_manager', 'analyst', 'reviewer', 'client'],
    description: "Full audit trail of a sample's custody and status changes.",
    dependsOn: ['Analysis Requests'] },
  { label: 'Approvals',    href: '/dashboard/approvals',    icon: 'fact_check',  roles: ['admin', 'lab_manager', 'reviewer'],
    description: 'Review and approve workflow transitions requiring e-signature.' },
  { label: 'Audit Trail',  href: '/dashboard/audit-trail',  icon: 'history',     roles: ['admin', 'lab_manager'],
    description: 'System-wide compliance log of every sensitive action.' },
  { label: 'Master Data Import', href: '/dashboard/master-data-import', icon: 'upload_file', roles: ['admin', 'lab_manager'],
    description: 'Bulk import reference/master data via spreadsheet.' },
  { label: 'Instrument Register', href: '/dashboard/instruments', icon: 'build_circle', roles: ['admin'],
    description: 'Register lab instruments with full SENAITE-parity fields.' },
  { label: 'Instrument List', href: '/dashboard/instrument-list', icon: 'precision_manufacturing', roles: ['admin', 'lab_manager'],
    description: 'Browse instruments, calibration and maintenance status.',
    dependsOn: ['Instrument Register'] },
  { label: 'Storage List', href: '/dashboard/storage-list', icon: 'inventory_2', roles: ['admin', 'lab_manager'],
    description: 'Manage physical storage locations and sample slot assignments.' },
  { label: 'Report Templates', href: '/dashboard/settings/report-templates', icon: 'description', roles: ['admin'],
    description: 'Configure COA and report template formatting.' },
  { label: 'Data Analytics', href: '/dashboard/analytics', icon: 'insights', roles: ['admin', 'lab_manager', 'analyst'],
    description: 'Embedded analytics dashboards for lab performance metrics.' },
  // Reference-data setup sections (mirror of SENAITE's setup matrix)
  { label: 'Analysis Categories', href: '/dashboard/analysis-categories', icon: 'account_tree', roles: ['admin', 'lab_manager'],
    description: 'Grouping categories used to organize Analyses.' },
  { label: 'Attachment Types', href: '/dashboard/attachment-types', icon: 'attach_file', roles: ['admin', 'lab_manager'],
    description: 'Classify file attachments uploaded to samples and requests.' },
  { label: 'Batch Labels', href: '/dashboard/batch-labels', icon: 'label', roles: ['admin', 'lab_manager'],
    description: 'Tags applied to Batches for grouping and filtering.' },
  { label: 'Instrument Locations', href: '/dashboard/instrument-locations', icon: 'place', roles: ['admin', 'lab_manager'],
    description: 'Physical locations where instruments are installed.' },
  { label: 'Instrument Types', href: '/dashboard/instrument-types', icon: 'category', roles: ['admin', 'lab_manager'],
    description: 'Categories of instruments used across the lab.' },
  { label: 'Interpretation Templates', href: '/dashboard/interpretation-templates', icon: 'description', roles: ['admin', 'lab_manager'],
    description: 'Reusable result-interpretation text blocks for reports.' },
  { label: 'Lab Contacts', href: '/dashboard/lab-contacts', icon: 'contact_page', roles: ['admin', 'lab_manager'],
    description: 'Internal lab staff contacts linked to reports and departments.' },
  { label: 'Lab Departments', href: '/dashboard/lab-departments', icon: 'corporate_fare', roles: ['admin', 'lab_manager'],
    description: 'Organizational departments within the lab.' },
  { label: 'Lab Products', href: '/dashboard/lab-products', icon: 'shopping_bag', roles: ['admin', 'lab_manager'],
    description: 'Billable products/services offered by the lab.' },
  { label: 'Labels', href: '/dashboard/labels', icon: 'sell', roles: ['admin', 'lab_manager'],
    description: 'Printable label templates for samples and containers.' },
  { label: 'Laboratory Information', href: '/dashboard/laboratory', icon: 'apartment', roles: ['admin', 'lab_manager'],
    description: 'Lab identity, accreditation, and contact details.' },
]
