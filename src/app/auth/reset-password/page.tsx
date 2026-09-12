'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

/*
 * Landing page for the link sent by POST /api/auth/forgot-password
 * (src/lib/send-password-reset-email.ts logs it in dev — no real email
 * provider is wired up yet). Reads ?token=... from the URL and posts it
 * alongside the new password to POST /api/auth/reset-password, which
 * enforces the same strength/breach checks as signup and consumes the
 * token exactly once.
 */

const VARS = {
  '--accent': '#FF8A1E',
  '--accent-bright': '#FFA64D',
  '--bg': '#0D0D0D',
} as React.CSSProperties

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not reset your password. Please try again.')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError('Could not reset your password. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={VARS} className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent-bright)] mb-1.5">
          Athlas<span className="text-[color:var(--accent)]">X</span>
        </p>
        <h1 className="uppercase text-3xl font-bold text-white mb-1.5">Set a new password</h1>

        {!token && (
          <p className="text-sm text-[#ff8a7e] mt-4">
            This link is missing its reset token. Request a new one from{' '}
            <Link href="/auth" className="text-[color:var(--accent-bright)] hover:underline">
              the sign-in page
            </Link>
            .
          </p>
        )}

        {token && done && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-white/80">Your password has been reset. You can now sign in with it.</p>
            <button
              type="button"
              onClick={() => router.push('/auth')}
              className="w-full py-3.5 rounded-[10px] text-base font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] hover:bg-[color:var(--accent-bright)] transition-colors"
            >
              Go to sign in
            </button>
          </div>
        )}

        {token && !done && (
          <form onSubmit={handleSubmit} className="space-y-3 mt-4">
            <div className="space-y-1">
              <input
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                placeholder="New password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors"
              />
              <p className="text-[11px] text-white/40">At least 10 characters, with letters and numbers.</p>
            </div>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              placeholder="Confirm new password"
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors"
            />
            {error && <p role="status" className="text-xs text-[#ff8a7e]">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-[10px] text-base font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
