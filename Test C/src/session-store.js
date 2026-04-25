const fs = require("node:fs");
const path = require("node:path");
const session = require("express-session");
const { DatabaseSync } = require("node:sqlite");

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getExpiry(sessionRecord) {
  if (sessionRecord && sessionRecord.cookie && sessionRecord.cookie.expires) {
    return new Date(sessionRecord.cookie.expires).getTime();
  }

  return Date.now() + 1000 * 60 * 60 * 8;
}

class SQLiteSessionStore extends session.Store {
  constructor({ dbPath }) {
    super();
    ensureDirectory(dbPath);
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
      ON sessions (expires_at);
    `);
  }

  destroy(sid, callback = () => {}) {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  get(sid, callback = () => {}) {
    try {
      const row = this.db.prepare("SELECT sess, expires_at FROM sessions WHERE sid = ?").get(sid);

      if (!row) {
        callback(null, null);
        return;
      }

      if (row.expires_at <= Date.now()) {
        this.destroy(sid, () => callback(null, null));
        return;
      }

      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionRecord, callback = () => {}) {
    try {
      const expiresAt = getExpiry(sessionRecord);
      this.db
        .prepare(`
          INSERT INTO sessions (sid, sess, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET
            sess = excluded.sess,
            expires_at = excluded.expires_at
        `)
        .run(sid, JSON.stringify(sessionRecord), expiresAt);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sessionRecord, callback = () => {}) {
    try {
      this.db
        .prepare("UPDATE sessions SET expires_at = ?, sess = ? WHERE sid = ?")
        .run(getExpiry(sessionRecord), JSON.stringify(sessionRecord), sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = {
  SQLiteSessionStore
};
