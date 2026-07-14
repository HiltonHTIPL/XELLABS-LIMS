// Shared detection + guarded-reload logic for the "stale bundle after a
// rebuild" class of errors — used by both the React error boundary
// (app/global-error.tsx, for errors that reach React's render cycle) and a
// global window listener (app/_components/ChunkErrorReloader.tsx, for
// ChunkLoadError-style failures that surface as unhandled promise
// rejections/window 'error' events instead, bypassing the boundary entirely).
//
// Every variant seen in this app so far: Next.js's own "Failed to find Server
// Action"/"unexpected response" (stale server-action id), and webpack's
// "ChunkLoadError"/"Loading chunk N failed" (stale route chunk hash deleted
// by a subsequent rebuild).
const STALE_BUNDLE_ERROR = /unexpected response|Failed to find|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i

export function isStaleBundleError(message: string | undefined | null): boolean {
  return STALE_BUNDLE_ERROR.test(message ?? '')
}

const RELOAD_GUARD_KEY = 'xellabs_stale_bundle_reload_at'
const RELOAD_GUARD_WINDOW_MS = 10_000

/**
 * Attempts a cache-busting recovery navigation, guarded against looping if
 * the browser keeps re-serving the same stale response after "reloading".
 * Returns true if a reload was actually triggered, false if a loop was
 * detected within the guard window (caller should stop retrying and, if it
 * has UI to do so, offer a manual recovery action instead).
 */
export function attemptGuardedReload(): boolean {
  if (typeof window === 'undefined') return false
  const lastAttempt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0)
  const now = Date.now()
  if (now - lastAttempt < RELOAD_GUARD_WINDOW_MS) return false

  sessionStorage.setItem(RELOAD_GUARD_KEY, String(now))
  const url = new URL(window.location.href)
  url.searchParams.set('_r', String(now))
  window.location.replace(url.toString())
  return true
}

export function clearReloadGuard(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(RELOAD_GUARD_KEY)
}
