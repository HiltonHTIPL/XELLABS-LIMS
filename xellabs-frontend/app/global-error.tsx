'use client'
import { useEffect } from 'react'

// When Next.js can't find a server action (stale JS bundle after a deploy),
// it surfaces an "unexpected response" error here. Auto-reload fetches the
// new bundles and clears the mismatch.
export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    if (error?.message?.includes('unexpected response') || error?.message?.includes('Failed to find')) {
      window.location.reload()
    }
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#666' }}>Reloading...</p>
          </div>
        </div>
      </body>
    </html>
  )
}
