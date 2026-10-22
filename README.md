# Diwali party site (Vercel + Neon)
Static page in `public/`, serverless API in `api/`, Postgres on Neon.

## Deploy (about 20 min, all free tiers)
1. **Neon**: create a project at neon.tech. Open its SQL Editor, paste `schema.sql`, run. Copy the connection string (DATABASE_URL).
2. **GitHub**: create a repo, upload these files (never upload `.env`).
3. **Vercel**: Add New > Project > import the repo. Under Environment Variables add:
   `DATABASE_URL`, `MAPS_URL`, `ADMIN_PASSWORD` (long passphrase), `SESSION_SECRET` (long random string). Deploy.
4. Share `https://<project>.vercel.app/`. Admin: `/admin.html`.

## Your database access
Neon dashboard > your project > Tables / SQL Editor: view, search, edit, delete, export rows. Rotate DB password in Neon, then update `DATABASE_URL` in Vercel and redeploy. Change `ADMIN_PASSWORD` the same way.

## How it works
- `POST /api/rsvp` validates server-side, saves, and only then returns `MAPS_URL` (going guests only). The link is never in the page or repo.
- Duplicates: each save returns a random edit token (only its hash is stored). The browser keeps it and re-submitting updates the same row. A new device creates a new row, since same names are not assumed to be the same person. Delete extras in the admin page.
- `/api/admin` needs the password (HttpOnly cookie, 8h). Wrong-password attempts are rate limited.
- Limits: rate limiting is per serverless instance (best effort); anyone with the link can share it. Local dev: `npm i -g vercel`, copy `.env.example` to `.env`, `vercel dev`.
