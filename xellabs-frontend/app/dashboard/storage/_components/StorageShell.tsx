'use client'
import { useState, useCallback } from 'react'
import { deleteStorageLocation, getStorageLocations, type StorageLocation } from '@/app/actions/storage'
import StorageTree from './StorageTree'
import StorageDetail from './StorageDetail'
import StorageModal from './StorageModal'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function StorageShell({ initialLocations }: { initialLocations: StorageLocation[] }) {
  const [locations, setLocations] = useState<StorageLocation[]>(initialLocations)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modal, setModal] = useState<{ editing: StorageLocation | null; defaultParentId?: number | null } | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const selected = locations.find(l => l.id === selectedId) ?? null

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const refreshLocations = useCallback(async () => {
    const fresh = await getStorageLocations()
    setLocations(fresh)
  }, [])

  async function handleDone(msg: string) {
    showToast(true, msg)
    await refreshLocations()
  }

  async function handleDelete(id: number) {
    const result = await deleteStorageLocation(id)
    showToast(result.success, result.message)
    if (result.success) {
      if (selectedId === id) setSelectedId(null)
      await refreshLocations()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F5F6FA' }}>
      {/* Page header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#111827' }}>Storage Management</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Manage laboratory storage locations and their contents</p>
        </div>
        <button
          onClick={() => setModal({ editing: null, defaultParentId: null })}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ backgroundColor: '#0154FC', border: 'none', cursor: 'pointer' }}
        >
          <MI name="add" size={15} color="#fff" />
          New Location
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: toast.ok ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`,
            color: toast.ok ? '#065F46' : '#991B1B',
          }}>
          <MI name={toast.ok ? 'check_circle' : 'error'} size={13} color={toast.ok ? '#10B981' : '#DC2626'} />
          {toast.msg}
        </div>
      )}

      {/* Split explorer */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', margin: '12px 20px 20px', gap: 12 }}>
        {/* Left tree panel */}
        <div style={{ width: 280, flexShrink: 0, backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <StorageTree
            locations={locations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddChild={(parentId) => setModal({ editing: null, defaultParentId: parentId })}
            onAddRoot={() => setModal({ editing: null, defaultParentId: null })}
          />
        </div>

        {/* Right detail panel */}
        <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex' }}>
          <StorageDetail
            location={selected}
            allLocations={locations}
            onEdit={(loc) => setModal({ editing: loc })}
            onDelete={handleDelete}
            onSelectChild={setSelectedId}
            onAssigned={async (msg) => { showToast(true, msg); await refreshLocations() }}
          />
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <StorageModal
          editing={modal.editing}
          defaultParentId={modal.defaultParentId}
          allLocations={locations}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
