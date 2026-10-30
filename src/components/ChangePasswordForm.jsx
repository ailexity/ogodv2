import { useState } from 'react'
import { api, isRemembered, setToken } from '../api/client.js'
import PasswordInput from './PasswordInput.jsx'

const EMPTY = { current: '', next: '', confirm: '' }

/**
 * Change (or, for a Google-only account, set) your own password. Every other
 * device is signed out; this one gets a fresh token and stays signed in.
 */
export default function ChangePasswordForm({ user, className = '', onChanged }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const hasPassword = user?.hasPassword !== false

  function update(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
    setDone(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.next !== form.confirm) return setError('The new passwords don’t match')

    setSaving(true)
    setError('')
    try {
      const remember = isRemembered()
      const { token, user: updated } = await api.changePassword(form.current, form.next, remember)
      setToken(token, { remember })
      setForm(EMPTY)
      setDone(true)
      onChanged?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={`form ${className}`} onSubmit={handleSubmit}>
      {hasPassword && (
        <label className="field">
          <span className="field-label">Current password</span>
          <PasswordInput
            name="current"
            value={form.current}
            onChange={update}
            autoComplete="current-password"
            required
          />
        </label>
      )}
      <label className="field">
        <span className="field-label">New password</span>
        <PasswordInput
          name="next"
          value={form.next}
          onChange={update}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="form-hint">At least 8 characters, with a letter and a number.</span>
      </label>
      <label className="field">
        <span className="field-label">Confirm new password</span>
        <PasswordInput
          name="confirm"
          value={form.confirm}
          onChange={update}
          autoComplete="new-password"
          required
        />
      </label>

      {error && <p className="form-error">{error}</p>}
      {done && <p className="save-note">Password {hasPassword ? 'changed' : 'set'}. Other devices were signed out.</p>}

      <button type="submit" className="submit" disabled={saving}>
        {saving ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
      </button>
    </form>
  )
}
