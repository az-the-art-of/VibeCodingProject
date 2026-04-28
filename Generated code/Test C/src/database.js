const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { DEFAULT_CLUB_IMAGE } = require("./constants");
const { hashPassword } = require("./security");

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

class AppDatabase {
  constructor(dbPath) {
    ensureDirectory(dbPath);
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.initSchema();
  }

  initSchema() {
    // The schema is intentionally explicit so the security-sensitive paths stay easy to inspect.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clubs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        category TEXT NOT NULL,
        age_group TEXT NOT NULL,
        price_type TEXT NOT NULL,
        venue_type TEXT NOT NULL,
        meeting_frequency TEXT NOT NULL,
        location TEXT NOT NULL,
        address TEXT NOT NULL,
        meeting_time TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        image_url TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS favourites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        club_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, club_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        club_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS contact_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        club_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);
      CREATE INDEX IF NOT EXISTS idx_clubs_location ON clubs(location);
      CREATE INDEX IF NOT EXISTS idx_clubs_activity_type ON clubs(activity_type);
      CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category);
      CREATE INDEX IF NOT EXISTS idx_clubs_age_group ON clubs(age_group);
      CREATE INDEX IF NOT EXISTS idx_clubs_price_type ON clubs(price_type);
      CREATE INDEX IF NOT EXISTS idx_clubs_venue_type ON clubs(venue_type);
      CREATE INDEX IF NOT EXISTS idx_clubs_meeting_frequency ON clubs(meeting_frequency);
      CREATE INDEX IF NOT EXISTS idx_favourites_user_id ON favourites(user_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_club_id ON reviews(club_id);
      CREATE INDEX IF NOT EXISTS idx_contact_requests_club_id ON contact_requests(club_id);
    `);
  }

  reset() {
    this.db.exec(`
      DROP TABLE IF EXISTS contact_requests;
      DROP TABLE IF EXISTS reviews;
      DROP TABLE IF EXISTS favourites;
      DROP TABLE IF EXISTS clubs;
      DROP TABLE IF EXISTS users;
    `);
    this.initSchema();
  }

  close() {
    this.db.close();
  }

  createUser({ displayName, email, passwordHash, role }) {
    const result = this.db
      .prepare(`
        INSERT INTO users (email, password_hash, display_name, role)
        VALUES (?, ?, ?, ?)
      `)
      .run(email, passwordHash, displayName, role);

    return Number(result.lastInsertRowid);
  }

  findUserByEmail(email) {
    return (
      this.db
        .prepare(`
          SELECT id, email, password_hash, display_name, role, created_at
          FROM users
          WHERE email = ?
        `)
        .get(email) || null
    );
  }

  getUserById(userId) {
    return (
      this.db
        .prepare(`
          SELECT id, email, display_name, role, created_at
          FROM users
          WHERE id = ?
        `)
        .get(userId) || null
    );
  }

  createClub(club) {
    const result = this.db
      .prepare(`
        INSERT INTO clubs (
          name, activity_type, category, age_group, price_type, venue_type,
          meeting_frequency, location, address, meeting_time, contact_email,
          image_url, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        club.name,
        club.activityType,
        club.category,
        club.ageGroup,
        club.priceType,
        club.venueType,
        club.meetingFrequency,
        club.location,
        club.address,
        club.meetingTime,
        club.contactEmail,
        club.imageUrl,
        club.description
      );

    return Number(result.lastInsertRowid);
  }

  updateClub(clubId, club) {
    this.db
      .prepare(`
        UPDATE clubs
        SET
          name = ?,
          activity_type = ?,
          category = ?,
          age_group = ?,
          price_type = ?,
          venue_type = ?,
          meeting_frequency = ?,
          location = ?,
          address = ?,
          meeting_time = ?,
          contact_email = ?,
          image_url = ?,
          description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        club.name,
        club.activityType,
        club.category,
        club.ageGroup,
        club.priceType,
        club.venueType,
        club.meetingFrequency,
        club.location,
        club.address,
        club.meetingTime,
        club.contactEmail,
        club.imageUrl,
        club.description,
        clubId
      );
  }

  deleteClub(clubId) {
    this.db.prepare("DELETE FROM clubs WHERE id = ?").run(clubId);
  }

  searchClubs(filters, userId = null) {
    const clauses = [];
    const params = [userId, userId];

    if (filters.name) {
      clauses.push("c.name LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filters.name)}%`);
    }

    if (filters.activityType) {
      clauses.push("c.activity_type LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filters.activityType)}%`);
    }

    if (filters.location) {
      clauses.push("c.location LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(filters.location)}%`);
    }

    if (filters.category) {
      clauses.push("c.category = ?");
      params.push(filters.category);
    }

    if (filters.ageGroup) {
      clauses.push("c.age_group = ?");
      params.push(filters.ageGroup);
    }

    if (filters.priceType) {
      clauses.push("c.price_type = ?");
      params.push(filters.priceType);
    }

    if (filters.venueType) {
      clauses.push("c.venue_type = ?");
      params.push(filters.venueType);
    }

    if (filters.meetingFrequency) {
      clauses.push("c.meeting_frequency = ?");
      params.push(filters.meetingFrequency);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const statement = this.db.prepare(`
      SELECT
        c.*,
        CASE
          WHEN ? IS NOT NULL AND EXISTS (
            SELECT 1 FROM favourites f WHERE f.user_id = ? AND f.club_id = c.id
          ) THEN 1
          ELSE 0
        END AS is_favourite,
        COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.club_id = c.id), 0) AS average_rating,
        COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.club_id = c.id), 0) AS review_count
      FROM clubs c
      ${whereClause}
      ORDER BY c.name ASC
    `);

    return statement.all(...params);
  }

  getClubById(clubId, userId = null) {
    return (
      this.db
        .prepare(`
          SELECT
            c.*,
            CASE
              WHEN ? IS NOT NULL AND EXISTS (
                SELECT 1 FROM favourites f WHERE f.user_id = ? AND f.club_id = c.id
              ) THEN 1
              ELSE 0
            END AS is_favourite,
            COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.club_id = c.id), 0) AS average_rating,
            COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.club_id = c.id), 0) AS review_count
          FROM clubs c
          WHERE c.id = ?
        `)
        .get(userId, userId, clubId) || null
    );
  }

  listFeaturedClubs(limit = 6) {
    return this.db
      .prepare(`
        SELECT
          c.*,
          COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.club_id = c.id), 0) AS average_rating,
          COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.club_id = c.id), 0) AS review_count
        FROM clubs c
        ORDER BY c.created_at DESC, c.name ASC
        LIMIT ?
      `)
      .all(limit);
  }

  listReviewsForClub(clubId) {
    return this.db
      .prepare(`
        SELECT
          r.id,
          r.rating,
          r.comment,
          r.created_at,
          u.display_name
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.club_id = ?
        ORDER BY r.created_at DESC
      `)
      .all(clubId);
  }

  addFavourite(userId, clubId) {
    this.db
      .prepare(`
        INSERT INTO favourites (user_id, club_id)
        VALUES (?, ?)
        ON CONFLICT(user_id, club_id) DO NOTHING
      `)
      .run(userId, clubId);
  }

  removeFavourite(userId, clubId) {
    this.db.prepare("DELETE FROM favourites WHERE user_id = ? AND club_id = ?").run(userId, clubId);
  }

  createReview({ clubId, comment, rating, userId }) {
    this.db
      .prepare(`
        INSERT INTO reviews (user_id, club_id, rating, comment)
        VALUES (?, ?, ?, ?)
      `)
      .run(userId, clubId, rating, comment);
  }

  createContactRequest({ clubId, message, userId }) {
    this.db
      .prepare(`
        INSERT INTO contact_requests (user_id, club_id, message)
        VALUES (?, ?, ?)
      `)
      .run(userId, clubId, message);
  }

  listDashboardFavourites(userId) {
    return this.db
      .prepare(`
        SELECT
          c.id,
          c.name,
          c.location,
          c.activity_type,
          c.category,
          c.image_url,
          f.created_at
        FROM favourites f
        JOIN clubs c ON c.id = f.club_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
      `)
      .all(userId);
  }

  listDashboardContactRequests(userId) {
    return this.db
      .prepare(`
        SELECT
          cr.id,
          cr.message,
          cr.created_at,
          c.id AS club_id,
          c.name AS club_name
        FROM contact_requests cr
        JOIN clubs c ON c.id = cr.club_id
        WHERE cr.user_id = ?
        ORDER BY cr.created_at DESC
      `)
      .all(userId);
  }

  listDashboardReviews(userId) {
    return this.db
      .prepare(`
        SELECT
          r.id,
          r.rating,
          r.comment,
          r.created_at,
          c.id AS club_id,
          c.name AS club_name
        FROM reviews r
        JOIN clubs c ON c.id = r.club_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
      `)
      .all(userId);
  }

  listAdminClubs() {
    return this.db
      .prepare(`
        SELECT
          c.*,
          COALESCE((SELECT COUNT(*) FROM favourites f WHERE f.club_id = c.id), 0) AS favourite_count,
          COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.club_id = c.id), 0) AS review_count
        FROM clubs c
        ORDER BY c.name ASC
      `)
      .all();
  }

  listAdminContactRequests() {
    return this.db
      .prepare(`
        SELECT
          cr.id,
          cr.message,
          cr.created_at,
          u.display_name,
          u.email,
          c.id AS club_id,
          c.name AS club_name
        FROM contact_requests cr
        JOIN users u ON u.id = cr.user_id
        JOIN clubs c ON c.id = cr.club_id
        ORDER BY cr.created_at DESC
      `)
      .all();
  }

  countClubs() {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM clubs").get();
    return row.count;
  }
}

function buildSeedClubs() {
  return [
    {
      activityType: "Board Games",
      address: "1224 E Olive Way, Seattle, WA",
      ageGroup: "Adults",
      category: "Games",
      contactEmail: "hello@capitolgames.example",
      description: "A welcoming weekly board game club with strategy nights, casual tables, and new-player teaching sessions.",
      imageUrl: "/images/games-club.svg",
      location: "Capitol Hill, Seattle",
      meetingFrequency: "Weekly",
      meetingTime: "Wednesdays at 7:00 PM",
      name: "Capitol Hill Board Game Circle",
      priceType: "Free",
      venueType: "Indoor"
    },
    {
      activityType: "Running",
      address: "3801 Discovery Park Blvd, Seattle, WA",
      ageGroup: "Adults",
      category: "Fitness",
      contactEmail: "run@discoverytrail.example",
      description: "Sunrise running group focused on approachable 5K and 10K routes, pacing support, and post-run coffee.",
      imageUrl: "/images/outdoor-club.svg",
      location: "Magnolia, Seattle",
      meetingFrequency: "Twice Weekly",
      meetingTime: "Tuesdays and Saturdays at 6:30 AM",
      name: "Discovery Trail Runners",
      priceType: "Free",
      venueType: "Outdoor"
    },
    {
      activityType: "Choir",
      address: "153 14th Ave, Seattle, WA",
      ageGroup: "All Ages",
      category: "Arts",
      contactEmail: "sing@centralchoir.example",
      description: "Community choir rehearsing pop, folk, and seasonal arrangements with low-pressure performances each quarter.",
      imageUrl: "/images/arts-club.svg",
      location: "Central District, Seattle",
      meetingFrequency: "Weekly",
      meetingTime: "Mondays at 6:45 PM",
      name: "Central District Community Choir",
      priceType: "Paid",
      venueType: "Indoor"
    },
    {
      activityType: "Gardening",
      address: "5513 6th Ave NW, Seattle, WA",
      ageGroup: "Families",
      category: "Community",
      contactEmail: "grow@greenpatch.example",
      description: "Neighborhood gardening club sharing raised beds, beginner workshops, and produce swaps for local families.",
      imageUrl: "/images/community-club.svg",
      location: "Ballard, Seattle",
      meetingFrequency: "Fortnightly",
      meetingTime: "Sundays at 10:00 AM",
      name: "Green Patch Garden Friends",
      priceType: "Free",
      venueType: "Outdoor"
    },
    {
      activityType: "Photography Walks",
      address: "860 Terry Ave N, Seattle, WA",
      ageGroup: "Adults",
      category: "Arts",
      contactEmail: "photos@cityframes.example",
      description: "Photography meetups exploring urban scenes, editing basics, and themed photo challenges around the city.",
      imageUrl: "/images/arts-club.svg",
      location: "South Lake Union, Seattle",
      meetingFrequency: "Monthly",
      meetingTime: "First Saturday at 2:00 PM",
      name: "City Frames Photo Walk Club",
      priceType: "Paid",
      venueType: "Mixed"
    },
    {
      activityType: "Coding Workshops",
      address: "500 108th Ave NE, Bellevue, WA",
      ageGroup: "Teens",
      category: "Learning",
      contactEmail: "learn@eastsidecode.example",
      description: "Hands-on coding club for teens covering web basics, small projects, peer demos, and mentor-led labs.",
      imageUrl: "/images/learning-club.svg",
      location: "Bellevue",
      meetingFrequency: "Weekly",
      meetingTime: "Thursdays at 5:30 PM",
      name: "Eastside Teen Code Collective",
      priceType: "Free",
      venueType: "Indoor"
    },
    {
      activityType: "Hiking",
      address: "2600 SW Barton St, Seattle, WA",
      ageGroup: "All Ages",
      category: "Outdoors",
      contactEmail: "hello@urbanhikes.example",
      description: "Weekend hiking club planning beginner-friendly local hikes, carpool coordination, and seasonal trail days.",
      imageUrl: "/images/outdoor-club.svg",
      location: "West Seattle",
      meetingFrequency: "Weekly",
      meetingTime: "Saturdays at 9:00 AM",
      name: "Urban Hikes Meetup",
      priceType: "Free",
      venueType: "Outdoor"
    },
    {
      activityType: "Yoga",
      address: "1111 Harvard Ave, Seattle, WA",
      ageGroup: "Adults",
      category: "Wellness",
      contactEmail: "calm@harboryoga.example",
      description: "Low-cost yoga sessions for stress relief, mobility, and community accountability with mats available onsite.",
      imageUrl: "/images/wellness-club.svg",
      location: "First Hill, Seattle",
      meetingFrequency: "Twice Weekly",
      meetingTime: "Tuesdays and Thursdays at 6:00 PM",
      name: "Harbor Wellness Yoga Club",
      priceType: "Paid",
      venueType: "Indoor"
    },
    {
      activityType: "Chess",
      address: "2200 Alaskan Way, Seattle, WA",
      ageGroup: "Seniors",
      category: "Games",
      contactEmail: "moves@waterfrontchess.example",
      description: "Relaxed chess meetups for seniors with ladder games, teaching boards, and monthly friendly tournaments.",
      imageUrl: "/images/games-club.svg",
      location: "Waterfront, Seattle",
      meetingFrequency: "Weekly",
      meetingTime: "Fridays at 1:00 PM",
      name: "Waterfront Chess Social",
      priceType: "Free",
      venueType: "Indoor"
    },
    {
      activityType: "Language Exchange",
      address: "10210 NE 8th St, Bellevue, WA",
      ageGroup: "Adults",
      category: "Learning",
      contactEmail: "speak@bridgelanguage.example",
      description: "Conversational language exchange group with rotating tables for Spanish, French, Japanese, and English practice.",
      imageUrl: "/images/learning-club.svg",
      location: "Bellevue",
      meetingFrequency: "Fortnightly",
      meetingTime: "Wednesdays at 7:00 PM",
      name: "Bridge Language Exchange",
      priceType: "Free",
      venueType: "Indoor"
    },
    {
      activityType: "Cycling",
      address: "111 Lake St S, Kirkland, WA",
      ageGroup: "Adults",
      category: "Fitness",
      contactEmail: "ride@lakesidepedal.example",
      description: "Intermediate cycling club organizing social rides, route planning clinics, and no-drop weekend loops.",
      imageUrl: "/images/outdoor-club.svg",
      location: "Kirkland",
      meetingFrequency: "Weekly",
      meetingTime: "Sundays at 8:30 AM",
      name: "Lakeside Pedal Club",
      priceType: "Paid",
      venueType: "Outdoor"
    },
    {
      activityType: "Crafting",
      address: "604 4th Ave, Kirkland, WA",
      ageGroup: "Families",
      category: "Arts",
      contactEmail: "create@makerscorner.example",
      description: "Family-friendly crafting sessions with seasonal projects, shared supplies, and community maker showcases.",
      imageUrl: "/images/arts-club.svg",
      location: "Kirkland",
      meetingFrequency: "Monthly",
      meetingTime: "Second Saturday at 11:00 AM",
      name: "Makers Corner Craft Club",
      priceType: "Paid",
      venueType: "Indoor"
    }
  ];
}

function seedDatabase(database) {
  database.reset();

  const users = [
    {
      displayName: "Admin User",
      email: "admin@example.com",
      passwordHash: hashPassword("AdminPass123!"),
      role: "admin"
    },
    {
      displayName: "Alice Carter",
      email: "alice@example.com",
      passwordHash: hashPassword("UserPass123!"),
      role: "user"
    },
    {
      displayName: "Bob Singh",
      email: "bob@example.com",
      passwordHash: hashPassword("UserPass123!"),
      role: "user"
    }
  ];

  for (const user of users) {
    database.createUser(user);
  }

  for (const club of buildSeedClubs()) {
    database.createClub({
      ...club,
      imageUrl: club.imageUrl || DEFAULT_CLUB_IMAGE
    });
  }

  database.addFavourite(2, 1);
  database.addFavourite(2, 4);
  database.addFavourite(3, 7);
  database.createReview({
    clubId: 1,
    comment: "Friendly hosts and a great mix of casual and strategy games.",
    rating: 5,
    userId: 2
  });
  database.createReview({
    clubId: 7,
    comment: "Well organized hikes with a welcoming group for new people.",
    rating: 4,
    userId: 3
  });
  database.createContactRequest({
    clubId: 4,
    message: "Hi, I would like to join the Sunday family gardening session next month.",
    userId: 2
  });
}

module.exports = {
  AppDatabase,
  buildSeedClubs,
  seedDatabase
};
