// XelLabs design tokens — single source of truth for inline styles.
// Mirrors the CSS custom properties in app/globals.css (Product Page_v3 design).

export const T = {
  navy: '#122A5E',          // sidebar background — one navy on every page
  heading: '#14265E',       // page/card titles, emphasized values
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  success: '#0154FC',
  successHover: '#0142CC',
  teal: '#0154FC',
  danger: '#DC2626',
  warning: '#EA580C',
  pageBg: '#F7F8FC',
  cardBorder: '#E8EAF2',
  rowBorder: '#F1F3F9',
  inputBorder: '#D9DEEA',
  tableHeadBg: '#FAFBFE',
  text: '#3B4256',
  muted: '#6B7280',
  faint: '#9AA1B2',
  cardShadow: '0 1px 2px rgba(16,24,40,0.04)',
  cardRadius: 14,
} as const

export type ChipTone = 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'purple' | 'teal'

export const CHIP_TONES: Record<ChipTone, { bg: string; text: string; border: string }> = {
  blue:   { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  green:  { bg: '#DBEAFE', text: '#0154FC', border: '#93C5FD' },
  orange: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  red:    { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  gray:   { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' },
  purple: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  teal:   { bg: '#DBEAFE', text: '#0154FC', border: '#93C5FD' },
}

// Canonical status → tone mapping (covers SENAITE + Django statuses).
export function statusTone(status: string): ChipTone {
  const s = (status || '').toLowerCase().replace(/[_-]/g, ' ').trim()
  if (['received', 'in process', 'in progress', 'sample due', 'assigned', 'open'].includes(s)) return 'blue'
  if (['completed', 'complete', 'verified', 'published', 'active', 'acceptable', 'passed', 'approved', 'low'].includes(s)) return 'green'
  if (['to be verified', 'pending', 'medium', 'on hold', 'in review'].includes(s)) return 'orange'
  if (['on hold for qa', 'high', 'urgent', 'overdue', 'compromised', 'rejected', 'invalid', 'cancelled', 'failed', 'inactive'].includes(s)) return 'red'
  if (['not started', 'registered', 'draft', 'unassigned'].includes(s)) return 'gray'
  return 'gray'
}
