//+------------------------------------------------------------------+
//|                                                  VeeroxAgent.mq5 |
//|                                                   Veerox Systems |
//+------------------------------------------------------------------+
#property copyright "Veerox Systems"
#property link      "https://veerox.io"
#property version   "1.4.2"
#property strict

// Config
input string NodeAgentHost = "127.0.0.1";
input int    NodeAgentPort = 1337;
input int    TelemetryIntervalMs = 5000;

int socket_handle = INVALID_HANDLE;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   Print("[VeeroxAgent] Initializing MT5 Bridge Client...");
   
   if(!CheckSafetyConstraints()) {
      Print("[VeeroxAgent] CRITICAL SAFETY FAILURE. Initialization aborted.");
      return INIT_FAILED;
   }
   
   if(!ConnectToNodeAgent()) {
      return INIT_FAILED;
   }
   
   EventSetMillisecondTimer(TelemetryIntervalMs);
   
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Helper: Demo Safety Constraints                                  |
//+------------------------------------------------------------------+
bool CheckSafetyConstraints()
  {
   long trade_mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if (trade_mode != ACCOUNT_TRADE_MODE_DEMO) {
      Print("[VeeroxAgent] SECURITY HALT: Agent is only authorized for DEMO environments.");
      Print("[VeeroxAgent] Current Trade Mode: ", trade_mode);
      return false;
   }
   
   if (!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) {
      Print("[VeeroxAgent] SECURITY HALT: AutoTrading is disabled in Terminal.");
      return false;
   }
   
   Print("[VeeroxAgent] Safety Check Passed. Demo Environment Confirmed.");
   return true;
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   
   if(socket_handle != INVALID_HANDLE) {
      SocketClose(socket_handle);
      socket_handle = INVALID_HANDLE;
   }
   
   Print("[VeeroxAgent] Bridge shut down.");
  }

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
  {
   if(socket_handle == INVALID_HANDLE) {
      ConnectToNodeAgent();
      return;
   }
   
   // Read incoming ACKs (we only read, we don't execute yet)
   ReadIncomingMessages();
   
   FlushReports();

   
   // Scrape Telemetry
   string telemetry = BuildTelemetryPayload();
   
   // Send to Node Agent
   if(!SendToSocket(telemetry)) {
      Print("[VeeroxAgent] Failed to send telemetry. Socket drop assumed.");
      SocketClose(socket_handle);
      socket_handle = INVALID_HANDLE;
   }
  }

//+------------------------------------------------------------------+
//| Helper: Connect to Node Agent TCP Bridge                         |
//+------------------------------------------------------------------+
bool ConnectToNodeAgent()
  {
   socket_handle = SocketCreate();
   if(socket_handle == INVALID_HANDLE) {
      Print("[VeeroxAgent] Failed to create socket! Error: ", GetLastError());
      return false;
   }
   
   if(!SocketConnect(socket_handle, NodeAgentHost, NodeAgentPort, 5000)) {
      Print("[VeeroxAgent] Failed to connect to Node Agent at ", NodeAgentHost, ":", NodeAgentPort, " Error: ", GetLastError());
      SocketClose(socket_handle);
      socket_handle = INVALID_HANDLE;
      return false;
   }
   
   Print("[VeeroxAgent] Connected to Node Agent. Sending Telemetry...");
   return true;
  }

