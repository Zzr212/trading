import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { getDb, saveDb, clearAllData } from './src/server/db.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const API_KEY = process.env.API_KEY || 'promijeni-ovo-u-tajni-kljuc';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper to log incoming requests
async function logWebhook(endpoint: string, status: number, message: string, payload: any, ip: string) {
  try {
    const db = await getDb();
    const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload || '');
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO webhook_logs (endpoint, status, message, payload, ip, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [endpoint, status, message, payloadStr.slice(0, 1000), ip || '127.0.0.1', now]
    );
    saveDb();
  } catch (err) {
    console.error('Error logging webhook:', err);
  }
}

// Authentication middleware for MT5 EA webhook endpoints
const requireApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const providedKey = req.header('X-API-Key') || req.header('x-api-key');
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!providedKey || providedKey !== API_KEY) {
    await logWebhook(req.path, 401, 'Odbijeno: Neispravan ili nedostaje X-API-Key', req.body, clientIp);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Neispravan ili nedostaje X-API-Key zaglavlje. Provjerite EA postavke.'
    });
  }

  next();
};

// ==========================================
// 1. MT5 EA Webhook Endpoints (Zaštićeno API ključem)
// ==========================================

// POST /api/heartbeat
// Payload: { account, broker, server, currency, balance, equity, margin, free_margin, daily_pnl, open_positions, day_limit_hit, server_time }
app.post('/api/heartbeat', requireApiKey, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
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

    db.run(
      `INSERT OR REPLACE INTO account_state (
        id, account, broker, server, currency, balance, equity, margin, free_margin, daily_pnl, open_positions_count, day_limit_hit, server_time, last_updated
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );

    // Update today's PnL history with real daily_pnl
    const todayStr = new Date().toISOString().split('T')[0];
    const existingPnl = db.exec(`SELECT * FROM daily_pnl_history WHERE date = '${todayStr}'`);
    if (existingPnl.length > 0 && existingPnl[0].values.length > 0) {
      db.run(`UPDATE daily_pnl_history SET profit_usd = ? WHERE date = ?`, [Number(daily_pnl), todayStr]);
    } else {
      db.run(`INSERT INTO daily_pnl_history (date, profit_usd, trades_count, win_count, loss_count) VALUES (?, ?, 0, 0, 0)`, [todayStr, Number(daily_pnl)]);
    }

    saveDb();

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    await logWebhook('/api/heartbeat', 200, `Heartbeat: Račun ${account} | Equity: $${equity} | P/L: $${daily_pnl}`, req.body, clientIp);

    console.log(`💚 [REAL MT5 Heartbeat] Račun: ${account} | Balans: $${balance} | Equity: $${equity} | P/L: $${daily_pnl}`);

    return res.json({
      success: true,
      message: 'Heartbeat uspješno zabilježen',
      timestamp: now
    });
  } catch (err: any) {
    console.error('Greška u /api/heartbeat:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/positions
// Payload: { account, positions: [{ ticket, symbol, type, volume, open, current, sl, tp, profit, open_time }] }
app.post('/api/positions', requireApiKey, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { account = '-', positions = [] } = req.body;
    const now = new Date().toISOString();

    if (!Array.isArray(positions)) {
      return res.status(400).json({ success: false, error: 'Polje positions mora biti niz' });
    }

    // Replace open positions atomically
    db.run(`DELETE FROM open_positions;`);

    for (const p of positions) {
      db.run(
        `INSERT INTO open_positions (
          ticket, account, symbol, type, volume, open_price, current_price, sl, tp, profit, open_time, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(p.ticket || Math.floor(Date.now() / 1000)),
          String(account),
          String(p.symbol || 'N/A'),
          String(p.type || 'BUY').toUpperCase(),
          Number(p.volume || 0),
          Number(p.open ?? p.open_price ?? 0),
          Number(p.current ?? p.current_price ?? 0),
          Number(p.sl || 0),
          Number(p.tp || 0),
          Number(p.profit || 0),
          String(p.open_time || now),
          now
        ]
      );
    }

    // Update count in account_state if exists
    db.run(`UPDATE account_state SET open_positions_count = ?, last_updated = ? WHERE id = 1`, [positions.length, now]);

    saveDb();

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    await logWebhook('/api/positions', 200, `Sinkronizirano ${positions.length} otvorenih pozicija`, req.body, clientIp);

    console.log(`📋 [REAL MT5 Positions] Sinkronizirano ${positions.length} pozicija`);

    return res.json({
      success: true,
      count: positions.length,
      timestamp: now
    });
  } catch (err: any) {
    console.error('Greška u /api/positions:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/trade/close
// Payload: { account, deal_ticket, symbol, magic, profit_usd, profit_pips, close_time }
app.post('/api/trade/close', requireApiKey, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
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

    db.run(
      `INSERT INTO closed_trades (
        account, deal_ticket, symbol, magic, profit_usd, profit_pips, close_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(account),
        Number(deal_ticket),
        String(symbol),
        Number(magic),
        Number(profit_usd),
        Number(profit_pips),
        String(close_time),
        now
      ]
    );

    // Update daily_pnl_history
    const closeDateStr = (close_time ? new Date(close_time) : new Date()).toISOString().split('T')[0];
    const existing = db.exec(`SELECT trades_count, win_count, loss_count, profit_usd FROM daily_pnl_history WHERE date = '${closeDateStr}'`);
    const isWin = Number(profit_usd) >= 0;

    if (existing.length > 0 && existing[0].values.length > 0) {
      const [tCount, wCount, lCount, curPnl] = existing[0].values[0];
      db.run(
        `UPDATE daily_pnl_history SET trades_count = ?, win_count = ?, loss_count = ?, profit_usd = ? WHERE date = ?`,
        [
          (tCount as number) + 1,
          (wCount as number) + (isWin ? 1 : 0),
          (lCount as number) + (isWin ? 0 : 1),
          Number(curPnl) + Number(profit_usd),
          closeDateStr
        ]
      );
    } else {
      db.run(
        `INSERT INTO daily_pnl_history (date, profit_usd, trades_count, win_count, loss_count) VALUES (?, ?, 1, ?, ?)`,
        [closeDateStr, Number(profit_usd), isWin ? 1 : 0, isWin ? 0 : 1]
      );
    }

    saveDb();

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    await logWebhook('/api/trade/close', 200, `Zatvoren trejd: ${symbol} P/L: $${profit_usd} (${profit_pips} pips)`, req.body, clientIp);

    console.log(`💰 [REAL MT5 Trade Closed] ${symbol} | Profit: $${profit_usd} (${profit_pips} pips)`);

    return res.json({
      success: true,
      message: 'Zatvoreni trejd uspješno pohranjen',
      deal_ticket,
      timestamp: now
    });
  } catch (err: any) {
    console.error('Greška u /api/trade/close:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. Dashboard Endpoints (Za Web Sučelje - Polling svakih 5s)
// ==========================================

// GET /api/dashboard/summary
app.get('/api/dashboard/summary', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT * FROM account_state WHERE id = 1`);
    
    let accountState: any = null;
    if (result.length > 0 && result[0].values.length > 0) {
      const cols = result[0].columns;
      const vals = result[0].values[0];
      accountState = cols.reduce((obj: any, col: string, idx: number) => {
        obj[col] = vals[idx];
        return obj;
      }, {});
    }

    // Ako još nema zapisa o računu ili nema heartbeat-a
    if (!accountState || !accountState.last_updated) {
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
          ea_status: 'disconnected', // 'disconnected' | 'offline' | 'warning' | 'online'
          margin_level_percent: '0.00',
          server_ip: '92.5.176.43'
        }
      });
    }

    // Izračunaj starost zadnjeg heartbeata
    const lastUpdated = new Date(accountState.last_updated).getTime();
    const now = Date.now();
    const ageSeconds = Math.max(0, Math.floor((now - lastUpdated) / 1000));
    
    // Status pravilo:
    // > 120 sekundi: offline (CRVENA BOJA)
    // 35 - 120 sekundi: warning (ŽUTA BOJA)
    // < 35 sekundi: online (ZELENA BOJA)
    let status: 'online' | 'warning' | 'offline' = 'online';
    if (ageSeconds > 120) {
      status = 'offline';
    } else if (ageSeconds > 35) {
      status = 'warning';
    }

    const margin = Number(accountState.margin) || 0;
    const equity = Number(accountState.equity) || 0;
    const marginLevel = margin > 0 ? ((equity / margin) * 100).toFixed(2) : '100.00';

    return res.json({
      success: true,
      data: {
        ...accountState,
        age_seconds: ageSeconds,
        ea_status: status,
        margin_level_percent: marginLevel,
        server_ip: '92.5.176.43'
      }
    });
  } catch (err: any) {
    console.error('Greška u /api/dashboard/summary:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/positions
app.get('/api/dashboard/positions', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT * FROM open_positions ORDER BY profit DESC, open_time DESC`);
    
    const positions: any[] = [];
    if (result.length > 0 && result[0].values.length > 0) {
      const cols = result[0].columns;
      for (const row of result[0].values) {
        const item = cols.reduce((obj: any, col: string, idx: number) => {
          obj[col] = row[idx];
          return obj;
        }, {});
        positions.push(item);
      }
    }

    const totalProfit = positions.reduce((acc, p) => acc + (Number(p.profit) || 0), 0);
    const totalVolume = positions.reduce((acc, p) => acc + (Number(p.volume) || 0), 0);

    return res.json({
      success: true,
      data: positions,
      count: positions.length,
      total_floating_profit: totalProfit,
      total_volume: totalVolume
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/trades
app.get('/api/dashboard/trades', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT * FROM closed_trades ORDER BY close_time DESC, id DESC LIMIT 20`);
    
    const trades: any[] = [];
    if (result.length > 0 && result[0].values.length > 0) {
      const cols = result[0].columns;
      for (const row of result[0].values) {
        const item = cols.reduce((obj: any, col: string, idx: number) => {
          obj[col] = row[idx];
          return obj;
        }, {});
        trades.push(item);
      }
    }

    const totalTrades = trades.length;
    const winTrades = trades.filter(t => (t.profit_usd || 0) >= 0).length;
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/daily-pnl
app.get('/api/dashboard/daily-pnl', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT * FROM daily_pnl_history ORDER BY date ASC LIMIT 30`);
    
    const history: any[] = [];
    let cumulative = 0;

    if (result.length > 0 && result[0].values.length > 0) {
      const cols = result[0].columns;
      for (const row of result[0].values) {
        const item = cols.reduce((obj: any, col: string, idx: number) => {
          obj[col] = row[idx];
          return obj;
        }, {});
        cumulative += Number(item.profit_usd || 0);
        item.cumulative_profit = Number(cumulative.toFixed(2));
        history.push(item);
      }
    }

    const totalPeriodProfit = history.reduce((acc, h) => acc + (Number(h.profit_usd) || 0), 0);
    const winningDays = history.filter(h => Number(h.profit_usd) > 0).length;
    const losingDays = history.filter(h => Number(h.profit_usd) < 0).length;

    return res.json({
      success: true,
      data: history,
      analytics: {
        total_30d_profit: totalPeriodProfit.toFixed(2),
        winning_days: winningDays,
        losing_days: losingDays
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/logs
app.get('/api/dashboard/logs', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = db.exec(`SELECT * FROM webhook_logs ORDER BY id DESC LIMIT 50`);
    
    const logs: any[] = [];
    if (result.length > 0 && result[0].values.length > 0) {
      const cols = result[0].columns;
      for (const row of result[0].values) {
        const item = cols.reduce((obj: any, col: string, idx: number) => {
          obj[col] = row[idx];
          return obj;
        }, {});
        logs.push(item);
      }
    }

    return res.json({ success: true, data: logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/dashboard/reset (Očisti bazu na nulu)
app.post('/api/dashboard/reset', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    clearAllData(db);
    saveDb();
    return res.json({ success: true, message: 'Baza je u potpunosti očišćena i spremna za stvarni MT5 bot.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Setup Vite development middleware in dev mode
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 MT5 REAL DASHBOARD POKRENUT`);
    console.log(`🌐 URL Dashboarda: http://localhost:${PORT}`);
    console.log(`🔑 X-API-Key: ${API_KEY}`);
    console.log(`📡 Čekaju se stvarni HTTP POST webhook pozivi s vašeg MT5 bota`);
    console.log(`======================================================\n`);
  });
}

startServer();
