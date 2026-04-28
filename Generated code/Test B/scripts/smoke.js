const request = require("supertest");
const app = require("../app");

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) {
    throw new Error("CSRF token not found in response HTML.");
  }

  return match[1];
}

async function login(agent, email, password) {
  const authPage = await agent.get("/auth").expect(200);
  const csrfToken = extractCsrfToken(authPage.text);

  await agent
    .post("/login")
    .type("form")
    .send({
      _csrf: csrfToken,
      email,
      password
    })
    .expect(302);
}

async function run() {
  const anonymousAgent = request.agent(app);

  await anonymousAgent.get("/").expect(200).expect(/Discover local clubs/i);
  await anonymousAgent.get("/clubs?location=Dublin").expect(200).expect(/Browse local social clubs/i);
  await anonymousAgent.get("/clubs/1").expect(200).expect(/Send an interest request/i);
  await anonymousAgent.get("/auth").expect(200).expect(/Login or create an account/i);

  const userAgent = request.agent(app);
  await login(userAgent, "emma@example.com", "UserPass123!");

  let clubPage = await userAgent.get("/clubs/3").expect(200);
  let csrfToken = extractCsrfToken(clubPage.text);

  await userAgent
    .post("/clubs/3/favourite")
    .type("form")
    .send({
      _csrf: csrfToken,
      returnTo: "/clubs/3"
    })
    .expect(302);

  clubPage = await userAgent.get("/clubs/3").expect(200);
  csrfToken = extractCsrfToken(clubPage.text);

  await userAgent
    .post("/clubs/3/contact")
    .type("form")
    .send({
      _csrf: csrfToken,
      message: "Interested in joining the next walk and would like details on how new members usually get started.",
      preferred_contact: "emma@example.com"
    })
    .expect(302);

  clubPage = await userAgent.get("/clubs/3").expect(200);
  csrfToken = extractCsrfToken(clubPage.text);

  await userAgent
    .post("/clubs/3/reviews")
    .type("form")
    .send({
      _csrf: csrfToken,
      rating: "4",
      comment: "Smoke test review confirming the rating and comment flow works through the full request cycle."
    })
    .expect(302);

  const adminAgent = request.agent(app);
  await login(adminAgent, "admin@clubs.local", "AdminPass123!");
  await adminAgent.get("/dashboard").expect(200).expect(/Manage clubs and contact requests/i);

  console.log("Smoke test passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
