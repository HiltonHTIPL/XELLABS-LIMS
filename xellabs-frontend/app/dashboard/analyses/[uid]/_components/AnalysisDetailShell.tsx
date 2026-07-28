'use client'
import { useState } from 'react'
import Link from 'next/link'
import { exportRowsToCsv } from '@/app/lib/exportCsv'
import { AuditEventsTable } from '@/app/dashboard/audit-trail/_components/AuditTrailShell'
import type { AuditEvent } from '@/app/actions/audit-trail'
import type { SenaiteAnalysisService, SenaiteInstrument, SenaiteCalculation } from '@/app/lib/senaite'
import type { SenaiteMethodRow } from '@/app/actions/senaite-methods'
import type { SpecificationRow } from '@/app/actions/specifications'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

const TABS = ['Overview', 'Calculations', 'Specifications', 'Instruments', 'Results Variables', 'Audit Trail'] as const
type Tab = typeof TABS[number]

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid #F9FAFB' }}>
      <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#111827', fontWeight: 500, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #E8EAF2' }}>
      <h3 className="text-xs font-semibold mb-2" style={{ color: '#111827' }}>{title}</h3>
      {children}
    </div>
  )
}

function yesNo(v: boolean) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: v ? '#0154FC' : '#6B7280' }}>
      <MI name={v ? 'check_circle' : 'cancel'} size={13} color={v ? '#0154FC' : '#9CA3AF'} /> {v ? 'Yes' : 'No'}
    </span>
  )
}

function timeLabel(days: string, hours: string, minutes: string) {
  const d = Number(days) || 0, h = Number(hours) || 0, m = Number(minutes) || 0
  return `${d} Days ${h} Hours ${m} Minutes`
}

