'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ENV_LABELS, type EnvLabel, getEnvOverride, setEnvOverride } from '@/app/lib/envOverride'

function MI({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

export default function AccountSettingsShell() {
  const [selected, setSelected] = useState<EnvLabel | ''>('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSelected(getEnvOverride() ?? '')
  }, [])

  function handleChange(value: string) {
    const label = (value || null) as EnvLabel | null
    setSelected(label ?? '')
    setEnvOverride(label)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: 20, backgroundColor: '#F7F8FC', minHeight: '100%' }}>
      <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-4" style={{ fontSize: 12 }}>
        <Link href="/dashboard" style={{ color: '#374151' }}>Dashboard</Link>
        <span style={{ color: '#D1D5DB' }}>/</span>
        <span style={{ color: '#111827', fontWeight: 500 }}>Account Settings</span>
      </div>

      <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>Account Settings</h1>
      <p className="text-sm mb-6" style={{ color: '#374151' }}>Manage display preferences for your account.</p>

      <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #E8EAF2' }}>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="material-icons" style={{ fontSize: 18, color: '#0154FC' }}>dns</span>
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>Environment Status</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: '#374151' }}>
          Sets the environment badge shown in the top bar next to the XelLabs logo. This is a display
          label only — it does not change which backend or SENAITE instance the app connects to.
        </p>

        <label className="text-xs font-medium block mb-1.5" style={{ color: '#374151' }}>Environment</label>
        <select
          value={selected}
          onChange={e => handleChange(e.target.value)}
          className="w-full max-w-xs px-3 py-2 rounded-lg text-sm"
          style={{ border: '1px solid #D1D5DB', color: '#111827' }}
        >
          <option value="">Default (from build config)</option>
          {ENV_LABELS.map(label => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>

        {saved && (
          <div className="flex items-center gap-1.5 mt-3" style={{ color: '#16A34A', fontSize: 12 }}>
            <MI name="check_circle" size={14} color="#16A34A" />
            Saved — badge updated.
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
