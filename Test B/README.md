# Local Social Clubs Finder

A compact full-stack web application for browsing local clubs and community groups. It uses Node.js, Express, EJS, SQLite, and session-based authentication.

## Features

- Search clubs by name, activity type, and location
- Filter by category, age group, free or paid, indoor or outdoor, and meeting frequency
- Register, login, and logout with session-based authentication
- Save favourite clubs when logged in
- Submit interest/contact requests to clubs
- Leave reviews and ratings
- Admin dashboard for club CRUD and viewing contact submissions
- SQLite seed script with example data

## Tech Stack

- Node.js
- Express
- EJS
- SQLite via `better-sqlite3`
- `express-session`
- `bcryptjs`

## Install

```bash
npm install express ejs better-sqlite3 express-session bcryptjs helmet
```

## Seed The Database

```bash
npm run seed
```

This creates `data/clubs-finder.sqlite` and inserts:

- 12 example clubs across multiple categories and locations
- 1 admin account
- 2 normal user accounts
- sample favourites, reviews, and contact requests

## Run Locally

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Optional Environment Variables

- `PORT` defaults to `3000`
- `SESSION_SECRET` defaults to a development-only fallback string. Set a custom value for local testing if you want a stronger secret.
- `DATABASE_FILE` lets you override the SQLite file path
- `NODE_ENV=production` enables secure session cookies

## Local Test Credentials

- Admin: `admin@clubs.local` / `AdminPass123!`
- User: `emma@example.com` / `UserPass123!`
- User: `noah@example.com` / `UserPass123!`

## Project Structure

```text
.
├── app.js
├── lib/
├── middleware/
├── public/
├── scripts/
└── views/
```

## Security Controls Implemented

- Passwords are hashed with `bcryptjs` using 12 salt rounds
- Session cookies are `httpOnly`, `sameSite=lax`, and `secure` in production
- Sessions are regenerated on login and registration to reduce session fixation risk
- All write routes use CSRF tokens stored in the session and validated server-side
- All SQL queries use parameter binding rather than string interpolation for user input
- All form data is validated and normalized on the server before database writes
- Admin-only routes are protected by server-side authorization checks
- Generic error pages avoid exposing stack traces or internal details to users
- `helmet` sets common HTTP security headers and a restrictive content security policy
- EJS escaped output is used for user-generated content and other dynamic values

## Notes

- This app is intentionally small and easy to inspect, so it keeps logic in a few readable files instead of introducing a larger abstraction layer.
- The default Express session store is acceptable for this local/demo app, but it is not intended as a production deployment setup.
