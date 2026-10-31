import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import {
  DIFFICULTIES,
  LANGUAGE_OPTIONS,
  TRIP_CATEGORIES,
} from '../data/categories.js'
import { CloseIcon, ImageIcon, PlusIcon } from './icons.jsx'
import { TripCover } from './TripDetail.jsx'
import {
  addDays,
  daysBetween,
  deadlineCountdown,
  formatDate,
  formatDateRange,
  todayISO,
  tripCountdown,
} from '../data/dates.js'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP']
const MAX_COVER_BYTES = 10 * 1024 * 1024

function initialState(trip) {
  return {
    title: trip?.title ?? '',
    destination: trip?.destination ?? '',
    description: trip?.description ?? '',
    meetingPoint: trip?.meetingPoint ?? '',
    minGroupSize: trip?.minGroupSize ?? 1,
    maxGroupSize: trip?.maxGroupSize ?? 8,
    pricePerPerson: trip?.pricePerPerson ?? '',
    currency: trip?.currency ?? 'INR',
    difficulty: trip?.difficulty ?? '',
    startDate: trip?.startDate ?? '',
    endDate: trip?.endDate ?? '',
    bookingDeadline: trip?.bookingDeadline ?? '',
    included: (trip?.included ?? []).join('\n'),
    excluded: (trip?.excluded ?? []).join('\n'),
    highlights: (trip?.highlights ?? []).join('\n'),
  }
}

