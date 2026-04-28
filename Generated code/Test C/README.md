# Local Social Clubs Finder

Local Social Clubs Finder is a compact full-stack web application for browsing community groups, saving favourites, contacting clubs, leaving reviews, and managing listings through an admin dashboard.

## Tech stack

- Node.js 24.11.1+
- Express
- EJS
- SQLite via Node's built-in `node:sqlite` module
- Session-based authentication with a SQLite-backed session store

## Features

- Search clubs by club name, activity type, and location
- Filter by category, age group, free/paid, indoor/outdoor, and meeting frequency
- Club details with description, address, meeting time, contact email, and image
- User registration, login, logout, favourites, contact requests, and reviews
- Admin dashboard for club CRUD and viewing stored contact submissions
- Seed script with 12 clubs, 1 admin, and 2 normal users

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Seed the database:

   ```sh
   npm run seed
   ```

3. Start the app:

   ```sh
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment variables

- `PORT`: optional, defaults to `3000`
- `NODE_ENV`: set to `production` for production-safe cookie and header behavior
- `SESSION_SECRET`: required in production and must be at least 32 characters

## Seed behavior

`npm run seed` recreates the application tables in `data/clubs.sqlite`, reloads the example clubs and users, and clears the session database file at `data/sessions.sqlite`.

## Local test credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `AdminPass123!` |
| User | `alice@example.com` | `UserPass123!` |
| User | `bob@example.com` | `UserPass123!` |

These credentials are for local development only.

## Tests

Run the local test suite with:

```sh
npm test
```

The tests cover:

- redirecting unauthenticated users away from admin routes
- controlled login failure responses
- admin-only access enforcement
- CSRF enforcement on state-changing routes
- authenticated favourite creation
- safe 404 handling for malformed IDs

## Project structure

- `server.js`: server startup and shutdown handling
- `app.js`: Express app configuration, routes, and middleware
- `src/database.js`: SQLite schema, queries, and seed helpers
- `src/session-store.js`: SQLite-backed Express session store
- `src/security.js`: password hashing and CSRF helpers
- `src/validation.js`: server-side validation rules
- `views/`: EJS templates
- `public/`: CSS and local SVG club images
- `scripts/seed.js`: database seed script
- `tests/`: integration tests with Node's built-in test runner

## Security notes

- Sessions use `HttpOnly` cookies with `SameSite=Lax`, and `Secure` is enabled when `NODE_ENV=production`.
- State-changing POST routes require a CSRF token stored in the session.
- Passwords are hashed with `crypto.scrypt`.
- Access control is enforced server-side for authenticated and admin routes.
- User-facing error pages are generic; detailed failures are logged server-side.

## Known limitations

- The app is designed for local use and does not include rate limiting or email delivery.
- SQLite access uses Node 24's built-in `node:sqlite` module, which currently emits an experimental runtime warning.
- Images are local static SVG assets only; file uploads are intentionally out of scope.
