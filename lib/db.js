const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'travel_alerts.db');

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_key TEXT NOT NULL,
      provider TEXT NOT NULL,
      currency TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      metadata TEXT DEFAULT NULL,
      observed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prices_item ON prices (item_type, item_key);
    CREATE INDEX IF NOT EXISTS idx_prices_observed_at ON prices (observed_at);
  `);
  return db;
}

function insertPrice(db, record) {
  const stmt = db.prepare(`
    INSERT INTO prices (item_type, item_key, provider, currency, price_cents, metadata, observed_at)
    VALUES (@item_type, @item_key, @provider, @currency, @price_cents, @metadata, @observed_at)
  `);
  stmt.run({
    ...record,
    metadata: record.metadata ? JSON.stringify(record.metadata) : null
  });
}

function getLatestPrice(db, item_type, item_key) {
  const stmt = db.prepare(`
    SELECT * FROM prices
    WHERE item_type = ? AND item_key = ?
    ORDER BY observed_at DESC
    LIMIT 1
  `);
  const row = stmt.get(item_type, item_key);
  if (!row) return null;
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  };
}

function getMinPrice(db, item_type, item_key) {
  const stmt = db.prepare(`
    SELECT * FROM prices
    WHERE item_type = ? AND item_key = ?
    ORDER BY price_cents ASC
    LIMIT 1
  `);
  const row = stmt.get(item_type, item_key);
  if (!row) return null;
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null
  };
}

module.exports = {
  ensureDb,
  insertPrice,
  getLatestPrice,
  getMinPrice,
  DB_PATH
};
