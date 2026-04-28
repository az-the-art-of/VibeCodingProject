const bcrypt = require("bcryptjs");
const { db, databasePath } = require("../lib/db");
const { userSeeds, clubSeeds } = require("../lib/seed-data");

function seedDatabase() {
  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (@name, @email, @password_hash, @role)`
  );

  const insertClub = db.prepare(
    `INSERT INTO clubs (
      name,
      category,
      activity_type,
      location,
      age_group,
      cost_type,
      venue_type,
      meeting_frequency,
      address,
      meeting_time,
      contact_email,
      image_url,
      description
    ) VALUES (
      @name,
      @category,
      @activity_type,
      @location,
      @age_group,
      @cost_type,
      @venue_type,
      @meeting_frequency,
      @address,
      @meeting_time,
      @contact_email,
      @image_url,
      @description
    )`
  );

  const insertFavourite = db.prepare(
    `INSERT INTO favourites (user_id, club_id) VALUES (?, ?)`
  );

  const insertReview = db.prepare(
    `INSERT INTO reviews (user_id, club_id, rating, comment) VALUES (?, ?, ?, ?)`
  );

  const insertContactRequest = db.prepare(
    `INSERT INTO contact_requests (user_id, club_id, message, preferred_contact)
     VALUES (?, ?, ?, ?)`
  );

  // Reset and repopulate the compact demo dataset in one transaction.
  const resetTables = db.transaction(() => {
    db.exec(`
      DELETE FROM contact_requests;
      DELETE FROM reviews;
      DELETE FROM favourites;
      DELETE FROM clubs;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name IN ('users', 'clubs', 'favourites', 'reviews', 'contact_requests');
    `);

    const seededUsers = {};

    for (const user of userSeeds) {
      const password_hash = bcrypt.hashSync(user.password, 12);
      const result = insertUser.run({
        name: user.name,
        email: user.email,
        password_hash,
        role: user.role
      });
      seededUsers[user.email] = result.lastInsertRowid;
    }

    const seededClubs = [];

    for (const club of clubSeeds) {
      const result = insertClub.run(club);
      seededClubs.push(result.lastInsertRowid);
    }

    insertFavourite.run(seededUsers["emma@example.com"], seededClubs[0]);
    insertFavourite.run(seededUsers["emma@example.com"], seededClubs[6]);
    insertFavourite.run(seededUsers["noah@example.com"], seededClubs[1]);
    insertFavourite.run(seededUsers["noah@example.com"], seededClubs[5]);

    insertReview.run(
      seededUsers["emma@example.com"],
      seededClubs[0],
      5,
      "Really welcoming group. The pace leaders make it easy to join even if you are coming back to running."
    );
    insertReview.run(
      seededUsers["noah@example.com"],
      seededClubs[1],
      4,
      "Good mix of games and friendly regulars. The weekly format is easy to fit into the schedule."
    );
    insertReview.run(
      seededUsers["emma@example.com"],
      seededClubs[6],
      5,
      "Helpful coding sessions with a nice mix of beginners and experienced developers."
    );

    insertContactRequest.run(
      seededUsers["emma@example.com"],
      seededClubs[3],
      "I would love to join the next garden exchange and can also help with seed swapping.",
      "Email me at emma@example.com"
    );
    insertContactRequest.run(
      seededUsers["noah@example.com"],
      seededClubs[5],
      "Interested in trying a beginner session. Could you let me know what gear is available to rent?",
      "Best by email at noah@example.com"
    );
  });

  resetTables();
}

seedDatabase();

console.log(`Seeded database at ${databasePath}`);
