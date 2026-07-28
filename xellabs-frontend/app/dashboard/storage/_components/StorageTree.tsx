'use client'
import { useState } from 'react'
import type { StorageLocation } from '@/app/actions/storage'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export type StorageNode = StorageLocation & { children: StorageNode[] }

export function buildTree(locations: StorageLocation[]): StorageNode[] {
  // box_location slots are shown in the slot grid, not the tree
  const treeLocations = locations.filter(l => l.location_type !== 'box_location')
  const map = new Map<number, StorageNode>()
  treeLocations.forEach(l => map.set(l.id, { ...l, children: [] }))
  const roots: StorageNode[] = []
  map.forEach(node => {
    if (node.parent === null) {
      roots.push(node)
    } else {
      const parent = map.get(node.parent)
      if (parent) parent.children.push(node)
      else roots.push(node) // orphan — treat as root
    }
  })
  return roots
}

const TYPE_ICONS: Record<string, string> = {
  building:     'apartment',
  room:         'meeting_room',
  fridge:       'thermostat',
  freezer:      'ac_unit',
  cabinet:      'inventory_2',
  shelf:        'view_agenda',
  box:          'grid_view',
  box_location: 'grid_on',
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  onAddChild,
}: {
  node: StorageNode
  depth: number
  selectedId: number | null
  onSelect: (id: number) => void
  onAddChild: (parentId: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0
  const icon = TYPE_ICONS[node.location_type] ?? 'place'
  // For boxes: show slot capacity (rows × columns) not children count
  const slotCount = (node.location_type === 'box' && node.rows && node.columns)
    ? node.rows * node.columns
    : null

  return (
    <div>
      <div
        className="flex items-center gap-1 group"
        style={{
          paddingLeft: 12 + depth * 16,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 5,
          cursor: 'pointer',
          borderLeft: isSelected ? '2px solid #0154FC' : '2px solid transparent',
          backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
          borderRadius: '0 6px 6px 0',
        }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {hasChildren
            ? <MI name={expanded ? 'expand_more' : 'chevron_right'} size={14} color={isSelected ? '#0154FC' : '#374151'} />
            : <span style={{ width: 14 }} />
          }
        </button>

        {/* Type icon */}
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6' }}>
          <MI name={icon} size={12} color={isSelected ? '#0154FC' : '#374151'} />
        </div>

        {/* Name */}
        <span className="flex-1 text-xs truncate"
          style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? '#0154FC' : '#374151' }}>
          {node.name}
        </span>

        {/* Child count badge */}
        {(node.children.length > 0 || slotCount !== null) && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6',
              color: isSelected ? '#0154FC' : '#374151',
              fontSize: 10,
            }}
          >
            {slotCount !== null ? slotCount : node.children.length}
          </span>
        )}

        {/* Add child button — shows on hover */}
        <button
          onClick={e => { e.stopPropagation(); onAddChild(node.id) }}
          className="opacity-0 group-hover:opacity-100"
          title="Add child location"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', borderRadius: 4, flexShrink: 0 }}
        >
          <MI name="add" size={13} color="#374151" />
        </button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function StorageTree({
  locations,
  selectedId,
  onSelect,
  onAddChild,
  onAddRoot,
}: {
  locations: StorageLocation[]
  selectedId: number | null
  onSelect: (id: number) => void
  onAddChild: (parentId: number) => void
  onAddRoot: () => void
}) {
  const tree = buildTree(locations)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tree header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#374151', letterSpacing: '0.05em' }}>
          Locations
        </span>
        <button
          onClick={onAddRoot}
          title="New top-level location"
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
          style={{ backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          <MI name="add" size={13} color="#fff" />
          New
        </button>
      </div>

      {/* Tree body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <MI name="storage" size={28} color="#D1D5DB" />
            <p className="mt-2 text-xs" style={{ color: '#374151' }}>No locations yet</p>
            <button
              onClick={onAddRoot}
              className="mt-2 text-xs font-medium"
              style={{ color: '#0154FC', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              + Add first location
            </button>
          </div>
        ) : (
          tree.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid #F3F4F6' }}>
        {(() => { const n = locations.filter(l => l.location_type !== 'box_location').length; return <p style={{ fontSize: 12, color: '#1F2937', fontWeight: 500 }}>{n} location{n !== 1 ? 's' : ''}</p> })()}
      </div>
    </div>
  )
}
