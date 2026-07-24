const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'panel.db');

let db = null;

function getDb() {
  if (db) return db;
  const exists = fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  if (!exists) {
    createSchema();
  }
  return db;
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function isSetupComplete() {
  try {
    const d = getDb();
    const row = d.prepare('SELECT COUNT(*) as cnt FROM users').get();
    return row && row.cnt > 0;
  } catch {
    return false;
  }
}

function closeDb() {
  if (db) { db.close(); db = null; }
}

module.exports = { getDb, isSetupComplete, closeDb };