const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const dbPromise = open({
  filename: './inventory.db',
  driver: sqlite3.Database
}).then(async db => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      unit TEXT,
      category TEXT,
      brand TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT,
      image TEXT
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      old_quantity INTEGER,
      new_quantity INTEGER,
      change_date TEXT,
      user_info TEXT,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);
  return db;
});

module.exports = dbPromise;
