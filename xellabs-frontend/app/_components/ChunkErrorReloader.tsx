'use client'
import { useEffect } from 'react'
import { isStaleBundleError, attemptGuardedReload } from '@/app/lib/staleBundleRecovery'

// A failed dynamic import (Next.js route-level code splitting hitting a
// chunk hash that no longer exists after a rebuild) rejects a promise rather
// than throwing synchronously during render — it surfaces as a plain
// 'unhandledrejection' or window 'error' event, NOT something React's
// error boundary (app/global-error.tsx) ever sees. That boundary alone left
// this exact class of failure (ChunkLoadError / "Loading chunk N failed")
// with no recovery at all. This is a render-nothing global safety net,
// mounted once in the root layout, that catches it regardless of how it
// surfaces.
export default function ChunkErrorReloader() {
  useEffect(() => {
    function handle(message: string | undefined) {
      if (isStaleBundleError(message)) attemptGuardedReload()
    }
    const onError = (e: ErrorEvent) => handle(e.message || e.error?.message)
    const onRejection = (e: PromiseRejectionEvent) => handle(e.reason?.message ?? String(e.reason))
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
