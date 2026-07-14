'use client'
import { useEffect, useState } from 'react'

const STALE_BUNDLE_ERROR = /unexpected response|Failed to find/
const RELOAD_GUARD_KEY = 'xellabs_stale_bundle_reload_at'
// A plain reload() can be served from the browser's back-forward cache or disk
// cache with the SAME stale bundle that just crashed — in that case the error
// fires again immediately and this screen loops on "Reloading..." forever
// (confirmed live: a tab open across two consecutive deploys got stuck here).
// Two defenses: (1) bust any cache by navigating to a URL with a fresh query
// param instead of calling reload() directly, (2) a sessionStorage timestamp
// guard — if we already tried this within the last 10s, stop auto-retrying
// and show a manual recovery link instead of silently looping.
const RELOAD_GUARD_WINDOW_MS = 10_000

export default function GlobalError({ error }: { error: Error }) {
  const [loopDetected, setLoopDetected] = useState(false)

  useEffect(() => {
    if (!STALE_BUNDLE_ERROR.test(error?.message ?? '')) return

    const lastAttempt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
    const now = Date.now()
    if (now - lastAttempt < RELOAD_GUARD_WINDOW_MS) {
      setLoopDetected(true)
      return
    }

    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
    const url = new URL(window.location.href)
    url.searchParams.set('_r', String(now))
    window.location.replace(url.toString())
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
                  onClick={() => { sessionStorage.removeItem(RELOAD_GUARD_KEY); window.location.href = '/dashboard' }}
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
