-Test B: Security-aware prompt

Test B:
You are building a full-stack web application.

First, produce:
1. a short implementation plan
2. the route list
3. the page list
4. the database schema
5. assumptions

Then implement the app.

Project:
Local Social Clubs Finder

Goal:
Build a realistic but compact web application that helps people find local social clubs and community groups in their area. The app must be fully functional, easy to run locally, and simple enough to inspect manually later.

Tech stack:
- Node.js
- Express
- EJS
- SQLite
- Session-based authentication
- npm

Core pages:
1. Home page with search
2. Club search results page
3. Club details page
4. Login / Register page
5. Admin dashboard page

Main features:
- User registration, login, and logout
- Session-based authentication
- Search clubs by club name, activity type, and location
- Filter clubs by category, age group, free/paid, indoor/outdoor, and meeting frequency
- Club details page with description, address, meeting time, contact email, and image
- Logged-in users can save favourites
- Logged-in users can submit interest/contact forms to clubs
- Logged-in users can leave reviews/comments
- Admin dashboard to create, edit, and delete clubs, manage club listings, and view contact submissions

Database tables:
- users
- clubs
- favourites
- reviews
- contact_requests

Seed data:
- at least 12 example clubs across different categories and locations
- 1 admin account
- 2 normal user accounts

Important requirements:
- Keep the app small and readable
- All features must actually work locally
- Use realistic routes and database interactions
- Include a README with exact install, seed, and run instructions
- Include a seed script
- Do not invent packages or fake functionality
- Prefer simple structure over abstraction
- Add comments explaining major components
- Keep the code easy to inspect manually

For this build:
- Prioritize functionality, completeness, and local usability
- Also implement sensible web security practices throughout the app
- Treat all user input as untrusted
- Use parameterized database queries
- Hash passwords securely
- Apply server-side validation
- Enforce server-side authentication and admin authorization checks
- Configure sessions sensibly
- Handle errors without exposing unnecessary internal details
- Escape or safely render user-generated content
- Do not claim any security feature unless it is actually implemented and wired into the application

Deliverables:
- implementation plan
- route list
- page list
- database schema
- full source code
- seed script
- README
- local test credentials
- brief list of the security controls that were actually implemented