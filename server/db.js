import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { hashPassword } from './password.js'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.join(serverDir, 'data')
export const UPLOADS_DIR = path.join(serverDir, 'uploads')
export const BLOG_MEDIA_DIR = path.join(serverDir, 'blog-media')
export const CHAT_MEDIA_DIR = path.join(serverDir, 'chat-media')

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(UPLOADS_DIR, { recursive: true })
mkdirSync(BLOG_MEDIA_DIR, { recursive: true })
mkdirSync(CHAT_MEDIA_DIR, { recursive: true })

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
    reviewed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
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

/**
 * Adds a column to an already-created table, so existing dev databases keep
 * working. Returns true when the column was added just now.
 */
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (columns.some((c) => c.name === column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

ensureColumn('bookings', 'notes', 'TEXT')
ensureColumn('bookings', 'guide_note', 'TEXT')
ensureColumn('bookings', 'service_fee', 'REAL NOT NULL DEFAULT 0')
ensureColumn('bookings', 'tax', 'REAL NOT NULL DEFAULT 0')
ensureColumn('users', 'disabled', 'INTEGER NOT NULL DEFAULT 0')
// Accounts that existed before email verification was introduced are trusted as
// verified; only sign-ups from here on have to confirm their address.
if (ensureColumn('users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0')) {
  db.exec('UPDATE users SET email_verified = 1')
}
ensureColumn('users', 'google_id', 'TEXT')
// Bumped whenever a password changes, which invalidates every token issued before it.
ensureColumn('users', 'token_version', 'INTEGER NOT NULL DEFAULT 0')
// Where travellers pay a guide; quoted in the automatic message after each booking.
ensureColumn('users', 'payout_upi', 'TEXT')
ensureColumn('users', 'payout_bank', 'TEXT')
// Guides pay OGod a yearly subscription. Guides verified before it existed get a
// year from today rather than being locked out.
if (ensureColumn('users', 'subscription_until', 'TEXT')) {
  db.exec("UPDATE users SET subscription_until = date('now', '+1 year') WHERE guide_status IN ('verified', 'suspended')")
}
// Set once the first-run app tour is finished or skipped. Accounts from before
// the tour existed already know their way around, so they never see it.
if (ensureColumn('users', 'tour_completed_at', 'TEXT')) {
  db.exec("UPDATE users SET tour_completed_at = datetime('now')")
}
// unpaid → proof_sent (traveller sent a screenshot) → received (guide checked it).
ensureColumn('bookings', 'payment_status', "TEXT NOT NULL DEFAULT 'unpaid'")
// Who ended a cancelled booking: 'traveler', 'guide' (declined) or 'trip' (trip cancelled).
ensureColumn('bookings', 'cancelled_by', 'TEXT')
ensureColumn('guide_applications', 'fee_receipt', 'TEXT')
// 'verification' (first application) or 'renewal' (yearly subscription only).
ensureColumn('guide_applications', 'kind', "TEXT NOT NULL DEFAULT 'verification'")

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id) WHERE google_id IS NOT NULL;

  -- Single-use links sent by email. Only a SHA-256 of the token is stored, so a
  -- leaked database cannot be used to verify or reset anyone's account.
  CREATE TABLE IF NOT EXISTS email_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    TEXT    NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash TEXT    NOT NULL UNIQUE,
    expires_at TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, purpose);

  -- Private chat between a traveller and a guide, one thread per pair. Each
  -- side's last-read message id drives the unread badges.
  CREATE TABLE IF NOT EXISTS conversations (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    traveler_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guide_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id            INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    traveler_last_read INTEGER NOT NULL DEFAULT 0,
    guide_last_read    INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (traveler_id, guide_id)
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_guide ON conversations(guide_id);

  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT    NOT NULL DEFAULT '',
    image           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);

  -- One vote per person per story: 1 is an upvote, -1 a dislike.
  CREATE TABLE IF NOT EXISTS blog_votes (
    blog_id    INTEGER NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value      INTEGER NOT NULL CHECK (value IN (1, -1)),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (blog_id, user_id)
  );
`)

// Messages the app sends on the guide's behalf carry a kind and the booking they
// are about, so the chat can show booking and ticket cards.
ensureColumn('messages', 'kind', "TEXT NOT NULL DEFAULT 'text'")
ensureColumn('messages', 'booking_id', 'INTEGER REFERENCES bookings(id) ON DELETE SET NULL')
// A chat started from a story keeps the story it is about, like trip_id for trips.
ensureColumn('conversations', 'blog_id', 'INTEGER REFERENCES blogs(id) ON DELETE SET NULL')

db.exec(`
  -- Trips a person has saved with the heart on the trip page.
  CREATE TABLE IF NOT EXISTS wishlist (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, trip_id)
  );
`)

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
        payment_status TEXT  NOT NULL DEFAULT 'unpaid',
        cancelled_by TEXT,
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
    `INSERT INTO users (email, password_hash, role, name, guide_status, email_verified)
     VALUES (?, ?, 'admin', ?, 'none', 1)`,
  ).run(email, hashPassword(password), process.env.OGOD_ADMIN_NAME ?? 'Administrator')

  if (!process.env.OGOD_ADMIN_PASSWORD) {
    console.warn(
      `[ogod] Created the first admin account (${email}) with the default password. ` +
        'Set OGOD_ADMIN_EMAIL / OGOD_ADMIN_PASSWORD before first run, or change it now.',
    )
  }
}

ensureAdminAccount()
