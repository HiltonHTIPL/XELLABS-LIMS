import { getSenaiteWorksheetDetailById } from '@/app/actions/senaite-worksheets'
import PrintTrigger from './PrintTrigger'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { a: 'Analysis', b: 'Blank', c: 'Control', d: 'Duplicate' }

function fmt(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${M[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export default async function WorksheetPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ws = await getSenaiteWorksheetDetailById(id)
  if (!ws) return <div style={{ padding: 40 }}>Worksheet not found</div>

  const slots = [...ws.slots].sort((a, b) => a.position - b.position)

  return (
    <div className="ws-print" style={{ padding: '32px 40px', color: '#111827', fontFamily: 'Arial, sans-serif', background: '#fff', maxWidth: 900, margin: '0 auto' }}>
      {/* Hide the dashboard chrome (sidebar/nav) when printing — only this COA prints. */}
      <style>{`@media print { body * { visibility: hidden !important; } .ws-print, .ws-print * { visibility: visible !important; } .ws-print { position: absolute !important; left: 0; top: 0; width: 100%; padding: 0 !important; } }`}</style>
      <PrintTrigger />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #14265E', paddingBottom: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#14265E', margin: 0 }}>XelLabs LIMS</h1>
          <p style={{ fontSize: 12, color: '#374151', margin: '2px 0 0' }}>Worksheet — {ws.id}</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#374151' }}>
          <div>Status: <strong>{ws.reviewState}</strong></div>
          <div>Created: {fmt(ws.created)}</div>
        </div>
      </div>

      <table style={{ width: '100%', fontSize: 12, marginBottom: 20, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '3px 8px', color: '#374151', width: 120 }}>Analyst</td><td style={{ padding: '3px 8px' }}>{ws.analyst || '—'}</td>
            <td style={{ padding: '3px 8px', color: '#374151', width: 120 }}>Instrument</td><td style={{ padding: '3px 8px' }}>{ws.instrumentTitle || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 8px', color: '#374151' }}>Method</td><td style={{ padding: '3px 8px' }}>{ws.methodTitle || '—'}</td>
            <td style={{ padding: '3px 8px', color: '#374151' }}>Template</td><td style={{ padding: '3px 8px' }}>{ws.templateTitle || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 8px', color: '#374151' }}>Routine / QC</td><td style={{ padding: '3px 8px' }}>{ws.numRegularAnalyses} / {ws.numQcAnalyses}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            {['Pos', 'Type', 'Analysis', 'Sample', 'Result', 'State'].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #D1D5DB', fontSize: 11, textTransform: 'uppercase', color: '#374151' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '6px 8px' }}>{s.position}</td>
              <td style={{ padding: '6px 8px' }}>{TYPE_LABEL[s.type] ?? s.type}</td>
              <td style={{ padding: '6px 8px' }}>{s.analysis?.title ?? '—'}</td>
              <td style={{ padding: '6px 8px' }}>{s.analysis?.sampleId ?? '—'}</td>
              <td style={{ padding: '6px 8px' }}>{s.analysis?.result || '—'}</td>
              <td style={{ padding: '6px 8px' }}>{s.analysis?.reviewState ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151' }}>
        <div style={{ borderTop: '1px solid #374151', paddingTop: 4, width: 200 }}>Analyst signature</div>
        <div style={{ borderTop: '1px solid #374151', paddingTop: 4, width: 200 }}>Reviewer signature</div>
      </div>
    </div>
  )
}
