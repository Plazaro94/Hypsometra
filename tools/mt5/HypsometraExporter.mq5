//+------------------------------------------------------------------+
//| HypsometraExporter.mq5                                           |
//| Exports everything Hypsometra needs for one symbol, in one run:  |
//|   <SYMBOL>_M1.csv    M1 bars with tick volume and spread         |
//|   <SYMBOL>_spec.json symbol specification (MT5 export format)    |
//|   account.json       deposit currency, leverage, broker          |
//| Output: MQL5\Files\Hypsometra\  (File → Open Data Folder)        |
//+------------------------------------------------------------------+
#property copyright "Hypsometra"
#property version   "1.00"
#property script_show_inputs
#property strict

input datetime InpFrom        = D'2010.01.01 00:00'; // Desde (se ajusta al primer dato disponible)
input datetime InpTo          = 0;                   // Hasta (0 = ahora)
input bool     InpExportBars  = true;                // Exportar velas M1
input bool     InpExportSpec  = true;                // Exportar especificación del símbolo
input bool     InpExportAcct  = true;                // Exportar datos de la cuenta
input string   InpFolder      = "Hypsometra";        // Carpeta dentro de MQL5\Files

//+------------------------------------------------------------------+
string JsonEscape(const string s)
  {
   string r = s;
   StringReplace(r, "\\", "\\\\");
   StringReplace(r, "\"", "\\\"");
   return r;
  }

string Kv(const string key, const string value, const bool last = false)
  {
   return "\"" + key + "\" : \"" + JsonEscape(value) + "\"" + (last ? "\r\n" : ",\r\n");
  }

string D(const double v, const int digits = 8) { return DoubleToString(v, digits); }
string I(const long v) { return IntegerToString(v); }

//+------------------------------------------------------------------+
//| Wait until the terminal has the M1 history for the range.        |
//+------------------------------------------------------------------+
bool EnsureHistory(const string symbol, const datetime from)
  {
   for(int attempt = 0; attempt < 60 && !IsStopped(); attempt++)
     {
      datetime first = 0;
      if(SeriesInfoInteger(symbol, PERIOD_M1, SERIES_FIRSTDATE, first) && first > 0 && first <= from + 86400)
         return true;
      MqlRates probe[];
      CopyRates(symbol, PERIOD_M1, from, from + 86400 * 7, probe); // triggers download
      Sleep(500);
     }
   return false;
  }

//+------------------------------------------------------------------+
bool ExportBars(const string symbol, datetime from, datetime to, long &written)
  {
   written = 0;
   datetime serverFirst = 0;
   if(SeriesInfoInteger(symbol, PERIOD_M1, SERIES_SERVER_FIRSTDATE, serverFirst) && serverFirst > from)
      from = serverFirst;
   EnsureHistory(symbol, from);

   const string path = InpFolder + "\\" + symbol + "_M1.csv";
   const int h = FileOpen(path, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE)
     {
      PrintFormat("No se pudo crear %s (error %d)", path, GetLastError());
      return false;
     }
   FileWriteString(h, "<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>\r\n");

   const int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   const int chunkDays = 31;
   datetime last = 0;
   for(datetime start = from; start < to && !IsStopped(); start += chunkDays * 86400)
     {
      datetime stop = MathMin(start + chunkDays * 86400 - 1, to);
      MqlRates rates[];
      int n = -1;
      for(int retry = 0; retry < 10 && n < 0; retry++)
        {
         n = CopyRates(symbol, PERIOD_M1, start, stop, rates);
         if(n < 0) Sleep(300);
        }
      if(n <= 0) continue;

      string block = "";
      for(int i = 0; i < n; i++)
        {
         if(rates[i].time <= last) continue; // chunk edges can overlap
         last = rates[i].time;
         block += TimeToString(rates[i].time, TIME_DATE) + "\t" +
                  TimeToString(rates[i].time, TIME_SECONDS) + "\t" +
                  DoubleToString(rates[i].open, digits) + "\t" +
                  DoubleToString(rates[i].high, digits) + "\t" +
                  DoubleToString(rates[i].low, digits) + "\t" +
                  DoubleToString(rates[i].close, digits) + "\t" +
                  I(rates[i].tick_volume) + "\t" +
                  I(rates[i].real_volume) + "\t" +
                  I(rates[i].spread) + "\r\n";
         written++;
        }
      FileWriteString(h, block);
      Comment(StringFormat("Hypsometra: exportando %s M1… %s (%I64d velas)", symbol, TimeToString(stop, TIME_DATE), written));
     }
   FileClose(h);
   Comment("");
   PrintFormat("Velas M1 exportadas: %I64d → MQL5\\Files\\%s", written, path);
   return written > 0;
  }