//+------------------------------------------------------------------+
//| Helper: Build Telemetry JSON                                     |
//+------------------------------------------------------------------+
string BuildTelemetryPayload()
  {
   // In MQL5, we build a basic JSON string.
   // Note: For production, we would use a robust JSON library.
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double free_margin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   long account_id = AccountInfoInteger(ACCOUNT_LOGIN);
   
   string json = "{\"type\":\"MT5_TELEMETRY\",";
   json += "\"account_id\":" + IntegerToString(account_id) + ",";
   json += "\"balance\":" + DoubleToString(balance, 2) + ",";
   json += "\"equity\":" + DoubleToString(equity, 2) + ",";
   json += "\"margin\":" + DoubleToString(margin, 2) + ",";
   json += "\"free_margin\":" + DoubleToString(free_margin, 2) + ",";
   
   // Build positions array
   json += "\"positions\":[";
   
   int total = PositionsTotal();
   for(int i=0; i<total; i++) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0) {
         double vol = PositionGetDouble(POSITION_VOLUME);
         string symbol = PositionGetString(POSITION_SYMBOL);
         long type = PositionGetInteger(POSITION_TYPE);
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         double price = PositionGetDouble(POSITION_PRICE_OPEN);
         double pnl = PositionGetDouble(POSITION_PROFIT);
         double swap = PositionGetDouble(POSITION_SWAP);
         long magic = PositionGetInteger(POSITION_MAGIC);
         string side = (type == POSITION_TYPE_BUY) ? "\"BUY\"" : "\"SELL\"";
         
         string origin = "\"EXTERNAL_EA\"";
         if (magic == 999111) origin = "\"VEEROX\"";
         else if (magic == 0) origin = "\"MANUAL\"";
         
         json += "{";
         json += "\"ticket\":" + IntegerToString(ticket) + ",";
         json += "\"symbol\":\"" + symbol + "\",";
         json += "\"side\":" + side + ",";
         json += "\"volume\":" + DoubleToString(vol, 2) + ",";
         json += "\"entry_price\":" + DoubleToString(price, 5) + ",";
         json += "\"sl\":" + DoubleToString(sl, 5) + ",";
         json += "\"tp\":" + DoubleToString(tp, 5) + ",";
         json += "\"pnl\":" + DoubleToString(pnl, 2) + ",";
         json += "\"swap\":" + DoubleToString(swap, 2) + ",";
         json += "\"origin\":" + origin;
         json += "}";
         
         if(i < total - 1) json += ",";
      }
   }
   
   json += "]}";
   return json;
  }

//+------------------------------------------------------------------+
//| Helper: Send string to socket                                    |
//+------------------------------------------------------------------+
bool SendToSocket(string payload)
  {
   if(socket_handle == INVALID_HANDLE) return false;
   
   uchar buf[];
   StringToCharArray(payload + "\n", buf); // Append newline for framing
   
   int sent = SocketSend(socket_handle, buf, ArraySize(buf)-1); // -1 to omit null terminator
   if(sent < 0) {
      return false;
   }
   
   return true;
  }

//+------------------------------------------------------------------+
//| Report Queueing                                                  |
//+------------------------------------------------------------------+
string PendingReports[];

void BufferReport(string report) {
   int size = ArraySize(PendingReports);
   ArrayResize(PendingReports, size + 1);
   PendingReports[size] = report;
}

void FlushReports() {
   if(ArraySize(PendingReports) == 0 || socket_handle == INVALID_HANDLE) return;
   
   string newQueue[];
   for(int i=0; i<ArraySize(PendingReports); i++) {
      if(!SendToSocket(PendingReports[i])) {
         int newSize = ArraySize(newQueue);
         ArrayResize(newQueue, newSize + 1);
         newQueue[newSize] = PendingReports[i];
      }
   }
   
   ArrayCopy(PendingReports, newQueue);
   ArrayResize(PendingReports, ArraySize(newQueue));
}

void SendOrBufferReport(string report) {
   if(!SendToSocket(report)) {
      BufferReport(report);
   }
}

//+------------------------------------------------------------------+
//| Broker-Authoritative Execution Identity                          |
//+------------------------------------------------------------------+
string MakeComment(string clientExecId) {
   string cleanId = clientExecId;
   StringReplace(cleanId, "-", "");
   return StringSubstr(cleanId, 0, 31);
}

string GetSavedReport(string clientExecId) {
   int handle = INVALID_HANDLE;
   int retries = 0;
   while(handle == INVALID_HANDLE && retries < 10) {
      handle = FileOpen("VeeroxAgent_State.csv", FILE_READ|FILE_CSV|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE, '|');
      if (handle == INVALID_HANDLE) { Sleep(10); retries++; }
   }
   
   if(handle != INVALID_HANDLE) {
      string lastMatch = "";
      while(!FileIsEnding(handle)) {
         string id = FileReadString(handle);
         string report = FileReadString(handle);
         if (id == clientExecId) lastMatch = report;
      }
      FileClose(handle);
      return lastMatch;
   }
   return "";
}

