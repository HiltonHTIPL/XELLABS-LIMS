'use client'
import { useRef, useState, useTransition } from 'react'
import { bulkDisposeSamples } from '@/app/actions/lab-samples'

const BASIS_PRESETS = [
  '40 CFR Part 261 — hazardous waste disposal after retention period',
  'State environmental retention schedule — sample discarded after due date',
  'Client disposal authorization — return / destroy after analysis complete',
]

type Props = {
  sampleIds: number[]
  onClose: () => void
  onDisposed: (disposedIds: number[], skipped: { id: number; reason: string }[]) => void
}

export default function BulkDisposeSampleModal({ sampleIds, onClose, onDisposed }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [basis, setBasis] = useState(BASIS_PRESETS[0])
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function submit() {
    const regulatory = basis.trim()
    if (!regulatory) {
      setError('Enter a regulatory basis for disposal.')
      return
    }
    setError(null)
    const fd = new FormData()
    fd.append('regulatory_basis', regulatory)
    if (notes.trim()) fd.append('notes', notes.trim())
    if (file) fd.append('attachment', file)
    startTransition(async () => {
      const r = await bulkDisposeSamples(sampleIds, fd)
      if (!r.ok) {
        setError(r.message ?? 'Bulk disposal failed.')
        return
      }
      onDisposed(r.disposed_ids ?? [], r.skipped ?? [])
      onClose()
    })
  }

  return (
    <div style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.40)' }} />
      <div style={{ position: 'relative', width: 480, maxWidth: '94vw', backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', padding: 22 }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FEF2F2' }}>
            <span className="material-icons" style={{ fontSize: 18, color: '#DC2626' }}>delete_forever</span>
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Dispose Selected Samples</h3>
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '4px 0 0' }}>
              <strong>{sampleIds.length} sample(s)</strong> selected for disposal. Record the compliance basis and optional certificate.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
            {error}
          </div>
        )}

        <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          Regulatory basis <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <select
          value={BASIS_PRESETS.includes(basis) ? basis : '__custom__'}
          onChange={e => {
            if (e.target.value === '__custom__') setBasis('')
            else setBasis(e.target.value)
          }}
          className="w-full mb-2 px-3 py-2 text-xs rounded-lg outline-none"
          style={{ border: '1px solid #D1D5DB', color: '#111827', background: '#fff' }}
        >
          {BASIS_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">Custom basis…</option>
        </select>
        <textarea
          value={basis}
          onChange={e => setBasis(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="e.g. 40 CFR Part 261 — disposed after retention period"
          className="w-full mb-3 px-3 py-2 text-xs rounded-lg outline-none"
          style={{ border: '1px solid #D1D5DB', color: '#111827', resize: 'vertical' }}
        />

        <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Additional notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value.slice(0, 1000))}
          rows={2}
          placeholder="Manifest reference, destruction method, waste carrier..."
          className="w-full mb-3 px-3 py-2 text-xs rounded-lg outline-none"
          style={{ border: '1px solid #D1D5DB', color: '#111827', resize: 'vertical' }}
        />

        <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Certificate of destruction (optional)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="w-full mb-4 text-xs"
        />

        <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{ border: '1px solid #D1D5DB', background: '#fff', color: '#374151' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ background: '#DC2626', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Disposing…' : `Dispose ${sampleIds.length} Sample(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
