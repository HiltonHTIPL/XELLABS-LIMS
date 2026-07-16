// Cosmetic environment-badge override, persisted per-browser in localStorage.
// Purely a display label — never touches which Django/SENAITE backend the app talks to.
export const ENV_OVERRIDE_KEY = 'xl_env_badge_override'
export const ENV_OVERRIDE_EVENT = 'xl-env-badge-override-change'

export const ENV_LABELS = ['Development', 'QA', 'Staging', 'Production'] as const
export type EnvLabel = typeof ENV_LABELS[number]

export function getEnvOverride(): EnvLabel | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(ENV_OVERRIDE_KEY)
  return (ENV_LABELS as readonly string[]).includes(stored ?? '') ? (stored as EnvLabel) : null
}

export function setEnvOverride(label: EnvLabel | null) {
  if (typeof window === 'undefined') return
  if (label) window.localStorage.setItem(ENV_OVERRIDE_KEY, label)
  else window.localStorage.removeItem(ENV_OVERRIDE_KEY)
  window.dispatchEvent(new Event(ENV_OVERRIDE_EVENT))
}