bool ExecutionExists(string clientExecId, ulong &outTicket, string &outOrderId, double &outVolume, double &outPrice, string &outSymbol, string &outSide, double &outCommission, double &outSwap, double &outPnl) {
   string commentMatch = MakeComment(clientExecId);
   
   ulong targetOrderTicket = 0;
   string savedReport = GetSavedReport(clientExecId);
   if (savedReport != "") {
      string savedOrderId = ExtractJsonString(savedReport, "brokerOrderId");
      if (savedOrderId != "" && savedOrderId != "0") {
         targetOrderTicket = (ulong)StringToInteger(savedOrderId);
      }
   }
   
   bool found = false;
   outVolume = 0; outCommission = 0; outSwap = 0; outPnl = 0;
   double totalValue = 0;
   
   // 1. Check open positions
   int totalPositions = PositionsTotal();
   for(int i=0; i<totalPositions; i++) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0) {
         string cmt = PositionGetString(POSITION_COMMENT);
         ulong posOrderId = PositionGetInteger(POSITION_IDENTIFIER);
         if ((targetOrderTicket > 0 && posOrderId == targetOrderTicket) || (targetOrderTicket == 0 && StringFind(cmt, commentMatch) >= 0)) {
            outTicket = ticket;
            outOrderId = IntegerToString(posOrderId);
            outVolume = PositionGetDouble(POSITION_VOLUME);
            outPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            outSymbol = PositionGetString(POSITION_SYMBOL);
            outSide = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            outCommission = 0; // Not available until closed/deal
            outSwap = PositionGetDouble(POSITION_SWAP);
            outPnl = PositionGetDouble(POSITION_PROFIT);
            return true;
         }
      }
   }
   
   // 2. Check history (last 7 days is enough for recovery/reconciliation)
   HistorySelect(TimeCurrent() - 7*24*60*60, TimeCurrent() + 24*60*60);
   
   // Find order ticket if we don't have it yet
   if (targetOrderTicket == 0) {
      int totalOrders = HistoryOrdersTotal();
      for(int i=totalOrders-1; i>=0; i--) {
         ulong ticket = HistoryOrderGetTicket(i);
         if(ticket > 0) {
            string cmt = HistoryOrderGetString(ticket, ORDER_COMMENT);
            if (StringFind(cmt, commentMatch) >= 0) {
                targetOrderTicket = ticket;
                outOrderId = IntegerToString(ticket);
                outPrice = HistoryOrderGetDouble(ticket, ORDER_PRICE_OPEN); // Initial request price
                outSymbol = HistoryOrderGetString(ticket, ORDER_SYMBOL);
                long type = HistoryOrderGetInteger(ticket, ORDER_TYPE);
                outSide = (type == ORDER_TYPE_BUY) ? "BUY" : "SELL";
                found = true;
                break;
            }
         }
      }
   }
   
   // Aggregate deals matching the order ticket OR comment
   int totalDeals = HistoryDealsTotal();
   for(int i=0; i<totalDeals; i++) { 
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket > 0) {
         string cmt = HistoryDealGetString(ticket, DEAL_COMMENT);
         ulong dealOrderId = HistoryDealGetInteger(ticket, DEAL_ORDER);
         if ((targetOrderTicket > 0 && dealOrderId == targetOrderTicket) || (targetOrderTicket == 0 && StringFind(cmt, commentMatch) >= 0)) {
            found = true;
            outTicket = ticket; // Last deal ticket
            if (outOrderId == "") outOrderId = IntegerToString(dealOrderId);
            if (outSymbol == "") outSymbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
            if (outSide == "") {
               long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
               outSide = (type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
            }
            
            double dealVol = HistoryDealGetDouble(ticket, DEAL_VOLUME);
            double dealPrice = HistoryDealGetDouble(ticket, DEAL_PRICE);
            
            outVolume += dealVol;
            totalValue += dealVol * dealPrice;
            outCommission += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            outSwap += HistoryDealGetDouble(ticket, DEAL_SWAP);
            outPnl += HistoryDealGetDouble(ticket, DEAL_PROFIT);
         }
      }
   }
   
   if (found) {
      if (outVolume > 0) {
         outPrice = totalValue / outVolume; // Weighted average price
      }
      return true;
   }
   
   return false;
}

