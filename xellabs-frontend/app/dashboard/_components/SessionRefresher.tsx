'use client'
import { useEffect } from 'react'

async function refresh() {
  await fetch('/api/refresh-session', { credentials: 'same-origin' })
}

export default function SessionRefresher() {
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return null
}
