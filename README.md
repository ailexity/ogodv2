# OGod
hello people

A guided-travel marketplace. Travelers sign up, browse trips and book seats; guides get verified by an admin, publish trips and manage applicants; admins run the platform from a separate console.

- **Frontend** — React 18 + Vite, no router (views are driven by state in `src/App.jsx`), plain CSS in `src/index.css`.
- **Backend** — Express 5 on Node, SQLite via `better-sqlite3`, JWT auth, `multer` for file uploads.
- **Database** — a single SQLite file (`server/data/ogod.db`, WAL mode). The schema is created and migrated in code on boot — there is no migration tool and no ORM.

## Table of contents

- [Project structure](#project-structure)
- [Roles and features](#roles-and-features)
- [Data model](#data-model)
- [API surface](#api-surface)
- [Configuration](#configuration)
- [Running locally](#running-locally)
- [Login credentials](#login-credentials)
- [Deployment](#deployment)

## Project structure

```
index.html              Vite entry
vite.config.js          Dev server: binds 0.0.0.0, proxies /api to the backend
src/
  main.jsx              React root
  App.jsx               Session bootstrap + top-level view switch (auth / traveler / admin)
  api/client.js         Single fetch wrapper; every endpoint the UI calls lives here
  components/           Traveler + guide UI (Home, TripForm, BookTrip, Blogs, …)
  components/admin/     Admin console (overview, people, blogs, settings)
  data/                 Static option lists (categories, interests, facts)
server/
  index.js              Express app, route mounting, error handler, listen()
  db.js                 SQLite connection, schema, in-code migrations, admin bootstrap
  auth.js               JWT sign/verify, authenticate / optionalAuth / requireAdmin guards
  password.js           scrypt hashing with timing-safe comparison
  settings.js           Admin-editable platform settings (fees, feature switches)
  routes/               auth, guides, admin, trips, bookings, blogs
  data/                 SQLite database + generated JWT secret   (gitignored)
  uploads/              Guide verification documents               (gitignored)
  blog-media/           Blog photos and videos                     (gitignored)
  trip-media/           Trip cover photos uploaded by guides       (gitignored)
```

## Roles and features

Every account is one of `traveler`, `guide` or `admin`. New sign-ups always start as `traveler`.

**Traveler**
- Register, sign in, reset password, edit profile (age, phone, address, bio, interests, languages).
- Browse and filter published trips, view trip detail with a day-by-day itinerary.
- Book a seat for a party of travelers — only the lead traveler gives contact details. A live `/bookings/quote` call shows the exact price breakdown the server will charge.
- Post travel stories (blogs) with a photo or video, and see everyone else's on the home feed.
- Apply for guide verification: experience, languages, areas, licence details, sample itinerary and four documents (ID, selfie, licence, address proof).

**Guide** (a traveler whose application was approved)
- Create, edit, duplicate and delete trips: destination, category, cover image, duration, meeting point, group size, price, currency, difficulty, languages, inclusions/exclusions, highlights, dates, booking deadline and instant-book.
- Move a trip through its lifecycle: `draft → published → booking_open → booking_closed → confirmed → ongoing → completed`, plus `archived` and `cancelled`.
- Review booking requests — approve or decline with a note. Trips with instant-book on confirm bookings automatically; otherwise a booking lands as `pending`.

**Admin**
- Gets the moderation console instead of the traveler app.
- Review, approve and reject guide applications, including viewing the uploaded documents.
- Suspend and reinstate guides.
- Manage people: search, edit, change role, reset password, disable/enable, delete. The last enabled admin is protected from being locked out.
- Hide or unhide blog posts without touching the author's account.
- Change platform settings — service fee rate, tax rate, and switches for guide applications and bookings. Every setting changes real behaviour.

## Data model

`users`, `guide_applications`, `trips`, `trip_itinerary_days`, `bookings`, `booking_travelers`, `blogs`, `settings`.

Two details worth knowing before you touch the schema:

- New columns are added at boot by `ensureColumn()` in [server/db.js](server/db.js), so existing dev databases keep working across pulls.
- `bookings` uses a **partial** unique index on `(trip_id, user_id) WHERE status != 'cancelled'` — one live booking per traveler per trip, while still allowing someone whose booking was declined to apply again. `dropLegacyBookingConstraint()` rebuilds the table for databases created before that rule existed.

## API surface

All routes are under `/api`. `GET /api/health` returns `{ ok: true }`.

| Prefix          | Auth              | What it covers                                                                 |
| --------------- | ----------------- | ------------------------------------------------------------------------------ |
| `/api/auth`     | mixed             | register, login, reset-password, `GET/PATCH /me`, `POST /me/tour` (first-run tour seen) |
| `/api/guides`   | signed in         | submit a verification application (multipart), read your own application       |
| `/api/trips`    | mixed             | list/filter/read trips (public), create/update/status/duplicate/delete (guide) |
| `/api/bookings` | signed in         | quote, create, my bookings, trip bookings, requests, approve, decline          |
| `/api/blogs`    | mixed             | list/read (public), create (multipart), delete own, serve media                |
| `/api/admin`    | admin only        | applications, guides, users, blogs, stats, settings, document downloads        |

Auth is a bearer JWT (7-day TTL) stored in `localStorage` under `ogod_token`. Passwords are scrypt-hashed. Uploads are re-named to random hex plus an extension derived from the vetted MIME type, so a client-supplied filename can never escape the upload directory. Limits: **5 MB × 4 files** for verification documents (JPG/PNG/WEBP/PDF), **25 MB × 1 file** for blog media (JPG/PNG/WEBP/MP4/WEBM/MOV).

## Configuration

All backend configuration is environment variables — there is no config file.

| Variable               | Default          | Notes                                                                                  |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `PORT`                 | `4000`           | API port.                                                                              |
| `HOST`                 | `0.0.0.0`        | Interface the API binds to. `0.0.0.0` listens on every interface; the startup log prints the actual addresses. |
| `OGOD_API_URL`         | `http://localhost:$PORT` | Dev only — where the Vite proxy sends `/api`. Set it (env or `.env.local`) only if the API runs on a different machine. |
| `OGOD_JWT_SECRET`      | *generated*      | **Set this in production.** Without it the server writes a random secret to `server/data/.jwt-secret` and reuses it — fine for dev, but it lives with the database and is not shared across instances. |
| `OGOD_ADMIN_EMAIL`     | `admin@ogod.app` | Only read on the very first boot against an empty database.                             |
| `OGOD_ADMIN_PASSWORD`  | `ChangeMe@123`   | Same. The server logs a warning if the default is used. Change it later in Admin → Settings → Change password. |
| `OGOD_ADMIN_NAME`      | `Administrator`  | Same.                                                                                   |

The frontend takes no build-time configuration: `src/api/client.js` always calls the relative path `/api`, so whatever serves the frontend must also route `/api` to the backend.

## Running locally

Requires **Node 22+** — `better-sqlite3@13` declares `engines: { node: ">=22" }`. It ships prebuilt native bindings for Linux, macOS and Windows on x64 and arm64, so no compiler is needed on a mainstream platform.

```bash
npm install
npm run server   # API on port 4000
npm run dev      # Frontend on port 5173
```

Both are bound to `0.0.0.0`, so the app is reachable from any device on the same network. No address is hardcoded: on startup the API and Vite each print the URLs they're reachable on (`localhost` plus your machine's current LAN IPs) — open the Vite **Network** URL from another device. The Vite dev server proxies `/api` to `http://localhost:4000`, which works on any network because both run on the same machine.

`npm run build` produces a static bundle in `dist/`; `npm run preview` serves that build locally.

## Login credentials

### Admin

The app has no seeded demo content, except for a single bootstrap admin account that is created automatically the first time the server runs with an empty database.

| Field    | Value              |
| -------- | ------------------ |
| Email    | `admin@ogod.app`   |
| Password | `ChangeMe@123`     |

Change this password after first login, or set `OGOD_ADMIN_EMAIL` / `OGOD_ADMIN_PASSWORD` / `OGOD_ADMIN_NAME` env vars before the first run to override the defaults.

### Traveler / Guide demo accounts

There are none by default — every non-admin account is created by signing up at `/api/auth/register` (all new sign-ups start as `traveler`). To test the guide flow: register a normal account, then apply for guide verification and approve the application from the admin account above.

## Deployment

There is no Dockerfile, CI pipeline or host configuration in this repository — the steps below are the manual process the code supports today.

### Before you deploy: known blockers

Read these first.

1. **Change the bootstrap admin password.** Set `OGOD_ADMIN_EMAIL` / `OGOD_ADMIN_PASSWORD` before the first boot; otherwise the first admin is created with `ChangeMe@123`.
2. **Set `OGOD_APP_URL`.** With `NODE_ENV=production` the server refuses to email verification or reset links without it, because the fallback (the request's `Origin` header) can be forged.
3. **CORS is off in production** unless `OGOD_CORS_ORIGIN` lists the allowed origins; a same-origin nginx setup needs nothing. Rate limits are in memory, so they reset on restart and do not span multiple instances.

### What kind of server you need

**Short answer: one small Linux VPS with a persistent disk.** A single 1–2 vCPU / 2 GB VM running Node and nginx hosts the entire application — API, database and file storage included. There is no separate database tier and no object store, because SQLite is a file on disk and uploads are directories on that same disk.

#### Server profile

| Requirement | What to provision | Why this, specifically |
| ----------- | ----------------- | ---------------------- |
| **Type** | A VM / VPS, or a container platform with an attached volume | Needs a persistent, writable, local filesystem — see the storage note below |
| **OS** | Any modern Linux, x64 or arm64. glibc (Ubuntu/Debian/RHEL) and musl (Alpine) both work | `better-sqlite3` v13 bundles prebuilt bindings for `linux-x64`, `linux-arm64`, `linuxmusl-x64` and `linuxmusl-arm64` |
| **Node** | **Node 22 or newer** | `better-sqlite3@13.0.2` declares `engines: { node: ">=22" }`. Express 5 needs ≥18, so 22 satisfies everything |
| **CPU** | 1 vCPU minimum, 2 vCPU comfortable. Favour clock speed over core count | `better-sqlite3` is a **synchronous** driver — every query blocks the event loop of a single Node process. Extra cores do not increase API throughput; they only buy headroom for nginx, TLS and the OS |
| **RAM** | 1 GB runs it; **2 GB recommended** | Node idles near ~100 MB, plus SQLite page cache and nginx. The 2 GB is headroom for upload buffering and for running `npm run build` on the box (see below) |
| **Disk** | 20 GB SSD to start, growing with media | Breakdown below. Must be a real block device, not a network mount |
| **Bandwidth** | Whatever your media traffic needs | Blog videos are served by Node itself via `res.sendFile`, with no CDN in front |

#### Storage: the one constraint that dictates the host

Four directories hold every piece of state, and none are in git:

- `server/data/` — the SQLite database (`ogod.db`, `.db-wal`, `.db-shm`) and the generated JWT secret
- `server/uploads/` — guide verification documents
- `server/blog-media/` — blog photos and videos
- `server/trip-media/` — trip cover photos (up to 10 MB each)

That has hard consequences for host choice:

- **No ephemeral filesystems.** Vercel/Netlify functions, Cloud Run, Heroku dynos and any scale-to-zero container without a mounted volume will silently lose the database between deploys or restarts. This app cannot run serverless.
- **No NFS, EFS or SMB for `server/data/`.** SQLite's WAL mode needs a shared-memory index (`.db-shm`) and working POSIX file locking; network filesystems provide neither reliably, and the documented failure mode is a corrupted database rather than an error. A local SSD or an attached block volume (EBS, Persistent Disk, DigitalOcean Volume) is fine.
- **Exactly one API instance.** SQLite has no cross-host coordination, so you cannot run two app servers against one database. Vertical scaling only — no load balancer fronting multiple app nodes, no `pm2 -i max` cluster mode.

Disk sizing, from actual measured sizes:

| Item | Size |
| ---- | ---- |
| Built frontend (`dist/`) | ~305 KB |
| `node_modules` | 74 MB as installed here (including dev dependencies), of which `better-sqlite3` alone is 27 MB |
| Database, current dev data | under 1 MB — it grows slowly, since rows are text |
| Guide verification documents | up to **20 MB per application** (4 files × 5 MB cap) |
| Blog media | up to **25 MB per post** (1 file × 25 MB cap) |

Media is what actually consumes the disk. A rough budget: `20 GB ≈ 800 blog posts at full size`, and in practice far more, since most uploads are photos rather than 25 MB videos. Nothing prunes or transcodes uploads, and deleting a blog row does not delete its file — plan to monitor free space.

#### Concrete options

- **Recommended:** a $12/mo-class VPS — DigitalOcean/Hetzner/Linode 2 vCPU / 2 GB / 50 GB SSD, or an AWS `t4g.small` with an EBS volume. Ubuntu LTS, nginx, systemd.
- **Cheapest that works:** 1 vCPU / 1 GB / 25 GB. Build the frontend on your laptop or in CI and copy `dist/` up — `vite build` on a 1 GB box with nothing else running is tight.
- **Containers:** fine on Fly.io, Render or ECS **only** with a persistent volume mounted at `server/` and `min_instances = 1`. Alpine images work.
- **Do not use:** Vercel, Netlify Functions, Lambda, Workers, or any host billing itself as "no filesystem". You can still host the *frontend* there if you point `/api` at a separate always-on API box.

#### What you do not need

No managed Postgres/MySQL, no Redis, no S3 bucket, no message queue, no Kubernetes. If the app outgrows a single box, the migration is to Postgres plus object storage for uploads — a code change, not a hosting change.

#### Toolchain note

`better-sqlite3` ships precompiled `.node` bindings for all mainstream platforms inside the published package, so a normal Linux host needs **no compiler** — plain `npm ci` works. You only need `python3`, `make` and a C++ compiler on platforms with no prebuild (FreeBSD, 32-bit ARM, unusual libc). Still run `npm ci` on the target rather than copying `node_modules` from a dev machine.

### 1. Build the frontend

```bash
npm ci
npm run build      # → dist/
```

`dist/` is a plain static bundle. The app has no client-side router, so no SPA rewrite rules are needed — but every request to `/api/*` must reach the backend.

### 2. Run the API

```bash
npm ci --omit=dev
export OGOD_JWT_SECRET="$(openssl rand -hex 48)"
export OGOD_ADMIN_EMAIL="you@example.com"
export OGOD_ADMIN_PASSWORD="<a real password>"
export PORT=4000
node server/index.js
```

Set `OGOD_ADMIN_*` **before the first boot** — they are only read when the database has zero admins. Keep `OGOD_JWT_SECRET` stable across restarts and deploys; changing it signs everyone out.

Under systemd:

```ini
[Unit]
Description=OGod API
After=network.target

[Service]
WorkingDirectory=/srv/ogod
ExecStart=/usr/bin/node server/index.js
Environment=NODE_ENV=production
Environment=PORT=4000
EnvironmentFile=/etc/ogod.env      # secrets live here, mode 0600
Restart=always
User=ogod

[Install]
WantedBy=multi-user.target
```

`pm2 start server/index.js --name ogod-api` works equally well if you already run pm2.

### 3. Put a reverse proxy in front

Serve `dist/` as static files and forward `/api` to the API on the same origin — that keeps `src/api/client.js`'s relative `/api` calls working and avoids CORS entirely.

```nginx
server {
  listen 443 ssl;
  server_name ogod.example.com;

  # Blog uploads are capped at 25 MB server-side; nginx defaults to 1 MB.
  client_max_body_size 25m;

  root /srv/ogod/dist;
  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

The `client_max_body_size` line matters: without it nginx rejects blog video uploads with a 413 before Express ever sees them. Caddy has no such default limit.

If you must host the frontend separately from the API, you have to either rewrite `/api` at the static host's edge or change `src/api/client.js` to use an absolute base URL — and then narrow the CORS origin on the server instead of the current open policy.

### 4. Upgrades

```bash
git pull && npm ci && npm run build && systemctl restart ogod-api
```

Schema changes apply themselves on boot from [server/db.js](server/db.js) — there is no migrate command and **no down-migration**, so back up before deploying a schema change.

### Backups

The database runs in WAL mode, so copying `ogod.db` alone can capture a torn state. Back it up with SQLite's own backup API and archive the upload directories alongside it:

```bash
sqlite3 server/data/ogod.db ".backup '/backups/ogod-$(date +%F).db'"
tar czf /backups/ogod-media-$(date +%F).tar.gz server/uploads server/blog-media server/trip-media
```

A database restore is only consistent with the media directories from the same run — restore both together, or verification documents and blog media will point at files that are not there.
