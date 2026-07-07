'use client'
import { useEffect } from 'react'
import { refreshSession } from '@/app/actions/auth'

// Refreshes the session cookie on mount and every 30 minutes so users
// are not logged out during active use.
export default function SessionRefresher() {
  useEffect(() => {
    refreshSession()
    const id = setInterval(refreshSession, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return null
}