export default function AnalysisDetailShell({
  service, methods, instruments, calculations, specRows, auditEvents,
}: {
  service: SenaiteAnalysisService
  methods: SenaiteMethodRow[]
  instruments: SenaiteInstrument[]
  calculations: SenaiteCalculation[]
  specRows: (SpecificationRow & { specTitle: string; isActive: boolean })[]
  auditEvents: AuditEvent[]
}) {
  const [tab, setTab] = useState<Tab>('Overview')

  const calculation = calculations.find(c => c.uid === service.CalculationUid)
  const supportedInstruments = instruments.filter(i => service.InstrumentUids.includes(i.uid))
  const defaultInstrument = instruments.find(i => i.uid === service.DefaultInstrumentUid)
  const supportedMethods = methods.filter(m => service.MethodUids.includes(m.uid))
  const defaultMethod = methods.find(m => m.uid === service.DefaultMethodUid)

  function handleExport() {
    exportRowsToCsv(
      [
        { key: 'field', label: 'Field' },
        { key: 'value', label: 'Value' },
      ],
      [
        { field: 'Title', value: service.title },
        { field: 'Short title', value: service.ShortTitle },
        { field: 'Sort Key', value: service.SortKey },
        { field: 'Commercial ID', value: service.CommercialID },
        { field: 'Protocol ID', value: service.ProtocolID },
        { field: 'Scientific name', value: service.ScientificName ? 'Yes' : 'No' },
        { field: 'Default Unit', value: service.Unit },
        { field: 'Units for Selection', value: service.UnitChoices.join(', ') },
        { field: 'Analysis Keyword', value: service.Keyword },
        { field: 'Accredited', value: service.Accredited ? 'Yes' : 'No' },
        { field: 'Point of Capture', value: service.PointOfCapture },
        { field: 'Analysis Category', value: service.Category },
        { field: 'Price (excluding VAT)', value: service.Price },
        { field: 'Bulk price (excluding VAT)', value: service.BulkPrice },
        { field: 'VAT %', value: service.VAT },
        { field: 'Department', value: service.DepartmentUid ? service.DepartmentUid : '' },
        { field: 'Remarks', value: service.Remarks },
        { field: 'Result type', value: service.ResultType },
        { field: 'Default result', value: service.DefaultResult },
        { field: 'Precision', value: service.Precision },
        { field: 'Exponential format precision', value: service.ExponentialFormatPrecision },
        { field: 'Lower Limit of Detection (LLOD)', value: service.LowerDetectionLimit },
        { field: 'Lower Limit Of Quantification (LLOQ)', value: service.LowerLimitOfQuantification },
        { field: 'Upper Limit Of Quantification (ULOQ)', value: service.UpperLimitOfQuantification },
        { field: 'Upper Limit of Detection (ULOD)', value: service.UpperDetectionLimit },
        { field: 'Maximum turn-around time', value: timeLabel(service.MaxTimeAllowedDays, service.MaxTimeAllowedHours, service.MaxTimeAllowedMinutes) },
        { field: 'Maximum holding time', value: timeLabel(service.MaxHoldingTimeDays, service.MaxHoldingTimeHours, service.MaxHoldingTimeMinutes) },
        { field: 'Duplicate Variation %', value: service.DuplicateVariation },
        { field: 'Hidden', value: service.Hidden ? 'Yes' : 'No' },
        { field: 'Self-verification of results', value: service.SelfVerification },
        { field: 'Number of required verifications', value: service.NumberOfRequiredVerifications },
        { field: 'Methods', value: supportedMethods.map(m => m.title).join(', ') },
        { field: 'Default Method', value: defaultMethod?.title ?? '' },
        { field: 'Instruments', value: supportedInstruments.map(i => i.title).join(', ') },
        { field: 'Default Instrument', value: defaultInstrument?.title ?? '' },
        { field: 'Calculation', value: calculation?.title ?? '' },
      ],
      `analysis-${service.Keyword || service.uid}`,
    )
  }

  return (
    <div className="print-page" style={{ padding: 20, backgroundColor: '#F7F8FC', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @media print {
          .noprint { display: none !important; }
          .print-page { height: auto !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
        }
      `}</style>

      <div className="flex items-center gap-1.5 mb-2 noprint" style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>
        <Link href="/dashboard/analyses" style={{ color: '#0154FC' }}>Analyses</Link>
        <MI name="chevron_right" size={14} color="#9CA3AF" />
        <span>View Analysis</span>
      </div>

      <div className="flex items-center justify-between mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/analyses" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0 noprint" style={{ border: '1px solid #E8EAF2' }}>
            <MI name="arrow_back" size={16} color="#374151" />
          </Link>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
            <MI name="biotech" size={20} color="#0154FC" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#14265E', letterSpacing: '-0.02em' }}>{service.title}</h1>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>{service.Category || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 noprint">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: '#374151', border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
            <MI name="download" size={15} color="#374151" /> Export
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: '#374151', border: '1px solid #D1D5DB', backgroundColor: '#fff' }}>
            <MI name="print" size={15} color="#374151" /> Print
          </button>
          <Link href={`/dashboard/analyses?edit=${service.uid}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#0154FC' }}>
            <MI name="edit" size={15} color="#fff" /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3 noprint" style={{ flexShrink: 0 }}>
        <div className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8EAF2' }}>
          <p style={{ fontSize: 10, color: '#6B7280' }}>Keyword</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }} className="font-mono">{service.Keyword || '—'}</p>
        </div>
        <div className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8EAF2' }}>
          <p style={{ fontSize: 10, color: '#6B7280' }}>Status</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: service.review_state === 'active' ? '#DBEAFE' : '#F3F4F6', color: service.review_state === 'active' ? '#0154FC' : '#6B7280' }}>
            {service.review_state === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8EAF2' }}>
          <p style={{ fontSize: 10, color: '#6B7280' }}>Unit</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{service.Unit || '—'}</p>
        </div>
        <div className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8EAF2' }}>
          <p style={{ fontSize: 10, color: '#6B7280' }}>Price</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{service.Price && service.Price !== '0.00' ? service.Price : '—'}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3 noprint" style={{ borderBottom: '1px solid #E8EAF2', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-3 py-2 text-xs font-medium whitespace-nowrap"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: tab === t ? '#0154FC' : '#374151', borderBottom: tab === t ? '2px solid #0154FC' : '2px solid transparent' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {tab === 'Overview' && (
          <div className="grid grid-cols-2 gap-3">
            <Panel title="General Information">
              <InfoRow label="Short title" value={service.ShortTitle} />
              <InfoRow label="Sort Key" value={service.SortKey} />
              <InfoRow label="Commercial ID" value={service.CommercialID} />
              <InfoRow label="Protocol ID" value={service.ProtocolID} />
              <InfoRow label="Scientific name" value={yesNo(service.ScientificName)} />
              <InfoRow label="Default Unit" value={service.Unit} />
              <InfoRow label="Units for Selection" value={service.UnitChoices.join(', ')} />
              <InfoRow label="Precision as number of decimals" value={service.Precision} />
              <InfoRow label="Exponential format precision" value={service.ExponentialFormatPrecision} />
              <InfoRow label="Lower Limit of Detection (LLOD)" value={service.LowerDetectionLimit} />
              <InfoRow label="Lower Limit Of Quantification (LLOQ)" value={service.LowerLimitOfQuantification} />
              <InfoRow label="Upper Limit Of Quantification (ULOQ)" value={service.UpperLimitOfQuantification} />
              <InfoRow label="Upper Limit of Detection (ULOD)" value={service.UpperDetectionLimit} />
              <InfoRow label="Display a Detection Limit selector" value={yesNo(service.DetectionLimitSelector)} />
              <InfoRow label="Allow Manual Detection Limit input" value={yesNo(service.AllowManualDetectionLimit)} />
              <InfoRow label="Attachment required for verification" value={yesNo(service.AttachmentRequired)} />
            </Panel>
            <Panel title="Methods &amp; Instrument">
              <InfoRow label="Result type" value={service.ResultType} />
              <InfoRow label="Default result" value={service.DefaultResult} />
              <InfoRow label="Sorting criteria" value="By Display Order ascending" />
              <InfoRow label="Hidden" value={yesNo(service.Hidden)} />
              <InfoRow label="Self-verification of results" value={service.SelfVerification === '1' ? 'Yes' : service.SelfVerification === '0' ? 'No' : 'System default'} />
              <InfoRow label="Number of required verifications" value={service.NumberOfRequiredVerifications} />
              <InfoRow label="Remarks" value={service.Remarks} />
              <InfoRow label="Methods" value={supportedMethods.map(m => m.title).join(', ')} />
              <InfoRow label="Default Method" value={defaultMethod?.title} />
              <InfoRow label="Instruments" value={supportedInstruments.map(i => i.title).join(', ')} />
              <InfoRow label="Default Instrument" value={defaultInstrument?.title} />
              <InfoRow label="Calculation" value={calculation?.title} />
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F3F4F6' }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Accredited</span>
                  {yesNo(service.Accredited)}
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Point of Capture</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{service.PointOfCapture}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Analysis Category</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#DBEAFE', color: '#0154FC' }}>{service.Category || '—'}</span>
                </div>
                <InfoRow label="Price (excluding VAT)" value={service.Price} />
                <InfoRow label="Bulk price (excluding VAT)" value={service.BulkPrice} />
                <InfoRow label="VAT %" value={service.VAT} />
                <InfoRow label="Maximum turn-around time" value={timeLabel(service.MaxTimeAllowedDays, service.MaxTimeAllowedHours, service.MaxTimeAllowedMinutes)} />
                <InfoRow label="Maximum holding time" value={timeLabel(service.MaxHoldingTimeDays, service.MaxHoldingTimeHours, service.MaxHoldingTimeMinutes)} />
                <InfoRow label="Duplicate Variation %" value={service.DuplicateVariation} />
              </div>
            </Panel>
          </div>
        )}

        {tab === 'Calculations' && (
          <Panel title="Calculation">
            {calculation ? (
              <>
                <InfoRow label="Title" value={calculation.title} />
                <InfoRow label="Description" value={calculation.description} />
                <InfoRow label="Formula" value={<code style={{ fontSize: 11 }}>{calculation.formula}</code>} />
                <div className="mt-3">
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Interim Fields</p>
                  {calculation.interimFields.length === 0
                    ? <p style={{ fontSize: 12, color: '#6B7280' }}>None</p>
                    : calculation.interimFields.map((f, i) => (
                      <InfoRow key={i} label={f.title || f.keyword} value={`${f.value} ${f.unit ?? ''}`.trim()} />
                    ))}
                </div>
              </>
            ) : <p style={{ fontSize: 12, color: '#6B7280' }}>No calculation assigned to this analysis.</p>}
          </Panel>
        )}

        {tab === 'Specifications' && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
            {specRows.length === 0 ? (
              <p className="p-4" style={{ fontSize: 12, color: '#6B7280' }}>No specification ranges reference this analysis.</p>
            ) : (
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAFAFA' }}>
                    {['Specification', 'Status', 'Min', 'Max', 'Warn min', 'Warn max', 'Out of range'].map(c => (
                      <th key={c} className="px-3 py-2 text-left" style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {specRows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F3F4F6' }}>
                      <td className="px-3 py-2 text-xs" style={{ color: '#111827', fontWeight: 500 }}>{r.specTitle}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: r.isActive ? '#0154FC' : '#6B7280' }}>{r.isActive ? 'Active' : 'Inactive'}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#374151' }}>{r.min_operator}{r.min_value ?? '—'}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#374151' }}>{r.max_operator}{r.max_value ?? '—'}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#374151' }}>{r.min_warn ?? '—'}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#374151' }}>{r.max_warn ?? '—'}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: '#374151' }}>{r.out_of_range_low || r.out_of_range_high ? `${r.out_of_range_low || ''} / ${r.out_of_range_high || ''}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Instruments' && (
          <Panel title="Instruments">
            <InfoRow label="Supported Instruments" value={supportedInstruments.map(i => i.title).join(', ') || 'None'} />
            <InfoRow label="Default Instrument" value={defaultInstrument?.title} />
            <InfoRow label="Supported Methods" value={supportedMethods.map(m => m.title).join(', ') || 'None'} />
            <InfoRow label="Default Method" value={defaultMethod?.title} />
          </Panel>
        )}

        {tab === 'Results Variables' && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF2' }}>
            {service.InterimFields.length === 0 ? (
              <p className="p-4" style={{ fontSize: 12, color: '#6B7280' }}>No result variables defined.</p>
            ) : (
              <div className="flex flex-wrap gap-2 p-4">
                {service.InterimFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: '1px solid #E8EAF2' }}>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>{f.keyword}</span>
                    <span style={{ fontSize: 12, color: '#111827' }}>{f.title}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{f.result_type}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{f.hidden ? 'Hidden' : 'Visible'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Audit Trail' && (
          <div className="bg-white rounded-xl p-3" style={{ border: '1px solid #E8EAF2' }}>
            <AuditEventsTable events={auditEvents} />
          </div>
        )}
      </div>
    </div>
  )
}
