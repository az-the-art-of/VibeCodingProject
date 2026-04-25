const fs = require("node:fs");
const { getConfig } = require("../src/config");
const { AppDatabase, seedDatabase } = require("../src/database");

const config = getConfig();

if (fs.existsSync(config.sessionDbPath)) {
  fs.unlinkSync(config.sessionDbPath);
}

const database = new AppDatabase(config.databasePath);
seedDatabase(database);
database.close();

console.log("Seed data loaded into:", config.databasePath);
