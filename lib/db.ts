import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'materialive.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database: Database.Database) {
  // Users table - PIN-based authentication
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'warehouse', 'field')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    )
  `);

  // Locations table - synced from ComputerEase iclocation
  database.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ce_locationnum INTEGER UNIQUE,
      name TEXT NOT NULL,
      type INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Staging spots - predefined spots within a location
  database.exec(`
    CREATE TABLE IF NOT EXISTS staging_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      spot_type TEXT NOT NULL CHECK (spot_type IN ('will_call_construction', 'will_call_service', 'staging', 'delivery', 'long_term', 'pending_returns')),
      grid_row INTEGER,
      grid_col INTEGER,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (location_id) REFERENCES locations(id),
      UNIQUE(location_id, code)
    )
  `);

  // Purchase Orders - synced from ComputerEase icpo
  database.exec(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ce_ponum INTEGER UNIQUE,
      vendor_num TEXT,
      vendor_name TEXT,
      po_date TEXT,
      blurb TEXT,
      request_id TEXT,
      ce_attachid INTEGER,
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'partial', 'received', 'closed')),
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // PO Line Items - synced from icpoitem
  database.exec(`
    CREATE TABLE IF NOT EXISTS po_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      ce_itemid INTEGER,
      item_order INTEGER,
      item_num TEXT,
      description TEXT,
      vendor_item_num TEXT,
      outstanding REAL DEFAULT 0,
      received REAL DEFAULT 0,
      unposted REAL DEFAULT 0,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    )
  `);

  // PO Distribution - synced from icpodist
  database.exec(`
    CREATE TABLE IF NOT EXISTS po_distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_item_id INTEGER NOT NULL,
      ce_itemid INTEGER,
      job_num TEXT,
      job_name TEXT,
      phase_num TEXT,
      phase_name TEXT,
      cat_num TEXT,
      cat_name TEXT,
      outstanding REAL DEFAULT 0,
      received REAL DEFAULT 0,
      unposted REAL DEFAULT 0,
      FOREIGN KEY (po_item_id) REFERENCES po_items(id)
    )
  `);

  // Received Items - synced from icreceived
  database.exec(`
    CREATE TABLE IF NOT EXISTS received_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ce_serialnum INTEGER UNIQUE,
      po_id INTEGER,
      ce_ponum INTEGER,
      ce_itemnum TEXT,
      job_num TEXT,
      received_date TEXT,
      quantity REAL,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    )
  `);

  // Staging Records - where items are physically located
  database.exec(`
    CREATE TABLE IF NOT EXISTS staging_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      received_item_id INTEGER,
      po_id INTEGER,
      request_id TEXT,
      job_num TEXT,
      job_name TEXT,
      job_address TEXT,
      spot_id INTEGER,
      custom_location TEXT,
      pack_number TEXT,
      item_descriptions TEXT,
      notes TEXT,
      status TEXT DEFAULT 'staged' CHECK (status IN ('staged', 'ready', 'picked_up', 'delivered', 'returned')),
      staged_by INTEGER,
      staged_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (received_item_id) REFERENCES received_items(id),
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (spot_id) REFERENCES staging_spots(id),
      FOREIGN KEY (staged_by) REFERENCES users(id)
    )
  `);

  // Delivery Records - signature capture and delivery confirmation
  database.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staging_record_id INTEGER NOT NULL,
      delivery_date TEXT,
      scheduled_date TEXT,
      signer_name TEXT,
      signer_first_initial TEXT,
      signer_last_name TEXT,
      signature_data TEXT,
      signature_image BLOB,
      signed_at TEXT,
      delivered_by INTEGER,
      ce_attachment_uploaded INTEGER DEFAULT 0,
      ce_attachment_path TEXT,
      notes TEXT,
      FOREIGN KEY (staging_record_id) REFERENCES staging_records(id),
      FOREIGN KEY (delivered_by) REFERENCES users(id)
    )
  `);

  // QR Codes - generated for request IDs
  database.exec(`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT UNIQUE NOT NULL,
      qr_data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sync Log - track ComputerEase synchronization
  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )
  `);

  // Sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Insert default users if not exist
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = database.prepare(`
      INSERT INTO users (username, full_name, pin_hash, role) VALUES (?, ?, ?, ?)
    `);

    // Hash PINs
    const users = [
      { username: 'TSTEPPAN', fullName: 'Tim Steppan', pin: '5668', role: 'warehouse' },
      { username: 'FGILIC', fullName: 'Faton Gilic', pin: '4214', role: 'warehouse' },
      { username: 'CAMES', fullName: 'Chris Ames', pin: '7902', role: 'admin' },
      { username: 'FIELD', fullName: 'Field User', pin: '1234', role: 'field' },
    ];

    for (const user of users) {
      const pinHash = bcrypt.hashSync(user.pin, 10);
      insertUser.run(user.username, user.fullName, pinHash, user.role);
    }
    console.log('Default users created');
  }

  // Insert Glendora as default location if not exists
  const locationCount = database.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number };
  if (locationCount.count === 0) {
    database.prepare(`
      INSERT INTO locations (ce_locationnum, name, type) VALUES (?, ?, ?)
    `).run(1, 'GLENDORA', 1);

    // Get the location ID
    const location = database.prepare('SELECT id FROM locations WHERE name = ?').get('GLENDORA') as { id: number };

    // Insert default staging spots based on PPT layout
    const insertSpot = database.prepare(`
      INSERT INTO staging_spots (location_id, code, name, spot_type, grid_row, grid_col) VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Will Call - Construction (W1A-W2C)
    const wcConst = ['W1A', 'W1B', 'W1C', 'W2A', 'W2B', 'W2C'];
    wcConst.forEach((code, i) => {
      insertSpot.run(location.id, code, code, 'will_call_construction', Math.floor(i / 3), i % 3);
    });

    // Will Call - Service (W3A-W4F)
    const wcService = ['W3A', 'W3B', 'W3C', 'W3D', 'W3E', 'W3F', 'W4A', 'W4B', 'W4C', 'W4D', 'W4E', 'W4F'];
    wcService.forEach((code, i) => {
      insertSpot.run(location.id, code, code, 'will_call_service', Math.floor(i / 6), i % 6);
    });

    // Staging in Warehouse (S1A-S4C)
    const staging = ['S1A', 'S1B', 'S1C', 'S2A', 'S2B', 'S2C', 'S3A', 'S3B', 'S3C', 'S4A', 'S4B', 'S4C'];
    staging.forEach((code, i) => {
      insertSpot.run(location.id, code, code, 'staging', Math.floor(i / 3), i % 3);
    });

    // Customer Delivery (D1A-D3C)
    const delivery = ['D1A', 'D1B', 'D1C', 'D2A', 'D2B', 'D2C', 'D3A', 'D3B', 'D3C'];
    delivery.forEach((code, i) => {
      insertSpot.run(location.id, code, code, 'delivery', Math.floor(i / 3), i % 3);
    });

    // Long Term Storage
    const longTerm = ['LT-1A', 'LT-1B', 'LT-1C', 'LT-2A', 'LT-2B', 'LT-2C'];
    longTerm.forEach((code, i) => {
      insertSpot.run(location.id, code, code, 'long_term', Math.floor(i / 3), i % 3);
    });

    // Pending Returns
    insertSpot.run(location.id, 'PR-1', 'Pending Returns 1', 'pending_returns', 0, 0);
    insertSpot.run(location.id, 'PR-2', 'Pending Returns 2', 'pending_returns', 0, 1);

    console.log('Default staging spots created');
  }
}

// Auth functions
export function authenticateUser(username: string, pin: string): { success: boolean; user?: any; token?: string; error?: string } {
  const database = getDb();
  const user = database.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.toUpperCase()) as any;

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (!bcrypt.compareSync(pin, user.pin_hash)) {
    return { success: false, error: 'Invalid PIN' };
  }

  // Generate session token
  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  database.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);
  database.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role
    },
    token
  };
}

export function validateSession(token: string): { valid: boolean; user?: any } {
  const database = getDb();
  const session = database.prepare(`
    SELECT s.*, u.id as user_id, u.username, u.full_name, u.role 
    FROM sessions s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now') AND u.active = 1
  `).get(token) as any;

  if (!session) {
    return { valid: false };
  }

  return {
    valid: true,
    user: {
      id: session.user_id,
      username: session.username,
      fullName: session.full_name,
      role: session.role
    }
  };
}

export function logoutSession(token: string): void {
  const database = getDb();
  database.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export default getDb;