//+------------------------------------------------------------------+
string SessionsJson(const string symbol)
  {
   string out = "[\r\n";
   for(int day = 0; day < 7; day++)
     {
      out += "[";
      datetime f, t;
      for(uint k = 0; SymbolInfoSessionTrade(symbol, (ENUM_DAY_OF_WEEK)day, k, f, t); k++)
        {
         if(k > 0) out += ",";
         out += "{\r\n\"Open\" : \"" + I(((long)f % 86400) / 60) + "\",\r\n\"Close\" : \"" + I(((long)t % 86400 == 0 && t > 0 ? 86400 : (long)t % 86400) / 60) + "\"\r\n}\r\n";
        }
      out += (day < 6) ? "],\r\n" : "]\r\n";
     }
   return out + "]";
  }

bool ExportSpec(const string symbol)
  {
   const bool floating = (bool)SymbolInfoInteger(symbol, SYMBOL_SPREAD_FLOAT);
   double initBuy = 0, maintBuy = 0, initSell = 0, maintSell = 0;
   SymbolInfoMarginRate(symbol, ORDER_TYPE_BUY, initBuy, maintBuy);
   SymbolInfoMarginRate(symbol, ORDER_TYPE_SELL, initSell, maintSell);
   const int triple = (int)SymbolInfoInteger(symbol, SYMBOL_SWAP_ROLLOVER3DAYS);
   const string days[7] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};

   string j = "{\r\n\"ConfigSymbols\" : [\r\n{\r\n";
   j += Kv("Symbol", symbol);
   j += Kv("Path", SymbolInfoString(symbol, SYMBOL_PATH));
   j += Kv("Description", SymbolInfoString(symbol, SYMBOL_DESCRIPTION));
   j += Kv("CurrencyBase", SymbolInfoString(symbol, SYMBOL_CURRENCY_BASE));
   j += Kv("CurrencyProfit", SymbolInfoString(symbol, SYMBOL_CURRENCY_PROFIT));
   j += Kv("CurrencyMargin", SymbolInfoString(symbol, SYMBOL_CURRENCY_MARGIN));
   j += Kv("Digits", I(SymbolInfoInteger(symbol, SYMBOL_DIGITS)));
   j += Kv("Point", D(SymbolInfoDouble(symbol, SYMBOL_POINT)));
   j += Kv("Spread", floating ? "0" : I(SymbolInfoInteger(symbol, SYMBOL_SPREAD)));
   j += Kv("TickValue", D(SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE)));
   j += Kv("TickSize", D(SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE)));
   j += Kv("ContractSize", D(SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE)));
   j += Kv("StopsLevel", I(SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL)));
   j += Kv("FreezeLevel", I(SymbolInfoInteger(symbol, SYMBOL_TRADE_FREEZE_LEVEL)));
   j += Kv("VolumeMinExt", I((long)MathRound(SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN) * 1e8)));
   j += Kv("VolumeMaxExt", I((long)MathRound(SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX) * 1e8)));
   j += Kv("VolumeStepExt", I((long)MathRound(SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP) * 1e8)));
   j += Kv("CalcMode", I(SymbolInfoInteger(symbol, SYMBOL_TRADE_CALC_MODE)));
   j += Kv("MarginInitial", D(SymbolInfoDouble(symbol, SYMBOL_MARGIN_INITIAL)));
   j += Kv("MarginMaintenance", D(SymbolInfoDouble(symbol, SYMBOL_MARGIN_MAINTENANCE)));
   j += Kv("MarginInitialBuy", D(initBuy));
   j += Kv("MarginInitialSell", D(initSell));
   j += Kv("MarginMaintenanceBuy", D(maintBuy));
   j += Kv("MarginMaintenanceSell", D(maintSell));
   j += Kv("MarginHedged", D(SymbolInfoDouble(symbol, SYMBOL_MARGIN_HEDGED)));
   j += Kv("SwapMode", I(SymbolInfoInteger(symbol, SYMBOL_SWAP_MODE)));
   j += Kv("SwapLong", D(SymbolInfoDouble(symbol, SYMBOL_SWAP_LONG)));
   j += Kv("SwapShort", D(SymbolInfoDouble(symbol, SYMBOL_SWAP_SHORT)));
   j += Kv("Swap3Day", I(triple));
   for(int d = 0; d < 7; d++)
     {
      const double rate = (d == 0 || d == 6) ? 0.0 : (d == triple ? 3.0 : 1.0);
      j += Kv("SwapRate" + days[d], D(rate));
     }
   j += "\"SessionsTrades\" : " + SessionsJson(symbol) + "\r\n";
   j += "}\r\n]\r\n}\r\n";

   const string path = InpFolder + "\\" + symbol + "_spec.json";
   const int h = FileOpen(path, FILE_WRITE | FILE_TXT | FILE_UNICODE);
   if(h == INVALID_HANDLE)
     {
      PrintFormat("No se pudo crear %s (error %d)", path, GetLastError());
      return false;
     }
   FileWriteString(h, j);
   FileClose(h);
   PrintFormat("Especificación exportada → MQL5\\Files\\%s", path);
   return true;
  }

