'use client'
import type { RefOption } from './AdminRefShell'

// Shared editor for a SENAITE ReferenceResults DataGrid (service → expected
// result / min / max). Used by both Reference Definitions and Reference Samples
// (DRY). Controlled component: parent owns the rows array.
export type RefResultRow = { uid: string; result: string; min: string; max: string }

function MI({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function ReferenceResultsGrid({
  services, rows, onChange, error,
}: {
  services: RefOption[]
  rows: RefResultRow[]
  onChange: (rows: RefResultRow[]) => void
  error?: string
}) {
  const used = new Set(rows.map(r => r.uid))
  const available = services.filter(s => !used.has(s.uid))
  const titleOf = (uid: string) => services.find(s => s.uid === uid)?.title ?? uid

  function addRow(uid: string) {
    if (!uid) return
    onChange([...rows, { uid, result: '', min: '', max: '' }])
  }
  function setField(i: number, field: keyof RefResultRow, value: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }
  function removeRow(i: number) { onChange(rows.filter((_, idx) => idx !== i)) }

  const inp = 'px-2 py-1 text-xs rounded outline-none w-full'
  const inpStyle = { border: '1px solid #D1D5DB', color: '#111827' } as const

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Expected Results</label>
      <p className="mb-2" style={{ fontSize: 10, color: '#374151' }}>
        Expected value (and optional acceptable range) per analysis service.
      </p>

      {rows.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-2" style={{ border: '1px solid #E8EAF2' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                {['Service', 'Result', 'Min', 'Max', ''].map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left uppercase" style={{ fontSize: 9, fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.uid} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td className="px-2 py-1 text-xs" style={{ color: '#111827', maxWidth: 140 }}>{titleOf(r.uid)}</td>
                  <td className="px-1 py-1" style={{ width: 70 }}><input className={inp} style={inpStyle} value={r.result} onChange={e => setField(i, 'result', e.target.value)} /></td>
                  <td className="px-1 py-1" style={{ width: 60 }}><input className={inp} style={inpStyle} value={r.min} onChange={e => setField(i, 'min', e.target.value)} /></td>
                  <td className="px-1 py-1" style={{ width: 60 }}><input className={inp} style={inpStyle} value={r.max} onChange={e => setField(i, 'max', e.target.value)} /></td>
                  <td className="px-1 py-1" style={{ width: 28 }}>
                    <button type="button" onClick={() => removeRow(i)} className="p-1 rounded hover:bg-gray-100" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                      <MI name="close" size={13} color="#374151" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <select
        value=""
        onChange={e => addRow(e.target.value)}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ border: '1px solid #D1D5DB', color: '#111827' }}
        disabled={available.length === 0}
      >
        <option value="">{available.length === 0 ? (services.length === 0 ? 'No analysis services available' : 'All services added') : '+ Add analysis service…'}</option>
        {available.map(s => <option key={s.uid} value={s.uid}>{s.title}</option>)}
      </select>
      {error && <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  )
}
