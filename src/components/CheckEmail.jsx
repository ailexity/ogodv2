import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import AuthLayout from './AuthLayout.jsx'

const RESEND_COOLDOWN_SECONDS = 60

/**
 * Shown after sign-up, or when an unconfirmed account tries to sign in: the
 * account can't be used until the emailed link is opened.
 *
 * reason: 'registered' (link just sent) | 'send_failed' | 'unverified' (sign-in attempt)
 */
export default function CheckEmail({ email, reason = 'registered', onBackToLogin }) {
  const [cooldown, setCooldown] = useState(reason === 'registered' ? RESEND_COOLDOWN_SECONDS : 0)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(
    reason === 'send_failed' ? "We couldn't send the email just now. Try sending it again." : '',
  )

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleResend() {
    setSending(true)
    setError('')
    setMessage('')
    try {
      await api.resendVerification(email)
      setMessage('A new confirmation link is on its way.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthLayout
      title={reason === 'unverified' ? 'Confirm your email' : 'Check your inbox'}
      subtitle={
        reason === 'unverified' ? (
          <>
            <strong>{email}</strong> hasn&apos;t been confirmed yet. Open the link we emailed you,
            or send a new one below.
          </>
        ) : (
          <>
            We sent a confirmation link to <strong>{email}</strong>. Open it to activate your
            account — the link expires in 24 hours.
          </>
        )
      }
      footer={
        <p className="switch-text">
          <button type="button" className="switch-link" onClick={onBackToLogin}>
            Back to sign in
          </button>
        </p>
      }
    >
      <div className="form">
        <p className="form-hint">
          Can&apos;t find it? Check your spam folder, or send it again.
        </p>

        {message && <p className="form-notice">{message}</p>}
        {error && <p className="form-error">{error}</p>}

        <button
          type="button"
          className="submit"
          onClick={handleResend}
          disabled={sending || cooldown > 0}
        >
          {sending
            ? 'Sending…'
            : cooldown > 0
              ? `Resend link in ${cooldown}s`
              : 'Resend confirmation link'}
        </button>
      </div>
    </AuthLayout>
  )
}
