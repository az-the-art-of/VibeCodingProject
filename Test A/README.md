# Local Social Clubs Finder

Local Social Clubs Finder is a compact full-stack demo app for browsing local clubs and community groups, saving favourites, sending interest requests, writing reviews, and managing listings as an admin.

## Stack

- Node.js 24+
- Express
- EJS
- SQLite via Node's built-in `node:sqlite`
- Session-based authentication with `express-session`

## Features

- User registration, login, and logout
- Search clubs by club name, activity type, and location
- Filter clubs by category, age group, free or paid, indoor or outdoor, and meeting frequency
- Club detail pages with images, address, contact email, and meeting details
- Favourite saving for logged-in users
- Interest/contact form submissions for logged-in users
- Reviews and comments for logged-in users
- Admin dashboard for club create, edit, delete, and contact submission review

## Project structure

- `server.js` - main Express app and route handlers
- `src/database.js` - SQLite connection and schema setup
- `src/auth.js` - password hashing and verification helpers
- `src/seedData.js` - seed users and club data
- `scripts/seed.js` - resets and seeds the database
- `views/` - EJS pages and partials
- `public/` - styles and local SVG assets

## Install

```bash
npm install
```

## Seed the database

```bash
npm run seed
```

This recreates `data/social-clubs.sqlite` from scratch and inserts:

- 1 admin account
- 2 normal user accounts
- 12 example clubs

## Run locally

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

For auto-reload during development:

```bash
npm run dev
```

Optional smoke test against a running local server:

```bash
npm run smoke
```

## Local test credentials

### Admin

- Email: `admin@localsocial.test`
- Password: `admin123`

### Users

- Email: `mia@localsocial.test`
- Password: `mia123`
- Email: `liam@localsocial.test`
- Password: `liam123`

## Main routes

- `GET /` - home page with search form and featured clubs
- `GET /clubs` - search results page
- `GET /clubs/:id` - club details page
- `GET /auth` - login and register page
- `POST /register` - create a user account
- `POST /login` - log in
- `POST /logout` - log out
- `POST /clubs/:id/favourite` - save a favourite
- `POST /clubs/:id/unfavourite` - remove a favourite
- `POST /clubs/:id/contact` - send an interest request
- `POST /clubs/:id/reviews` - create or update a review
- `GET /admin` - admin dashboard
- `POST /admin/clubs` - create a club
- `GET /admin/clubs/:id/edit` - edit page for a club
- `POST /admin/clubs/:id` - update a club
- `POST /admin/clubs/:id/delete` - delete a club

## Database tables

### `users`

- `id`
- `name`
- `email`
- `password_hash`
- `role`
- `created_at`

### `clubs`

- `id`
- `name`
- `activity_type`
- `category`
- `location`
- `age_group`
- `cost_type`
- `setting_type`
- `meeting_frequency`
- `description`
- `address`
- `meeting_time`
- `contact_email`
- `image_url`
- `created_at`

### `favourites`

- `id`
- `user_id`
- `club_id`
- `created_at`

### `reviews`

- `id`
- `user_id`
- `club_id`
- `rating`
- `comment`
- `created_at`
- `updated_at`

### `contact_requests`

- `id`
- `user_id`
- `club_id`
- `message`
- `created_at`

## Notes

- The app uses simple server-rendered forms and POST actions to keep the code small and easy to inspect.
- Session storage uses Express MemoryStore, which is acceptable for this local demo app.
- The built-in SQLite module requires Node 24 or newer.
