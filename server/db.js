import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { hashPassword } from './password.js'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.join(serverDir, 'data')
export const UPLOADS_DIR = path.join(serverDir, 'uploads')
export const BLOG_MEDIA_DIR = path.join(serverDir, 'blog-media')

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(UPLOADS_DIR, { recursive: true })
mkdirSync(BLOG_MEDIA_DIR, { recursive: true })

export const db = new Database(path.join(DATA_DIR, 'ogod.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'traveler'
                  CHECK (role IN ('traveler', 'guide', 'admin')),
    name          TEXT    NOT NULL,
    age           INTEGER,
    phone         TEXT,
    address       TEXT,
    interests     TEXT    NOT NULL DEFAULT '[]',
    bio           TEXT,
    languages     TEXT    NOT NULL DEFAULT '[]',
    guide_status  TEXT    NOT NULL DEFAULT 'none'
                  CHECK (guide_status IN ('none', 'pending', 'verified', 'rejected', 'suspended')),
    certified     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guide_applications (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    years_experience INTEGER NOT NULL DEFAULT 0,
    languages        TEXT    NOT NULL DEFAULT '[]',
    areas            TEXT    NOT NULL DEFAULT '[]',
    license_number   TEXT,
    license_region   TEXT,
    license_expires  TEXT,
    sample_itinerary TEXT,
    id_document      TEXT,
    selfie           TEXT,
    license_document TEXT,
    address_proof    TEXT,
    review_notes     TEXT,
    reviewed_by      INTEGER REFERENCES users(id),
    reviewed_at      TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_applications_status ON guide_applications(status);
  CREATE INDEX IF NOT EXISTS idx_applications_user   ON guide_applications(user_id);

  CREATE TABLE IF NOT EXISTS trips (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    guide_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               TEXT    NOT NULL,
    destination         TEXT    NOT NULL,
    category            TEXT    NOT NULL,
    description         TEXT    NOT NULL DEFAULT '',
    status              TEXT    NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'booking_open', 'booking_closed',
                                          'confirmed', 'ongoing', 'completed', 'archived', 'cancelled')),
    cover_image         TEXT,
    duration_days       INTEGER,
    meeting_point       TEXT,
    min_group_size      INTEGER NOT NULL DEFAULT 1,
    max_group_size      INTEGER NOT NULL DEFAULT 10,
    price_per_person    REAL    NOT NULL DEFAULT 0,
    currency            TEXT    NOT NULL DEFAULT 'USD',
    difficulty          TEXT    CHECK (difficulty IN ('easy', 'moderate', 'challenging', 'strenuous')),
    languages           TEXT    NOT NULL DEFAULT '[]',
    included            TEXT    NOT NULL DEFAULT '[]',
    excluded            TEXT    NOT NULL DEFAULT '[]',
    highlights          TEXT    NOT NULL DEFAULT '[]',
    start_date          TEXT,
    end_date            TEXT,
    booking_deadline    TEXT,
    instant_book        INTEGER NOT NULL DEFAULT 0,
    rating              REAL    NOT NULL DEFAULT 0,
    review_count        INTEGER NOT NULL DEFAULT 0,
    cancellation_reason TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
  CREATE INDEX IF NOT EXISTS idx_trips_guide  ON trips(guide_id);

  CREATE TABLE IF NOT EXISTS trip_itinerary_days (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_number  INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    UNIQUE (trip_id, day_number)
  );

  -- A traveler's seat on a trip. "completed" is what makes a trip show up as
  -- one they have actually attended (doc §6 steps 5-9).
  CREATE TABLE IF NOT EXISTS bookings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    travelers    INTEGER NOT NULL DEFAULT 1,
    status       TEXT    NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    total_paid   REAL    NOT NULL DEFAULT 0,
    booked_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);

  -- One live booking per traveler per trip, but a cancelled or declined one
  -- must not block them from applying again.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active
    ON bookings(trip_id, user_id) WHERE status != 'cancelled';

  -- One row per person on a booking. Only the lead traveler carries contact
  -- details; companions are recorded by name, age and gender alone.
  CREATE TABLE IF NOT EXISTS booking_travelers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    is_lead    INTEGER NOT NULL DEFAULT 0,
    name       TEXT    NOT NULL,
    age        INTEGER,
    gender     TEXT,
    phone      TEXT,
    email      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_booking_travelers ON booking_travelers(booking_id);

  -- Travel stories shown on the home feed. Anyone signed in can post one;
  -- an admin can hide or delete a story without touching the author's account.
  CREATE TABLE IF NOT EXISTS blogs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    content     TEXT    NOT NULL DEFAULT '',
    location    TEXT,
    media_type  TEXT    CHECK (media_type IN ('image', 'video')),
    media_url   TEXT,
    status      TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_blogs_status ON blogs(status);
  CREATE INDEX IF NOT EXISTS idx_blogs_author ON blogs(author_id);
`)

/** Adds a column to an already-created table, so existing dev databases keep working. */
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('bookings', 'notes', 'TEXT')
ensureColumn('bookings', 'guide_note', 'TEXT')
ensureColumn('bookings', 'service_fee', 'REAL NOT NULL DEFAULT 0')
ensureColumn('bookings', 'tax', 'REAL NOT NULL DEFAULT 0')
ensureColumn('users', 'disabled', 'INTEGER NOT NULL DEFAULT 0')

/** Guards the admin People screen from locking the platform out of its own console. */
export function isLastEnabledAdmin(userId) {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0 AND id != ?",
    )
    .get(userId)
  return row.n === 0
}

/**
 * Early databases carried a blanket UNIQUE(trip_id, user_id) on bookings, which
 * permanently locked a traveler out of a trip once their booking was declined.
 * Rebuild the table without it; the partial index above enforces the real rule.
 */
function dropLegacyBookingConstraint() {
  const schema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bookings'")
    .get()?.sql

  if (!schema || !/UNIQUE\s*\(\s*trip_id\s*,\s*user_id\s*\)/i.test(schema)) return

  const columns = db
    .prepare('PRAGMA table_info(bookings)')
    .all()
    .map((c) => c.name)
    .join(', ')

  db.pragma('foreign_keys = OFF')
  db.transaction(() => {
    db.exec(`
      CREATE TABLE bookings_rebuilt (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        travelers    INTEGER NOT NULL DEFAULT 1,
        status       TEXT    NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
        total_paid   REAL    NOT NULL DEFAULT 0,
        service_fee  REAL    NOT NULL DEFAULT 0,
        tax          REAL    NOT NULL DEFAULT 0,
        notes        TEXT,
        guide_note   TEXT,
        booked_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );
      INSERT INTO bookings_rebuilt (${columns}) SELECT ${columns} FROM bookings;
      DROP TABLE bookings;
      ALTER TABLE bookings_rebuilt RENAME TO bookings;
      CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active
        ON bookings(trip_id, user_id) WHERE status != 'cancelled';
    `)
  })()
  db.pragma('foreign_keys = ON')
}

dropLegacyBookingConstraint()

/**
 * The app ships with no demo content. The one exception is a single
 * administrator, because guide verification (doc §4) needs a reviewer before
 * anyone can post a trip — an install with zero admins cannot bootstrap itself.
 * Override with OGOD_ADMIN_EMAIL / OGOD_ADMIN_PASSWORD.
 */
function ensureAdminAccount() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n
  if (existing > 0) return

  const email = (process.env.OGOD_ADMIN_EMAIL ?? 'admin@ogod.app').trim().toLowerCase()
  const password = process.env.OGOD_ADMIN_PASSWORD ?? 'ChangeMe@123'

  db.prepare(
    `INSERT INTO users (email, password_hash, role, name, guide_status)
     VALUES (?, ?, 'admin', ?, 'none')`,
  ).run(email, hashPassword(password), process.env.OGOD_ADMIN_NAME ?? 'Administrator')

  if (!process.env.OGOD_ADMIN_PASSWORD) {
    console.warn(
      `[ogod] Created the first admin account (${email}) with the default password. ` +
        'Set OGOD_ADMIN_EMAIL / OGOD_ADMIN_PASSWORD before first run, or change it now.',
    )
  }
}

ensureAdminAccount()
