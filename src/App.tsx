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
  FileText,
  Smartphone,
  ChevronDown,
  ChevronUp
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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

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

  const floatingPl = (account?.equity || 0) - (account?.balance || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200 pb-20 md:pb-8">
      {/* Top Header - Mobile Optimized */}
      <header className="sticky top-0 z-50 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md px-3.5 sm:px-6 py-2.5 sm:py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-md shadow-emerald-500/20 text-white font-black text-xs sm:text-sm">
              MT5
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">MT5 Monitor</h1>
                <span className="hidden sm:inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
                  {SERVER_IP}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                {account?.broker && account.broker !== 'Nije spojeno' ? (
                  <span className="text-slate-300 font-medium">
                    {account.broker} • #{account.account}
                  </span>
                ) : (
                  <span>Auto-sync 5s</span>
                )}
              </p>
            </div>
          </div>

          {/* EA Status Pill & Quick Action */}
          <div className="flex items-center gap-2 shrink-0">
            {!isConnected ? (
              <div className="flex items-center gap-1.5 rounded-full bg-slate-800/90 border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                <span className="hidden xs:inline">Čeka se</span> MT5
              </div>
            ) : isStale ? (
              <div className="flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/40 px-2.5 py-1 text-[11px] font-bold text-rose-400 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span>OFFLINE ({Math.floor((account?.age_seconds || 0) / 60)}m)</span>
              </div>
            ) : isWarning ? (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span>SIGNAL ({account?.age_seconds}s)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 -ml-3.5"></span>
                <span>UŽIVO ({account?.age_seconds}s)</span>
              </div>
            )}

            <button
              onClick={fetchData}
              disabled={isRefreshing}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-200 border border-slate-700 transition disabled:opacity-50"
              title="Osvježi sada"
              aria-label="Osvježi podatke"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={handleResetDb}
              className="hidden sm:flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 border border-slate-700 transition"
              title="Očisti bazu"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs - Mobile Scrollable */}
      <nav className="sticky top-[49px] sm:top-[57px] z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm px-3 sm:px-6 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex gap-1 sm:gap-4 min-w-max">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Nadzor Uživo</span>
            {positions.length > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-mono">
                {positions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('integration')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === 'integration'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Spajanje & cURL</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Logovi ({logs.length})</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6">
        {/* Offline Warning Banner */}
        {isStale && (
          <div className="flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-rose-300 text-xs sm:text-sm">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-rose-200">Upozorenje: Nema signala s MT5 terminala &gt; 2 min!</p>
              <p className="text-rose-300/80 text-xs mt-0.5">
                Provjerite je li MT5 uključen i ima li <code className="bg-rose-950/60 px-1 rounded font-mono">http://{SERVER_IP}</code> na WebRequest listi.
              </p>
            </div>
          </div>
        )}

        {/* Not Connected Empty State */}
        {!isConnected && activeTab === 'overview' && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-5 sm:p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-emerald-400 border border-slate-700">
              <Server className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Sustav čeka stvarni MT5 bot</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1">
                Baza je čista (bez simulacija). Čim MT5 pošalje podatke na <code className="text-emerald-300 font-mono">/api/heartbeat</code>, ovdje će se pojaviti stanje uživo.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('integration')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-semibold shadow-md transition"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>cURL naredbe za test</span>
            </button>
          </div>
        )}

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <>
            {/* Primary Mobile Financial Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* 1. Balance */}
              <div className="rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
                  <span>BALANCE</span>
                  <DollarSign className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight">
                    ${Number(account?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                    Račun: {account?.account || '-'}
                  </div>
                </div>
              </div>

              {/* 2. Equity */}
              <div className="rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
                  <span>EQUITY</span>
                  <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight">
                    ${Number(account?.equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-mono mt-0.5 flex items-center gap-1">
                    <span className="text-slate-400">Float:</span>
                    <span className={`font-bold ${floatingPl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {floatingPl >= 0 ? '+' : ''}${floatingPl.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Daily P/L */}
              <div className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 shadow-sm flex flex-col justify-between ${
                (account?.daily_pnl || 0) > 0 
                  ? 'border-emerald-500/30 bg-emerald-950/15' 
                  : (account?.daily_pnl || 0) < 0 
                    ? 'border-rose-500/30 bg-rose-950/15' 
                    : 'border-slate-800 bg-slate-900/70'
              }`}>
                <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
                  <span>DNEVNI P/L</span>
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className={`text-lg sm:text-2xl lg:text-3xl font-extrabold font-mono tracking-tight ${
                    (account?.daily_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {(account?.daily_pnl || 0) >= 0 ? '+' : ''}
                    ${Number(account?.daily_pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-medium mt-0.5">
                    {account?.day_limit_hit ? (
                      <span className="text-rose-400 font-bold">⚠️ LIMIT DOSEGNUT</span>
                    ) : (
                      <span className="text-slate-400">Limit: <strong className="text-emerald-400">OK</strong></span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Margin & Free Margin */}
              <div className="rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
                  <span>SLOBODNA MARŽA</span>
                  <Percent className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1.5 sm:mt-2">
                  <div className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight">
                    ${Number(account?.free_margin || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Level: <strong className="text-emerald-400 font-bold">{account?.margin_level_percent || '0.00'}%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Meta Bar (Compact on mobile) */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-400">
              <div className="flex items-center gap-3 flex-wrap">
                <span>Broker: <strong className="text-slate-200">{account?.broker || '-'}</strong></span>
                <span className="hidden xs:inline text-slate-600">•</span>
                <span>Server: <strong className="text-slate-200">{account?.server || '-'}</strong></span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="hidden sm:inline">Vrijeme: <strong className="text-slate-300 font-mono">{account?.server_time || '-'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span>Win Rate: <strong className="text-emerald-400 font-mono">{tradeStats.win_rate}%</strong> ({tradeStats.win_trades}W/{tradeStats.loss_trades}L)</span>
              </div>
            </div>

            {/* OPEN POSITIONS - Responsive Cards on Mobile, Table on Desktop */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Layers className="h-4 w-4" />
                  </div>
                  <h2 className="font-bold text-white text-sm sm:text-base">Otvorene Pozicije MT5</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* View toggle for mobile/tablet */}
                  <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 sm:hidden">
                    <button
                      onClick={() => setViewMode('cards')}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${viewMode === 'cards' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      Kartice
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      Tablica
                    </button>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-mono font-bold text-slate-300 border border-slate-700">
                    {positions.length}
                  </span>
                </div>
              </div>

              {positions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs sm:text-sm bg-slate-950/40 rounded-xl border border-slate-800/60 p-4">
                  {isConnected ? 'Trenutno nema otvorenih pozicija na MT5 terminalu.' : 'Nema pozicija (čeka se prvi kontakt s MT5).'}
                </div>
              ) : (
                <>
                  {/* MOBILE CARDS VIEW (Clean, touch-friendly, highly readable) */}
                  <div className={`grid grid-cols-1 gap-2.5 sm:hidden ${viewMode === 'cards' ? 'block' : 'hidden'}`}>
                    {positions.map((p) => {
                      const isProfit = (p.profit || 0) >= 0;
                      return (
                        <div
                          key={p.ticket}
                          className={`rounded-xl p-3 border transition ${
                            isProfit 
                              ? 'bg-slate-900 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                              : 'bg-slate-900 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.05)]'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-white tracking-wide">{p.symbol}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono ${
                                p.type === 'BUY'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}>
                                {p.type} {p.volume.toFixed(2)}
                              </span>
                            </div>
                            <div className={`text-base font-extrabold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isProfit ? '+' : ''}${Number(p.profit).toFixed(2)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] font-mono">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Open Price:</span>
                              <span className="text-slate-200 font-semibold">{p.open_price}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Current:</span>
                              <span className="text-slate-100 font-bold">{p.current_price}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">SL / TP:</span>
                              <span className="text-slate-300">{p.sl > 0 ? p.sl : '-'} / {p.tp > 0 ? p.tp : '-'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block text-[10px]">Ticket:</span>
                              <span className="text-slate-400">#{p.ticket}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP & TABLE VIEW */}
                  <div className={`overflow-x-auto rounded-xl border border-slate-800/80 ${viewMode === 'table' ? 'block' : 'hidden sm:block'}`}>
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-950/80 border-b border-slate-800">
                        <tr className="text-slate-400 text-[11px] uppercase tracking-wider font-mono">
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
                        {positions.map((p) => (
                          <tr key={p.ticket} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 text-slate-400">#{p.ticket}</td>
                            <td className="py-2.5 px-3 font-bold text-white">{p.symbol}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}>
                                {p.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{p.volume.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-slate-300">{p.open_price}</td>
                            <td className="py-2.5 px-3 text-slate-200 font-semibold">{p.current_price}</td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {p.sl > 0 ? p.sl : '-'} / {p.tp > 0 ? p.tp : '-'}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold text-sm ${
                              p.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* BOTTOM SECTION: Closed Trades & Daily History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Last 20 Closed Trades (Card/Table Hybrid on mobile) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Clock className="h-4 w-4" />
                    </div>
                    <h2 className="font-bold text-white text-sm sm:text-base">Zadnji Zatvoreni Trejdovi</h2>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">Top 20</span>
                </div>

                {trades.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60">
                    Nema zabilježenih zatvorenih trejdova.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-800/80">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-950 border-b border-slate-800">
                        <tr className="text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-wider font-mono">
                          <th className="py-2 px-2.5">Simbol</th>
                          <th className="py-2 px-2.5 text-right">Profit ($)</th>
                          <th className="py-2 px-2.5 text-right">Pips</th>
                          <th className="py-2 px-2.5 text-right">Vrijeme</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                        {trades.map((t) => (
                          <tr key={t.id || t.deal_ticket} className="hover:bg-slate-800/40 transition">
                            <td className="py-2 px-2.5">
                              <div className="font-bold text-white">{t.symbol}</div>
                              <div className="text-[10px] text-slate-400">#{t.deal_ticket}</div>
                            </td>
                            <td className={`py-2 px-2.5 text-right font-bold text-xs sm:text-sm ${
                              t.profit_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {t.profit_usd >= 0 ? '+' : ''}${Number(t.profit_usd).toFixed(2)}
                            </td>
                            <td className={`py-2 px-2.5 text-right ${
                              t.profit_pips >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {t.profit_pips >= 0 ? '+' : ''}{t.profit_pips}
                            </td>
                            <td className="py-2 px-2.5 text-right text-slate-400 text-[10px] whitespace-nowrap">
                              {t.close_time ? t.close_time.split(' ')[1] || t.close_time : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Daily PnL History List */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <h2 className="font-bold text-white text-sm sm:text-base">Dnevni P/L (Zadnjih 30 dana)</h2>
                  </div>
                </div>

                {dailyPnl.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60">
                    Nema povijesti (čeka se bilježenje prvih stvarnih dana).
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-800/80">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-950 border-b border-slate-800">
                        <tr className="text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-wider font-mono">
                          <th className="py-2 px-2.5">Datum</th>
                          <th className="py-2 px-2.5 text-right">Dnevni P/L</th>
                          <th className="py-2 px-2.5 text-right">Trejdova</th>
                          <th className="py-2 px-2.5 text-right">W / L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                        {dailyPnl.map((d) => (
                          <tr key={d.date} className="hover:bg-slate-800/40 transition">
                            <td className="py-2 px-2.5 text-slate-300 font-semibold">{d.date}</td>
                            <td className={`py-2 px-2.5 text-right font-bold ${
                              d.profit_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {d.profit_usd >= 0 ? '+' : ''}${Number(d.profit_usd).toFixed(2)}
                            </td>
                            <td className="py-2 px-2.5 text-right text-slate-300">{d.trades_count}</td>
                            <td className="py-2 px-2.5 text-right text-slate-400">
                              <span className="text-emerald-400 font-semibold">{d.win_count}</span> / <span className="text-rose-400 font-semibold">{d.loss_count}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ================= TAB 2: INTEGRATION & CURL ================= */}
        {activeTab === 'integration' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                <span>Kako spojiti MT5 EA i testirati cURL naredbama</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Vaš poslužitelj na Oracle VPS-u (<code className="text-emerald-300 font-mono">http://{SERVER_IP}</code>) prihvaća 3 zaštićena endpointa.
                Zaglavlje: <code className="text-amber-300 font-mono">X-API-Key: {API_KEY}</code>.
              </p>

              {/* cURL Example 1 */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 font-mono">1. POST /api/heartbeat</span>
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
                    <span>{copiedKey === 'curl-hb' ? 'Kopirano!' : 'Kopiraj'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90 overflow-x-auto">
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

              {/* cURL Example 2 */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 font-mono">2. POST /api/positions</span>
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
                    <span>{copiedKey === 'curl-pos' ? 'Kopirano!' : 'Kopiraj'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90 overflow-x-auto">
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

              {/* cURL Example 3 */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 font-mono">3. POST /api/trade/close</span>
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
                    <span>{copiedKey === 'curl-close' ? 'Kopirano!' : 'Kopiraj'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90 overflow-x-auto">
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-white text-sm sm:text-base">Stvarni HTTP Pristupni Logovi</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">{logs.length} zapisa</span>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800">
                  <tr className="text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-wider font-mono">
                    <th className="py-2 px-2.5">Vrijeme</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5">Endpoint</th>
                    <th className="py-2 px-2.5">Poruka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                        Nema zabilježenih HTTP poziva. Čeka se prvi zahtjev s MT5 EA bota.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2 px-2.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 200 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-200 font-semibold">{log.endpoint}</td>
                        <td className="py-2 px-2.5 text-slate-300 max-w-[200px] sm:max-w-md truncate" title={log.payload}>
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

      {/* Mobile Bottom Quick Bar for instant overview on phone */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2 sm:hidden z-40 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-400 text-[10px] block uppercase">Equity</span>
          <span className="font-mono font-bold text-white">${Number(account?.equity || 0).toFixed(2)}</span>
        </div>
        <div className="text-center">
          <span className="text-slate-400 text-[10px] block uppercase">Dnevni P/L</span>
          <span className={`font-mono font-bold ${
            (account?.daily_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(account?.daily_pnl || 0) >= 0 ? '+' : ''}${Number(account?.daily_pnl || 0).toFixed(2)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 text-[10px] block uppercase">Pozicije</span>
          <span className="font-mono font-bold text-emerald-400">{positions.length}</span>
        </div>
      </div>
    </div>
  );
}
