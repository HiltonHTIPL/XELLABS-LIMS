'use client'
import { useEffect, useState } from 'react'
import { isStaleBundleError, attemptGuardedReload, clearReloadGuard } from '@/app/lib/staleBundleRecovery'

// Detection + the cache-busting/loop-guarded reload itself live in
// app/lib/staleBundleRecovery.ts, shared with app/_components/ChunkErrorReloader.tsx
// (a global window-level listener) — a ChunkLoadError from a failed dynamic
// import rejects a promise rather than throwing during render, so it never
// reaches this boundary at all; that component is what actually catches it.
// This boundary still matters for errors that DO throw synchronously during
// render (e.g. Next's own "Failed to find Server Action").

export default function GlobalError({ error }: { error: Error }) {
  const [loopDetected, setLoopDetected] = useState(false)

  useEffect(() => {
    if (!isStaleBundleError(error?.message)) return
    if (!attemptGuardedReload()) setLoopDetected(true)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center' }}>
            {loopDetected ? (
              <>
                <p style={{ color: '#666', marginBottom: 12 }}>
                  This page couldn&apos;t recover automatically.
                </p>
                <button
                  onClick={() => { clearReloadGuard(); window.location.href = '/dashboard' }}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                >
                  Return to Dashboard
                </button>
              </>
            ) : (
              <p style={{ color: '#666' }}>Reloading...</p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
