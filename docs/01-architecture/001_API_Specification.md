# VEEROX ATI

**Document ID:** 012  
**Document Name:** API Specification  
**Version:** 1.0.0  
**Chapter:** Market Intelligence, Risk, Portfolio, Decision & Execution APIs

---

# 17. Market Intelligence API

---

## 17.1 Get Market Snapshot

**Endpoint**

```http
GET /api/v1/market/snapshot
```

### Description

Returns the latest normalized Market Snapshot for one or more symbols.

### Query Parameters

| Parameter | Type | Required | Description |
|------------|------|----------|-------------|
| symbol | string | Yes | Trading Symbol |
| timeframe | string | Yes | M1, M5, M15, M30, H1, H4, D1 |

### Response

```json
{
  "symbol": "XAUUSD",
  "timeframe": "M15",
  "marketRegime": "TRENDING",
  "trendStrength": 82,
  "volatility": 71,
  "liquidity": 88,
  "spread": 14,
  "marketHealth": 91,
  "confidence": 89,
  "generatedAt": "2026-08-07T10:00:00Z"
}
```

---

## 17.2 Market Probability

```http
GET /api/v1/market/probability
```

Returns:

- Trend Probability
- Range Probability
- Breakout Probability
- High Volatility Probability
- Reversal Probability

---

## 17.3 Market Regime

```http
GET /api/v1/market/regime
```

Returns current market classification.

Possible values:

- TRENDING
- RANGING
- BREAKOUT
- REVERSAL
- HIGH_VOLATILITY
- LOW_VOLATILITY

---

## 17.4 Market Dashboard

```http
GET /api/v1/market/dashboard
```

Returns complete dashboard data for frontend.

---

# 18. News Intelligence API

---

## Latest News

```http
GET /api/v1/news
```

Supports:

- Currency Filter
- Impact Filter
- Search
- Pagination

---

## High Impact News

```http
GET /api/v1/news/high-impact
```

Returns only High Impact news.

---

## News Details

```http
GET /api/v1/news/{id}
```

---

# 19. Economic Calendar API

---

## Calendar Events

```http
GET /api/v1/calendar/events
```

Supports:

- Country
- Currency
- Date
- Impact

---

## Upcoming High Impact Events

```http
GET /api/v1/calendar/high-impact
```

---

# 20. Sentiment API

---

## Current Sentiment

```http
GET /api/v1/sentiment
```

Returns:

- Overall Score
- Bullish %
- Bearish %
- Neutral %

---

## Sentiment Trend

```http
GET /api/v1/sentiment/history
```

---

# 21. Risk API

---

## Risk Assessment

```http
GET /api/v1/risk/assessment
```

Returns

```json
{
  "riskScore": 34,
  "drawdownRisk": 19,
  "marginRisk": 22,
  "portfolioRisk": 41,
  "recommendation": "REDUCE_POSITION_SIZE"
}
```

---

## Risk History

```http
GET /api/v1/risk/history
```

---

## Risk Policies

```http
GET /api/v1/risk/policies
```

---

## Update Risk Policy

```http
PUT /api/v1/risk/policies/{id}
```

---

## Risk Dashboard

```http
GET /api/v1/risk/dashboard
```

---

# 22. Portfolio API

---

## List Portfolios

```http
GET /api/v1/portfolios
```

---

## Portfolio Details

```http
GET /api/v1/portfolios/{id}
```

---

## Portfolio Health

```http
GET /api/v1/portfolios/{id}/health
```

---

## Portfolio Performance

```http
GET /api/v1/portfolios/{id}/performance
```

---

## Portfolio Exposure

```http
GET /api/v1/portfolios/{id}/exposure
```

---

## Portfolio Allocation

```http
PUT /api/v1/portfolios/{id}/allocation
```

---

## Portfolio Rebalance

```http
POST /api/v1/portfolios/{id}/rebalance
```

---

# 23. Decision API

---

## Generate Decision

```http
POST /api/v1/decisions/generate
```

Internal endpoint.

Returns:

```json
{
  "decisionId": "",
  "decision": "EXECUTE",
  "confidence": 91
}
```

---

## Decision History

```http
GET /api/v1/decisions
```

---

## Decision Details

```http
GET /api/v1/decisions/{id}
```

---

## Decision Timeline

```http
GET /api/v1/decisions/{id}/timeline
```

---

## Decision Explainability

```http
GET /api/v1/decisions/{id}/explanation
```

---

# 24. Policy API

---

## Evaluate Policy

```http
POST /api/v1/policies/evaluate
```

Internal endpoint.

---

## Active Policies

```http
GET /api/v1/policies
```

---

## Create Policy

```http
POST /api/v1/policies
```

---

## Update Policy

```http
PUT /api/v1/policies/{id}
```

---

## Delete Policy

```http
DELETE /api/v1/policies/{id}
```

---

# 25. Execution API

---

## Submit Execution

```http
POST /api/v1/executions
```

Internal endpoint.

---

## Execution Status

```http
GET /api/v1/executions/{id}
```

---

## Execution History

```http
GET /api/v1/executions
```

---

## Open Positions

```http
GET /api/v1/executions/positions
```

---

## Position Details

```http
GET /api/v1/executions/positions/{id}
```

---

## Modify Position

```http
PUT /api/v1/executions/positions/{id}
```

Supports:

- Stop Loss
- Take Profit
- Trailing Stop
- Break Even

---

## Close Position

```http
POST /api/v1/executions/positions/{id}/close
```

---

## Partial Close

```http
POST /api/v1/executions/positions/{id}/partial-close
```

---

## Pending Orders

```http
GET /api/v1/executions/orders
```

---

## Cancel Order

```http
DELETE /api/v1/executions/orders/{id}
```

---

# 26. Connector API

---

## Connector Status

```http
GET /api/v1/connectors
```

---

## Connector Health

```http
GET /api/v1/connectors/{id}/health
```

---

## Restart Connector

```http
POST /api/v1/connectors/{id}/restart
```

---

## Synchronize Connector

```http
POST /api/v1/connectors/{id}/synchronize
```

---

## Connected Trading Accounts

```http
GET /api/v1/connectors/{id}/accounts
```

---

# 27. Dashboard API

---

## Trading Dashboard

```http
GET /api/v1/dashboard/trading
```

---

## Executive Dashboard

```http
GET /api/v1/dashboard/executive
```

---

## Operational Dashboard

```http
GET /api/v1/dashboard/operations
```

---

## AI Dashboard

```http
GET /api/v1/dashboard/ai
```

---

## Platform Dashboard

```http
GET /api/v1/dashboard/platform
```

---

# End of Part 2

**Next Chapter**

- Marketplace APIs
- Licensing APIs
- Billing APIs
- AI APIs
- Notification APIs
- Audit APIs
- Administration APIs
- WebSocket APIs
- Internal Service APIs
- MT5 Agent APIs

This chapter defines the operational APIs that power the core trading lifecycle of Veerox ATI, from market intelligence through execution and monitoring.