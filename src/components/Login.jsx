import { useState } from 'react'
import { api } from '../api/client.js'
import AuthLayout from './AuthLayout.jsx'

export default function Login({ onAuthenticated, onSwitchToRegister, onForgotPassword }) {
  const [form, setForm] = useState({ identifier: '', password: '' })
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
      onAuthenticated(await api.login(form.identifier, form.password))
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  function handleGoogleSignIn() {
    // Placeholder: wire this up to real Google OAuth.
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
          <input
            type="password"
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
            <input type="checkbox" />
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

      <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
        <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.02l7.73 6c4.51-4.18 7.09-10.36 7.09-17.49z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.86.92 7.51 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.92-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
        Continue with Google
      </button>
    </AuthLayout>
  )
}
