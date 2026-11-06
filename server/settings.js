import { db } from './db.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

/**
 * Platform switches the admin can change. Every one of these actually changes
 * behaviour somewhere — none are decorative toggles.
 */
export const SETTING_DEFINITIONS = {
  trip_posting_enabled: {
    label: 'Trip posting',
    hint: 'When off, no new trips can be posted anywhere on the platform.',
    default: true,
  },
  bookings_enabled: {
    label: 'Bookings',
    hint: 'When off, no new bookings can be placed anywhere on the platform.',
    default: true,
  },
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]))

  return Object.fromEntries(
    Object.entries(SETTING_DEFINITIONS).map(([key, definition]) => [
      key,
      key in stored ? stored[key] === 'true' : definition.default,
    ]),
  )
}

export function getSetting(key) {
  return getSettings()[key]
}

/** Returns `{ error }` for a setting that doesn't exist, otherwise the new settings. */
export function updateSettings(patch) {
  const write = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )

  const pending = []
  for (const [key, raw] of Object.entries(patch ?? {})) {
    if (!SETTING_DEFINITIONS[key]) return { error: `Unknown setting: ${key}` }
    // The string "false" is truthy, so compare explicitly.
    pending.push([key, raw === true || raw === 'true' ? 'true' : 'false'])
  }

  db.transaction(() => {
    for (const [key, value] of pending) write.run(key, value)
  })()

  return { settings: getSettings() }
}
