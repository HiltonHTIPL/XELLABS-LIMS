'use client'

/**
 * DataTable — the app's single reusable table.
 *
 * Adapter Pattern: wraps the headless `@liji-table/react` hook (which owns all
 * table LOGIC — sort / global search / pagination / row selection / column
 * pinning / reorder / resize / layout persistence) behind a stable prop API so
 * every feature list "maps through" one component (DRY). The library provides no
 * cell renderer and no sticky UI, so this file adds both: a `render?()` column
 * field and the pinned-column sticky positioning (SoC — library = logic,
 * component = presentation).
 *
 * Built on @liji-table 0.0.8-beta.0:
 *  - right-click a header → Pin left / Pin right / Unpin (sticky columns)
 *  - drag a header onto another → reorder ("swap") columns
 *  - drag the right edge of a header → resize the column
 *  - auto-fit widths to the container (computedColumnWidths + containerRef)
 *  - optional `persistKey` remembers order/width/pin/hidden in localStorage
 *
 * If the third-party hook is ever swapped/changed (it is v0.0.x), only this
 * file changes — no feature page does.
 */

import { Fragment, useEffect, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useLijiTable } from '@liji-table/react'
import type { TableColumn, GroupRow } from '@liji-table/core'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

/** Our column config = the library's sortable/align/width fields + a cell renderer. */
export type DataTableColumn<T> = {
  id: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: number
  minWidth?: number
  /** Custom cell content. Defaults to the raw `row[id]` value when omitted. */
  render?: (row: T) => ReactNode
}

type Props<T extends { id: string | number }> = {
  data: T[]
  columns: DataTableColumn<T>[]
  selectable?: boolean
  pageSize?: number
  searchable?: boolean
  onRowClick?: (row: T) => void
  /** Trailing per-row action cell (e.g. Receive button / kebab menu). */
  rowActions?: (row: T) => ReactNode
  emptyMessage?: string
  /** When set, column order/width/pin/hidden persist to localStorage under this key. */
  persistKey?: string
  /** Show pagination + footer (default true). When false, all rows render and the footer is hidden. */
  paginated?: boolean
  /** Drop the component's own border/shadow/radius so it sits inside an existing card. */
  bare?: boolean
  /** Tighter padding / smaller type for compact/embedded tables. */
  dense?: boolean
  /** Optional max height (px) for the scroll area. */
  maxHeight?: number
  /** Fires whenever the selected row-id set changes (for external bulk actions). */
  onSelectionChange?: (ids: (string | number)[]) => void
  /**
   * When set, the layout controls (Reset layout + Views) render into this DOM
   * node via a portal instead of the component's own toolbar row — lets a page
   * place them in its existing toolbar. All control logic still lives here (SoC).
   */
  /** Optional array of row IDs that should render expanded row details inline. */
  expandedRowIds?: (string | number)[]
  /** Custom inline dropdown renderer for expanded rows. */
  renderRowDetails?: (row: T) => ReactNode
  controlsTargetRef?: RefObject<HTMLElement | null>
}

const CHECKBOX_WIDTH = 40
const ACTIONS_WIDTH = 130
const DEFAULT_COL_WIDTH = 150
const HEADER_BG = '#F9FAFB'

function isGroup<T>(r: T | GroupRow<T>): r is GroupRow<T> {
  return typeof r === 'object' && r !== null && (r as GroupRow<T>).isGroup === true
}

// Flips true after the first client mount anywhere in the app. Lets remounted
// instances (e.g. when the column set changes) skip the SSR placeholder so a
// column toggle doesn't flash an empty table.
let hasHydrated = false

/**
 * Public component. The underlying `useLijiTable` hook reads its columns only
 * once (on init) and never re-syncs them, so adding/removing a column in a
 * parent's column chooser wouldn't show up. We remount the inner table whenever
 * the SET of column ids changes — persistence (layout/sort/page/search) restores
 * on remount, so nothing is lost.
 */
