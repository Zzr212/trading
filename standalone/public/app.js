/**
 * MT5 Trading Bot Live Monitor - Frontend Script
 * Polling u realnom vremenu svakih 5 sekundi (bez simulacija, samo pravi podaci s MT5)
 */

const API_POLL_INTERVAL = 5000; // 5 sekundi
let pnlChart = null;

// Elementi u DOM-u
const elBalance = document.getElementById('val-balance');
const elEquity = document.getElementById('val-equity');
const elDailyPnl = document.getElementById('val-daily-pnl');
const elFreeMargin = document.getElementById('val-free-margin');
const elMargin = document.getElementById('val-margin');
const elMarginLevel = document.getElementById('val-margin-level');
const elFloatingPnl = document.getElementById('val-floating-pnl');
const elAccount = document.getElementById('val-account');
const elBroker = document.getElementById('val-broker');
const elServer = document.getElementById('val-server');
const elServerTime = document.getElementById('val-server-time');
const elPositionsCount = document.getElementById('val-positions-count');
const elTotalTrades = document.getElementById('val-total-trades');
const elWinRate = document.getElementById('val-win-rate');
const elTotalProfit = document.getElementById('val-total-profit');
const elPositionsBadge = document.getElementById('badge-positions-count');

const elEaStatusPill = document.getElementById('ea-status-pill');
const elOfflineBanner = document.getElementById('offline-banner');
const elSyncTime = document.getElementById('sync-time');
const positionsTbody = document.getElementById('positions-tbody');
const tradesTbody = document.getElementById('trades-tbody');
const logsTbody = document.getElementById('logs-tbody');

