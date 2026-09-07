# VEEROX ATI

**Document ID:** 012  
**Document Name:** API Specification  
**Version:** 1.0.0  
**Chapter:** Marketplace, Licensing, AI, Notification, Audit, Administration & WebSocket APIs

---

# 28. Marketplace API

---

## 28.1 Browse Marketplace

```http
GET /api/v1/marketplace/products
```

### Query Parameters

| Parameter | Description |
|------------|-------------|
| category | EA, Strategy, Indicator, AI Model |
| search | Product search |
| page | Pagination |
| pageSize | Page size |
| sort | Popularity, Rating, Latest |

---

## 28.2 Product Details

```http
GET /api/v1/marketplace/products/{productId}
```

Returns:

- Product Information
- Screenshots
- Documentation
- Version History
- Pricing
- License Options
- Reviews

---

## 28.3 Purchase Product

```http
POST /api/v1/marketplace/products/{productId}/purchase
```

Creates:

- Order
- Invoice
- License
- Payment Session

---

## 28.4 Download Product

```http
POST /api/v1/marketplace/products/{productId}/download
```

Validation:

- License
- Subscription
- Purchase Status

---

## 28.5 Product Reviews

```http
GET /api/v1/marketplace/products/{productId}/reviews
```

---

## 28.6 Submit Review

```http
POST /api/v1/marketplace/products/{productId}/reviews
```

---

# 29. Licensing API

---

## Create License

```http
POST /api/v1/licenses
```

---

## Validate License

```http
POST /api/v1/licenses/validate
```

---

## Activate License

```http
POST /api/v1/licenses/{licenseId}/activate
```

---

## Deactivate License

```http
POST /api/v1/licenses/{licenseId}/deactivate
```

---

## Renew License

```http
POST /api/v1/licenses/{licenseId}/renew
```

---

## License Details

```http
GET /api/v1/licenses/{licenseId}
```

---

## License History

```http
GET /api/v1/licenses/history
```

---

# 30. Billing API

---

## Create Checkout Session

```http
POST /api/v1/billing/checkout
```

---

## Payment Callback

```http
POST /api/v1/billing/webhook
```

---

## Payment History

```http
GET /api/v1/billing/payments
```

---

## Invoices

```http
GET /api/v1/billing/invoices
```

---

## Invoice Details

```http
GET /api/v1/billing/invoices/{id}
```

---

# 31. AI API

---

## AI Recommendation

```http
GET /api/v1/ai/recommendation
```

Returns:

- Recommended Strategy
- Recommended EA
- Risk Recommendation
- Confidence

---

## Trading Coach

```http
GET /api/v1/ai/trading-coach
```

Returns:

- Mistakes
- Suggestions
- Learning Insights

---

## AI Prediction

```http
GET /api/v1/ai/prediction
```

Returns:

- Trend Probability
- Confidence
- Expected Market Regime

---

## AI Explainability

```http
GET /api/v1/ai/explanation/{predictionId}
```

---

## AI Models

```http
GET /api/v1/ai/models
```

---

## AI Model Details

```http
GET /api/v1/ai/models/{id}
```

---

# 32. Notification API

---

## Notifications

```http
GET /api/v1/notifications
```

---

## Mark Read

```http
POST /api/v1/notifications/{id}/read
```

---

## Notification Preferences

```http
GET /api/v1/notifications/preferences
```

---

## Update Preferences

```http
PUT /api/v1/notifications/preferences
```

---

## Test Notification

```http
POST /api/v1/notifications/test
```

---

# 33. Audit API

---

## Audit History

```http
GET /api/v1/audit
```

Supports:

- User
- Workspace
- Organization
- Event Type
- Date Range

---

## Audit Details

```http
GET /api/v1/audit/{id}
```

---

## Export Audit

```http
POST /api/v1/audit/export
```

---

# 34. Administration API

---

## Platform Health

```http
GET /api/v1/admin/health
```