export default function DataTable<T extends { id: string | number }>(props: Props<T>) {
  const colKey = props.columns.map(c => c.id).join('|')
  return <DataTableInner<T> key={colKey} {...props} />
}

function DataTableInner<T extends { id: string | number }>({
  data,
  columns,
  selectable = false,
  pageSize = 25,
  searchable = false,
  onRowClick,
  rowActions,
  emptyMessage = 'No records found.',
  persistKey,
  paginated = true,
  bare = false,
  dense = false,
  maxHeight,
  onSelectionChange,
  controlsTargetRef,
  expandedRowIds,
  renderRowDetails,
}: Props<T>) {
  // Strip our render field down to what the engine understands.
  const engineColumns: TableColumn[] = columns.map(c => ({
    id: c.id,
    label: c.label,
    sortable: c.sortable ?? false,
    align: c.align,
    width: c.width,
    minWidth: c.minWidth,
  }))

  const leftBase = selectable ? CHECKBOX_WIDTH : 0
  const rightBase = rowActions ? ACTIONS_WIDTH : 0

  const table = useLijiTable<T>(data, engineColumns, {
    persistKey,
    reservedWidth: leftBase + rightBase, // checkbox + actions live outside the column list
  })

  // The hook has no pageSize option — set it after mount / when it changes.
  // When not paginated, size the page to the whole dataset so every row renders.
  const effectivePageSize = paginated ? pageSize : Math.max(1, data.length)
  useEffect(() => {
    table.setPageSize(effectivePageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePageSize])

  // Persist layout (order / width / pin / hidden) whenever it changes.
  const layoutSig = persistKey
    ? JSON.stringify(table.allColumns.map(c => [c.id, c.pinned ?? null, c.hidden ?? false, table.state.columnWidths[c.id] ?? null]))
    : ''
  const didMount = useRef(false)
  useEffect(() => {
    if (!persistKey) return
    if (!didMount.current) { didMount.current = true; return } // don't re-save the just-restored layout
    table.saveLayout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSig])

  // Surface selection changes so a parent can drive external bulk actions.
  const selSig = table.selectedIds.join(',')
  useEffect(() => {
    onSelectionChange?.(table.selectedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSig])

  // `hasSavedLayout()` reads localStorage, which doesn't exist during SSR — so
  // anything that depends on it must render only after the client has mounted,
  // otherwise the server (no button) and client (button) HTML disagree and React
  // throws a hydration mismatch. Gate such UI on this flag.
  const [mounted, setMounted] = useState(hasHydrated)
  useEffect(() => { hasHydrated = true; setMounted(true) }, [])

  // Persist sort / page / search per page. The library only auto-persists column
  // layout (order/width/pin/hidden) under `persistKey`; sort direction, current
  // page, and the search text reset on refresh unless we save them too. Stored
  // under `${persistKey}:view`, restored once on mount before saving resumes.
  const viewKey = persistKey ? `${persistKey}:view` : ''
  const viewRestored = useRef(false)
  useEffect(() => {
    if (!viewKey || viewRestored.current) return
    viewRestored.current = true
    try {
      const raw = localStorage.getItem(viewKey)
      if (raw) {
        const v = JSON.parse(raw)
        if (v.globalSearch) table.setSearch(v.globalSearch)
        if (v.sortColumn) table.setSortDirection(v.sortColumn, v.sortDirection ?? 'asc')
        if (v.pageIndex) table.setPage(v.pageIndex)
      }
    } catch { /* ignore corrupt view */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey])

  const { sortColumn: vSc, sortDirection: vSd, pageIndex: vPi } = table.state
  const vGs = table.state.globalSearch
  useEffect(() => {
    if (!viewKey || !viewRestored.current) return
    try {
      localStorage.setItem(viewKey, JSON.stringify({ sortColumn: vSc, sortDirection: vSd, pageIndex: vPi, globalSearch: vGs }))
    } catch { /* ignore quota */ }
  }, [viewKey, vSc, vSd, vPi, vGs])

  // Right-click header context menu (sort / autosize / pin / reset).
  const [ctx, setCtx] = useState<{ colId: string; x: number; y: number; pinned: 'left' | 'right' | null; sortable: boolean } | null>(null)
  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [ctx])

  // Per-column autosize override. The hook has no `setColumnWidth`, so we measure
  // content ourselves and override the width here; a manual drag-resize clears
  // the override for that column so lib-driven and manual widths never conflict.
  const [localWidths, setLocalWidths] = useState<Record<string, number>>({})
  const clearLocalWidth = (colId: string) =>
    setLocalWidths(prev => { if (!(colId in prev)) return prev; const n = { ...prev }; delete n[colId]; return n })

  /** Measure the widest rendered content (header + body cells) for a column. */
  function measureColumn(root: HTMLElement, colId: string): number {
    const sel = `[data-col="${CSS.escape(colId)}"],[data-colhead="${CSS.escape(colId)}"]`
    let max = 0
    root.querySelectorAll(sel).forEach(el => { max = Math.max(max, (el as HTMLElement).scrollWidth) })
    return max > 0 ? Math.max(80, Math.ceil(max) + 24 + 8) : 0
  }
  function autosizeColumn(colId: string) {
    const root = table.containerRef?.current
    if (!root) return
    const w = measureColumn(root, colId)
    if (w > 0) setLocalWidths(prev => ({ ...prev, [colId]: w }))
  }
  // Autosize = measure each column's content (header + widest cell), then scale
  // the columns up proportionally so they span the full container width — the
  // table fills edge-to-edge with no blank area, while wider-content columns
  // still get proportionally more room than short ones (better than the
  // library's equal distribution). If content is already wider than the
  // container, keep the measured widths and let the table scroll horizontally.
  function autosizeAll() {
    const root = table.containerRef?.current
    if (!root) return
    const next: Record<string, number> = {}
    let sum = 0
    vis.forEach(col => { const w = measureColumn(root, col.id); if (w > 0) { next[col.id] = w; sum += w } })
    if (sum === 0) return
    const avail = root.clientWidth - leftBase - rightBase
    if (avail > sum) {
      const scale = avail / sum
      Object.keys(next).forEach(id => { next[id] = Math.floor(next[id] * scale) })
    }
    setLocalWidths(next)
  }
  /** Reset one column's width only — leaves its position/pin untouched. */
  function resetColumn(colId: string) { clearLocalWidth(colId) }
  /** Reset everything: order / width / pin / hidden back to defaults. */
  function resetAllColumns() { setLocalWidths({}); table.resetLayout() }

  const rows = table.rows.filter((r): r is T => !isGroup(r))
  const { sortColumn, sortDirection, pageIndex } = table.state
  const colById = new Map(columns.map(c => [c.id, c]))
  const vis = table.visibleColumns

  const widthOf = (colId: string) => {
    const m = colById.get(colId)
    const fallback = m?.width ?? Math.max(m?.minWidth ?? 0, DEFAULT_COL_WIDTH)
    return localWidths[colId] ?? table.computedColumnWidths?.[colId] ?? table.state.columnWidths?.[colId] ?? fallback
  }

  // Auto-fit on first mount: size each column to its content, then scale
  // proportionally to fill the container. The headless library otherwise
  // distributes width *equally*, which stretches short-content columns (e.g. a
  // 2-char prefix) as wide as long ones and leaves their content stranded at the
  // left edge — the "misaligned / gappy" look. Runs once; skipped when a saved
  // layout or manual width already exists so it never overrides the user.
  const didAutoFit = useRef(false)
  useEffect(() => {
    if (didAutoFit.current) return
    if (rows.length === 0) return
    if (persistKey && table.hasSavedLayout()) { didAutoFit.current = true; return }
    const id = requestAnimationFrame(() => { autosizeAll(); didAutoFit.current = true })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length])

  // ── Pinning geometry (sticky offsets) ─────────────────────────────────────
  // Checkbox pins to the far left and actions to the far right so pinned data
  // columns dock cleanly against them.
  const leftPinned = vis.filter(c => c.pinned === 'left')
  const rightPinned = vis.filter(c => c.pinned === 'right')

  const leftOffset = (colId: string) => {
    let off = leftBase
    for (const c of leftPinned) { if (c.id === colId) break; off += widthOf(c.id) }
    return off
  }
  const rightOffset = (colId: string) => {
    let off = rightBase
    for (let i = rightPinned.length - 1; i >= 0; i--) { if (rightPinned[i].id === colId) break; off += widthOf(rightPinned[i].id) }
    return off
  }
  const lastLeftPinned = leftPinned.at(-1)?.id
  const firstRightPinned = rightPinned[0]?.id

  /** Sticky style shared by a pinned column's header + body cells. */
  const pinStyle = (colId: string, bg: string): React.CSSProperties => {
    if (leftPinned.some(c => c.id === colId)) {
      return { position: 'sticky', left: leftOffset(colId), background: bg, boxShadow: colId === lastLeftPinned ? '2px 0 4px -2px rgba(0,0,0,0.18)' : undefined }
    }
    if (rightPinned.some(c => c.id === colId)) {
      return { position: 'sticky', right: rightOffset(colId), background: bg, boxShadow: colId === firstRightPinned ? '-2px 0 4px -2px rgba(0,0,0,0.18)' : undefined }
    }
    return {}
  }
  const isPinned = (colId: string) => vis.some(c => c.id === colId && (c.pinned === 'left' || c.pinned === 'right'))

  const cell = (row: T, colId: string): ReactNode => {
    const col = colById.get(colId)
    if (col?.render) return col.render(row)
    const v = (row as Record<string, unknown>)[colId]
    return v == null ? <span style={{ color: '#374151' }}>—</span> : String(v)
  }

  const start = data.length === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, data.length)
  const totalCols = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)
  const totalWidth = leftBase + rightBase + vis.reduce((s, c) => s + widthOf(c.id), 0)

  // Sizing (compact when `dense`). Header keeps extra right padding for the resizer.
  const headFontSize = 12
  const bodyFontSize = dense ? 11 : 10
  const headPad = dense ? '6px 14px 6px 10px' : '9px 16px 9px 12px'
  const cellPad = dense ? '5px 10px' : '7px 12px'

  // ── Saved Views: named presets (sort + search + column layout) per page ──
  // `order` (column id sequence) is captured/restored alongside width/hidden/pin —
  // previously missing, so switching views never actually moved columns around.
  type SavedView = {
    name: string; sortColumn: string | null; sortDirection: 'asc' | 'desc'; globalSearch: string
    widths: Record<string, number>; hidden: string[]; pins: Record<string, 'left' | 'right'>; order: string[]
  }
  const viewsKey = persistKey ? `${persistKey}:views` : ''
  const [views, setViews] = useState<SavedView[]>([])
  const [viewsOpen, setViewsOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [viewName, setViewName] = useState('')
  useEffect(() => {
    if (!viewsKey) return
    try {
      const raw = localStorage.getItem(viewsKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      // Migrate views saved before order-tracking was added — old rows have no
      // `order` field; default to current order (a no-op reorder on apply).
      const migrated: SavedView[] = parsed.map((v: SavedView) => ({ ...v, order: v.order ?? [] }))
      setViews(migrated)
    } catch { /* ignore */ }
  }, [viewsKey])
  useEffect(() => {
    if (!viewsOpen) return
    const close = () => setViewsOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [viewsOpen])
  function writeViews(next: SavedView[]) {
    setViews(next)
    try { localStorage.setItem(viewsKey, JSON.stringify(next)) } catch { /* ignore quota */ }
  }
  function saveCurrentView(name: string) {
    const n = name.trim()
    if (!n) return
    const cols = table.allColumns as { id: string; hidden?: boolean; pinned?: 'left' | 'right' }[]
    const pins: Record<string, 'left' | 'right'> = {}
    cols.forEach(c => { if (c.pinned) pins[c.id] = c.pinned })
    const v: SavedView = {
      name: n,
      sortColumn: table.state.sortColumn,
      sortDirection: table.state.sortDirection as 'asc' | 'desc',
      globalSearch: table.state.globalSearch,
      widths: { ...localWidths },
      hidden: cols.filter(c => c.hidden).map(c => c.id),
      pins,
      order: cols.map(c => c.id),
    }
    writeViews([...views.filter(x => x.name !== n), v])
    setNaming(false); setViewName('')
  }
  function applyView(v: SavedView) {
    const cols = table.allColumns as { id: string; hidden?: boolean; pinned?: 'left' | 'right' }[]
    // Column order — the hook exposes no direct "set order" API, only the
    // drag-and-drop handlers (`getHeaderProps().onDrop`) that reorder internally
    // via `reorderColumn(fromIndex, toIndex)`. Replay the same swap sequence a
    // real drag would produce with a synthetic drop event, computed against a
    // local simulation of the column array so each successive move's indices
    // stay correct.
    if (v.order?.length) {
      const sim = cols.map(c => c.id)
      const target = v.order.filter(id => sim.includes(id))
      target.push(...sim.filter(id => !target.includes(id)))
      target.forEach((id, toIndex) => {
        const fromIndex = sim.indexOf(id)
        if (fromIndex !== toIndex) {
          const fakeDrop = {
            preventDefault: () => {},
            dataTransfer: { getData: () => String(fromIndex) },
            currentTarget: { classList: { add() {}, remove() {} } },
          } as unknown as DragEvent
          table.getHeaderProps(toIndex, id).onDrop(fakeDrop)
          const [moved] = sim.splice(fromIndex, 1)
          sim.splice(toIndex, 0, moved)
        }
      })
    }
    // Column visibility — toggle any column whose shown/hidden state differs.
    cols.forEach(c => {
      const shouldHide = (v.hidden ?? []).includes(c.id)
      if (!!c.hidden !== shouldHide) table.toggleVisibility(c.id)
    })
    // Column pins — set each to the saved pin (or unpin).
    cols.forEach(c => {
      const want = v.pins?.[c.id] ?? null
      if ((c.pinned ?? null) !== want) table.pinColumn(c.id, want)
    })
    // Widths, sort, search.
    setLocalWidths(v.widths || {})
    if (v.sortColumn) table.setSortDirection(v.sortColumn, v.sortDirection)
    else if (table.state.sortColumn) table.setSortDirection(table.state.sortColumn, null)
    table.setSearch(v.globalSearch || '')
    table.setPage(0)
    setViewsOpen(false)
  }

  // SSR hydration guard: with `persistKey`, the hook restores column order/width
  // from localStorage on the client but not on the server, so the first render
  // differs → hydration mismatch. Render a same-shape placeholder on the server
  // and the first client paint, then the real (restored) table after mount.
  // Tables without persistKey have no client-only state and SSR normally.
  if (persistKey && !mounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
        <div className="xl-visible-scrollbar" aria-hidden
          style={{ flex: '1 1 auto', width: '100%', minHeight: 160, maxHeight,
            ...(bare ? {} : { background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB' }) }} />
      </div>
    )
  }

  // Layout controls (Reset layout + Views). Shared between the built-in toolbar
  // row and the optional `controlsTargetRef` portal — same logic, either place.
  const portalControls = !!controlsTargetRef
  const layoutControls = (
    <>
          {mounted && persistKey && table.hasSavedLayout() && (
            <button onClick={() => table.resetLayout()} title="Restore default column order/width/pins"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <MI name="restart_alt" size={14} color="#374151" /> Reset layout
            </button>
          )}
          {mounted && persistKey && (
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => setViewsOpen(o => !o)} title="Saved views (sort + search + column widths)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: viewsOpen ? '#F3F4F6' : '#fff', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <MI name="bookmark" size={14} color="#374151" /> Views{views.length ? ` (${views.length})` : ''}
              </button>
              {viewsOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, minWidth: 220, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px 0' }}>
                  {views.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: '#6B7280' }}>No saved views yet.</div>}
                  {views.map(v => (
                    <div key={v.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px' }}>
                      <button onClick={() => applyView(v)} style={{ flex: 1, textAlign: 'left', padding: '6px 8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#374151' }}>{v.name}</button>
                      <button onClick={() => writeViews(views.filter(x => x.name !== v.name))} title="Delete view" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: '#9CA3AF' }}><MI name="close" size={13} /></button>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 4, paddingTop: 4 }}>
                    {naming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}>
                        <input autoFocus value={viewName} onChange={e => setViewName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCurrentView(viewName); if (e.key === 'Escape') { setNaming(false); setViewName('') } }}
                          placeholder="View name…"
                          style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', color: '#111827' }} />
                        <button onClick={() => saveCurrentView(viewName)} disabled={!viewName.trim()}
                          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: viewName.trim() ? '#2563EB' : '#93C5FD', color: '#fff', fontSize: 12, fontWeight: 600, cursor: viewName.trim() ? 'pointer' : 'not-allowed' }}>Save</button>
                      </div>
                    ) : (
                      <button onClick={() => { setNaming(true); setViewName('') }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
                        <MI name="add" size={14} color="#2563EB" /> Save current view…
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
    </>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
      {/* Built-in toolbar row: search (if enabled) + layout controls (unless the
          controls have been portaled elsewhere via controlsTargetRef). */}
      {(searchable || (persistKey && !portalControls)) && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          {searchable && (
            <div style={{ position: 'relative', maxWidth: 320, flex: '1 1 auto' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <MI name="search" size={14} color="#374151" />
              </span>
              <input value={table.state.globalSearch} onChange={e => table.setSearch(e.target.value)} placeholder="Search…"
                style={{ border: '1px solid #D1D5DB', borderRadius: 6, padding: '6px 10px 6px 30px', fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }} />
            </div>
          )}
          {!portalControls && layoutControls}
        </div>
      )}

      {/* Portal the layout controls into the page-supplied slot when requested. */}
      {portalControls && mounted && controlsTargetRef?.current
        && createPortal(layoutControls, controlsTargetRef.current)}

      <div ref={table.containerRef as React.RefObject<HTMLDivElement>} className="xl-visible-scrollbar"
        style={{ flex: '1 1 auto', width: '100%', minHeight: 0, maxHeight, overflow: 'auto',
          ...(bare ? {} : { background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB' }) }}>
        <table style={{ width: totalWidth, minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: bodyFontSize }}>
          <colgroup>
            {selectable && <col style={{ width: CHECKBOX_WIDTH }} />}
            {vis.map(c => <col key={c.id} style={{ width: widthOf(c.id) }} />)}
            {rowActions && <col style={{ width: ACTIONS_WIDTH }} />}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '2px solid #D8DEEA', background: HEADER_BG }}>
              {selectable && (
                <th style={{ padding: headPad, position: 'sticky', top: 0, left: 0, zIndex: 30, background: HEADER_BG, boxShadow: '0 1px 0 #D8DEEA' }}>
                  <input type="checkbox" checked={rows.length > 0 && table.isAllPageSelected()} onChange={() => table.toggleAllPage()} />
                </th>
              )}
              {vis.map((col, i) => {
                const meta = colById.get(col.id)
                const active = sortColumn === col.id && sortDirection
                const pinned = isPinned(col.id)
                const dnd = table.getHeaderProps(i, col.id) // drag-to-reorder ("swap")
                return (
                  <th
                    key={col.id}
                    {...dnd}
                    onClick={() => { if (!table.isResizing && meta?.sortable) table.toggleSort(col.id) }}
                    onContextMenu={e => { e.preventDefault(); setCtx({ colId: col.id, x: e.clientX, y: e.clientY, pinned: col.pinned ?? null, sortable: meta?.sortable ?? false }) }}
                    title="Drag to reorder · drag right edge to resize · right-click to pin"
                    style={{
                      position: 'sticky', top: 0, zIndex: pinned ? 30 : 10, background: HEADER_BG, boxShadow: '0 1px 0 #D8DEEA',
                      padding: headPad, fontSize: headFontSize, textAlign: meta?.align ?? 'left', fontWeight: 600, color: '#374151',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none', cursor: 'grab',
                      ...pinStyle(col.id, HEADER_BG),
                    }}
                  >
                    <span data-colhead={col.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: meta?.sortable ? 'pointer' : 'default' }}>
                      {col.pinned && <MI name="push_pin" size={12} color="#2563EB" />}
                      {col.label}
                      {meta?.sortable && (
                        <MI name={active ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'} size={13} color={active ? '#2563EB' : '#374151'} />
                      )}
                    </span>
                    {/* Resize handle — right edge. Stop drag/sort from firing on it. */}
                    {(() => {
                      const rp = table.getResizerProps(col.id)
                      return (
                        <span
                          {...rp}
                          onMouseDown={e => { clearLocalWidth(col.id); rp.onMouseDown(e) }}
                          draggable={false}
                          onDragStart={e => e.preventDefault()}
                          onClick={e => e.stopPropagation()}
                          style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 6, cursor: 'col-resize' }}
                        />
                      )
                    })()}
                  </th>
                )
              })}
              {rowActions && (
                <th style={{ padding: headPad, fontSize: headFontSize, textAlign: 'left', fontWeight: 600, color: '#374151', position: 'sticky', top: 0, zIndex: 10, background: HEADER_BG, boxShadow: '0 1px 0 #D8DEEA' }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={totalCols} style={{ padding: 40, textAlign: 'center', color: '#374151', fontSize: 13 }}>{emptyMessage}</td></tr>
            ) : rows.map((row, idx) => {
              const isExpanded = expandedRowIds?.includes(row.id)
              const rowBg = isExpanded ? '#EFF6FF' : (idx % 2 === 0 ? '#fff' : '#FAFAFA')
              return (
                <Fragment key={row.id}>
                  <tr onClick={() => onRowClick?.(row)}
                    style={{ borderBottom: '1px solid #F3F4F6', background: rowBg, cursor: onRowClick ? 'pointer' : 'default', borderLeft: isExpanded ? '3px solid #2563EB' : '3px solid transparent' }}>
                    {selectable && (
                      <td style={{ padding: cellPad, position: 'sticky', left: 0, zIndex: 6, background: rowBg }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={table.selectedIds.includes(row.id)} onChange={() => table.toggleSelection(row.id as number)} />
                      </td>
                    )}
                    {vis.map(col => {
                      const meta = colById.get(col.id)
                      const pinned = isPinned(col.id)
                      return (
                        <td key={col.id}
                          style={{
                            padding: cellPad, textAlign: meta?.align ?? 'left', color: '#374151',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            zIndex: pinned ? 6 : undefined, ...pinStyle(col.id, rowBg),
                          }}>
                          <span data-col={col.id} style={{ display: 'block', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cell(row, col.id)}
                          </span>
                        </td>
                      )
                    })}
                    {rowActions && (
                      <td style={{ padding: cellPad, whiteSpace: 'nowrap', background: rowBg }} onClick={e => e.stopPropagation()}>
                        {rowActions(row)}
                      </td>
                    )}
                  </tr>
                  {renderRowDetails && isExpanded && (
                    <tr key={`${row.id}-details`} style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <td colSpan={totalCols} style={{ padding: '14px 20px', background: '#F8FAFC' }}>
                        {renderRowDetails(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: range + pagination */}
      {paginated && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: '#374151' }}>
          {data.length === 0 ? 'No results' : `Showing ${start} to ${end} of ${data.length} results`}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => table.prevPage()} disabled={pageIndex === 0}
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: pageIndex === 0 ? '#F9FAFB' : '#fff', cursor: pageIndex === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MI name="chevron_left" size={16} color={pageIndex === 0 ? '#D1D5DB' : '#374151'} />
          </button>
          {Array.from({ length: Math.min(5, table.totalPages) }, (_, i) => i).map(p => (
            <button key={p} onClick={() => table.setPage(p)}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: pageIndex === p ? '#2563EB' : '#fff', color: pageIndex === p ? '#fff' : '#374151', fontSize: 12, fontWeight: pageIndex === p ? 600 : 400, cursor: 'pointer' }}>
              {p + 1}
            </button>
          ))}
          <button onClick={() => table.nextPage()} disabled={pageIndex >= table.totalPages - 1}
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: pageIndex >= table.totalPages - 1 ? '#F9FAFB' : '#fff', cursor: pageIndex >= table.totalPages - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MI name="chevron_right" size={16} color={pageIndex >= table.totalPages - 1 ? '#D1D5DB' : '#374151'} />
          </button>
        </div>
      </div>
      )}

      {/* Right-click column menu: sort · autosize · pin · reset */}
      {ctx && (() => {
        const item = (icon: string, label: string, onClick: () => void, opts?: { active?: boolean; disabled?: boolean }) => (
          <button key={label} disabled={opts?.disabled}
            onClick={() => { onClick(); setCtx(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', border: 'none', borderRadius: 6, background: opts?.active ? '#EFF6FF' : 'transparent', color: opts?.disabled ? '#374151' : opts?.active ? '#2563EB' : '#374151', fontSize: 12, fontWeight: 500, cursor: opts?.disabled ? 'default' : 'pointer', textAlign: 'left' }}
            onMouseEnter={e => { if (!opts?.disabled && !opts?.active) e.currentTarget.style.background = '#F3F4F6' }}
            onMouseLeave={e => { if (!opts?.active) e.currentTarget.style.background = 'transparent' }}>
            <MI name={icon} size={14} color={opts?.disabled ? '#374151' : opts?.active ? '#2563EB' : '#374151'} />
            {label}{opts?.active ? ' ✓' : ''}
          </button>
        )
        const divider = (k: string) => <div key={k} style={{ height: 1, background: '#F3F4F6', margin: '4px 6px' }} />
        const cur = sortColumn === ctx.colId ? sortDirection : null
        // Keep the menu fully on-screen: flip up/left when it would overflow.
        const MENU_W = 200, MENU_H = 340, PAD = 8
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
        const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
        const left = Math.max(PAD, Math.min(ctx.x, vw - MENU_W - PAD))
        const top = Math.max(PAD, Math.min(ctx.y, vh - MENU_H - PAD))
        return (
          <div style={{ position: 'fixed', top, left, zIndex: 1000, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 4, minWidth: 180, maxHeight: vh - 2 * PAD, overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            {item('arrow_upward', 'Sort ascending', () => table.setSortDirection(ctx.colId, 'asc'), { active: cur === 'asc', disabled: !ctx.sortable })}
            {item('arrow_downward', 'Sort descending', () => table.setSortDirection(ctx.colId, 'desc'), { active: cur === 'desc', disabled: !ctx.sortable })}
            {divider('d1')}
            {item('width_normal', 'Autosize this column', () => autosizeColumn(ctx.colId))}
            {item('view_column', 'Autosize all columns', () => autosizeAll())}
            {divider('d2')}
            {item('push_pin', 'Pin to left', () => table.pinColumn(ctx.colId, 'left'), { active: ctx.pinned === 'left' })}
            {item('push_pin', 'Pin to right', () => table.pinColumn(ctx.colId, 'right'), { active: ctx.pinned === 'right' })}
            {item('close', 'Unpin', () => table.pinColumn(ctx.colId, null), { active: ctx.pinned === null })}
            {divider('d3')}
            {item('restart_alt', 'Reset column', () => resetColumn(ctx.colId))}
            {item('restart_alt', 'Reset all columns', () => resetAllColumns())}
          </div>
        )
      })()}
    </div>
  )
}