void SaveReport(string clientExecId, string reportJson) {
   int handle = INVALID_HANDLE;
   int retries = 0;
   while(handle == INVALID_HANDLE && retries < 10) {
      handle = FileOpen("VeeroxAgent_State.csv", FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE, '|');
      if (handle == INVALID_HANDLE) { Sleep(10); retries++; }
   }
   
   if(handle != INVALID_HANDLE) {
      FileSeek(handle, 0, SEEK_END);
      FileWrite(handle, clientExecId, reportJson);
      FileClose(handle);
   }
}

//+------------------------------------------------------------------+
//| Helper: Read incoming commands                                   |
//+------------------------------------------------------------------+
void ReadIncomingMessages()
  {
   if(socket_handle == INVALID_HANDLE) return;
   
   uint len = SocketIsReadable(socket_handle);
   if(len > 0) {
      uchar buf[];
      int read = SocketRead(socket_handle, buf, len, 100);
      if(read > 0) {
         string msg = CharArrayToString(buf, 0, read);
         Print("[VeeroxAgent] Received from Node: ", msg);
         
         if(StringFind(msg, "\"commandType\":\"TRADE_EXECUTE\"") >= 0) {
            ExecuteTrade(msg);
         } else if(StringFind(msg, "\"commandType\":\"RECONCILE\"") >= 0) {
            ExecuteReconcile(msg);
         }
      }
   }
  }

//+------------------------------------------------------------------+
//| Helper: Extract JSON String Value                                |
//+------------------------------------------------------------------+
string ExtractJsonString(string json, string key)
  {
   string search = "\"" + key + "\":\"";
   int start = StringFind(json, search);
   if(start < 0) return "";
   start += StringLen(search);
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
  }

//+------------------------------------------------------------------+
//| Helper: Extract JSON Number Value                                |
//+------------------------------------------------------------------+
double ExtractJsonNumber(string json, string key)
  {
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start < 0) return 0.0;
   start += StringLen(search);
   
   int end_comma = StringFind(json, ",", start);
   int end_brace = StringFind(json, "}", start);
   int end = end_comma;
   if(end_comma < 0 || (end_brace > 0 && end_brace < end_comma)) end = end_brace;
   if(end < 0) return 0.0;
   
   string val = StringSubstr(json, start, end - start);
   return StringToDouble(val);
  }

