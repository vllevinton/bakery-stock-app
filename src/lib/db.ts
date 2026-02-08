import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

export type UserRole = "EMPLEADO" | "OWNER";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  init(db);
  return db;
}

function init(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_stock_packs INTEGER NOT NULL DEFAULT 0,
      margin_minimum_packs INTEGER NOT NULL DEFAULT 0,
      lead_time_days INTEGER NOT NULL DEFAULT 1,
      units_per_pack INTEGER NOT NULL DEFAULT 1,
      min_packs_order INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      stock_packs INTEGER NOT NULL,
      recorded_by INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      recorded_date TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(recorded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS alert_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      stock_packs INTEGER NOT NULL,
      margin_minimum_packs INTEGER NOT NULL,
      replenish_packs INTEGER NOT NULL,
      sent_to TEXT NOT NULL,
      reason TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);

  const userCount = d.prepare("SELECT COUNT(*) as c FROM users").get() as any;
  if (userCount.c === 0) {
    const now = new Date().toISOString();
    const ownerPass = process.env.SEED_OWNER_PASSWORD || "56789";
    const employeePass = process.env.SEED_EMPLOYEE_PASSWORD || "12345";
    const ownerEmail = process.env.OWNER_EMAIL || "valentinelio04@gmail.com";
    const bakeryEmail = process.env.BAKERY_EMAIL || "valentineliotwitch@gmail.com";

    d.prepare("INSERT INTO users (username, password_hash, role, email, created_at) VALUES (?,?,?,?,?)").run(
      "owner", bcrypt.hashSync(ownerPass, 10), "OWNER", ownerEmail, now
    );
    d.prepare("INSERT INTO users (username, password_hash, role, email, created_at) VALUES (?,?,?,?,?)").run(
      "empleado", bcrypt.hashSync(employeePass, 10), "EMPLEADO", bakeryEmail, now
    );

    const seed = [
      { code: "PAN", name: "Panes", cat: "Pan", stock: 8, margin: 8, lead: 1, units: 48, minOrder: 2 },
      { code: "MED", name: "Medialunas", cat: "Pastelería", stock: 3, margin: 5, lead: 1, units: 72, minOrder: 1 },
      { code: "COK", name: "Cookies", cat: "Dulces", stock: 5, margin: 7, lead: 1, units: 12, minOrder: 4 },
      { code: "FAC", name: "Facturas", cat: "Dulces", stock: 8, margin: 10, lead: 1, units: 72, minOrder: 3 }
    ];
    const ins = d.prepare(`
      INSERT INTO products
      (product_code, name, category, current_stock_packs, margin_minimum_packs, lead_time_days, units_per_pack, min_packs_order, active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);
    for (const p of seed) ins.run(p.code, p.name, p.cat, p.stock, p.margin, p.lead, p.units, p.minOrder, 1, now, now);
  }
}

export function nowIso() {
  return new Date().toISOString();
}
