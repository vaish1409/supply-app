const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  unit TEXT NOT NULL,
  per_person REAL NOT NULL,
  min_qty REAL NOT NULL DEFAULT 1,
  image_path TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requisition_no TEXT UNIQUE NOT NULL,
  org_name TEXT,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  delivery_date TEXT,
  gstin TEXT,
  instructions TEXT,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  razorpay_order_id TEXT,
  items_json TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'received',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
`);

// Seed a first admin account if none exists yet.
const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
if (adminCount === 0) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Created first admin account "${username}". Set ADMIN_USERNAME / ADMIN_PASSWORD in .env before deploying.`);
}

// Seed a starter catalog if empty, so the storefront isn't blank on first run.
const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (productCount === 0) {
  const insert = db.prepare(`INSERT INTO products (name, category, description, price, unit, per_person, min_qty)
    VALUES (@name, @category, @description, @price, @unit, @per_person, @min_qty)`);
  const starter = [
    { name: 'Rice (Bulk)', category: 'Food', description: 'Standard-grade rice, bulk sacks.', price: 60, unit: 'kg', per_person: 0.25, min_qty: 20 },
    { name: 'Mixed Dal', category: 'Food', description: 'Pulses mix, bulk packaging.', price: 110, unit: 'kg', per_person: 0.06, min_qty: 10 },
    { name: 'Field Cap', category: 'Apparel', description: 'Standard-issue field cap.', price: 180, unit: 'unit', per_person: 1, min_qty: 50 },
    { name: 'Rucksack — 45L', category: 'Gear', description: 'Durable 45L pack, reinforced straps.', price: 2200, unit: 'unit', per_person: 1, min_qty: 10 },
    { name: 'First-Aid Field Kit', category: 'Equipment', description: 'Compact field-ready medical kit.', price: 890, unit: 'kit', per_person: 0.1, min_qty: 5 },
  ];
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  insertMany(starter);
  console.log('Seeded starter catalog (5 items). Edit or remove these from the admin panel.');
}

module.exports = db;
