// Trip dates are calendar days ("YYYY-MM-DD") and the server decides booking
// windows in UTC, so day arithmetic here is done in UTC too.

const DAY_MS = 86_400_000

function parseDay(iso) {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
}

export function todayISO(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10)
}

export function addDays(iso, days) {
  return new Date(parseDay(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from today to `iso`: 0 today, 1 tomorrow, -1 yesterday. */
export function daysUntil(iso, now = Date.now()) {
  return Math.round((parseDay(iso) - parseDay(todayISO(now))) / DAY_MS)
}

export function daysBetween(startIso, endIso) {
  return Math.round((parseDay(endIso) - parseDay(startIso)) / DAY_MS)
}

/** "13 Nov 2026" (or "13 Nov" without the year). */
export function formatDate(iso, { year = true } = {}) {
  if (!iso) return ''
  return new Date(parseDay(iso)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(year && { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

/** "13–14 Nov 2026", "28 Nov – 2 Dec 2026", or a single date. */
export function formatDateRange(start, end) {
  if (!start) return ''
  if (!end || end === start) return formatDate(start)
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  if (sameYear && start.slice(5, 7) === end.slice(5, 7)) {
    return `${Number(start.slice(8, 10))}–${formatDate(end)}`
  }
  return `${formatDate(start, { year: !sameYear })} – ${formatDate(end)}`
}

/** "Starts in 12 days", "Starts tomorrow", "Happening now", "Ended". */
export function tripCountdown(trip, now = Date.now()) {
  if (!trip?.startDate) return ''
  const toStart = daysUntil(trip.startDate, now)
  if (toStart > 1) return `Starts in ${toStart} days`
  if (toStart === 1) return 'Starts tomorrow'
  if (toStart === 0) return 'Starts today'
  if (trip.endDate && daysUntil(trip.endDate, now) >= 0) return 'Happening now'
  return 'Ended'
}

/** "Bookings close in 3 days", "Last day to book", "Bookings closed". */
export function deadlineCountdown(trip, now = Date.now()) {
  if (!trip?.bookingDeadline) return ''
  const left = daysUntil(trip.bookingDeadline, now)
  if (left < 0) return 'Bookings closed'
  if (left === 0) return 'Last day to book'
  if (left === 1) return 'Bookings close tomorrow'
  return `Bookings close in ${left} days`
}

/**
 * The server's booking window (deadline not passed, trip not started), checked
 * against the clock, so a Book button turns off the moment the window shuts.
 */
export function canBookNow(trip, now = Date.now()) {
  if (!trip?.bookable) return false
  if (trip.bookingDeadline && daysUntil(trip.bookingDeadline, now) < 0) return false
  if (trip.startDate && daysUntil(trip.startDate, now) <= 0) return false
  return true
}

/** Before the trip's first day, a traveller can still cancel from the app. */
export function beforeTripStarts(trip, now = Date.now()) {
  return !trip?.startDate || daysUntil(trip.startDate, now) > 0
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a date. */
export function timeAgo(timestamp, now = Date.now()) {
  if (!timestamp) return ''
  const then = new Date(`${timestamp.replace(' ', 'T')}Z`).getTime()
  const minutes = Math.floor(Math.max(0, now - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(timestamp.slice(0, 10))
}