function toLines(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Doc §5 step 1: the full trip listing a verified guide creates. */
export default function TripForm({ trip, onClose, onSaved }) {
  const editing = Boolean(trip)
  const [form, setForm] = useState(() => initialState(trip))
  const [category, setCategory] = useState(trip?.category ?? null)
  const [languages, setLanguages] = useState(trip?.languages ?? [])
  const [itinerary, setItinerary] = useState(
    trip?.itinerary?.length ? trip.itinerary.map(({ title, description }) => ({ title, description })) : [],
  )
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // `cover` is the saved photo's URL; `coverFile` is a newly picked one, which
  // is only uploaded when the trip is saved.
  const [cover, setCover] = useState(trip?.coverImage ?? null)
  const [coverFile, setCoverFile] = useState(null)
  const previewUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile])
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  function pickCover(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.size > MAX_COVER_BYTES) return setError('The cover photo must be 10 MB or smaller')
    setError('')
    setCoverFile(picked)
  }

  function removeCover() {
    setCoverFile(null)
    setCover(null)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value }
      // Keep the dates consistent as the start moves: the end can't come before
      // it, and bookings must close before it.
      if (name === 'startDate' && value) {
        if (next.endDate && next.endDate < value) next.endDate = value
        if (next.bookingDeadline && next.bookingDeadline > value) next.bookingDeadline = addDays(value, -1)
      }
      return next
    })
    setError('')
  }

  function toggleLanguage(language) {
    setError('')
    setLanguages((prev) =>
      prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language],
    )
  }

  function updateDay(index, field, value) {
    setItinerary((prev) =>
      prev.map((day, i) => (i === index ? { ...day, [field]: value } : day)),
    )
  }

  function addDay() {
    setItinerary((prev) => [...prev, { title: '', description: '' }])
  }

  function removeDay(index) {
    setItinerary((prev) => prev.filter((_, i) => i !== index))
  }

  async function save(status) {
    setError('')

    if (!form.title.trim() || !form.destination.trim() || !form.description.trim()) {
      return setError('Title, destination and description are required')
    }
    if (!category) return setError('Select a category')
    if (Number(form.maxGroupSize) < Number(form.minGroupSize)) {
      return setError('Maximum group size must be at least the minimum')
    }

    const payload = {
      title: form.title.trim(),
      destination: form.destination.trim(),
      category,
      description: form.description.trim(),
      coverImage: cover,
      meetingPoint: form.meetingPoint.trim(),
      minGroupSize: Number(form.minGroupSize),
      maxGroupSize: Number(form.maxGroupSize),
      pricePerPerson: Number(form.pricePerPerson) || 0,
      currency: form.currency.trim() || 'USD',
      difficulty: form.difficulty || null,
      languages,
      included: toLines(form.included),
      excluded: toLines(form.excluded),
      highlights: toLines(form.highlights),
      startDate: form.startDate,
      endDate: form.endDate,
      // Duration follows from the dates when both are set.
      ...(form.startDate &&
        form.endDate && { durationDays: daysBetween(form.startDate, form.endDate) + 1 }),
      bookingDeadline: form.bookingDeadline,
      itinerary: itinerary.filter((day) => day.title.trim()),
    }

    setSubmitting(true)
    try {
      if (coverFile) {
        const { url } = await api.uploadTripCover(coverFile)
        // Keep the upload, so retrying after a failed save doesn't send it again.
        setCover(url)
        setCoverFile(null)
        payload.coverImage = url
      }
      const result = editing
        ? await api.updateTrip(trip.id, payload)
        : await api.createTrip({ ...payload, status })
      onSaved(result.trip)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="edit-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Cancel">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">{editing ? 'Edit trip' : 'New trip'}</h2>
        <button
          type="button"
          className="edit-save-btn"
          onClick={() => save('published')}
          disabled={submitting}
        >
          {submitting ? 'Saving…' : editing ? 'Save' : 'Publish'}
        </button>
      </header>

      <div className="edit-body">
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <span className="field-label">
              Cover photo <span className="upload-optional">Optional</span>
            </span>
            {coverFile || cover ? (
              <div className="media-preview">
                {coverFile ? (
                  <img src={previewUrl} alt="Selected cover" />
                ) : (
                  <TripCover trip={{ coverImage: cover, category }} alt="Current cover" />
                )}
                <div className="cover-actions">
                  <label className="media-remove">
                    Change
                    <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickCover} />
                  </label>
                  <button type="button" className="media-remove" onClick={removeCover}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="media-picker">
                <span className="media-picker-icon">
                  <ImageIcon />
                </span>
                <span className="media-picker-text">
                  <strong>Add a cover photo</strong>
                  <span>
                    JPG, PNG or WEBP · up to 10 MB.{' '}
                    {category ? `Without one, the ${category} photo is used.` : 'Without one, the category photo is used.'}
                  </span>
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickCover} />
              </label>
            )}
          </div>

          <label className="field">
            <span className="field-label">Trip title</span>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Sunrise trek to Triund"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Destination</span>
            <input
              type="text"
              name="destination"
              value={form.destination}
              onChange={handleChange}
              placeholder="e.g. McLeod Ganj, Himachal Pradesh"
              required
            />
          </label>

          <div className="field">
            <span className="field-label">Category</span>
            <div className="chip-group">
              {TRIP_CATEGORIES.map(({ label }) => (
                <button
                  key={label}
                  type="button"
                  className={`chip${category === label ? ' chip-active' : ''}`}
                  aria-pressed={category === label}
                  onClick={() => {
                    setCategory(label)
                    setError('')
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Tell travelers what this trip is about"
              rows={4}
              required
            />
          </label>

          <div className="form-section">
            <h3 className="form-section-title">Itinerary</h3>
            {itinerary.length === 0 && (
              <p className="field-hint">Add a day-by-day breakdown so travelers know what to expect.</p>
            )}
            {itinerary.map((day, index) => (
              <div key={index} className="itinerary-row">
                <div className="itinerary-day-badge">Day {index + 1}</div>
                <div className="itinerary-fields">
                  <input
                    type="text"
                    value={day.title}
                    onChange={(e) => updateDay(index, 'title', e.target.value)}
                    placeholder="What happens on this day"
                  />
                  <textarea
                    value={day.description}
                    onChange={(e) => updateDay(index, 'description', e.target.value)}
                    rows={2}
                    placeholder="Details (optional)"
                  />
                </div>
                <button
                  type="button"
                  className="edit-icon-btn"
                  onClick={() => removeDay(index)}
                  aria-label={`Remove day ${index + 1}`}
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
            <button type="button" className="ghost-btn add-day-btn" onClick={addDay}>
              <PlusIcon />
              Add day
            </button>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Logistics</h3>

            <label className="field">
              <span className="field-label">Meeting point</span>
              <input
                type="text"
                name="meetingPoint"
                value={form.meetingPoint}
                onChange={handleChange}
                placeholder="e.g. McLeod Ganj bus stand, 6:00 am"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span className="field-label">Min group size</span>
                <input
                  type="number"
                  name="minGroupSize"
                  value={form.minGroupSize}
                  onChange={handleChange}
                  min="1"
                />
              </label>

              <label className="field">
                <span className="field-label">Max group size</span>
                <input
                  type="number"
                  name="maxGroupSize"
                  value={form.maxGroupSize}
                  onChange={handleChange}
                  min="1"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field-label">Price per person</span>
                <input
                  type="number"
                  name="pricePerPerson"
                  value={form.pricePerPerson}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  placeholder="e.g. 3499"
                />
              </label>

              <label className="field">
                <span className="field-label">Currency</span>
                <select name="currency" value={form.currency} onChange={handleChange}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span className="field-label">Start date</span>
                <input
                  type="date"
                  name="startDate"
                  min={addDays(todayISO(), 1)}
                  value={form.startDate}
                  onChange={handleChange}
                />
              </label>

              <label className="field">
                <span className="field-label">End date</span>
                <input
                  type="date"
                  name="endDate"
                  min={form.startDate || addDays(todayISO(), 1)}
                  value={form.endDate}
                  onChange={handleChange}
                />
              </label>
            </div>
            {form.startDate && (
              <p className="field-hint date-summary">
                {formatDateRange(form.startDate, form.endDate)}
                {form.endDate &&
                  ` · ${daysBetween(form.startDate, form.endDate) + 1} ${
                    form.startDate === form.endDate ? 'day' : 'days'
                  }`}
                {` · ${tripCountdown({ startDate: form.startDate, endDate: form.endDate })}`}
              </p>
            )}

            <label className="field">
              <span className="field-label">Booking deadline</span>
              <input
                type="date"
                name="bookingDeadline"
                min={todayISO()}
                max={form.startDate ? addDays(form.startDate, -1) : undefined}
                value={form.bookingDeadline}
                onChange={handleChange}
              />
              <span className="field-hint">
                {form.bookingDeadline
                  ? `${deadlineCountdown({ bookingDeadline: form.bookingDeadline })} — they close automatically after ${formatDate(form.bookingDeadline)}.`
                  : 'Bookings close automatically after this date, and in any case when the trip starts.'}
              </span>
            </label>

            <div className="field">
              <span className="field-label">Difficulty</span>
              <div className="chip-group">
                {DIFFICULTIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`chip${form.difficulty === level ? ' chip-active' : ''}`}
                    aria-pressed={form.difficulty === level}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        difficulty: prev.difficulty === level ? '' : level,
                      }))
                    }
                  >
                    {level[0].toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Languages offered</span>
              <div className="chip-group">
                {LANGUAGE_OPTIONS.map((language) => (
                  <button
                    key={language}
                    type="button"
                    className={`chip${languages.includes(language) ? ' chip-active' : ''}`}
                    aria-pressed={languages.includes(language)}
                    onClick={() => toggleLanguage(language)}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="form-section">
            <h3 className="form-section-title">What travellers get</h3>

            <label className="field">
              <span className="field-label">Highlights</span>
              <textarea
                name="highlights"
                value={form.highlights}
                onChange={handleChange}
                rows={3}
                placeholder="One per line"
              />
            </label>

            <label className="field">
              <span className="field-label">Included</span>
              <textarea
                name="included"
                value={form.included}
                onChange={handleChange}
                rows={3}
                placeholder="One per line"
              />
            </label>

            <label className="field">
              <span className="field-label">Not included</span>
              <textarea
                name="excluded"
                value={form.excluded}
                onChange={handleChange}
                rows={3}
                placeholder="One per line"
              />
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="submit"
              onClick={() => save('published')}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Publish trip'}
            </button>
            {!editing && (
              <button
                type="button"
                className="ghost-btn full-width"
                onClick={() => save('draft')}
                disabled={submitting}
              >
                Save as draft
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
