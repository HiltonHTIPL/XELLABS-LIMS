'use client'
import { useState } from 'react'
import {
  NamedRefSlide,
  type SelectOrAddItem,
  type CreateNamedResult,
} from './SelectOrAddField'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type Props = {
  tip?: string
  items: SelectOrAddItem[]
  selectedIds: number[]
  onToggle: (id: number) => void
  onItemsChange: (items: SelectOrAddItem[]) => void
  createAction: (name: string, description: string, extras?: Record<string, string>) => Promise<CreateNamedResult>
  error?: string
}

/** Multi-select methods using the shared NamedRefSlide for choose/create. */
export default function MethodsSelectOrAdd({
  tip, items, selectedIds, onToggle, onItemsChange, createAction, error,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Supported methods</label>
      {tip && <p style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>{tip}</p>}
      <div className="rounded-lg p-2 max-h-36 overflow-y-auto mb-2" style={{ border: `1px solid ${error ? '#EF4444' : '#D1D5DB'}` }}>
        {items.length === 0 && (
          <p style={{ fontSize: 11, color: '#374151' }}>No methods yet. Add one below.</p>
        )}
        {items.map(m => (
          <label key={m.id} className="flex items-center gap-2 py-1 text-xs" style={{ color: '#374151' }}>
            <input type="checkbox" checked={selectedIds.includes(m.id)} onChange={() => onToggle(m.id)} />
            {m.name}{m.code ? ` (${m.code})` : ''}
          </label>
        ))}
      </div>
      {error && <p className="mb-2 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium"
        style={{ color: '#0154FC', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <MI name="add" size={14} color="#0154FC" />
        Add method…
      </button>

      <NamedRefSlide
        open={open}
        onClose={() => setOpen(false)}
        entityLabel="Method"
        items={items}
        selectedIds={selectedIds.map(String)}
        onPickExisting={id => {
          const num = Number(id)
          if (!selectedIds.includes(num)) onToggle(num)
        }}
        createAction={createAction}
        onCreated={item => {
          onItemsChange([...items, item].sort((a, b) => a.name.localeCompare(b.name)))
          if (!selectedIds.includes(item.id)) onToggle(item.id)
        }}
        extraFields={[
          { key: 'code', label: 'Code', required: true, placeholder: 'e.g. EPA-200.8' },
        ]}
        zIndex={420}
      />
    </div>
  )
}
