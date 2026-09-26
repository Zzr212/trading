/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Layers,
  Percent,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  TrendingUp,
  Wifi,
  WifiOff,
  Code2,
  FileText
} from 'lucide-react';

interface AccountState {
  account: string;
  broker: string;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  daily_pnl: number;
  open_positions_count: number;
  day_limit_hit: number;
  server_time: string;
  last_updated: string | null;
  age_seconds: number | null;
  ea_status: 'online' | 'warning' | 'offline' | 'disconnected';
  margin_level_percent: string;
  server_ip: string;
}

interface Position {
  ticket: number;
  account: string;
  symbol: string;
  type: string;
  volume: number;
  open_price: number;
  current_price: number;
  sl: number;
  tp: number;
  profit: number;
  open_time: string;
  updated_at: string;
}

interface ClosedTrade {
  id: number;
  account: string;
  deal_ticket: number;
  symbol: string;
  magic: number;
  profit_usd: number;
  profit_pips: number;
  close_time: string;
}

interface TradeStats {
  total_trades: number;
  win_trades: number;
  loss_trades: number;
  win_rate: string;
  total_profit_usd: number;
}

interface DailyPnl {
  date: string;
  profit_usd: number;
  trades_count: number;
  win_count: number;
  loss_count: number;
  cumulative_profit?: number;
}

interface WebhookLog {
  id: number;
  endpoint: string;
  status: number;
  message: string;
  payload: string;
  ip: string;
  timestamp: string;
}

