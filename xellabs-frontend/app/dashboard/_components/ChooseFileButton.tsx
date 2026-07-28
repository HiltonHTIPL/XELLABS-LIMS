'use client'
import { useRef, useState } from 'react'

function MI({ name, size = 13, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons" style={{ fontSize: size, color, lineHeight: 1 }}>{name}</span>
}

// Shared "Choose File" control — a hidden native <input type="file"> triggered
// by a styled button, with the chosen filename shown alongside. Matches the
// pattern already used across the app (Sample Points attachment, Instrument
// photo/cert, Method Document, Instrument Maintenance record) — use this
// instead of a bare <input type="file"> or a one-off copy of this pattern.
export default function ChooseFileButton({
  name, accept, required, buttonLabel = 'Choose File', onFileChange,
}: {
  name: string
  accept?: string
  required?: boolean
  buttonLabel?: string
  onFileChange?: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0] ?? null
          setFileName(file?.name ?? '')
          onFileChange?.(file)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{ border: '1px solid #D1D5DB', color: '#374151', background: '#fff', cursor: 'pointer' }}
      >
        <MI name="upload_file" size={13} color="#374151" /> {buttonLabel}
      </button>
      <span className="text-xs" style={{ color: fileName ? '#111827' : '#374151' }}>
        {fileName || 'No file chosen'}
      </span>
    </div>
  )
}
