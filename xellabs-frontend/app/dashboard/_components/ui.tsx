'use client'
// XelLabs shared UI kit — presentational primitives for the Product Page_v3 design.
// Every dashboard page composes these; do not fork per-page styling.
import React, { useState } from 'react'
import { T, CHIP_TONES, ChipTone, statusTone } from './tokens'

export { T, CHIP_TONES, statusTone }
export type { ChipTone }

export function MI({ name, size = 16, color, className }: { name: string; size?: number; color?: string; className?: string }) {
  return (
    <span className={`material-icons ${className ?? ''}`} style={{ fontSize: size, lineHeight: 1, color }}>
      {name}
    </span>
  )
}

/* ---------------------------------- Page header ---------------------------------- */

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.heading, letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <p className="mt-1" style={{ fontSize: 13, color: T.muted }}>{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  )
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <div className="flex items-center gap-1.5 mb-1" style={{ fontSize: 12 }}>
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <React.Fragment key={i}>
            {item.href && !last ? (
              <a href={item.href} style={{ color: T.muted }} className="hover:underline">{item.label}</a>
            ) : (
              <span style={{ color: last ? T.heading : T.muted, fontWeight: last ? 700 : 400 }}>{item.label}</span>
            )}
            {!last && <MI name="chevron_right" size={14} color={T.faint} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ------------------------------------ Cards ------------------------------------- */

export function Card({
  title, icon, action, children, className, bodyClassName, pad = true,
}: {
  title?: React.ReactNode; icon?: string; action?: React.ReactNode
  children: React.ReactNode; className?: string; bodyClassName?: string; pad?: boolean
}) {
  return (
    <div
      className={`bg-white ${className ?? ''}`}
      style={{ border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {icon && <MI name={icon} size={18} color={T.primary} />}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: T.heading }}>{title}</h3>
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName ?? (pad ? (title || action ? 'px-4 pb-4' : 'p-4') : '')}>{children}</div>
    </div>
  )
}