export default function App() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [tradeStats, setTradeStats] = useState<TradeStats>({
    total_trades: 0,
    win_trades: 0,
    loss_trades: 0,
    win_rate: '0',
    total_profit_usd: 0
  });
  const [dailyPnl, setDailyPnl] = useState<DailyPnl[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'integration' | 'logs'>('overview');

  const API_KEY = 'promijeni-ovo-u-tajni-kljuc';
  const SERVER_IP = '92.5.176.43';

  // Fetch real data from server
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [sumRes, posRes, tradeRes, pnlRes, logRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/dashboard/positions'),
        fetch('/api/dashboard/trades'),
        fetch('/api/dashboard/daily-pnl'),
        fetch('/api/dashboard/logs')
      ]);

      if (sumRes.ok) {
        const json = await sumRes.json();
        if (json.success && json.data) {
          setAccount(json.data);
        }
      }

      if (posRes.ok) {
        const json = await posRes.json();
        if (json.success && Array.isArray(json.data)) {
          setPositions(json.data);
        }
      }

      if (tradeRes.ok) {
        const json = await tradeRes.json();
        if (json.success) {
          setTrades(json.data || []);
          if (json.stats) setTradeStats(json.stats);
        }
      }

      if (pnlRes.ok) {
        const json = await pnlRes.json();
        if (json.success && Array.isArray(json.data)) {
          setDailyPnl(json.data);
        }
      }

      if (logRes.ok) {
        const json = await logRes.json();
        if (json.success && Array.isArray(json.data)) {
          setLogs(json.data);
        }
      }

      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Greška pri dohvaćanju stvarnih podataka:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Polling svake 5 sekundi (bez simulacija, samo pravi podaci)
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleResetDb = async () => {
    if (confirm('Jeste li sigurni da želite očistiti sve podatke iz baze? Baza će biti prazna i čekat će stvarne pozive vašeg MT5 EA bota.')) {
      try {
        const res = await fetch('/api/dashboard/reset', { method: 'POST' });
        if (res.ok) {
          fetchData();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const isConnected = account && account.last_updated && account.ea_status !== 'disconnected';
  const isStale = account?.ea_status === 'offline';
  const isWarning = account?.ea_status === 'warning';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/20 text-white font-bold text-lg">
            MT5
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base lg:text-lg font-bold tracking-tight text-white">MT5 Real-Time Monitor</h1>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400 border border-slate-700">
                VPS: {SERVER_IP}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>Automatsko osvježavanje svakih 5s</span>
              <span className="inline-block h-1 w-1 rounded-full bg-slate-600"></span>
              <span>Zadnji pregled: {lastSyncTime.toLocaleTimeString()}</span>
            </p>
          </div>
        </div>

        {/* EA Status Pill & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {!isConnected ? (
              <div className="flex items-center gap-2 rounded-full bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 text-xs font-medium text-slate-300">
                <WifiOff className="h-3.5 w-3.5 text-slate-400" />
                <span>Čeka se prvi kontakt s MT5</span>
              </div>
            ) : isStale ? (
              <div className="flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/30 px-3.5 py-1.5 text-xs font-semibold text-rose-400 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                <span>EA OFFLINE ({Math.floor((account?.age_seconds || 0) / 60)} min bez signala)</span>
              </div>
            ) : isWarning ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 text-xs font-semibold text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span>ZADNJI HEARTBEAT ({account?.age_seconds}s)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 -ml-4"></span>
                <span>EA AKTIVAN ({account?.age_seconds}s)</span>
              </div>
            )}
          </div>

          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 px-3 py-1.5 text-xs font-medium border border-slate-700 transition disabled:opacity-50"
            title="Osvježi sada"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Osvježi</span>
          </button>

          <button
            onClick={handleResetDb}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 px-2.5 py-1.5 text-xs font-medium border border-slate-700 transition"
            title="Očisti bazu na nulu"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Očisti bazu</span>
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-4 lg:px-8">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Nadzorna ploča (Uživo)</span>
          </button>
          <button
            onClick={() => setActiveTab('integration')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'integration'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Postavke & cURL Test</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Pravi HTTP Logovi ({logs.length})</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Offline Warning Banner if MT5 hasn't sent heartbeat for > 2 min */}
        {isStale && (
          <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-300">
            <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-rose-200">Upozorenje: Nema signala od MT5 Expert Advisora više od 2 minute!</p>
              <p className="text-rose-300/80 mt-0.5">
                Provjerite je li MetaTrader 5 terminal upaljen, ima li EA uključen "Allow WebRequest" za <code className="bg-rose-950/60 px-1 py-0.5 rounded text-rose-200 font-mono">http://{SERVER_IP}</code> i šalje li POST pozive.
              </p>
            </div>
          </div>
        )}

        {!isConnected && activeTab === 'overview' && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-emerald-400 border border-slate-700">
              <Server className="h-7 w-7 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Sustav je spreman i čeka stvarni MT5 bot</h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto mt-1">
                Baza je potpuno čista bez ikakvih simulacija. Čim vaš MetaTrader 5 pošalje stvarni heartbeat, podaci o vašem računu, pozicijama i profitu pojavit će se ovdje u realnom vremenu.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setActiveTab('integration')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-sm font-semibold shadow-lg shadow-emerald-600/20 transition"
              >
                <Code2 className="h-4 w-4" />
                <span>Pogledaj cURL naredbe za testiranje</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <>
            {/* Top Stat Cards (Balance, Equity, Margin, Free Margin, Daily P/L) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Balance */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                  <span>STANJE RAČUNA (BALANCE)</span>
                  <DollarSign className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl lg:text-3xl font-extrabold text-white font-mono">
                    ${Number(account?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{account?.currency || 'USD'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span>Račun: <strong className="text-slate-300 font-mono">{account?.account || '-'}</strong></span>
                  <span className="truncate max-w-[120px]" title={account?.broker || '-'}>{account?.broker || '-'}</span>
                </div>
              </div>

              {/* 2. Equity */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                  <span>VRIJEDNOST RAČUNA (EQUITY)</span>
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl lg:text-3xl font-extrabold text-white font-mono">
                    ${Number(account?.equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{account?.currency || 'USD'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span>Floating P/L:</span>
                  <span className={`font-mono font-bold ${
                    (account?.equity || 0) - (account?.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(account?.equity || 0) - (account?.balance || 0) >= 0 ? '+' : ''}
                    ${((account?.equity || 0) - (account?.balance || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* 3. Daily P/L */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                  <span>DNEVNI PROFIT / GUBITAK</span>
                  <Activity className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-2xl lg:text-3xl font-extrabold font-mono ${
                    (account?.daily_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(account?.daily_pnl || 0) >= 0 ? '+' : ''}
                    ${Number(account?.daily_pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{account?.currency || 'USD'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span>Dnevni limit:</span>
                  <span className={`font-medium ${account?.day_limit_hit ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                    {account?.day_limit_hit ? 'LIMIT DOSEGNUT' : 'OK (Aktivno)'}
                  </span>
                </div>
              </div>

              {/* 4. Margin & Free Margin */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                  <span>SLOBODNA MARŽA / LEVEL</span>
                  <Percent className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl lg:text-3xl font-extrabold text-white font-mono">
                    ${Number(account?.free_margin || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span>Margin: <strong className="text-slate-300 font-mono">${Number(account?.margin || 0).toFixed(2)}</strong></span>
                  <span>Level: <strong className="text-emerald-400 font-mono">{account?.margin_level_percent || '0.00'}%</strong></span>
                </div>
              </div>
            </div>

            {/* Middle Section: Open Positions & Daily P/L Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Open Positions Table (2 cols on lg) */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-emerald-400" />
                    <h2 className="font-bold text-white text-base">Otvorene Pozicije MT5</h2>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-mono font-semibold text-slate-300 border border-slate-700">
                    {positions.length} aktivnih
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-mono">
                        <th className="py-2.5 px-3">Ticket</th>
                        <th className="py-2.5 px-3">Simbol</th>
                        <th className="py-2.5 px-3">Tip</th>
                        <th className="py-2.5 px-3">Volumen</th>
                        <th className="py-2.5 px-3">Open</th>
                        <th className="py-2.5 px-3">Current</th>
                        <th className="py-2.5 px-3">SL / TP</th>
                        <th className="py-2.5 px-3 text-right">Profit ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {positions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                            {isConnected ? 'Trenutno nema otvorenih pozicija na MT5 računu.' : 'Nema zabilježenih pozicija (čeka se veza s MT5).'}
                          </td>
                        </tr>
                      ) : (
                        positions.map((p) => (
                          <tr key={p.ticket} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-3 text-slate-400">#{p.ticket}</td>
                            <td className="py-3 px-3 font-bold text-white">{p.symbol}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}>
                                {p.type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-300">{p.volume.toFixed(2)}</td>
                            <td className="py-3 px-3 text-slate-300">{p.open_price}</td>
                            <td className="py-3 px-3 text-slate-200 font-semibold">{p.current_price}</td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {p.sl > 0 ? p.sl : '-'} / {p.tp > 0 ? p.tp : '-'}
                            </td>
                            <td className={`py-3 px-3 text-right font-bold text-sm ${
                              p.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Account Info card (1 col on lg) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  <h2 className="font-bold text-white text-base">Server & MT5 Stanje</h2>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400">IP Poslužitelja:</span>
                    <span className="font-mono font-semibold text-white">{SERVER_IP}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400">MT5 Server:</span>
                    <span className="font-mono font-semibold text-slate-200">{account?.server || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400">Vrijeme MT5 Servera:</span>
                    <span className="font-mono text-slate-300">{account?.server_time || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400">Zadnji kontakt:</span>
                    <span className="font-mono text-slate-300">
                      {account?.last_updated ? new Date(account.last_updated).toLocaleTimeString() : 'Nikad'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400">Ukupno zatvorenih trejdova:</span>
                    <span className="font-mono font-bold text-white">{tradeStats.total_trades}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="font-mono font-bold text-emerald-400">{tradeStats.win_rate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Last 20 Closed Trades & Daily PnL History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Last 20 Closed Trades */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-emerald-400" />
                    <h2 className="font-bold text-white text-base">Zadnjih 20 Zatvorenih Trejdova</h2>
                  </div>
                  <span className="text-xs text-slate-400">Stvarni podaci s POST /api/trade/close</span>
                </div>

                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                      <tr className="text-slate-400 text-xs uppercase tracking-wider font-mono">
                        <th className="py-2.5 px-3">Deal</th>
                        <th className="py-2.5 px-3">Simbol</th>
                        <th className="py-2.5 px-3 text-right">Profit ($)</th>
                        <th className="py-2.5 px-3 text-right">Pips</th>
                        <th className="py-2.5 px-3 text-right">Vrijeme</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {trades.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                            Nema zabilježenih zatvorenih trejdova.
                          </td>
                        </tr>
                      ) : (
                        trades.map((t) => (
                          <tr key={t.id || t.deal_ticket} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 text-slate-400">#{t.deal_ticket}</td>
                            <td className="py-2.5 px-3 font-bold text-white">{t.symbol}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              t.profit_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {t.profit_usd >= 0 ? '+' : ''}${Number(t.profit_usd).toFixed(2)}
                            </td>
                            <td className={`py-2.5 px-3 text-right ${
                              t.profit_pips >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {t.profit_pips >= 0 ? '+' : ''}{t.profit_pips}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">{t.close_time}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daily PnL History List */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    <h2 className="font-bold text-white text-base">Povijest Dnevnog P/L-a (Realno)</h2>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                      <tr className="text-slate-400 text-xs uppercase tracking-wider font-mono">
                        <th className="py-2.5 px-3">Datum</th>
                        <th className="py-2.5 px-3 text-right">Dnevni P/L</th>
                        <th className="py-2.5 px-3 text-right">Trejdova</th>
                        <th className="py-2.5 px-3 text-right">W / L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {dailyPnl.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                            Nema povijesti (čeka se bilježenje prvih stvarnih dana).
                          </td>
                        </tr>
                      ) : (
                        dailyPnl.map((d) => (
                          <tr key={d.date} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 text-slate-300 font-semibold">{d.date}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              d.profit_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {d.profit_usd >= 0 ? '+' : ''}${Number(d.profit_usd).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">{d.trades_count}</td>
                            <td className="py-2.5 px-3 text-right text-slate-400">
                              <span className="text-emerald-400 font-semibold">{d.win_count}</span> / <span className="text-rose-400 font-semibold">{d.loss_count}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= TAB 2: INTEGRATION & CURL ================= */}
        {activeTab === 'integration' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                <span>Kako spojiti MT5 EA i testirati cURL naredbama</span>
              </h2>
              <p className="text-sm text-slate-300">
                Vaš poslužitelj na Oracle VPS-u (<code className="text-emerald-300 font-mono">http://{SERVER_IP}</code>) prihvaća 3 zaštićena endpointa.
                Svaki zahtjev <strong>MORA</strong> imati zaglavlje <code className="text-amber-300 font-mono">X-API-Key: {API_KEY}</code>.
              </p>

              {/* cURL Example 1: Heartbeat */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono">1. Testiranje Heartbeata (POST /api/heartbeat)</span>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST http://${SERVER_IP}/api/heartbeat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  -d '{
    "account": "10948201",
    "broker": "IC Markets",
    "server": "ICMarketsSC-Live02",
    "currency": "USD",
    "balance": 10000.00,
    "equity": 10250.00,
    "margin": 200.00,
    "free_margin": 10050.00,
    "daily_pnl": 250.00,
    "open_positions": 1,
    "day_limit_hit": 0,
    "server_time": "2026-09-26 15:00:00"
  }'`, 'curl-hb')}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-mono"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedKey === 'curl-hb' ? 'Kopirano!' : 'Kopiraj cURL'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300/90 overflow-x-auto">
{`curl -X POST http://${SERVER_IP}/api/heartbeat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  -d '{
    "account": "10948201",
    "broker": "IC Markets",
    "server": "ICMarketsSC-Live02",
    "currency": "USD",
    "balance": 10000.00,
    "equity": 10250.00,
    "margin": 200.00,
    "free_margin": 10050.00,
    "daily_pnl": 250.00,
    "open_positions": 1,
    "day_limit_hit": 0,
    "server_time": "2026-09-26 15:00:00"
  }'`}
                </pre>
              </div>

              {/* cURL Example 2: Positions */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono">2. Sinkronizacija Otvorenih Pozicija (POST /api/positions)</span>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST http://${SERVER_IP}/api/positions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  -d '{
    "account": "10948201",
    "positions": [
      {
        "ticket": 78491021,
        "symbol": "EURUSD",
        "type": "BUY",
        "volume": 0.50,
        "open": 1.08450,
        "current": 1.08720,
        "sl": 1.08100,
        "tp": 1.09200,
        "profit": 135.00,
        "open_time": "2026-09-26 14:00:00"
      }
    ]
  }'`, 'curl-pos')}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-mono"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedKey === 'curl-pos' ? 'Kopirano!' : 'Kopiraj cURL'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300/90 overflow-x-auto">
{`curl -X POST http://${SERVER_IP}/api/positions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  -d '{
    "account": "10948201",
    "positions": [
      {
        "ticket": 78491021,
        "symbol": "EURUSD",
        "type": "BUY",
        "volume": 0.50,
        "open": 1.08450,
        "current": 1.08720,
        "sl": 1.08100,
        "tp": 1.09200,
        "profit": 135.00,
        "open_time": "2026-09-26 14:00:00"
      }
    ]
  }'`}
                </pre>
              </div>

              {/* cURL Example 3: Close Trade */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 font-mono">3. Zatvaranje Trejda (POST /api/trade/close)</span>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST http://${SERVER_IP}/api/trade/close \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  -d '{
    "account": "10948201",
    "deal_ticket": 78491999,
    "symbol": "GBPUSD",
    "magic": 101,
    "profit_usd": 185.50,
    "profit_pips": 18.5,
    "close_time": "2026-09-26 14:35:10"
  }'`, 'curl-close')}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-mono"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedKey === 'curl-close' ? 'Kopirano!' : 'Kopiraj cURL'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300/90 overflow-x-auto">
{`curl -X POST http://${SERVER_IP}/api/trade/close \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${API_KEY}" \\
  -d '{
    "account": "10948201",
    "deal_ticket": 78491999,
    "symbol": "GBPUSD",
    "magic": 101,
    "profit_usd": 185.50,
    "profit_pips": 18.5,
    "close_time": "2026-09-26 14:35:10"
  }'`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: REAL LOGS ================= */}
        {activeTab === 'logs' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                <h2 className="font-bold text-white text-base">Stvarni HTTP Pristupni Logovi</h2>
              </div>
              <span className="text-xs text-slate-400">Prikazuje stvarne dolazne webhooke i 401 provjere</span>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                  <tr className="text-slate-400 text-xs uppercase tracking-wider font-mono">
                    <th className="py-2.5 px-3">Vrijeme</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Endpoint</th>
                    <th className="py-2.5 px-3">IP Adresa</th>
                    <th className="py-2.5 px-3">Poruka / Sadržaj</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        Nema zabilježenih HTTP poziva. Čeka se prvi zahtjev s MT5 EA bota.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 200 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-semibold">{log.endpoint}</td>
                        <td className="py-2.5 px-3 text-slate-400">{log.ip}</td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-md truncate" title={log.payload}>
                          {log.message}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
