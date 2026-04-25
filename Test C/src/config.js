const path = require("node:path");

function parsePort(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return 3000;
  }

  return parsed;
}

function getConfig(overrides = {}) {
  const rootDir = overrides.rootDir || path.resolve(__dirname, "..");
  const dataDir = overrides.dataDir || path.join(rootDir, "data");
  const nodeEnv = overrides.nodeEnv || process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  let sessionSecret = overrides.sessionSecret || process.env.SESSION_SECRET || "";

  if (!sessionSecret) {
    if (isProduction) {
      throw new Error("SESSION_SECRET must be set in production.");
    }

    sessionSecret = "EXAMPLE_NOT_A_REAL_SECRET";
  }

  if (isProduction && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }

  return {
    appName: "Local Social Clubs Finder",
    dataDir,
    databasePath: overrides.databasePath || path.join(dataDir, "clubs.sqlite"),
    isProduction,
    nodeEnv,
    port: parsePort(overrides.port || process.env.PORT || 3000),
    rootDir,
    sessionCookieName: "clubs.sid",
    sessionDbPath: overrides.sessionDbPath || path.join(dataDir, "sessions.sqlite"),
    sessionSecret
  };
}

module.exports = {
  getConfig
};
