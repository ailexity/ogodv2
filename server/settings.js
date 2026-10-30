import { db } from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

/**
 * Platform settings the admin can change. Every one of these actually changes
 * behaviour somewhere — none are decorative toggles.
 */
export const SETTING_DEFINITIONS = {
  service_fee_rate: {
    label: 'Service fee',
    hint: 'Share of the base price OGod adds at checkout.',
    type: 'rate',
    default: 0.08,
    min: 0,
    max: 0.5,
  },
  tax_rate: {
    label: 'Tax rate',
    hint: 'Applied to the base price plus service fee.',
    type: 'rate',
    default: 0.05,
    min: 0,
    max: 0.5,
  },
  guide_applications_open: {
    label: 'Guide applications',
    hint: 'When off, travelers cannot submit new verification applications.',
    type: 'boolean',
    default: true,
  },
  guide_subscription_fee: {
    label: 'Guide subscription (₹ per year)',
    hint: 'What a guide pays OGod each year to stay verified and post trips.',
    type: 'amount',
    default: 3000,
    min: 0,
    max: 100000,
  },
  platform_upi: {
    label: 'OGod UPI ID',
    hint: 'Where guides pay the yearly subscription. Shown on the guide application.',
    type: 'text',
    default: '',
    maxLength: 100,
  },
  bookings_enabled: {
    label: 'Bookings',
    hint: 'When off, no new bookings can be placed anywhere on the platform.',
    type: 'boolean',
    default: true,
  },
}

function parse(key, raw) {
  const definition = SETTING_DEFINITIONS[key]
  if (definition.type === 'boolean') return raw === 'true'
  if (definition.type === 'text') return raw
  const value = Number(raw)
  return Number.isFinite(value) ? value : definition.default
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]))

  return Object.fromEntries(
    Object.entries(SETTING_DEFINITIONS).map(([key, definition]) => [
      key,
      key in stored ? parse(key, stored[key]) : definition.default,
    ]),
  )
}

export function getSetting(key) {
  return getSettings()[key]
}

/** Returns `{ error }` when a value is out of range, otherwise the new settings. */
export function updateSettings(patch) {
  const write = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )

  const pending = []
  for (const [key, raw] of Object.entries(patch ?? {})) {
    const definition = SETTING_DEFINITIONS[key]
    if (!definition) return { error: `Unknown setting: ${key}` }

    if (definition.type === 'text') {
      const value = String(raw ?? '').trim()
      if (value.length > definition.maxLength) return { error: `${definition.label} is too long` }
      pending.push([key, value])
      continue
    }

    if (definition.type === 'boolean') {
      // The string "false" is truthy, so compare explicitly.
      pending.push([key, raw === true || raw === 'true' ? 'true' : 'false'])
      continue
    }

    const value = Number(raw)
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
      const range =
        definition.type === 'rate'
          ? `${definition.min * 100}% and ${definition.max * 100}%`
          : `${definition.min} and ${definition.max}`
      return { error: `${definition.label} must be between ${range}` }
    }
    pending.push([key, String(value)])
  }

  db.transaction(() => {
    for (const [key, value] of pending) write.run(key, value)
  })()

  return { settings: getSettings() }
}
