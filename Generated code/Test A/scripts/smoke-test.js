const { get, run } = require("../src/database");

const BASE_URL = "http://localhost:3000";
const TEST_USER_EMAIL = "mia@localsocial.test";
const TEST_USER_PASSWORD = "mia123";
const ADMIN_EMAIL = "admin@localsocial.test";
const ADMIN_PASSWORD = "admin123";
const TEST_CLUB_ID = 1;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }

  console.log(`PASS: ${message}`);
}

function formBody(values) {
  return new URLSearchParams(values).toString();
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...options
  });
  const text = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    text
  };
}

async function login(email, password) {
  const response = await request("/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: formBody({ email, password })
  });

  assert(response.status === 302, `login redirect for ${email}`);

  const cookie = response.headers.get("set-cookie");
  assert(Boolean(cookie), `session cookie issued for ${email}`);

  return cookie.split(";")[0];
}

async function main() {
  const testUser = get("SELECT id FROM users WHERE email = ?", [TEST_USER_EMAIL]);
  assert(Boolean(testUser), "seeded normal user exists");

  run("DELETE FROM favourites WHERE user_id = ? AND club_id = ?", [testUser.id, TEST_CLUB_ID]);
  run("DELETE FROM reviews WHERE user_id = ? AND club_id = ?", [testUser.id, TEST_CLUB_ID]);
  run("DELETE FROM contact_requests WHERE user_id = ? AND club_id = ?", [testUser.id, TEST_CLUB_ID]);

  const home = await request("/");
  assert(home.status === 200, "home page responds");
  assert(home.text.includes("Discover local social clubs"), "home page renders hero content");

  const results = await request("/clubs?activity=Running&location=Dublin");
  assert(results.status === 200, "search results page responds");
  assert(results.text.includes("Riverside Running Club"), "search results include matching club");

  const detail = await request(`/clubs/${TEST_CLUB_ID}`);
  assert(detail.status === 200, "club detail page responds");
  assert(detail.text.includes("Contact this club"), "club detail page renders contact section");

  const auth = await request("/auth");
  assert(auth.status === 200, "auth page responds");
  assert(auth.text.includes("Login or create an account"), "auth page renders login/register content");

  const userCookie = await login(TEST_USER_EMAIL, TEST_USER_PASSWORD);

  const favourite = await request(`/clubs/${TEST_CLUB_ID}/favourite`, {
    method: "POST",
    headers: {
      cookie: userCookie
    }
  });
  assert(favourite.status === 302, "favourite action redirects after save");
  assert(
    Boolean(get("SELECT id FROM favourites WHERE user_id = ? AND club_id = ?", [testUser.id, TEST_CLUB_ID])),
    "favourite row is stored"
  );

  const contact = await request(`/clubs/${TEST_CLUB_ID}/contact`, {
    method: "POST",
    headers: {
      cookie: userCookie,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: formBody({
      message: "I would like to join the next session."
    })
  });
  assert(contact.status === 302, "contact request redirects after submit");
  assert(
    Boolean(
      get("SELECT id FROM contact_requests WHERE user_id = ? AND club_id = ?", [
        testUser.id,
        TEST_CLUB_ID
      ])
    ),
    "contact request row is stored"
  );

  const review = await request(`/clubs/${TEST_CLUB_ID}/reviews`, {
    method: "POST",
    headers: {
      cookie: userCookie,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: formBody({
      rating: "5",
      comment: "Friendly group with an easy-going atmosphere."
    })
  });
  assert(review.status === 302, "review submit redirects after save");

  const reviewRow = get("SELECT rating, comment FROM reviews WHERE user_id = ? AND club_id = ?", [
    testUser.id,
    TEST_CLUB_ID
  ]);
  assert(Boolean(reviewRow), "review row is stored");
  assert(reviewRow.rating === 5, "review rating is saved");

  const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminPage = await request("/admin", {
    headers: {
      cookie: adminCookie
    }
  });
  assert(adminPage.status === 200, "admin dashboard responds");
  assert(adminPage.text.includes("Admin dashboard"), "admin dashboard renders");

  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error(`Smoke test failed: ${error.message}`);
  process.exit(1);
});
