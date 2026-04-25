const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const inject = require("light-my-request");
const { createApp } = require("../app");
const { AppDatabase, seedDatabase } = require("../src/database");

function extractCsrf(html) {
  const match = html.match(/name="_csrf"[^>]*value="([^"]+)"/);
  return match ? match[1] : null;
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  add(cookies) {
    for (const cookie of cookies) {
      this.cookies.set(cookie.name, cookie.value);
    }
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

async function startTestApp() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clubs-finder-"));
  const databasePath = path.join(tempDir, "test.sqlite");
  const sessionDbPath = path.join(tempDir, "sessions.sqlite");
  const database = new AppDatabase(databasePath);
  seedDatabase(database);
  const { app, close } = createApp({
    database,
    databasePath,
    nodeEnv: "test",
    sessionDbPath,
    sessionSecret: "EXAMPLE_NOT_A_REAL_SECRET"
  });

  async function stop() {
    close();
    fs.rmSync(tempDir, { force: true, recursive: true });
  }

  return {
    app,
    stop
  };
}

async function request(app, jar, requestPath, options = {}) {
  const headers = Object.assign({}, options.headers);

  if (jar.header()) {
    headers.cookie = jar.header();
  }

  let payload;
  if (options.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(options.form).toString();
  }

  const response = await inject(app, {
    headers,
    method: options.method || "GET",
    payload,
    url: requestPath
  });

  jar.add(response.cookies);
  return response;
}

test("redirects anonymous users away from admin routes", async () => {
  const testApp = await startTestApp();
  const jar = new CookieJar();

  try {
    const response = await request(testApp.app, jar, "/admin");
    assert.equal(response.statusCode, 302);
    assert.equal(response.headers.location, "/auth");
  } finally {
    await testApp.stop();
  }
});

test("rejects invalid login attempts with a controlled response", async () => {
  const testApp = await startTestApp();
  const jar = new CookieJar();

  try {
    const authPage = await request(testApp.app, jar, "/auth");
    const csrfToken = extractCsrf(authPage.payload);
    assert.ok(csrfToken);

    const response = await request(testApp.app, jar, "/login", {
      form: {
        _csrf: csrfToken,
        email: "alice@example.com",
        password: "WrongPassword!"
      },
      method: "POST"
    });

    assert.equal(response.statusCode, 401);
    assert.match(response.payload, /Invalid email or password\./);
  } finally {
    await testApp.stop();
  }
});

test("blocks non-admin users from the admin dashboard", async () => {
  const testApp = await startTestApp();
  const jar = new CookieJar();

  try {
    const authPage = await request(testApp.app, jar, "/auth");
    const csrfToken = extractCsrf(authPage.payload);
    assert.ok(csrfToken);

    const loginResponse = await request(testApp.app, jar, "/login", {
      form: {
        _csrf: csrfToken,
        email: "alice@example.com",
        password: "UserPass123!"
      },
      method: "POST"
    });

    assert.equal(loginResponse.statusCode, 302);
    assert.equal(loginResponse.headers.location, "/dashboard");

    const adminResponse = await request(testApp.app, jar, "/admin");
    assert.equal(adminResponse.statusCode, 403);
    assert.match(adminResponse.payload, /You do not have access to that page\./);
  } finally {
    await testApp.stop();
  }
});

test("enforces CSRF checks on authenticated state-changing routes", async () => {
  const testApp = await startTestApp();
  const jar = new CookieJar();

  try {
    const authPage = await request(testApp.app, jar, "/auth");
    const csrfToken = extractCsrf(authPage.payload);
    assert.ok(csrfToken);

    await request(testApp.app, jar, "/login", {
      form: {
        _csrf: csrfToken,
        email: "alice@example.com",
        password: "UserPass123!"
      },
      method: "POST"
    });

    const response = await request(testApp.app, jar, "/clubs/1/favourite", {
      form: {},
      method: "POST"
    });

    assert.equal(response.statusCode, 403);
    assert.match(response.payload, /The request could not be verified\./);
  } finally {
    await testApp.stop();
  }
});

test("lets an authenticated user save a favourite with a valid CSRF token", async () => {
  const testApp = await startTestApp();
  const jar = new CookieJar();

  try {
    const authPage = await request(testApp.app, jar, "/auth");
    const loginToken = extractCsrf(authPage.payload);
    assert.ok(loginToken);

    await request(testApp.app, jar, "/login", {
      form: {
        _csrf: loginToken,
        email: "alice@example.com",
        password: "UserPass123!"
      },
      method: "POST"
    });

    const clubPage = await request(testApp.app, jar, "/clubs/3");
    const favouriteToken = extractCsrf(clubPage.payload);
    assert.ok(favouriteToken);

    const favouriteResponse = await request(testApp.app, jar, "/clubs/3/favourite", {
      form: { _csrf: favouriteToken },
      method: "POST"
    });

    assert.equal(favouriteResponse.statusCode, 302);
    assert.equal(favouriteResponse.headers.location, "/clubs/3");

    const dashboard = await request(testApp.app, jar, "/dashboard");
    assert.match(dashboard.payload, /Central District Community Choir/);
  } finally {
    await testApp.stop();
  }
});

test("returns a safe 404 for malformed club identifiers", async () => {
  const testApp = await startTestApp();
  const jar = new CookieJar();

  try {
    const response = await request(testApp.app, jar, "/clubs/not-a-number");
    assert.equal(response.statusCode, 404);
    assert.match(response.payload, /We couldn't find that page\./);
  } finally {
    await testApp.stop();
  }
});
