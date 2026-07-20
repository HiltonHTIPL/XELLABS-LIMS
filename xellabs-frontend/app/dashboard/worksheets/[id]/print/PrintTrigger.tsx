'use client'
import { useEffect } from 'react'

// Auto-open the print dialog once the printable worksheet has rendered.
export default function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])
  return null
}