//+------------------------------------------------------------------+
bool ExportAccount()
  {
   string j = "{\r\n";
   j += Kv("Currency", AccountInfoString(ACCOUNT_CURRENCY));
   j += Kv("Leverage", I(AccountInfoInteger(ACCOUNT_LEVERAGE)));
   j += Kv("Balance", D(AccountInfoDouble(ACCOUNT_BALANCE), 2));
   j += Kv("MarginMode", I(AccountInfoInteger(ACCOUNT_MARGIN_MODE)));
   j += Kv("StopOutLevel", D(AccountInfoDouble(ACCOUNT_MARGIN_SO_SO), 2));
   j += Kv("StopOutMode", I(AccountInfoInteger(ACCOUNT_MARGIN_SO_MODE)));
   j += Kv("Company", AccountInfoString(ACCOUNT_COMPANY));
   j += Kv("Server", AccountInfoString(ACCOUNT_SERVER), true);
   j += "}\r\n";
   const string path = InpFolder + "\\account.json";
   const int h = FileOpen(path, FILE_WRITE | FILE_TXT | FILE_UNICODE);
   if(h == INVALID_HANDLE) return false;
   FileWriteString(h, j);
   FileClose(h);
   PrintFormat("Cuenta exportada → MQL5\\Files\\%s", path);
   return true;
  }

//+------------------------------------------------------------------+
void OnStart()
  {
   const string symbol = _Symbol;
   const datetime to = (InpTo == 0) ? TimeCurrent() : InpTo;
   if(InpFrom >= to)
     {
      Alert("Hypsometra: la fecha inicial debe ser anterior a la final.");
      return;
     }
   PrintFormat("Hypsometra: exportando %s desde %s hasta %s", symbol, TimeToString(InpFrom), TimeToString(to));

   long bars = 0;
   bool ok = true;
   if(InpExportSpec) ok &= ExportSpec(symbol);
   if(InpExportAcct) ok &= ExportAccount();
   if(InpExportBars) ok &= ExportBars(symbol, InpFrom, to, bars);

   const string where = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + InpFolder;
   if(ok)
      Alert(StringFormat("Hypsometra: exportación completada (%I64d velas M1).\nArchivos en: %s", bars, where));
   else
      Alert("Hypsometra: la exportación terminó con errores. Revisa la pestaña Expertos.");
  }
//+------------------------------------------------------------------+