//+------------------------------------------------------------------+
//| Execute Trade command                                            |
//+------------------------------------------------------------------+
void ExecuteTrade(string json)
  {
   string commandId = ExtractJsonString(json, "commandId");
   string clientExecId = ExtractJsonString(json, "clientExecutionId");
   if (clientExecId == "") {
      string pl = ExtractJsonString(json, "payload");
      // Actually we extract from payload inside the agent if not top level
   }
   // Wait, in MT5, ExtractJsonString is very basic. Let's make sure we find clientExecutionId.
   int clIdx = StringFind(json, "\"clientExecutionId\":\"");
   if (clIdx >= 0) {
      int endCl = StringFind(json, "\"", clIdx + 21);
      clientExecId = StringSubstr(json, clIdx + 21, endCl - (clIdx + 21));
   }
   
   // Also handle ExtractJsonNumber inside payload if it's nested (MT5 basic json parser doesn't do nesting properly if same keys)
   // For now, assuming basic flat structure for the needed fields if they exist uniquely
   string symbol = ExtractJsonString(json, "symbol");
   string side = ExtractJsonString(json, "side");
   double quantity = ExtractJsonNumber(json, "quantity");
   string sl_str = ExtractJsonString(json, "sl");
   string tp_str = ExtractJsonString(json, "tp");
   double sl = StringToDouble(sl_str); 
   if (sl == 0.0) sl = ExtractJsonNumber(json, "sl");
   double tp = StringToDouble(tp_str);
   if (tp == 0.0) tp = ExtractJsonNumber(json, "tp");
   
   double expiresAtMs = ExtractJsonNumber(json, "expiresAt");
   
   Print("[VeeroxAgent] Executing TRADE_EXECUTE -> ", side, " ", quantity, " ", symbol, " [Req: ", clientExecId, "]");
   
   ulong outTicket=0; string outOrderId=""; double outVolume=0.0; double outPrice=0.0; 
   string outSymbol=""; string outSide=""; double outCommission=0.0; double outSwap=0.0; double outPnl=0.0;
   
   if(ExecutionExists(clientExecId, outTicket, outOrderId, outVolume, outPrice, outSymbol, outSide, outCommission, outSwap, outPnl)) {
      Print("[VeeroxAgent] Deduplication triggered for ", clientExecId);
      
      string status = (outTicket > 0) ? "FILLED" : "ORDER_PLACED";
      string actionStr = (outTicket > 0) ? "ORDER_FILLED" : "ORDER_PLACED";
      string executionReportId = clientExecId + "_" + IntegerToString(outTicket) + "_" + status;
      string rpt = "{\"type\":\"MT5_EXECUTION_REPORT\",";
      rpt += "\"executionReportId\":\"" + executionReportId + "\",";
      rpt += "\"commandId\":\"" + commandId + "\",";
      rpt += "\"clientExecutionId\":\"" + clientExecId + "\",";
      rpt += "\"brokerTicketId\":\"" + IntegerToString(outTicket) + "\",";
      rpt += "\"brokerOrderId\":\"" + outOrderId + "\",";
      rpt += "\"status\":\"" + status + "\",";
      rpt += "\"action\":\"" + actionStr + "\",";
      rpt += "\"symbol\":\"" + outSymbol + "\",";
      rpt += "\"side\":\"" + outSide + "\",";
      rpt += "\"requestedSize\":" + DoubleToString(quantity, 2) + ",";
      rpt += "\"executedSize\":" + DoubleToString(outVolume, 2) + ",";
      rpt += "\"remainingSize\":" + DoubleToString(quantity - outVolume, 2) + ",";
      rpt += "\"executedPrice\":" + DoubleToString(outPrice, 5) + ",";
      rpt += "\"commission\":" + DoubleToString(outCommission, 2) + ",";
      rpt += "\"swap\":" + DoubleToString(outSwap, 2) + ",";
      rpt += "\"realizedPnl\":" + DoubleToString(outPnl, 2) + ",";
      rpt += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
      rpt += "\"origin\":\"VEEROX\"}";
      SendOrBufferReport(rpt);
      return;
   }
   
   // Check TTL
   if (expiresAtMs > 0 && ((double)TimeCurrent() * 1000.0) > expiresAtMs) {
      Print("[VeeroxAgent] Rejected: Command TTL Expired natively in MT5.");
      string executionReportId = clientExecId + "_0_EXPIRED";
      string rpt = "{\"type\":\"MT5_EXECUTION_REPORT\",";
      rpt += "\"executionReportId\":\"" + executionReportId + "\",";
      rpt += "\"commandId\":\"" + commandId + "\",";
      rpt += "\"clientExecutionId\":\"" + clientExecId + "\",";
      rpt += "\"brokerTicketId\":\"0\",";
      rpt += "\"brokerOrderId\":\"0\",";
      rpt += "\"status\":\"EXPIRED\",";
      rpt += "\"action\":\"ORDER_CANCELED\",";
      rpt += "\"reason\":\"TTL expired before MT5 processing\",";
      rpt += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
      rpt += "\"origin\":\"VEEROX\"}";
      SendOrBufferReport(rpt);
      return;
   }
   
   double currentPrice = (side == "BUY") ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID);
   
   string status = "FAILED";
   string reason = "";
   double executedSize = 0.0;
   double executedPrice = 0.0;
   ulong ticket = 0;
   string orderId = "";
   double commission = 0.0;
   double swap = 0.0;
   double realizedPnl = 0.0;

   // Geometry Validation
   bool validGeometry = true;
   if (side == "BUY") {
      if ((sl > 0 && sl >= currentPrice) || (tp > 0 && tp <= currentPrice)) validGeometry = false;
   } else if (side == "SELL") {
      if ((sl > 0 && sl <= currentPrice) || (tp > 0 && tp >= currentPrice)) validGeometry = false;
   }

   if (!validGeometry) {
      status = "REJECTED";
      reason = "Financial Geometry Validation Failed (SL/TP invalid)";
      Print("[VeeroxAgent] Rejected: ", reason, " price=", currentPrice, " sl=", sl, " tp=", tp);
   } else {
      MqlTradeRequest request;
      MqlTradeResult result;
      ZeroMemory(request);
      ZeroMemory(result);
      
      request.action = TRADE_ACTION_DEAL;
      request.symbol = symbol;
      request.volume = quantity;
      request.type = (side == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      request.price = currentPrice;
      request.sl = sl;
      request.tp = tp;
      request.deviation = 10;
      request.magic = 999111; // Veerox Magic Number
      request.comment = MakeComment(clientExecId);
   
      if(OrderSend(request, result)) {
         if(result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_DONE_PARTIAL) {
            status = (result.retcode == TRADE_RETCODE_DONE_PARTIAL) ? "PARTIALLY_FILLED" : "FILLED";
            executedSize = result.volume;
            executedPrice = result.price;
            ticket = result.deal;
            orderId = IntegerToString(result.order);
            
            // Extract Financials
            if (HistoryDealSelect(ticket)) {
               commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
               swap = HistoryDealGetDouble(ticket, DEAL_SWAP);
               realizedPnl = HistoryDealGetDouble(ticket, DEAL_PROFIT);
            }
            
            Print("[VeeroxAgent] Trade Success: Ticket ", ticket, " Comm: ", commission);
            
            // S-24 Phase 10-C-D: Retrieve cumulative volume for partial fills
            ulong aggTicket=0; string aggOrderId=""; double aggVolume=0.0; double aggPrice=0.0;
            string aggSymbol=""; string aggSide=""; double aggCommission=0.0; double aggSwap=0.0; double aggPnl=0.0;
            if (ExecutionExists(clientExecId, aggTicket, aggOrderId, aggVolume, aggPrice, aggSymbol, aggSide, aggCommission, aggSwap, aggPnl)) {
               executedSize = aggVolume;
               executedPrice = aggPrice; // Weighted average price from aggregation
               commission = aggCommission;
               swap = aggSwap;
               realizedPnl = aggPnl;
            }
         } else if(result.retcode == TRADE_RETCODE_PLACED) {
            status = "ORDER_ACCEPTED";
            orderId = IntegerToString(result.order);
            Print("[VeeroxAgent] Order Placed: ", orderId);
         } else {
            status = "REJECTED";
            reason = "Broker Rejected: " + IntegerToString(result.retcode);
            Print("[VeeroxAgent] Trade Rejected: ", result.retcode);
         }
      } else {
         status = "FAILED";
         reason = "OrderSend Failed: " + IntegerToString(GetLastError());
         Print("[VeeroxAgent] OrderSend Failed: ", GetLastError());
      }
   }
   
   string actionStr = "ORDER_REJECTED";
   if (status == "FILLED" || status == "PARTIALLY_FILLED") actionStr = "ORDER_FILLED";
   else if (status == "ORDER_ACCEPTED") actionStr = "ORDER_PLACED";
   
   string executionReportId = clientExecId + "_" + IntegerToString(ticket) + "_" + status;
   
   // Build Execution Report
   string report = "{\"type\":\"MT5_EXECUTION_REPORT\",";
   report += "\"executionReportId\":\"" + executionReportId + "\",";
   report += "\"commandId\":\"" + commandId + "\",";
   report += "\"clientExecutionId\":\"" + clientExecId + "\",";
   report += "\"brokerTicketId\":\"" + IntegerToString(ticket) + "\",";
   report += "\"brokerOrderId\":\"" + orderId + "\",";
   report += "\"status\":\"" + status + "\",";
   report += "\"action\":\"" + actionStr + "\",";
   report += "\"symbol\":\"" + symbol + "\",";
   report += "\"side\":\"" + side + "\",";
   report += "\"requestedSize\":" + DoubleToString(quantity, 2) + ",";
   report += "\"executedSize\":" + DoubleToString(executedSize, 2) + ",";
   report += "\"remainingSize\":" + DoubleToString(quantity - executedSize, 2) + ",";
   report += "\"executedPrice\":" + DoubleToString(executedPrice, 5) + ",";
   report += "\"commission\":" + DoubleToString(commission, 2) + ",";
   report += "\"swap\":" + DoubleToString(swap, 2) + ",";
   report += "\"realizedPnl\":" + DoubleToString(realizedPnl, 2) + ",";
   report += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
   if(reason != "") report += "\"reason\":\"" + reason + "\",";
   report += "\"origin\":\"VEEROX\"}";
   
   SaveReport(clientExecId, report);
   SendOrBufferReport(report);
  }

