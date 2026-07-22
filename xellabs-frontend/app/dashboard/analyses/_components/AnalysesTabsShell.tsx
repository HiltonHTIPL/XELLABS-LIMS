'use client'
import { useState } from 'react'
import AnalysesShell from './AnalysesShell'
import AnalysisProfilesShell from '../../analysis-profiles/_components/AnalysisProfilesShell'
import { type AnalysisProfile } from '@/app/actions/analysis-profiles'
import {
  type SenaiteAnalysisService,
  type SenaiteAnalysisCategory,
  type SenaiteDepartment,
  type SenaiteLabContact,
  type SenaiteRefOption,
  type SenaiteInstrument,
} from '@/app/lib/senaite'

function MI({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

type Tab = 'analyses' | 'profiles'

export default function AnalysesTabsShell({
  initialServices, categories, departments, labContacts, methods, instruments, initialProfiles, sampleTypeOptions,
}: {
  initialServices: SenaiteAnalysisService[]
  categories: SenaiteAnalysisCategory[]
  departments: SenaiteDepartment[]
  labContacts: SenaiteLabContact[]
  methods: SenaiteRefOption[]
  instruments: SenaiteInstrument[]
  initialProfiles: AnalysisProfile[]
  sampleTypeOptions: { uid: string; title: string }[]
}) {
  const [tab, setTab] = useState<Tab>('analyses')

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'analyses', label: 'Analyses', icon: 'biotech' },
    { key: 'profiles', label: 'Analysis Profiles', icon: 'science' },
  ]

  return (
    <div>
      <div className="flex items-center gap-1 px-5 pt-4" style={{ backgroundColor: '#F7F8FC', borderBottom: '1px solid #E8EAF2' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
            style={{
              color: tab === t.key ? '#0154FC' : '#374151',
              borderBottom: tab === t.key ? '2px solid #0154FC' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <MI name={t.icon} size={14} color={tab === t.key ? '#0154FC' : '#374151'} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analyses' ? (
        <AnalysesShell
          initialServices={initialServices}
          categories={categories}
          departments={departments}
          labContacts={labContacts}
          methods={methods}
          instruments={instruments}
        />
      ) : (
        <AnalysisProfilesShell
          initialProfiles={initialProfiles}
          analysisServices={initialServices}
          sampleTypeOptions={sampleTypeOptions}
        />
      )}
    </div>
  )
}
