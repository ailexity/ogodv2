import { useState } from 'react'
import { api } from '../api/client.js'
import { TRAVEL_INTERESTS } from '../data/interests.js'
import AuthLayout from './AuthLayout.jsx'
import GoogleSignIn from './GoogleSignIn.jsx'
import PasswordInput from './PasswordInput.jsx'

const INITIAL_FORM = {
  name: '',
  age: '',
  address: '',
  phone: '',
  email: '',
  password: '',
}

export default function Register({ onAuthenticated, onRegistered, onSwitchToLogin }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [interests, setInterests] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  function toggleInterest(value) {
    setError('')
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (
      !form.name.trim() ||
      !form.age ||
      !form.address.trim() ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      setError('Please fill in all fields')
      return
    }

    if (interests.length === 0) {
      setError('Select at least one travel interest')
      return
    }

    setSubmitting(true)

    try {
      const result = await api.register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        age: Number(form.age),
        address: form.address.trim(),
        phone: form.phone.trim(),
        interests,
      })
      onRegistered(result.email, result.emailSent)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Tell us a bit about yourself. You can apply to become a guide once you're in."
      footer={
        <p className="switch-text">
          Already have an account?{' '}
          <button type="button" className="switch-link" onClick={onSwitchToLogin}>
            Sign in
          </button>
        </p>
      }
    >
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Full name</span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Email address</span>
          <input
            type="email"
            name="email"
            value={form.email}
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
            placeholder="Create a password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span className="form-hint">At least 8 characters, with a letter and a number.</span>
        </label>

        <label className="field">
          <span className="field-label">Phone number</span>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="Enter your phone number"
            autoComplete="tel"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Age</span>
          <input
            type="number"
            name="age"
            value={form.age}
            onChange={handleChange}
            placeholder="Enter your age"
            min="1"
            max="120"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Address</span>
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Enter your address"
            rows={2}
            required
          />
        </label>

        <div className="field">
          <span className="field-label">What kind of trips do you enjoy?</span>
          <div className="chip-group" role="group" aria-label="Travel interests">
            {TRAVEL_INTERESTS.map((interest) => (
              <button
                key={interest}
                type="button"
                className={`chip${interests.includes(interest) ? ' chip-active' : ''}`}
                aria-pressed={interests.includes(interest)}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="submit" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="divider">
        <span>or sign up with</span>
      </div>

      <GoogleSignIn remember onAuthenticated={onAuthenticated} onError={setError} />
    </AuthLayout>
  )
}
