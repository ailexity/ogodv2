# OGod

## Running the app

```bash
npm run server   # API on http://172.20.10.3:4000
npm run dev      # Frontend on http://172.20.10.3:5173
```

Both are bound to `0.0.0.0`, so open `http://172.20.10.3:5173` from any device on the same network. The Vite dev server proxies `/api` requests to the backend.

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
