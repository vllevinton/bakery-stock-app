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
  // TABLAS BASE (compatibles con lo que ya tenés)
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
      start_date TEXT,
      end_date TEXT,
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

  // ✅ MIGRACIONES (para DBs ya creadas)
  ensureProductsColumns(d);
  ensureBranchSchema(d);           // branches + branch_products
  ensureUsersBranchColumn(d);      // users.branch_id
  ensureBranchIdInEntries(d);      // stock_entries.branch_id + alert_logs.branch_id

  // ✅ Seed branches + branch_products
  seedBranchesIfMissing(d);
  seedBranchProductsIfMissing(d);

  // ✅ Seed users si vacío (nuevo proyecto)
  seedUsersIfEmpty(d);

  // ✅ Backfill para DBs existentes (TU CASO)
  backfillEmployeeBranches(d);
}

/* ----------------------------- Helpers MIGRATION ---------------------------- */

function columnExists(d: Database.Database, table: string, column: string): boolean {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return cols.some((c) => c.name === column);
}

function tableExists(d: Database.Database, table: string): boolean {
  const row = d.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
  ).get(table) as any;
  return !!row;
}

function ensureProductsColumns(d: Database.Database) {
  if (!columnExists(d, "products", "active")) {
    d.exec(`ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!columnExists(d, "products", "start_date")) {
    d.exec(`ALTER TABLE products ADD COLUMN start_date TEXT;`);
  }
  if (!columnExists(d, "products", "end_date")) {
    d.exec(`ALTER TABLE products ADD COLUMN end_date TEXT;`);
  }
}

function ensureBranchSchema(d: Database.Database) {
  if (!tableExists(d, "branches")) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);
  }

  if (!tableExists(d, "branch_products")) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS branch_products (
        branch_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        start_date TEXT,
        end_date TEXT,
        current_stock_packs INTEGER NOT NULL DEFAULT 0,
        margin_minimum_packs INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (branch_id, product_id),
        FOREIGN KEY(branch_id) REFERENCES branches(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
      );
    `);
  }
}

function ensureUsersBranchColumn(d: Database.Database) {
  if (!columnExists(d, "users", "branch_id")) {
    d.exec(`ALTER TABLE users ADD COLUMN branch_id INTEGER;`);
  }
}

function ensureBranchIdInEntries(d: Database.Database) {
  if (!columnExists(d, "stock_entries", "branch_id")) {
    d.exec(`ALTER TABLE stock_entries ADD COLUMN branch_id INTEGER;`);
  }
  if (!columnExists(d, "alert_logs", "branch_id")) {
    d.exec(`ALTER TABLE alert_logs ADD COLUMN branch_id INTEGER;`);
  }
}

/* ---------------------------------- Seeds --------------------------------- */

function seedBranchesIfMissing(d: Database.Database) {
  const now = nowIso();
  const count = d.prepare("SELECT COUNT(*) as c FROM branches").get() as any;
  if ((count?.c ?? 0) > 0) return;

  const ins = d.prepare("INSERT INTO branches (name, created_at) VALUES (?,?)");
  ins.run("Sucursal 1", now);
  ins.run("Sucursal 2", now);
  ins.run("Sucursal 3", now);
}