// Formatiranje valute
function formatMoney(amount, currency = 'USD') {
  const num = Number(amount) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Osvježavanje Dashboarda putem Pollinga
async function updateDashboard() {
  try {
    const [summaryRes, positionsRes, tradesRes, pnlRes, logsRes] = await Promise.all([
      fetch('/api/dashboard/summary').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/dashboard/positions').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/dashboard/trades').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/dashboard/daily-pnl').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/dashboard/logs').then((r) => (r.ok ? r.json() : null))
    ]);

    // 1. Account Summary
    if (summaryRes && summaryRes.success && summaryRes.data) {
      const d = summaryRes.data;
      const isConnected = d.last_updated && d.ea_status !== 'disconnected';

      elBalance.textContent = formatMoney(d.balance, d.currency);
      elEquity.textContent = formatMoney(d.equity, d.currency);
      
      const pnlVal = Number(d.daily_pnl || 0);
      elDailyPnl.textContent = (pnlVal >= 0 ? '+' : '') + formatMoney(pnlVal, d.currency);
      elDailyPnl.className = `metric-value ${pnlVal >= 0 ? 'text-profit' : 'text-loss'}`;

      elFreeMargin.textContent = formatMoney(d.free_margin, d.currency);
      elMargin.textContent = '$' + Number(d.margin || 0).toFixed(2);
      elMarginLevel.textContent = (d.margin_level_percent || '0.00') + '%';

      const floating = (Number(d.equity) || 0) - (Number(d.balance) || 0);
      elFloatingPnl.textContent = (floating >= 0 ? '+' : '') + '$' + floating.toFixed(2);
      elFloatingPnl.className = floating >= 0 ? 'text-profit font-mono font-bold' : 'text-loss font-mono font-bold';

      elAccount.textContent = d.account || '-';
      elBroker.textContent = d.broker || '-';
      elServer.textContent = d.server || '-';
      elServerTime.textContent = d.server_time || '-';
      elPositionsCount.textContent = d.open_positions_count || 0;

      // Status EA (Zeleno / Žuto / Crveno)
      if (!isConnected) {
        elEaStatusPill.className = 'status-badge status-offline';
        elEaStatusPill.innerHTML = `<span class="dot"></span> ČEKA SPOJ S MT5`;
        if (elOfflineBanner) elOfflineBanner.classList.add('hidden');
      } else if (d.ea_status === 'offline') {
        elEaStatusPill.className = 'status-badge status-offline';
        elEaStatusPill.innerHTML = `<span class="dot"></span> EA OFFLINE (${Math.floor(d.age_seconds / 60)}m)`;
        if (elOfflineBanner) elOfflineBanner.classList.remove('hidden');
      } else if (d.ea_status === 'warning') {
        elEaStatusPill.className = 'status-badge status-warning';
        elEaStatusPill.innerHTML = `<span class="dot"></span> EA SPOREN (${d.age_seconds}s)`;
        if (elOfflineBanner) elOfflineBanner.classList.add('hidden');
      } else {
        elEaStatusPill.className = 'status-badge status-online';
        elEaStatusPill.innerHTML = `<span class="dot pulse"></span> EA ONLINE (${d.age_seconds}s)`;
        if (elOfflineBanner) elOfflineBanner.classList.add('hidden');
      }
    }

    // 2. Open Positions
    if (positionsRes && positionsRes.success) {
      const positions = positionsRes.data || [];
      if (elPositionsBadge) elPositionsBadge.textContent = `${positions.length} aktivnih`;

      if (positions.length === 0) {
        positionsTbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-muted">Nema otvorenih pozicija (čeka se podatak s MT5)</td></tr>`;
      } else {
        positionsTbody.innerHTML = positions
          .map((p) => {
            const isProfit = Number(p.profit) >= 0;
            return `
            <tr>
              <td class="font-mono text-muted">#${p.ticket}</td>
              <td><strong>${p.symbol}</strong></td>
              <td><span class="badge ${p.type === 'BUY' ? 'badge-buy' : 'badge-sell'}">${p.type}</span></td>
              <td class="font-mono">${Number(p.volume).toFixed(2)}</td>
              <td class="font-mono">${p.open_price}</td>
              <td class="font-mono text-white font-semibold">${p.current_price}</td>
              <td class="font-mono text-muted text-xs">${p.sl || '-'} / ${p.tp || '-'}</td>
              <td class="font-mono text-right font-bold ${isProfit ? 'text-profit' : 'text-loss'}">
                ${isProfit ? '+' : ''}$${Number(p.profit).toFixed(2)}
              </td>
            </tr>
          `;
          })
          .join('');
      }
    }

    // 3. Closed Trades (Zadnjih 20)
    if (tradesRes && tradesRes.success) {
      const trades = tradesRes.data || [];
      const stats = tradesRes.stats || {};

      if (elTotalTrades) elTotalTrades.textContent = stats.total_trades || 0;
      if (elWinRate) elWinRate.textContent = (stats.win_rate || '0') + '%';
      if (elTotalProfit) {
        const p = Number(stats.total_profit_usd || 0);
        elTotalProfit.textContent = (p >= 0 ? '+' : '') + '$' + p.toFixed(2);
        elTotalProfit.className = p >= 0 ? 'text-profit font-mono font-bold' : 'text-loss font-mono font-bold';
      }

      if (trades.length === 0) {
        tradesTbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-muted">Nema zatvorenih trejdova u bazi</td></tr>`;
      } else {
        tradesTbody.innerHTML = trades
          .map((t) => {
            const isProfit = Number(t.profit_usd) >= 0;
            return `
            <tr>
              <td class="font-mono text-muted">#${t.deal_ticket}</td>
              <td><strong>${t.symbol}</strong></td>
              <td class="font-mono text-right font-bold ${isProfit ? 'text-profit' : 'text-loss'}">
                ${isProfit ? '+' : ''}$${Number(t.profit_usd).toFixed(2)}
              </td>
              <td class="font-mono text-right ${isProfit ? 'text-profit' : 'text-loss'}">
                ${Number(t.profit_pips) >= 0 ? '+' : ''}${t.profit_pips} p
              </td>
              <td class="font-mono text-right text-muted text-xs">${t.close_time}</td>
            </tr>
          `;
          })
          .join('');
      }
    }

    // 4. Daily PnL Chart
    if (pnlRes && pnlRes.success && pnlRes.data) {
      renderDailyPnlChart(pnlRes.data);
    }

    // 5. Server Webhook Logs
    if (logsRes && logsRes.success && logsTbody) {
      const logs = logsRes.data || [];
      if (logs.length === 0) {
        logsTbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Nema dolaznih zahtjeva</td></tr>`;
      } else {
        logsTbody.innerHTML = logs
          .slice(0, 10)
          .map(
            (l) => `
            <tr>
              <td class="font-mono text-xs text-muted">${new Date(l.timestamp).toLocaleTimeString()}</td>
              <td><span class="badge ${l.status === 200 ? 'badge-buy' : 'badge-sell'}">${l.status}</span></td>
              <td class="font-mono text-xs">${l.endpoint}</td>
              <td class="text-xs text-muted truncate max-w-[200px]">${l.message}</td>
            </tr>
          `
          )
          .join('');
      }
    }

    if (elSyncTime) {
      elSyncTime.textContent = new Date().toLocaleTimeString();
    }
  } catch (err) {
    console.error('Greška pri dohvaćanju podataka:', err);
  }
}

// Crtanje grafa dnevnog P/L-a pomoću Chart.js
function renderDailyPnlChart(data) {
  const canvas = document.getElementById('daily-pnl-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = data.map((d) => d.date);
  const values = data.map((d) => Number(d.profit_usd || 0));
  const colors = values.map((v) => (v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)'));

  if (pnlChart) {
    pnlChart.data.labels = labels;
    pnlChart.data.datasets[0].data = values;
    pnlChart.data.datasets[0].backgroundColor = colors;
    pnlChart.update();
  } else {
    const ctx = canvas.getContext('2d');
    pnlChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Dnevni P/L ($)',
            data: values,
            backgroundColor: colors,
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` P/L: $${Number(context.raw).toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'monospace', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { family: 'monospace', size: 10 },
              callback: (val) => '$' + val
            }
          }
        }
      }
    });
  }
}

// Inicijalizacija i pokretanje pollinga
window.addEventListener('DOMContentLoaded', () => {
  updateDashboard();
  setInterval(updateDashboard, API_POLL_INTERVAL); // Polling svakih 5s
});
