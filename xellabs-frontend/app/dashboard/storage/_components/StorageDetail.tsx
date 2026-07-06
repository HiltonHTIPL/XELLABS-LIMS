'use client'
import { useState } from 'react'
import type { StorageLocation } from '@/app/actions/storage'
import SlotGrid from './SlotGrid'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const TYPE_ICONS: Record<string, string> = {
  room:         'meeting_room',
  fridge:       'thermostat',
  freezer:      'ac_unit',
  cabinet:      'inventory_2',
  shelf:        'view_agenda',
  box:          'grid_view',
  box_location: 'grid_on',
}

const TYPE_LABELS: Record<string, string> = {
  room:         'Room',
  fridge:       'Refrigerator',
  freezer:      'Freezer',
  cabinet:      'Cabinet',
  shelf:        'Shelf',
  box:          'Box',
  box_location: 'Slot',
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2" style={{ borderBottom: '1px solid #F9FAFB' }}>
      <span className="text-xs w-32 shrink-0" style={{ color: '#9CA3AF' }}>{label}</span>
      <span className="text-xs" style={{ color: '#111827' }}>{value || '—'}</span>
    </div>
  )
}

export default function StorageDetail({
  location,
  allLocations,
  onEdit,
  onDelete,
  onSelectChild,
  onAssigned,
}: {
  location: StorageLocation | null
  allLocations: StorageLocation[]
  onEdit: (loc: StorageLocation) => void
  onDelete: (id: number) => void
  onSelectChild: (id: number) => void
  onAssigned: (msg: string) => void
}) {
  const [tab, setTab] = useState<'sublocations' | 'info'>('sublocations')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!location) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <MI name="storage" size={40} color="#D1D5DB" />
        <p className="mt-3 text-sm font-medium" style={{ color: '#6B7280' }}>Select a location</p>
        <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Choose a storage location from the tree to view details</p>
      </div>
    )
  }

  const children = allLocations.filter(l => l.parent === location.id)
  const parent = location.parent ? allLocations.find(l => l.id === location.parent) : null
  const icon = TYPE_ICONS[location.location_type] ?? 'place'
  const typeLabel = TYPE_LABELS[location.location_type] ?? location.location_type

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#F9FAFB', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 20px' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#EFF6FF' }}>
              <MI name={icon} size={20} color="#0154FC" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#111827' }}>{location.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: '#EFF6FF', color: '#0154FC' }}>
                  {typeLabel}
                </span>
                {location.temperature && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                    <MI name="thermostat" size={13} color="#6B7280" />
                    {location.temperature}
                  </span>
                )}
                {parent && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                    <MI name="subdirectory_arrow_right" size={13} color="#9CA3AF" />
                    {parent.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(location)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
            >
              <MI name="edit" size={13} color="#374151" />
              Edit
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ border: '1px solid #FECACA', color: '#DC2626', backgroundColor: '#FEF2F2', cursor: 'pointer' }}
              >
                <MI name="delete" size={13} color="#DC2626" />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: '#DC2626' }}>Confirm?</span>
                <button
                  onClick={() => { onDelete(location.id); setConfirmDelete(false) }}
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{ backgroundColor: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ border: '1px solid #E5E7EB', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', paddingLeft: 20 }}>
        <div className="flex gap-1">
          {([['sublocations', 'Sub-locations', children.length], ['info', 'Info', null]] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2.5"
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === key ? '2px solid #0154FC' : '2px solid transparent',
                color: tab === key ? '#0154FC' : '#6B7280',
              }}
            >
              {label}
              {count !== null && count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: tab === key ? '#EFF6FF' : '#F3F4F6', color: tab === key ? '#0154FC' : '#6B7280', fontSize: 10 }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {tab === 'sublocations' && (
          location.location_type === 'box' ? (
            <SlotGrid
              box={location}
              allLocations={allLocations}
              onAssigned={onAssigned}
            />
          ) : (
            <>
              {children.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MI name="inbox" size={32} color="#D1D5DB" />
                  <p className="mt-2 text-sm" style={{ color: '#9CA3AF' }}>No sub-locations</p>
                </div>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                  {children.map(child => {
                    const childIcon = TYPE_ICONS[child.location_type] ?? 'place'
                    const childLabel = TYPE_LABELS[child.location_type] ?? child.location_type
                    const grandchildren = allLocations.filter(l => l.parent === child.id).length
                    return (
                      <button
                        key={child.id}
                        onClick={() => onSelectChild(child.id)}
                        className="text-left p-3 rounded-xl"
                        style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', cursor: 'pointer' }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: '#EFF6FF' }}>
                            <MI name={childIcon} size={14} color="#0154FC" />
                          </div>
                          <span className="text-xs font-semibold truncate" style={{ color: '#111827' }}>{child.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>{childLabel}</span>
                          {grandchildren > 0 && (
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>{grandchildren} inside</span>
                          )}
                        </div>
                        {child.temperature && (
                          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{child.temperature}</p>
                        )}
                        {child.location_type === 'box' && child.rows && child.columns && (
                          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{child.rows}×{child.columns} slots</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )
        )}

        {tab === 'info' && (
          <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E5E7EB' }}>
            <InfoRow label="Name" value={location.name} />
            <InfoRow label="Type" value={typeLabel} />
            <InfoRow label="Parent" value={parent?.name ?? 'None (top level)'} />
            <InfoRow label="Temperature" value={location.temperature} />
            <InfoRow label="Notes" value={location.notes} />
            <InfoRow label="ID" value={String(location.id)} />
            {location.location_type === 'box' && location.rows && location.columns && (
              <InfoRow label="Grid Size" value={`${location.rows} rows × ${location.columns} columns (${location.rows * location.columns} slots)`} />
            )}
            {location.slot_id && <InfoRow label="Slot ID" value={location.slot_id} />}
          </div>
        )}
      </div>
    </div>
  )
}
