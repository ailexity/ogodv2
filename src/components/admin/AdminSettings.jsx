import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'

export default function AdminSettings() {
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

              {definition.type === 'boolean' ? (
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
              ) : (
                <div className="rate-input">
                  <input
                    type="number"
                    value={Math.round((values[key] ?? 0) * 1000) / 10}
                    min={definition.min * 100}
                    max={definition.max * 100}
                    step="0.1"
                    onChange={(e) => update(key, Number(e.target.value) / 100)}
                  />
                  <span className="rate-suffix">%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}
        {saved && <p className="save-note">Settings saved.</p>}

        <button type="button" className="submit console-save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </section>
    </div>
  )
}
