require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 80; // Standardni port 80 za direct HTTP na Oracle VPS ili 3000 iza Nginx-a
const API_KEY = process.env.API_KEY || 'promijeni-ovo-u-tajni-kljuc';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicijalizacija SQLite baze (bez ikakvih simulacija/lažnih podataka)
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Greška pri spajanju na SQLite bazu:', err.message);
  } else {
    console.log('✅ Spojeno na SQLite bazu:', DB_PATH);
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // 1. Account state table
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
      )
    `);

    // 2. Open positions table
    db.run(`
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
      )
    `);

    // 3. Closed trades table
    db.run(`
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
      )
    `);

    // 4. Daily PnL history
    db.run(`
      CREATE TABLE IF NOT EXISTS daily_pnl_history (
        date TEXT PRIMARY KEY,
        profit_usd REAL DEFAULT 0,
        trades_count INTEGER DEFAULT 0,
        win_count INTEGER DEFAULT 0,
        loss_count INTEGER DEFAULT 0
      )
    `);

    // 5. Webhook audit logs
    db.run(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT,
        status INTEGER,
        message TEXT,
        payload TEXT,
        ip TEXT,
        timestamp TEXT
      )
    `);
  });
}

// Audit logger helper
function logWebhook(endpoint, status, message, payload, ip) {
  const now = new Date().toISOString();
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload || '');
  db.run(
    `INSERT INTO webhook_logs (endpoint, status, message, payload, ip, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
    [endpoint, status, message, payloadStr.slice(0, 1000), ip, now]
  );
}

// Sigurnosni middleware za provjeru API ključa
const requireApiKey = (req, res, next) => {
  const clientKey = req.header('X-API-Key') || req.header('x-api-key');
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (!clientKey || clientKey !== API_KEY) {
    console.warn(`⚠️ [401 Odbijeno] Neispravan API ključ s IP adrese: ${clientIp}`);
    logWebhook(req.path, 401, 'Unauthorized: Invalid X-API-Key', req.body, clientIp);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Neispravan ili nedostajući X-API-Key header.'
    });
  }
  next();
};

// ==========================================
// 1. MT5 EA API ENDPOINTS (Stvarni pozivi)
// ==========================================

// POST /api/heartbeat
// MT5 šalje svakih 10-30s
app.post('/api/heartbeat', requireApiKey, (req, res) => {
  const {
    account = '-',
    broker = 'Unknown Broker',
    server = '-',
    currency = 'USD',
    balance = 0,
    equity = 0,
    margin = 0,
    free_margin = 0,
    daily_pnl = 0,
    open_positions = 0,
    day_limit_hit = 0,
    server_time = new Date().toISOString()
  } = req.body;

  const now = new Date().toISOString();

  const query = `
    INSERT OR REPLACE INTO account_state (
      id, account, broker, server, currency, balance, equity, margin, free_margin, daily_pnl, open_positions_count, day_limit_hit, server_time, last_updated
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      String(account),
      String(broker),
      String(server),
      String(currency),
      Number(balance),
      Number(equity),
      Number(margin),
      Number(free_margin),
      Number(daily_pnl),
      Number(open_positions),
      day_limit_hit ? 1 : 0,
      String(server_time),
      now
    ],
    function (err) {
      if (err) {
        console.error('Greška pri spremanju heartbeata:', err.message);
        return res.status(500).json({ success: false, error: err.message });
      }

      // Update today's PnL in daily history
      const todayStr = now.split('T')[0];
      db.run(
        `INSERT INTO daily_pnl_history (date, profit_usd, trades_count, win_count, loss_count)
         VALUES (?, ?, 0, 0, 0)
         ON CONFLICT(date) DO UPDATE SET profit_usd = excluded.profit_usd`,
        [todayStr, Number(daily_pnl)]
      );

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      logWebhook('/api/heartbeat', 200, `Heartbeat: Račun ${account} | Equity: $${equity} | P/L: $${daily_pnl}`, req.body, clientIp);
      console.log(`💚 [REAL MT5 Heartbeat] Račun: ${account} | Equity: $${equity} | P/L: $${daily_pnl}`);

      return res.json({
        success: true,
        message: 'Heartbeat zaprimljen',
        timestamp: now
      });
    }
  );
});

