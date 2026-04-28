const fs = require("node:fs");
const { hashPassword } = require("../src/auth");
const {
  DB_PATH,
  closeDatabase,
  initializeDatabase,
  run
} = require("../src/database");
const { sampleClubs, sampleUsers } = require("../src/seedData");

if (fs.existsSync(DB_PATH)) {
  fs.rmSync(DB_PATH, { force: true });
}

initializeDatabase();

for (const user of sampleUsers) {
  run(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `,
    [user.name, user.email, hashPassword(user.password), user.role]
  );
}

for (const club of sampleClubs) {
  run(
    `
      INSERT INTO clubs (
        name,
        activity_type,
        category,
        location,
        age_group,
        cost_type,
        setting_type,
        meeting_frequency,
        description,
        address,
        meeting_time,
        contact_email,
        image_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      club.name,
      club.activity_type,
      club.category,
      club.location,
      club.age_group,
      club.cost_type,
      club.setting_type,
      club.meeting_frequency,
      club.description,
      club.address,
      club.meeting_time,
      club.contact_email,
      club.image_url
    ]
  );
}

closeDatabase();

console.log(`Seeded ${sampleUsers.length} users and ${sampleClubs.length} clubs into ${DB_PATH}.`);