export function SectionCard({ step, title, children, className }: { step: number; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white ${className ?? ''}`}
      style={{ border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow }}
    >
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span
          className="flex items-center justify-center shrink-0 rounded-full text-white"
          style={{ width: 22, height: 22, backgroundColor: T.primary, fontSize: 12, fontWeight: 700 }}
        >
          {step}
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.heading }}>{title}</h3>
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  )
}

/* ---------------------------------- Stat card ------------------------------------ */

export function StatCard({
  icon, iconColor = T.primary, iconBg = '#EFF6FF', label, value, delta, deltaTone = 'up-good', sub,
}: {
  icon: string; iconColor?: string; iconBg?: string; label: string
  value: React.ReactNode; delta?: string; deltaTone?: 'up-good' | 'up-warn' | 'up-bad'; sub?: string
}) {
  const deltaColor = deltaTone === 'up-good' ? T.success : deltaTone === 'up-warn' ? T.warning : T.danger
  return (
    <div
      className="bg-white p-4"
      style={{ border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: iconBg }}
        >
          <MI name={icon} size={20} color={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>{label}</p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span style={{ fontSize: 22, fontWeight: 800, color: T.heading }}>{value}</span>
            {delta && (
              <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor }}>
                ▲ {delta}
              </span>
            )}
          </div>
          {sub && <p style={{ fontSize: 10.5, color: T.faint }}>{sub}</p>}
        </div>
      </div>
    </div>
  )
}

/** Clickable icon+label tile — used by grid launcher pages (e.g. /dashboard/admin). */
export function LinkTile({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="bg-white flex items-center gap-3 hover:shadow-md"
      style={{
        border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow,
        padding: '18px 16px', textDecoration: 'none', transition: 'box-shadow .15s, border-color .15s',
      }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF' }}
      >
        <MI name={icon} size={20} color={T.primary} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>{label}</span>
    </a>
  )
}

/* ------------------------------------ Chips -------------------------------------- */

export function Chip({ tone, children, dot }: { tone: ChipTone; children: React.ReactNode; dot?: boolean }) {
  const c = CHIP_TONES[tone]
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap"
      style={{
        backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600,
      }}
    >
      {dot && <span className="rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: c.text }} />}
      {children}
    </span>
  )
}

export function StatusChip({ status, dot = true }: { status: string; dot?: boolean }) {
  return <Chip tone={statusTone(status)} dot={dot}>{status}</Chip>
}

/** Condition indicator: colored dot + plain text (design page 1 "Condition" column) */
export function ConditionDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12.5, color: T.text }}>
      <span className="rounded-full shrink-0" style={{ width: 7, height: 7, backgroundColor: ok ? T.success : T.danger }} />
      {label}
    </span>
  )
}

/* ----------------------------------- Buttons ------------------------------------- */

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'success' | 'danger'

export function Btn({
  variant = 'primary', icon, children, className, style, fullWidth, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; icon?: string; fullWidth?: boolean
}) {
  const base: React.CSSProperties = {
    borderRadius: 10, fontSize: 13, fontWeight: 600, padding: '8px 16px', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: '1px solid transparent', transition: 'background-color .15s, border-color .15s, color .15s',
    width: fullWidth ? '100%' : undefined,
    opacity: rest.disabled ? 0.6 : 1,
  }
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { backgroundColor: T.primary, color: '#fff' },
    success: { backgroundColor: T.success, color: '#fff' },
    danger:  { backgroundColor: T.danger, color: '#fff' },
    outline: { backgroundColor: '#fff', color: T.primary, border: `1px solid ${T.inputBorder}` },
    ghost:   { backgroundColor: 'transparent', color: T.muted },
  }
  return (
    <button {...rest} className={className} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <MI name={icon} size={16} />}
      {children}
    </button>
  )
}

export function IconBtn({ icon, size = 16, color, title, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; size?: number; color?: string }) {
  return (
    <button
      {...rest}
      title={title}
      className={`p-1.5 rounded-lg hover:bg-gray-100 ${rest.className ?? ''}`}
      style={{ cursor: 'pointer', ...rest.style }}
    >
      <MI name={icon} size={size} color={color ?? T.muted} />
    </button>
  )
}

/* ------------------------------------ Forms -------------------------------------- */

export const inputCls = 'w-full outline-none bg-white'
export const inputStyle: React.CSSProperties = {
  height: 36, borderRadius: 10, border: `1px solid ${T.inputBorder}`, fontSize: 13,
  padding: '0 12px', color: T.text,
}
export const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }
export const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: 28 }

export function Field({ label, required, hint, children, className }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={className}>
      <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
        {label} {required && <span style={{ color: T.danger }}>*</span>}
      </label>
      {children}
      {hint && <p className="mt-1" style={{ fontSize: 11, color: T.faint }}>{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative shrink-0"
      style={{
        width: 36, height: 20, borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: checked ? T.primary : '#D1D5DB', transition: 'background-color .15s', border: 'none',
      }}
    >
      <span
        className="absolute rounded-full bg-white"
        style={{
          width: 16, height: 16, top: 2, left: checked ? 18 : 2,
          transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}

/** Removable chip used by multi-value inputs (CC emails, analysis profiles). */
export function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        backgroundColor: '#F1F3F9', color: T.text, borderRadius: 8,
        padding: '3px 8px', fontSize: 12, fontWeight: 500,
      }}
    >
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ cursor: 'pointer', display: 'inline-flex' }}>
          <MI name="close" size={13} color={T.faint} />
        </button>
      )}
    </span>
  )
}

/** Multi-value text input (e.g. CC emails) — press Enter or comma to add a tag. */
export function TagInput({ tags, onAdd, onRemove, placeholder, type = 'text' }: {
  tags: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void; placeholder?: string; type?: string
}) {
  const [val, setVal] = useState('')
  return (
    <div
      className="w-full flex flex-wrap items-center gap-1.5"
      style={{ ...inputStyle, height: 'auto', minHeight: 36, padding: '5px 8px' }}
    >
      {tags.map(t => <TagChip key={t} label={t} onRemove={() => onRemove(t)} />)}
      <input
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && val.trim()) { e.preventDefault(); onAdd(val.trim()); setVal('') }
        }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className={inputCls}
        style={{ border: 'none', height: 22, flex: 1, minWidth: 100, padding: 0 }}
      />
    </div>
  )
}

/* ------------------------------------ Tables ------------------------------------- */

export const thStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: T.muted, textAlign: 'left',
  padding: '10px 12px', backgroundColor: T.tableHeadBg, borderBottom: `1px solid ${T.cardBorder}`,
  whiteSpace: 'nowrap',
}
export const tdStyle: React.CSSProperties = {
  fontSize: 13, color: T.text, padding: '12px 12px', borderBottom: `1px solid ${T.rowBorder}`,
  verticalAlign: 'middle',
}
export const linkStyle: React.CSSProperties = { color: T.primary, fontWeight: 600, textDecoration: 'none' }

export function Pagination({ page, pages, onPage, showTotal, totalItems, alwaysShow }: { page: number; pages: number; onPage: (p: number) => void; showTotal?: boolean; totalItems?: number; alwaysShow?: boolean }) {
  if (pages <= 1 && !alwaysShow) return null
  const nums: number[] = []
  const start = Math.max(1, Math.min(page - 2, pages - 4))
  for (let p = start; p <= Math.min(pages, start + 4); p++) nums.push(p)
  const circle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 999, fontSize: 12, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none',
    backgroundColor: 'transparent', color: T.muted,
  }
  return (
    <div className="flex items-center gap-3">
      {showTotal && (
        <span style={{ fontSize: 12, color: T.muted }}>
          Page {page} of {pages}{typeof totalItems === 'number' ? ` · ${totalItems.toLocaleString()} total` : ''}
        </span>
      )}
      <div className="flex items-center gap-1">
        <button style={circle} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <MI name="chevron_left" size={16} color={page <= 1 ? '#D1D5DB' : T.muted} />
        </button>
        {nums.map(p => (
          <button
            key={p}
            style={{ ...circle, backgroundColor: p === page ? T.primary : 'transparent', color: p === page ? '#fff' : T.muted }}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        ))}
        <button style={circle} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <MI name="chevron_right" size={16} color={page >= pages ? '#D1D5DB' : T.muted} />
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- Empty state ----------------------------------- */

export function EmptyState({ icon = 'inbox', title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div
        className="flex items-center justify-center mb-3"
        style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF' }}
      >
        <MI name={icon} size={24} color={T.primary} />
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: T.heading }}>{title}</p>
      {sub && <p className="mt-1" style={{ fontSize: 12, color: T.faint }}>{sub}</p>}
    </div>
  )
}

/* ------------------------------------ Confirm modal ------------------------------- */

export function ConfirmModal({
  title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel?: string; cancelLabel?: string
  danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div
      onClick={e => { if (e.currentTarget === e.target) onCancel() }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 16, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="px-5 pt-5 pb-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.heading }}>{title}</h3>
          <p className="mt-2" style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <Btn variant="outline" onClick={onCancel}>{cancelLabel}</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- Avatar (initials) ------------------------------- */

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = (name || '?')
    .split(/\s+/)
    .map(w => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: T.primary, fontSize: Math.round(size * 0.38), fontWeight: 700 }}
    >
      {initials}
    </span>
  )
}
