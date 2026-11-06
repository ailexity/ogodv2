import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import ChangePasswordForm from '../ChangePasswordForm.jsx'

/** The signed-in admin's own password. Other devices are signed out; this one stays in. */
function ChangePassword({ user }) {
  return (
    <section>
      <h2 className="console-section-title">Change password</h2>
      <p className="console-section-hint">
        For {user?.email}. Other devices signed in to this account are signed out.
      </p>
      <ChangePasswordForm user={user} className="password-form" />
    </section>
  )
}

export default function AdminSettings({ user }) {
  const [definitions, setDefinitions] = useState(null)
  const [values, setValues] = useState({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .getSettings()
      .then(({ settings, definitions: defs }) => {
        setDefinitions(defs)
        setValues(settings)
      })
      .catch((err) => setError(err.message))
  }, [])

  function update(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setError('')
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const { settings } = await api.updateSettings(values)
      setValues(settings)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (error && !definitions) return <p className="form-error">{error}</p>
  if (!definitions) return <p className="console-empty">Loading settings…</p>

  return (
    <div className="console-sections">
      <section>
        <h2 className="console-section-title">Platform settings</h2>
        <p className="console-section-hint">
          These take effect immediately across the whole app.
        </p>

        <div className="setting-list">
          {Object.entries(definitions).map(([key, definition]) => (
            <div key={key} className="setting-row">
              <div className="setting-copy">
                <span className="setting-label">{definition.label}</span>
                <span className="field-hint">{definition.hint}</span>
              </div>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={Boolean(values[key])}
                  onChange={(e) => update(key, e.target.checked)}
                />
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
              </label>
            </div>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}
        {saved && <p className="save-note">Settings saved.</p>}

        <button type="button" className="submit console-save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </section>

      <ChangePassword user={user} />
    </div>
  )
}
