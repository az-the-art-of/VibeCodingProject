const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { initializeSchema } = require("./schema");

const databasePath = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(__dirname, "..", "data", "clubs-finder.sqlite");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

// Open the single SQLite file used by both the app and the seed script.
const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initializeSchema(db);

module.exports = { db, databasePath };
