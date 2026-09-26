import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'database.db');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Initialize Schema without any fake/mock data
  initSchema(dbInstance);
  saveDb();

  return dbInstance;
}

export function saveDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS account_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      account TEXT DEFAULT '-',
      broker TEXT DEFAULT 'Čeka spajanje...',
      server TEXT DEFAULT '-',
      currency TEXT DEFAULT 'USD',
      balance REAL DEFAULT 0,
      equity REAL DEFAULT 0,
      margin REAL DEFAULT 0,
      free_margin REAL DEFAULT 0,
      daily_pnl REAL DEFAULT 0,
      open_positions_count INTEGER DEFAULT 0,
      day_limit_hit INTEGER DEFAULT 0,
      server_time TEXT DEFAULT '-',
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS open_positions (
      ticket INTEGER PRIMARY KEY,
      account TEXT,
      symbol TEXT,
      type TEXT,
      volume REAL,
      open_price REAL,
      current_price REAL,
      sl REAL,
      tp REAL,
      profit REAL,
      open_time TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS closed_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT,
      deal_ticket INTEGER,
      symbol TEXT,
      magic INTEGER DEFAULT 0,
      profit_usd REAL DEFAULT 0,
      profit_pips REAL DEFAULT 0,
      close_time TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_pnl_history (
      date TEXT PRIMARY KEY,
      profit_usd REAL DEFAULT 0,
      trades_count INTEGER DEFAULT 0,
      win_count INTEGER DEFAULT 0,
      loss_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT,
      status INTEGER,
      message TEXT,
      payload TEXT,
      ip TEXT,
      timestamp TEXT
    );
  `);
}

export function clearAllData(db: Database) {
  db.run(`DELETE FROM account_state;`);
  db.run(`DELETE FROM open_positions;`);
  db.run(`DELETE FROM closed_trades;`);
  db.run(`DELETE FROM daily_pnl_history;`);
  db.run(`DELETE FROM webhook_logs;`);
}
