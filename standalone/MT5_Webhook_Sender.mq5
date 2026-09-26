//+------------------------------------------------------------------+
//|                                        MT5_Webhook_Sender.mq5    |
//|                        Skripta / Modul za slanje na Dashboard    |
//+------------------------------------------------------------------+
#property copyright "MT5 Dashboard"
#property link      "http://92.5.176.43"
#property version   "1.00"

input string   InpServerUrl = "http://92.5.176.43"; // URL Oracle VPS-a
input string   InpApiKey    = "promijeni-ovo-u-tajni-kljuc"; // X-API-Key
input int      InpHeartbeatSeconds = 15; // Interval heartbeata u sekundama

datetime g_last_heartbeat = 0;

//+------------------------------------------------------------------+
//| Pomoćna funkcija za HTTP POST zahtjev (WebRequest)              |
//+------------------------------------------------------------------+
bool SendJsonPost(string endpoint, string json_body)
{
   string url = InpServerUrl + endpoint;
   string headers = "Content-Type: application/json\r\n" +
                    "X-API-Key: " + InpApiKey + "\r\n";
   
   char post_data[];
   char result_data[];
   string result_headers;
   
   StringToCharArray(json_body, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post_data, ArraySize(post_data)-1); // Ukloni null terminator
   
   int res = WebRequest("POST", url, headers, 3000, post_data, result_data, result_headers);
   
   if(res == 200 || res == 201)
   {
      // Uspješno poslano
      return true;
   }
   else
   {
      int err = GetLastError();
      PrintFormat("⚠️ Greška pri slanju na %s | Status: %d | MT5 Err: %d", endpoint, res, err);
      if(err == 4014)
      {
         Print("❌ VAŽNO: Dodaj URL '" + InpServerUrl + "' u MT5 -> Tools -> Options -> Expert Advisors -> Allow WebRequest!");
      }
      return false;
   }
}

//+------------------------------------------------------------------+
//| 1. Šalji Heartbeat                                              |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   long account_num = AccountInfoInteger(ACCOUNT_LOGIN);
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   string server = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double free_margin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   
   // Izračunaj današnji P/L iz povijesti računa od 00:00
   datetime today_midnight = (datetime)(TimeCurrent() - (TimeCurrent() % 86400));
   HistorySelect(today_midnight, TimeCurrent());
   double daily_pnl = 0;
   int total_deals = HistoryDealsTotal();
   for(int i = 0; i < total_deals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      daily_pnl += HistoryDealGetDouble(ticket, DEAL_PROFIT);
      daily_pnl += HistoryDealGetDouble(ticket, DEAL_SWAP);
      daily_pnl += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
   }

   int open_pos = PositionsTotal();
   int day_limit_hit = 0; // Postavi na 1 ako je tvoj bot dosegao dnevni limit

   string json = StringFormat(
      "{\"account\":\"%I64d\",\"broker\":\"%s\",\"server\":\"%s\",\"currency\":\"%s\","
      "\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"daily_pnl\":%.2f,"
      "\"open_positions\":%d,\"day_limit_hit\":%d,\"server_time\":\"%s\"}",
      account_num, broker, server, currency,
      balance, equity, margin, free_margin, daily_pnl,
      open_pos, day_limit_hit, TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
   );

   SendJsonPost("/api/heartbeat", json);
}

//+------------------------------------------------------------------+
//| 2. Šalji listu otvorenih pozicija                               |
//+------------------------------------------------------------------+
void SendOpenPositions()
{
   long account_num = AccountInfoInteger(ACCOUNT_LOGIN);
   int total = PositionsTotal();
   
   string positions_json = "[";
   
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      
      string symbol = PositionGetString(POSITION_SYMBOL);
      long type_enum = PositionGetInteger(POSITION_TYPE);
      string type_str = (type_enum == POSITION_TYPE_BUY) ? "BUY" : "SELL";
      double volume = PositionGetDouble(POSITION_VOLUME);
      double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
      double current_price = PositionGetDouble(POSITION_PRICE_CURRENT);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      datetime open_time = (datetime)PositionGetInteger(POSITION_TIME);
      
      string pos_item = StringFormat(
         "{\"ticket\":%I64u,\"symbol\":\"%s\",\"type\":\"%s\",\"volume\":%.2f,"
         "\"open\":%.5f,\"current\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f,\"open_time\":\"%s\"}",
         ticket, symbol, type_str, volume, open_price, current_price, sl, tp, profit,
         TimeToString(open_time, TIME_DATE|TIME_SECONDS)
      );
      
      if(i > 0) positions_json += ",";
      positions_json += pos_item;
   }
   positions_json += "]";
   
   string payload = StringFormat("{\"account\":\"%I64d\",\"positions\":%s}", account_num, positions_json);
   SendJsonPost("/api/positions", payload);
}

//+------------------------------------------------------------------+
//| 3. Šalji zatvoreni trade (Pozovi unutar OnTradeTransaction)      |
//+------------------------------------------------------------------+
void SendTradeClose(ulong deal_ticket, string symbol, long magic, double profit_usd, double profit_pips)
{
   long account_num = AccountInfoInteger(ACCOUNT_LOGIN);
   string json = StringFormat(
      "{\"account\":\"%I64d\",\"deal_ticket\":%I64u,\"symbol\":\"%s\",\"magic\":%I64d,"
      "\"profit_usd\":%.2f,\"profit_pips\":%.1f,\"close_time\":\"%s\"}",
      account_num, deal_ticket, symbol, magic, profit_usd, profit_pips,
      TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
   );

   SendJsonPost("/api/trade/close", json);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();
   if(now - g_last_heartbeat >= InpHeartbeatSeconds)
   {
      g_last_heartbeat = now;
      SendHeartbeat();
      SendOpenPositions();
   }
}
