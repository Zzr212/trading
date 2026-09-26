# 📊 MT5 Trading Bot Live Monitoring Dashboard

Kompletna platforma za praćenje MetaTrader 5 (MT5) Expert Advisora (EA) u realnom vremenu na vašem **Oracle VPS (Ubuntu 22.04)** poslužitelju (`92.5.176.43`).

---

## 📁 Struktura Projekta

```text
mt5-dashboard/
├── server.js               # Express backend s SQLite bazom i API autentifikacijom
├── package.json            # Node.js konfiguracija i ovisnosti
├── database.db             # Automatski kreirana SQLite baza (account_state, open_positions, closed_trades)
├── .env.example            # Primjer varijabli okruženja
├── .env                    # Tvoja stvarna konfiguracija (PORT, API_KEY, DB_PATH)
├── mt5-dashboard.service   # Systemd servisna datoteka za auto-start pri bootu
├── nginx.conf              # Nginx obrnuti proxy konfiguracija
├── MT5_Webhook_Sender.mq5  # MQL5 skripta za slanje podataka iz MT5
├── public/
│   ├── index.html          # Responzivna kontrolna ploča (Dark Theme)
│   ├── style.css           # Moderni stilovi, statusne animacije i tablice
│   └── app.js              # Real-time polling (svakih 5 sekundi) i Chart.js graf
└── README.md               # Upute za instalaciju i testiranje
```

---

## 🚀 1. Upute za Instalaciju na Ubuntu 22.04 (Oracle VPS)

Povežite se na svoj Oracle VPS putem SSH-a:
```bash
ssh ubuntu@92.5.176.43
```

### Korak 1.1: Ažuriranje sustava i instalacija Node.js 20 LTS & SQLite
```bash
# Ažuriraj pakete
sudo apt update && sudo apt upgrade -y

# Instaliraj osnovne alate
sudo apt install -y curl git build-essential sqlite3

# Instaliraj Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Provjeri verzije
node -v   # Treba ispisati v20.x.x
npm -v    # Treba ispisati 10.x.x
```

### Korak 1.2: Postavljanje projekta
```bash
# Kreiraj direktorij aplikacije
sudo mkdir -p /var/www/mt5-dashboard
sudo chown -R $USER:$USER /var/www/mt5-dashboard
cd /var/www/mt5-dashboard

# Kopiraj datoteke projekta u ovaj direktorij, ili ih kreiraj
# Instaliraj npm pakete:
npm install

# Kreiraj .env datoteku:
cp .env.example .env
nano .env
```

Postavi u `.env`:
```env
PORT=80
API_KEY=promijeni-ovo-u-tajni-kljuc
DB_PATH=./database.db
```

---

## 🛡️ 2. Konfiguracija Vatrozida (Firewall & Oracle Security List)

Na Oracle Cloud VPS-u morate otvoriti port 80 i 443 u IPTables i na Oracle Web Console:

```bash
# Dozvoli port 80 i 443 u Ubuntu UFW / iptables
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Ili ako koristiš UFW:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw reload
```
*(Također provjerite u Oracle Cloud Console -> Virtual Cloud Networks -> Ingress Rules da je dodano pravilo za TCP port 80 / 443).*

---

## ⚙️ 3. Pokretanje Aplikacije

Možete birati između **PM2** upravitelja procesa ili **Systemd** servisa:

### Opcija A: Pokretanje putem PM2 (Preporučeno za brzinu i jednostavnost)
```bash
# Instaliraj PM2 globalno
sudo npm install -g pm2

# Pokreni server
pm2 start server.js --name "mt5-dashboard"

# Postavi PM2 da se automatski pali nakon restarta servera
pm2 startup
# (Kopiraj i zalijepi naredbu koju ti PM2 ispiše)
pm2 save

# Provjeri status i logove
pm2 status
pm2 logs mt5-dashboard
```

### Opcija B: Pokretanje putem Systemd servisa
```bash
# Kopiraj service datoteku
sudo cp mt5-dashboard.service /etc/systemd/system/

# Učitaj konfiguraciju servisa
sudo systemctl daemon-reload

# Pokreni servis i omogući auto-start pri bootu
sudo systemctl start mt5-dashboard
sudo systemctl enable mt5-dashboard

# Provjera statusa i logova
sudo systemctl status mt5-dashboard
sudo journalctl -u mt5-dashboard -f
```

---

## 🌐 4. Nginx Obrnuti Proxy (Opcionalno - za vlastitu domenu i besplatan SSL)

Ako želiš dodati domenu (npr. `trading.tvojadomena.com`) i HTTPS:

1. Promijeni u `.env` port na `PORT=3000` i restartaj PM2 (`pm2 restart mt5-dashboard`).
2. Instaliraj i konfiguriraj Nginx:
```bash
sudo apt install -y nginx
sudo cp nginx.conf /etc/nginx/sites-available/mt5-dashboard
sudo ln -s /etc/nginx/sites-available/mt5-dashboard /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null
sudo nginx -t
sudo systemctl restart nginx
```

3. Dodaj besplatan Let's Encrypt SSL certifikat:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d trading.tvojadomena.com
```

---

## 🧪 5. Testiranje API-ja (cURL Primjeri)

Testirajte endpoints direktno iz terminala kako biste potvrdili ispravnost:

### Test 1: Slanje Heartbeata (POST /api/heartbeat)
```bash
curl -X POST http://92.5.176.43/api/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: promijeni-ovo-u-tajni-kljuc" \
  -d '{
    "account": "10948201",
    "broker": "IC Markets Global",
    "server": "ICMarketsSC-Live02",
    "currency": "USD",
    "balance": 25480.50,
    "equity": 25895.20,
    "margin": 420.00,
    "free_margin": 25475.20,
    "daily_pnl": 414.70,
    "open_positions": 2,
    "day_limit_hit": 0,
    "server_time": "2026-09-26 14:30:00"
  }'
```
*Očekivani odgovor:*
`{"success":true,"message":"Heartbeat uspjesno primljen","timestamp":"..."}`

---

### Test 2: Slanje Otvorenih Pozicija (POST /api/positions)
```bash
curl -X POST http://92.5.176.43/api/positions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: promijeni-ovo-u-tajni-kljuc" \
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
        "open_time": "2026-09-26 06:12:44"
      },
      {
        "ticket": 78491045,
        "symbol": "XAUUSD",
        "type": "BUY",
        "volume": 0.20,
        "open": 2635.40,
        "current": 2647.80,
        "sl": 2622.00,
        "tp": 2660.00,
        "profit": 248.00,
        "open_time": "2026-09-26 06:45:10"
      }
    ]
  }'
```

---

### Test 3: Slanje Zatvorenog Trejda (POST /api/trade/close)
```bash
curl -X POST http://92.5.176.43/api/trade/close \
  -H "Content-Type: application/json" \
  -H "X-API-Key: promijeni-ovo-u-tajni-kljuc" \
  -d '{
    "account": "10948201",
    "deal_ticket": 78491999,
    "symbol": "GBPUSD",
    "magic": 101,
    "profit_usd": 185.50,
    "profit_pips": 18.5,
    "close_time": "2026-09-26 14:35:10"
  }'
```

---

### Test 4: Provjera Zaštite (Odbijanje bez ključa)
```bash
curl -X POST http://92.5.176.43/api/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"account": "123"}'
```
*Očekivani odgovor: HTTP 401 Unauthorized*
`{"success":false,"error":"Unauthorized: Neispravan ili nedostajući X-API-Key header."}`

---

## 📈 6. Konfiguracija MetaTrader 5 Terminala

Kako bi MT5 EA mogao slati HTTP POST zahtjeve, **obavezno** morate dodati URL u dopuštenu listu:

1. U MT5 terminalu otvorite: **Tools -> Options** (ili pritisnite `Ctrl + O`).
2. Kliknite na karticu **Expert Advisors**.
3. Označite kvačicu: **"Allow WebRequest for listed URL"**.
4. Kliknite na **"Add new URL"** i unesite:
   - `http://92.5.176.43`
   - (ili svoju domenu `https://tvoja-domena.com`)
5. Kliknite **OK**.

---

## 🔍 7. Kako Provjeriti da MT5 Šalje Podatke (Log Lokacije)

### 1. U samom MT5 terminalu:
- Otvorite prozor **Toolbox** (`Ctrl + T`) na dnu MT5 terminala.
- Kliknite na karticu **"Experts"** ili **"Journal"**.
- Tamo ćete vidjeti ispise vašeg bota. Ako vidite grešku `WebRequest error 4014`, niste dodali URL u *Allow WebRequest*.

### 2. Na Ubuntu serveru (Live stream logova):
- **Ako koristiš PM2:**
  ```bash
  pm2 logs mt5-dashboard --lines 50
  ```
- **Ako koristiš Systemd:**
  ```bash
  sudo journalctl -u mt5-dashboard -f
  ```

### 3. Pregled SQLite baze podataka na serveru:
```bash
# Pokreni sqlite3 CLI
sqlite3 /var/www/mt5-dashboard/database.db

# Provjeri zadnji heartbeat
SELECT * FROM account_state;

# Provjeri otvorene pozicije
SELECT * FROM open_positions;

# Provjeri zadnje webhook logove
SELECT timestamp, endpoint, status, message FROM webhook_logs ORDER BY id DESC LIMIT 10;

# Izlaz iz sqlite3:
.quit
```