// POST /api/positions
// MT5 šalje listu svih trenutno otvorenih pozicija
app.post('/api/positions', requireApiKey, (req, res) => {
  const { account = '-', positions = [] } = req.body;
  const now = new Date().toISOString();

  if (!Array.isArray(positions)) {
    return res.status(400).json({ success: false, error: 'Polje positions mora biti niz' });
  }

  db.serialize(() => {
    // Obriši prethodne otvorene pozicije
    db.run(`DELETE FROM open_positions WHERE 1=1`, [], (err) => {
      if (err) console.error('Greška pri brisanju starih pozicija:', err.message);
    });

    const stmt = db.prepare(`
      INSERT INTO open_positions (
        ticket, account, symbol, type, volume, open_price, current_price, sl, tp, profit, open_time, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of positions) {
      stmt.run([
        Number(p.ticket || Math.floor(Date.now() / 1000)),
        String(account),
        String(p.symbol || 'N/A'),
        String(p.type || 'BUY').toUpperCase(),
        Number(p.volume || 0),
        Number(p.open || p.open_price || 0),
        Number(p.current || p.current_price || 0),
        Number(p.sl || 0),
        Number(p.tp || 0),
        Number(p.profit || 0),
        String(p.open_time || now),
        now
      ]);
    }

    stmt.finalize();

    // Ažuriraj broj u stanju računa
    db.run(`UPDATE account_state SET open_positions_count = ?, last_updated = ? WHERE id = 1`, [positions.length, now]);

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    logWebhook('/api/positions', 200, `Sinkronizirano ${positions.length} pozicija`, req.body, clientIp);
    console.log(`📋 [REAL MT5 Positions] Sinkronizirano ${positions.length} pozicija`);

    return res.json({
      success: true,
      count: positions.length,
      timestamp: now
    });
  });
});

// POST /api/trade/close
// MT5 šalje kad se zatvori pojedini trejd
app.post('/api/trade/close', requireApiKey, (req, res) => {
  const {
    account = '-',
    deal_ticket = Math.floor(Date.now() / 1000),
    symbol = 'N/A',
    magic = 0,
    profit_usd = 0,
    profit_pips = 0,
    close_time = new Date().toISOString()
  } = req.body;

  const now = new Date().toISOString();

  const query = `
    INSERT INTO closed_trades (
      account, deal_ticket, symbol, magic, profit_usd, profit_pips, close_time, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      String(account),
      Number(deal_ticket),
      String(symbol),
      Number(magic),
      Number(profit_usd),
      Number(profit_pips),
      String(close_time),
      now
    ],
    function (err) {
      if (err) {
        console.error('Greška pri spremanju zatvorenog trejda:', err.message);
        return res.status(500).json({ success: false, error: err.message });
      }

      // Ažuriraj statistiku dana
      const closeDateStr = (close_time ? new Date(close_time) : new Date()).toISOString().split('T')[0];
      const isWin = Number(profit_usd) >= 0 ? 1 : 0;
      const isLoss = Number(profit_usd) < 0 ? 1 : 0;

      db.run(
        `INSERT INTO daily_pnl_history (date, profit_usd, trades_count, win_count, loss_count)
         VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           profit_usd = profit_usd + excluded.profit_usd,
           trades_count = trades_count + 1,
           win_count = win_count + excluded.win_count,
           loss_count = loss_count + excluded.loss_count`,
        [closeDateStr, Number(profit_usd), isWin, isLoss]
      );

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      logWebhook('/api/trade/close', 200, `Zatvoren trejd: ${symbol} P/L: $${profit_usd} (${profit_pips} pips)`, req.body, clientIp);
      console.log(`💰 [REAL MT5 Trade Closed] Deal #${deal_ticket} ${symbol} | P/L: $${profit_usd}`);

      return res.json({
        success: true,
        message: 'Zatvoreni trejd uspješno evidentiran',
        deal_ticket,
        timestamp: now
      });
    }
  );
});

// ==========================================
// 2. DASHBOARD READ API (Za Web Sučelje - Polling svakih 5s)
// ==========================================

// GET /api/dashboard/summary
app.get('/api/dashboard/summary', (req, res) => {
  db.get('SELECT * FROM account_state WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    if (!row || !row.last_updated) {
      return res.json({
        success: true,
        data: {
          account: '-',
          broker: 'Nije spojeno',
          server: '-',
          currency: 'USD',
          balance: 0,
          equity: 0,
          margin: 0,
          free_margin: 0,
          daily_pnl: 0,
          open_positions_count: 0,
          day_limit_hit: 0,
          server_time: '-',
          last_updated: null,
          age_seconds: null,
          ea_status: 'disconnected',
          margin_level_percent: '0.00',
          server_ip: '92.5.176.43'
        }
      });
    }

    const lastUpdated = new Date(row.last_updated).getTime();
    const now = Date.now();
    const ageSeconds = Math.max(0, Math.floor((now - lastUpdated) / 1000));

    let status = 'online';
    if (ageSeconds > 120) {
      status = 'offline';
    } else if (ageSeconds > 35) {
      status = 'warning';
    }

    const margin = Number(row.margin) || 0;
    const equity = Number(row.equity) || 0;
    const marginLevel = margin > 0 ? ((equity / margin) * 100).toFixed(2) : '100.00';

    return res.json({
      success: true,
      data: {
        ...row,
        age_seconds: ageSeconds,
        ea_status: status,
        margin_level_percent: marginLevel,
        server_ip: '92.5.176.43'
      }
    });
  });
});