//+------------------------------------------------------------------+
//| RECONCILE command handler                                        |
//+------------------------------------------------------------------+
void ExecuteReconcile(string json) {
   string commandId = ExtractJsonString(json, "commandId");
   string clientExecId = ExtractJsonString(json, "clientExecutionId");
   
   int clIdx = StringFind(json, "\"clientExecutionId\":\"");
   if (clIdx >= 0 && clientExecId == "") {
      int endCl = StringFind(json, "\"", clIdx + 21);
      clientExecId = StringSubstr(json, clIdx + 21, endCl - (clIdx + 21));
   }
   
   Print("[VeeroxAgent] Executing RECONCILE -> [Req: ", clientExecId, "]");
   
   ulong outTicket=0; string outOrderId=""; double outVolume=0.0; double outPrice=0.0; 
   string outSymbol=""; string outSide=""; double outCommission=0.0; double outSwap=0.0; double outPnl=0.0;
   
   if(ExecutionExists(clientExecId, outTicket, outOrderId, outVolume, outPrice, outSymbol, outSide, outCommission, outSwap, outPnl)) {
      Print("[VeeroxAgent] Reconciled: Found authoritative broker state for ", clientExecId);
      string status = (outTicket > 0) ? "FILLED" : "ORDER_PLACED";
      string actionStr = (outTicket > 0) ? "ORDER_FILLED" : "ORDER_PLACED";
      string executionReportId = clientExecId + "_" + IntegerToString(outTicket) + "_" + status;
      string report = "{\"type\":\"MT5_EXECUTION_REPORT\",";
      report += "\"executionReportId\":\"" + executionReportId + "\",";
      report += "\"commandId\":\"" + commandId + "\",";
      report += "\"clientExecutionId\":\"" + clientExecId + "\",";
      report += "\"brokerTicketId\":\"" + IntegerToString(outTicket) + "\",";
      report += "\"brokerOrderId\":\"" + outOrderId + "\",";
      report += "\"status\":\"" + status + "\",";
      report += "\"action\":\"" + actionStr + "\",";
      report += "\"symbol\":\"" + outSymbol + "\",";
      report += "\"side\":\"" + outSide + "\",";
      report += "\"executedSize\":" + DoubleToString(outVolume, 2) + ",";
      report += "\"executedPrice\":" + DoubleToString(outPrice, 5) + ",";
      report += "\"commission\":" + DoubleToString(outCommission, 2) + ",";
      report += "\"swap\":" + DoubleToString(outSwap, 2) + ",";
      report += "\"realizedPnl\":" + DoubleToString(outPnl, 2) + ",";
      report += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
      report += "\"origin\":\"VEEROX\"}";
      SendOrBufferReport(report);
   } else {
      Print("[VeeroxAgent] Reconciled: NEVER EXECUTED ", clientExecId);
      string executionReportId = clientExecId + "_0_FAILED";
      string report = "{\"type\":\"MT5_EXECUTION_REPORT\",";
      report += "\"executionReportId\":\"" + executionReportId + "\",";
      report += "\"commandId\":\"" + commandId + "\",";
      report += "\"clientExecutionId\":\"" + clientExecId + "\",";
      report += "\"brokerTicketId\":\"0\",";
      report += "\"brokerOrderId\":\"0\",";
      report += "\"status\":\"FAILED\",";
      report += "\"action\":\"ORDER_REJECTED\",";
      report += "\"reason\":\"Command never reached MT5. Safe to retry.\",";
      report += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
      report += "\"origin\":\"VEEROX\"}";
      SendOrBufferReport(report);
   }
  }