---

## Services

```http
GET /api/v1/admin/services
```

---

## Restart Service

```http
POST /api/v1/admin/services/{service}/restart
```

---

## Platform Metrics

```http
GET /api/v1/admin/metrics
```

---

## Active Users

```http
GET /api/v1/admin/users/active
```

---

## Feature Flags

```http
GET /api/v1/admin/features
```

---

## Update Feature Flag

```http
PUT /api/v1/admin/features/{flag}
```

---

# 35. WebSocket API

---

## Connection

```text
wss://api.veerox.ai/ws
```

---

## Authentication

```json
{
  "type": "authenticate",
  "token": "<JWT>"
}
```

---

## Subscription Types

### Market Updates

```json
{
  "type": "subscribe",
  "channel": "market.XAUUSD.M15"
}
```

---

### Strategy Updates

```json
{
  "type": "subscribe",
  "channel": "strategy"
}
```

---

### Portfolio Updates

```json
{
  "type": "subscribe",
  "channel": "portfolio"
}
```

---

### Execution Updates

```json
{
  "type": "subscribe",
  "channel": "execution"
}
```

---

### AI Updates

```json
{
  "type": "subscribe",
  "channel": "ai"
}
```

---

### Notifications

```json
{
  "type": "subscribe",
  "channel": "notifications"
}
```

---

# 36. Internal Service APIs

These APIs SHALL be accessible only through the internal service network.

Examples:

```text
POST /internal/risk/calculate

POST /internal/decision/generate

POST /internal/policy/evaluate

POST /internal/execution/submit

POST /internal/strategy/select

POST /internal/market/snapshot
```

These endpoints SHALL require service authentication and SHALL NOT be exposed publicly.

---

# 37. MT5 Agent APIs

The Veerox Agent SHALL communicate through authenticated APIs.

---

## Agent Registration

```http
POST /api/v1/agents/register
```

---

## Agent Heartbeat

```http
POST /api/v1/agents/heartbeat
```

---

## Account Synchronization

```http
POST /api/v1/agents/accounts/sync
```

---

## Position Synchronization

```http
POST /api/v1/agents/positions/sync
```

---

## Order Synchronization

```http
POST /api/v1/agents/orders/sync
```

---

## Deal Synchronization

```http
POST /api/v1/agents/deals/sync
```

---

## Execute Trade

```http
POST /api/v1/agents/trades/execute
```

---

## Modify Position

```http
POST /api/v1/agents/positions/modify
```

---

## Close Position

```http
POST /api/v1/agents/positions/close
```

---

## Download EA

```http
GET /api/v1/agents/ea/download/{eaId}
```

---

## Agent Update

```http
GET /api/v1/agents/update
```

Allows the platform to distribute new Agent versions.

---

# 38. API Security Requirements

Every API SHALL implement:

- Authentication
- Authorization
- Input Validation
- Rate Limiting
- Request Logging
- Correlation ID
- Audit Trail
- Version Validation

Public APIs SHALL NEVER expose internal implementation details.

---

# 39. API Lifecycle

Every API SHALL progress through:

```text
Draft
   ↓
Review
   ↓
Approved
   ↓
Implemented
   ↓
Tested
   ↓
Released
   ↓
Deprecated
   ↓
Retired
```

Breaking changes SHALL require a new API version.

---

# END OF DOCUMENT

**Document:** 012_API_Specification.md

**Status:** COMPLETE

---

# Next Documentation Phase

The API contracts are now complete.

The next document is the most important for implementation:

**013_Database_Design.md**

This document will define:

- Every PostgreSQL schema
- Every table
- Every column
- Every index
- Every foreign key
- Every constraint
- Every enum
- Every relationship
- Read models
- Event store
- Audit schema
- AI datasets
- Marketplace schema
- Licensing schema
- Multi-tenant architecture

This will become the definitive database blueprint for Claude Code implementation.