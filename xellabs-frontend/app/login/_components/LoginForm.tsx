'use client'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import type { LoginFormState } from '@/app/lib/definitions'

const initialState: LoginFormState = undefined

export default function LoginForm({
  tenantName,
  tenantSubdomain,
}: {
  tenantName?: string
  tenantSubdomain?: string
}) {
  const [state, action, pending] = useActionState(login, initialState)

  const isTenant = !!tenantSubdomain

  return (
    <div className="w-full max-w-sm">
      {/* Tenant badge — shown only on subdomain */}
      {isTenant && (
        <div
          className="mb-6 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', color: '#0D9488' }}
        >
          <span style={{ fontSize: 16 }} className="material-icons">business</span>
          <span className="font-medium">{tenantName || tenantSubdomain}</span>
          <span className="ml-auto text-xs font-mono opacity-60">{tenantSubdomain}.localhost</span>
        </div>
      )}

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#0B1E47' }}>
          Welcome back
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
          {isTenant
            ? `Sign in to ${tenantName || tenantSubdomain}'s laboratory portal`
            : 'Sign in to access the laboratory portal'}
        </p>
      </div>

      {/* Error banner */}
      {state?.message && (
        <div
          className="mb-6 px-4 py-3 rounded text-sm"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
          role="alert"
        >
          {state.message}
        </div>
      )}

      {/* Form */}
      <form action={action} className="space-y-5">
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-medium tracking-widest uppercase mb-2"
            style={{ color: '#475569' }}
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            required
            className="w-full px-4 py-3 text-sm rounded focus:outline-none transition-colors"
            style={{ backgroundColor: '#EEF3FF', border: '1px solid #D1DBF5', color: '#0B1E47' }}
            onFocus={e => { e.target.style.border = '1px solid #3B82F6'; e.target.style.backgroundColor = '#ffffff' }}
            onBlur={e => { e.target.style.border = '1px solid #D1DBF5'; e.target.style.backgroundColor = '#EEF3FF' }}
          />
          {state?.errors?.username && (
            <p className="mt-1 text-xs" style={{ color: '#DC2626' }}>{state.errors.username[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium tracking-widest uppercase mb-2"
            style={{ color: '#475569' }}
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 text-sm rounded focus:outline-none transition-colors"
            style={{ backgroundColor: '#EEF3FF', border: '1px solid #D1DBF5', color: '#0B1E47' }}
            onFocus={e => { e.target.style.border = '1px solid #3B82F6'; e.target.style.backgroundColor = '#ffffff' }}
            onBlur={e => { e.target.style.border = '1px solid #D1DBF5'; e.target.style.backgroundColor = '#EEF3FF' }}
          />
          {state?.errors?.password && (
            <p className="mt-1 text-xs" style={{ color: '#DC2626' }}>{state.errors.password[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 text-sm font-medium tracking-wide text-white rounded transition-opacity mt-2"
          style={{ backgroundColor: pending ? '#93C5FD' : '#1A4FDB', cursor: pending ? 'not-allowed' : 'pointer' }}
        >
          {pending ? 'Signing in…' : 'Sign in →'}
        </button>
      </form>

      <p
        className="mt-8 text-xs text-center"
        style={{ color: '#94A3B8', fontFamily: 'var(--font-geist-mono)' }}
      >
        HIPAA §164.312(d) · Person/Entity Authentication
      </p>
    </div>
  )
}
