import { useState } from 'react'
import { api } from '../api/client.js'
import AuthLayout from './AuthLayout.jsx'
import GoogleSignIn from './GoogleSignIn.jsx'
import PasswordInput from './PasswordInput.jsx'

export default function Login({
  notice,
  onAuthenticated,
  onUnverified,
  onSwitchToRegister,
  onForgotPassword,
}) {
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      onAuthenticated(await api.login(form.identifier, form.password, remember), { remember })
    } catch (err) {
      if (err.code === 'email_unverified') {
        onUnverified(err.email)
        return
      }
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to find verified local guides and book your next trip."
      footer={
        <p className="switch-text">
          Don&apos;t have an account?{' '}
          <button type="button" className="switch-link" onClick={onSwitchToRegister}>
            Create one
          </button>
        </p>
      }
    >
      {notice && (
        <p className={notice.tone === 'error' ? 'form-error form-banner' : 'form-notice'}>
          {notice.text}
        </p>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Email address</span>
          <input
            type="email"
            name="identifier"
            value={form.identifier}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <PasswordInput
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter password"
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <button type="button" className="link link-button" onClick={onForgotPassword}>
            Forgot password?
          </button>
        </div>

        <button className="submit" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="divider">
        <span>or continue with</span>
      </div>

      <GoogleSignIn remember={remember} onAuthenticated={onAuthenticated} onError={setError} />
    </AuthLayout>
  )
}
