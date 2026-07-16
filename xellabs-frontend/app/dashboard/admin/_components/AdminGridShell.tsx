'use client'
import { useMemo, useState } from 'react'
import { LinkTile } from '../../_components/ui'
import type { AdminSection } from '../../_components/adminNav'

export default function AdminGridShell({ sections }: { sections: AdminSection[] }) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter(s => s.label.toLowerCase().includes(q))
  }, [query, sections])

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-5"
        style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', maxWidth: 360 }}
      >
        <span className="material-icons" style={{ fontSize: 16, color: '#9CA3AF' }}>search</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search admin sections..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: '#374151' }}
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-sm" style={{ color: '#9CA3AF' }}>No sections match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {visible.map(section => (
            <LinkTile
              key={section.href}
              href={section.href}
              icon={section.icon}
              label={section.label}
              description={section.description}
              dependsOn={section.dependsOn}
            />
          ))}
        </div>
      )}
    </>
  )
}
