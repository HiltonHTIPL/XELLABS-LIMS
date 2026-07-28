'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getBatchWorksheetPreview, createWorksheetsForBatch, type BatchWorksheetGroup, type BatchWorksheetResult } from '@/app/actions/batch-worksheets'
import { getLabAnalysts } from '@/app/actions/senaite-worksheets'
import type { LabAnalyst } from '@/app/lib/senaite-worksheets'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type Step = 'loading' | 'preview' | 'creating' | 'done'

export default function BatchWorksheetWizard({ batchUid, onClose }: { batchUid: string; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [groups, setGroups] = useState<BatchWorksheetGroup[]>([])
  const [analysts, setAnalysts] = useState<LabAnalyst[]>([])
  const [analystId, setAnalystId] = useState('')
  const [results, setResults] = useState<BatchWorksheetResult[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getBatchWorksheetPreview(batchUid), getLabAnalysts()]).then(([g, a]) => {
      if (!active) return
      setGroups(g)
      setAnalysts(a)
      setStep('preview')
    })
    return () => { active = false }
  }, [batchUid])

  async function handleCreate() {
    setStep('creating')
    setError('')
    const outcome = await createWorksheetsForBatch(batchUid, analystId)
    setResults(outcome.results)
    if (outcome.results.length === 0) { setError(outcome.message); setStep('preview'); return }
    setStep('done')
    router.refresh()
  }

  const totalAnalyses = groups.reduce((sum, g) => sum + g.analysisCount, 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 'var(--dashboard-header-h)', bottom: 'var(--dashboard-footer-h)', left: 0, right: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 640, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Create Worksheet{groups.length === 1 ? '' : 's'} from Batch</h2>
            <p style={{ fontSize: 11, color: '#374151' }}>One worksheet per distinct analysis requested across this batch&apos;s samples</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <MI name="close" size={16} color="#374151" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {step === 'loading' && (
            <div className="flex items-center justify-center py-10">
              <p style={{ fontSize: 12, color: '#374151' }}>Scanning batch samples for requested analyses…</p>
            </div>
          )}

          {step === 'preview' && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10">
              <MI name="science" size={28} color="#D1D5DB" />
              <p className="mt-2 text-sm" style={{ color: '#374151' }}>No addable analyses found</p>
              <p className="text-xs mt-0.5 text-center" style={{ color: '#374151' }}>Every analysis in this batch is already on a worksheet or past that stage.</p>
            </div>
          )}

          {step === 'preview' && groups.length > 0 && (
            <>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                {groups.length} worksheet{groups.length === 1 ? '' : 's'} will be created ({totalAnalyses} analyses total)
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {['Analysis', 'Samples', 'Analyses'].map(h => (
                      <th key={h} className="px-2 py-2 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.keyword} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td className="px-2 py-2 text-xs font-medium" style={{ color: '#111827' }}>{g.serviceTitle}</td>
                      <td className="px-2 py-2 text-xs" style={{ color: '#374151' }}>{g.sampleCount}</td>
                      <td className="px-2 py-2 text-xs" style={{ color: '#374151' }}>{g.analysisCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <label style={{ fontSize: 11, fontWeight: 600, color: '#111827', display: 'block', marginBottom: 4 }}>Analyst</label>
              <select
                value={analystId}
                onChange={e => setAnalystId(e.target.value)}
                className="text-xs rounded outline-none w-full"
                style={{ border: '1px solid #D1D5DB', padding: '7px 10px' }}
              >
                <option value="">Unassigned</option>
                {analysts.map(a => <option key={a.id} value={a.id}>{a.fullname}</option>)}
              </select>
              <p style={{ fontSize: 10, color: '#374151', marginTop: 6 }}>
                Instrument, Method and QC are auto-mapped per analysis where a default/matching QC material is configured — check each worksheet afterward if a mapping was skipped.
              </p>

              {error && (
                <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>{error}</div>
              )}
            </>
          )}

          {step === 'creating' && (
            <div className="flex items-center justify-center py-10">
              <p style={{ fontSize: 12, color: '#374151' }}>Creating worksheets…</p>
            </div>
          )}

          {step === 'done' && (
            <>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
                {results.filter(r => r.success).length} of {results.length} worksheet{results.length === 1 ? '' : 's'} created
              </p>
              <div className="flex flex-col gap-2">
                {results.map(r => (
                  <div key={r.keyword} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ border: '1px solid #F3F4F6', backgroundColor: r.success ? '#F9FAFB' : '#FEF2F2' }}>
                    <MI name={r.success ? 'check_circle' : 'error'} size={15} color={r.success ? '#15803D' : '#DC2626'} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                        {r.serviceTitle}
                        {r.success && r.worksheetId && (
                          <Link href={`/dashboard/worksheets/${r.worksheetId}`} className="ml-2 hover:underline" style={{ color: '#2563EB', fontWeight: 600 }}>
                            {r.worksheetId} →
                          </Link>
                        )}
                      </div>
                      {r.success && <div style={{ fontSize: 11, color: '#374151' }}>{r.analysisCount} analyses added{r.qcAdded ? ' · QC added' : ''}</div>}
                      {r.warning && <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>{r.warning}</div>}
                      {r.error && <div style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>{r.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
          {step === 'preview' && (
            <>
              <button onClick={onClose} style={{ fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 8, border: '1px solid #E8EAF2', color: '#374151', backgroundColor: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={groups.length === 0}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: groups.length === 0 ? 'not-allowed' : 'pointer', opacity: groups.length === 0 ? 0.6 : 1 }}>
                Create {groups.length || ''} Worksheet{groups.length === 1 ? '' : 's'}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8, backgroundColor: '#0154FC', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
