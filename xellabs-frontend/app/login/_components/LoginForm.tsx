'use client'
import { useActionState, useState } from 'react'
import { login } from '@/app/actions/auth'
import type { LoginFormState } from '@/app/lib/definitions'

const initialState: LoginFormState = undefined

const inputWrapStyle: React.CSSProperties = {
  border: '1px solid #D7E3F0',
  borderRadius: 10,
  backgroundColor: '#FFFFFF',
}

export default function LoginForm({
  tenantName,
  tenantSubdomain,
  tenantLogo,
}: {
  tenantName?: string
  tenantSubdomain?: string
  tenantLogo?: string
}) {
  const [state, action, pending] = useActionState(login, initialState)
  const [showPassword, setShowPassword] = useState(false)

  const isTenant = !!tenantSubdomain

  return (
    <div className="w-full">
      {/* Client logo — shown above "Welcome back" when on a client subdomain */}
      {isTenant && tenantLogo && (
        <div className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tenantLogo}
            alt={tenantName || tenantSubdomain}
            style={{ maxHeight: 72, maxWidth: 200, objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Tenant badge — shown only on subdomain (when no logo) */}
      {isTenant && !tenantLogo && (
        <div
          className="mb-6 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: '#DBEAFE', border: '1px solid #DBEAFE', color: '#0154FC' }}
        >
          <span style={{ fontSize: 16 }} className="material-icons">business</span>
          <span className="font-medium">{tenantName || tenantSubdomain}</span>
          <span className="ml-auto text-xs font-mono opacity-60">{tenantSubdomain}.localhost</span>
        </div>
      )}

      {/* Heading */}
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-bold" style={{ color: '#0B1E47' }}>
          Welcome back
        </h2>
        <p className="mt-1 text-sm" style={{ color: '#475569' }}>
          {isTenant
            ? `Sign in to ${tenantName || tenantSubdomain}'s XELLABS LIMS account`
            : 'Sign in to your XELLABS LIMS account'}
        </p>
      </div>

      {/* Error banner */}
      {state?.message && (
        <div
          className="mb-6 px-4 py-3 rounded-lg text-sm"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
          role="alert"
        >
          {state.message}
        </div>
      )}

      {/* Form */}
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: '#0B1E47' }}>
            Email
          </label>
          <div className="flex items-center px-3.5 focus-within:ring-2 focus-within:ring-blue-500/40" style={inputWrapStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              required
              placeholder="name@company.com"
              className="w-full py-3 pl-3 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
              style={{ color: '#0B1E47' }}
            />
          </div>
          {state?.errors?.username && (
            <p className="mt-1 text-xs" style={{ color: '#DC2626' }}>{state.errors.username[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#0B1E47' }}>
            Password
          </label>
          <div className="flex items-center px-3.5 focus-within:ring-2 focus-within:ring-blue-500/40" style={inputWrapStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 018 0v3" />
            </svg>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              className="w-full py-3 pl-3 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
              style={{ color: '#0B1E47' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="p-1 shrink-0"
              style={{ color: '#94A3B8' }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a3 3 0 004.2 4.2" />
                  <path d="M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4 10 7-.4 1.2-1.3 2.6-2.6 3.8M6.6 6.6C4.4 8 2.8 10 2 12c1 3 5 7 10 7 1.5 0 2.9-.3 4.2-.9" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7S3 15 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {state?.errors?.password && (
            <p className="mt-1 text-xs" style={{ color: '#DC2626' }}>{state.errors.password[0]}</p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: '#334155' }}>
            <input
              type="checkbox"
              name="remember"
              className="w-4 h-4 rounded accent-blue-700"
              style={{ border: '1px solid #CBD5E1' }}
            />
            Remember me
          </label>
          <a href="#" className="font-medium hover:underline" style={{ color: '#1A4FDB' }}>
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 text-sm font-semibold text-white rounded-lg flex items-center justify-center gap-2 transition-opacity"
          style={{ backgroundColor: pending ? '#93C5FD' : '#1A4FDB', cursor: pending ? 'not-allowed' : 'pointer' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
          {pending ? 'Signing in…' : 'Sign In'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
          <span className="text-xs" style={{ color: '#94A3B8' }}>or</span>
          <span className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
        </div>

        <button
          type="button"
          className="w-full py-3 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 bg-white hover:bg-blue-50 transition-colors"
          style={{ border: '1px solid #1A4FDB', color: '#1A4FDB' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Single Sign-On (SSO)
        </button>
      </form>
    </div>
  )
}
