import 'server-only'

// Single owner of the SENAITE service-account token. No 'admin'/'admin'
// fallbacks anywhere: if the env vars are missing we fail fast at module
// evaluation (and the same change that requires a new env var must add it to
// the frontend service's environment block in docker-compose.yml — CLAUDE.md §10).
const SENAITE_USER = process.env.SENAITE_ADMIN_USER
const SENAITE_PASS = process.env.SENAITE_ADMIN_PASS

if (!SENAITE_USER || !SENAITE_PASS) {
  throw new Error('SENAITE_ADMIN_USER and SENAITE_ADMIN_PASS env vars are required')
}

/** Basic-auth token for the SENAITE service account. */
export function serverToken(): string {
  return Buffer.from(`${SENAITE_USER}:${SENAITE_PASS}`).toString('base64')
}

/** The logged-in user's own SENAITE token if they have one, else the service account. */
export function sessionToken(session: { senaiteToken?: string } | null): string {
  return session?.senaiteToken ?? serverToken()
}