function seedBranchProductsIfMissing(d: Database.Database) {
  const now = nowIso();

  const count = d.prepare("SELECT COUNT(*) as c FROM branch_products").get() as any;
  if ((count?.c ?? 0) > 0) return;

  const branches = d.prepare("SELECT id FROM branches ORDER BY id ASC").all() as any[];
  const products = d.prepare(`
    SELECT id, current_stock_packs, margin_minimum_packs, active, start_date, end_date
    FROM products
    ORDER BY id ASC
  `).all() as any[];

  const ins = d.prepare(`
    INSERT INTO branch_products
      (branch_id, product_id, active, start_date, end_date, current_stock_packs, margin_minimum_packs, updated_at)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  for (const b of branches) {
    for (const p of products) {
      ins.run(
        b.id,
        p.id,
        p.active ?? 1,
        p.start_date ?? null,
        p.end_date ?? null,
        p.current_stock_packs ?? 0,
        p.margin_minimum_packs ?? 0,
        now
      );
    }
  }
}

function seedUsersIfEmpty(d: Database.Database) {
  const userCount = d.prepare("SELECT COUNT(*) as c FROM users").get() as any;
  if ((userCount?.c ?? 0) !== 0) return;

  const now = nowIso();

  const ownerUser = process.env.SEED_OWNER_USER || "owner";
  const ownerPass = process.env.SEED_OWNER_PASSWORD || "56789";
  const ownerEmail = process.env.OWNER_EMAIL || "valentinelio04@gmail.com";

  const b1User = process.env.SEED_BRANCH1_USER || "sucursal1";
  const b1Pass = process.env.SEED_BRANCH1_PASS || "12345";

  const b2User = process.env.SEED_BRANCH2_USER || "sucursal2";
  const b2Pass = process.env.SEED_BRANCH2_PASS || "12345";

  const b3User = process.env.SEED_BRANCH3_USER || "sucursal3";
  const b3Pass = process.env.SEED_BRANCH3_PASS || "12345";

  const bakeryEmail = process.env.BAKERY_EMAIL || "valentineliotwitch@gmail.com";

  const ins = d.prepare(`
    INSERT INTO users (username, password_hash, role, email, created_at, branch_id)
    VALUES (?,?,?,?,?,?)
  `);

  ins.run(ownerUser, bcrypt.hashSync(ownerPass, 10), "OWNER", ownerEmail, now, null);
  ins.run(b1User, bcrypt.hashSync(b1Pass, 10), "EMPLEADO", bakeryEmail, now, 1);
  ins.run(b2User, bcrypt.hashSync(b2Pass, 10), "EMPLEADO", bakeryEmail, now, 2);
  ins.run(b3User, bcrypt.hashSync(b3Pass, 10), "EMPLEADO", bakeryEmail, now, 3);

  const keepLegacy = (process.env.KEEP_LEGACY_EMPLEADO ?? "1") === "1";
  if (keepLegacy) {
    const legacyUser = "empleado";
    const legacyPass = process.env.SEED_EMPLOYEE_PASSWORD || "12345";
    try {
      ins.run(legacyUser, bcrypt.hashSync(legacyPass, 10), "EMPLEADO", bakeryEmail, now, 1);
    } catch {
      // ya existía
    }
  }
}

/* ------------------------------ Backfill FIX ------------------------------- */

function backfillEmployeeBranches(d: Database.Database) {
  // Esto arregla el error actual: empleados sin branch_id
  // 1) Setear branch_id para usuarios conocidos sucursal1/2/3/empleado si están NULL
  const mapping: Array<{ username: string; branch_id: number }> = [
    { username: process.env.SEED_BRANCH1_USER || "sucursal1", branch_id: 1 },
    { username: process.env.SEED_BRANCH2_USER || "sucursal2", branch_id: 2 },
    { username: process.env.SEED_BRANCH3_USER || "sucursal3", branch_id: 3 },
    { username: "empleado", branch_id: 1 }, // legacy
  ];

  const upd = d.prepare(`
    UPDATE users
    SET branch_id = ?
    WHERE username = ?
      AND role = 'EMPLEADO'
      AND (branch_id IS NULL OR branch_id = '')
  `);

  for (const m of mapping) {
    try { upd.run(m.branch_id, m.username); } catch {}
  }

  // 2) (Opcional pero muy útil) cualquier EMPLEADO sin branch_id => sucursal 1
  // Si preferís NO hacerlo, borrá este bloque.
  d.prepare(`
    UPDATE users
    SET branch_id = 1
    WHERE role = 'EMPLEADO'
      AND (branch_id IS NULL OR branch_id = '')
  `).run();
}

/* ---------------------------------- Utils --------------------------------- */

export function nowIso() {
  return new Date().toISOString();
}
