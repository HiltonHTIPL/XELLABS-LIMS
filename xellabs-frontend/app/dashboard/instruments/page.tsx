import Link from 'next/link'
import { T } from '../_components/tokens'

const CARDS = [
  {
    href: '/dashboard/instruments/import',
    icon: 'upload_file',
    title: 'Import Instrument Results',
    body: 'Upload a CSV or XML instrument export, preview how each row maps to a sample and test, then commit. The original file is retained as the backup of record.',
  },
  {
    href: '/dashboard/instruments/report',
    icon: 'summarize',
    title: 'Multi-Instrument Sample Report',
    body: 'Pull every result for a sample across all instruments into one printable report, with the source instrument and import date shown per result.',
  },
]

export default function InstrumentsPage() {
  return (
    <div style={{ padding: 20, backgroundColor: T.pageBg, minHeight: '100%' }}>
      <div className="mb-5">
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.heading, letterSpacing: '-0.02em' }}>Instruments</h1>
        <p className="mt-1" style={{ fontSize: 13, color: T.muted }}>
          Back up instrument data into sample records and consolidate results across instruments.
        </p>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {CARDS.map(c => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="bg-white h-full" style={{ border: `1px solid ${T.cardBorder}`, borderRadius: T.cardRadius, boxShadow: T.cardShadow, padding: 20 }}>
              <div className="flex items-center justify-center mb-3" style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF' }}>
                <span className="material-icons" style={{ fontSize: 22, color: T.primary }}>{c.icon}</span>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: T.heading }}>{c.title}</h2>
              <p className="mt-1.5" style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>{c.body}</p>
              <span className="inline-flex items-center gap-1 mt-3" style={{ fontSize: 13, fontWeight: 600, color: T.primary }}>
                Open <span className="material-icons" style={{ fontSize: 16, color: T.primary }}>arrow_forward</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