// GET /api/dashboard/positions
app.get('/api/dashboard/positions', (req, res) => {
  db.all('SELECT * FROM open_positions ORDER BY profit DESC, open_time DESC', (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const positions = rows || [];
    const totalProfit = positions.reduce((acc, p) => acc + (Number(p.profit) || 0), 0);
    const totalVolume = positions.reduce((acc, p) => acc + (Number(p.volume) || 0), 0);
    return res.json({
      success: true,
      data: positions,
      count: positions.length,
      total_floating_profit: totalProfit,
      total_volume: totalVolume
    });
  });
});

// GET /api/dashboard/trades
app.get('/api/dashboard/trades', (req, res) => {
  db.all('SELECT * FROM closed_trades ORDER BY close_time DESC, id DESC LIMIT 20', (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const trades = rows || [];
    const totalTrades = trades.length;
    const winTrades = trades.filter((t) => (t.profit_usd || 0) >= 0).length;
    const lossTrades = totalTrades - winTrades;
    const winRate = totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : '0';
    const totalClosedProfit = trades.reduce((acc, t) => acc + (Number(t.profit_usd) || 0), 0);

    return res.json({
      success: true,
      data: trades,
      stats: {
        total_trades: totalTrades,
        win_trades: winTrades,
        loss_trades: lossTrades,
        win_rate: winRate,
        total_profit_usd: totalClosedProfit
      }
    });
  });
});

// GET /api/dashboard/daily-pnl
app.get('/api/dashboard/daily-pnl', (req, res) => {
  db.all('SELECT * FROM daily_pnl_history ORDER BY date ASC LIMIT 30', (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const history = rows || [];
    const totalProfit = history.reduce((acc, h) => acc + (Number(h.profit_usd) || 0), 0);
    return res.json({
      success: true,
      data: history,
      analytics: {
        total_30d_profit: totalProfit.toFixed(2)
      }
    });
  });
});

// GET /api/dashboard/logs
app.get('/api/dashboard/logs', (req, res) => {
  db.all('SELECT * FROM webhook_logs ORDER BY id DESC LIMIT 50', (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    return res.json({ success: true, data: rows || [] });
  });
});

// POST /api/dashboard/reset
app.post('/api/dashboard/reset', (req, res) => {
  db.serialize(() => {
    db.run(`DELETE FROM account_state;`);
    db.run(`DELETE FROM open_positions;`);
    db.run(`DELETE FROM closed_trades;`);
    db.run(`DELETE FROM daily_pnl_history;`);
    db.run(`DELETE FROM webhook_logs;`);
    return res.json({ success: true, message: 'Baza je uspješno resetirana na nulu.' });
  });
});

// Posluživanje frontend HTML-a
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Pokretanje servera
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 MT5 Live Monitor Server Pokrenut`);
  console.log(`🌐 Dashboard URL: http://92.5.176.43:${PORT}/`);
  console.log(`🔑 Sigurnosni X-API-Key: ${API_KEY}`);
  console.log(`📊 Spreman za stvarni MT5 Expert Advisor (nema simulacija)`);
  console.log(`======================================================\n`);
});
