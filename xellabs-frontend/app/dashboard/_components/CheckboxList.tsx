'use client'

// Shared multi-select picker — same shape as the inline copies already used on
// the Methods and Analyses pages for Instruments/Calculations/Methods pickers.
export default function CheckboxList({ options, selected, onChange }: {
  options: { uid: string; title: string }[]; selected: string[]; onChange: (uids: string[]) => void
}) {
  function toggle(uid: string) {
    onChange(selected.includes(uid) ? selected.filter(x => x !== uid) : [...selected, uid])
  }
  return (
    <div className="rounded-lg overflow-y-auto" style={{ border: '1px solid #D1D5DB', maxHeight: 120 }}>
      {options.length === 0
        ? <p className="px-3 py-2 text-xs" style={{ color: '#374151' }}>None available</p>
        : options.map(o => (
            <label key={o.uid} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50" style={{ color: '#374151' }}>
              <input type="checkbox" checked={selected.includes(o.uid)} onChange={() => toggle(o.uid)} />
              {o.title}
            </label>
          ))}
    </div>
  )
}
