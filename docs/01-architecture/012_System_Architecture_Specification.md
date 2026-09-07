# VEEROX ATI

**Document ID:** 011  
**Document Name:** System Architecture Specification (SAS)  
**Version:** 1.0.0  
**Chapter:** Runtime Architecture & Service Architecture

---

# 11. Runtime Architecture

## 11.1 Runtime Philosophy

The Veerox ATI Platform SHALL execute as a distributed, event-driven platform where every business capability operates as an independent service while remaining part of a unified business ecosystem.

The runtime SHALL prioritize:

- High Availability
- Fault Isolation
- Horizontal Scalability
- Event Consistency
- Low Latency
- Operational Visibility

---

# 11.2 Runtime Layers

```text
                    Client Layer
                         │
        ┌────────────────────────────────┐
        │  Web Dashboard (Next.js)       │
        │  Admin Portal                  │
        │  Marketplace                   │
        └────────────────────────────────┘
                         │
                   HTTPS / WebSocket
                         │
                  API Gateway Layer
                         │
      Authentication • Routing • Rate Limit
                         │
────────────────────────────────────────────────────
               Application Services
────────────────────────────────────────────────────
 Identity Service
 Organization Service
 Workspace Service
 Strategy Service
 Risk Service
 Portfolio Service
 Decision Service
 Policy Service
 Execution Service
 Marketplace Service
 AI Service
 Notification Service
 Audit Service
────────────────────────────────────────────────────
                    Event Bus
────────────────────────────────────────────────────
 PostgreSQL • Redis • Object Storage • Message Broker
────────────────────────────────────────────────────
 MT5 Connector Service
 External Provider Adapters
────────────────────────────────────────────────────
 MetaTrader 5
 Market Data Providers
 News Providers
 Calendar Providers
 Payment Providers
```

---

# 11.3 Runtime Lifecycle

Every runtime instance SHALL follow the same lifecycle.

```
Starting

↓

Configuration Validation

↓

Infrastructure Validation

↓

Dependency Validation

↓

Health Verification

↓

Ready

↓

Running

↓

Graceful Shutdown
```

No service SHALL accept production traffic before reaching the **Ready** state.

---

# 12. Service Architecture

---

## 12.1 Identity Service

### Responsibility

Manage authentication, authorization, sessions, users and permissions.

### Owns

- Users
- Sessions
- Roles
- Permissions

### Publishes

- UserCreated
- UserUpdated
- UserLoggedIn
- UserSuspended

### Consumes

None

---

## 12.2 Organization Service

### Responsibility

Manage organizations.

### Owns

- Organizations
- Members
- Invitations

### Publishes

- OrganizationCreated
- OrganizationUpdated

### Consumes

- UserCreated

---

## 12.3 Workspace Service

### Responsibility

Manage isolated workspaces.

### Owns

- Workspaces
- Workspace Configuration

### Publishes

- WorkspaceCreated
- WorkspaceArchived

---

## 12.4 Market Intelligence Service

### Responsibility

Transform raw market data into normalized Market Intelligence.

### Owns

- Market Snapshot
- Trend Analysis
- Volatility
- Liquidity
- Confidence Score

### Publishes

- MarketSnapshotUpdated
- MarketRegimeChanged
- VolatilityChanged

---

## 12.5 News Intelligence Service

### Responsibility

Process financial news.

### Owns

- News
- News Classification
- Impact Analysis

### Publishes

- NewsReceived
- HighImpactNewsDetected

---

## 12.6 Economic Calendar Service

### Responsibility

Manage economic calendar events.

### Owns

- Calendar Events
- Event Severity

### Publishes

- CalendarUpdated
- HighImpactEventDetected

---

## 12.7 Strategy Service

### Responsibility

Maintain Strategy Registry.

### Owns

- Strategies
- Strategy Versions

### Publishes

- StrategyPublished
- StrategyActivated
- StrategyDeprecated

---

## 12.8 Expert Advisor Service

### Responsibility

Manage Expert Advisors.

### Owns

- EA Registry
- EA Packages
- Compatibility Matrix

### Publishes

- EAInstalled
- EAUpdated
- EAActivated

---

## 12.9 Strategy Orchestrator Service

### Responsibility

Evaluate market conditions and select the optimal strategy.

### Owns

- Strategy Ranking
- Recommendation History

### Publishes

- StrategySelected
- StrategyChanged
- StrategyRecommendationGenerated

---

## 12.10 Risk Service

### Responsibility

Protect trading capital.

### Owns

- Risk Assessment
- Drawdown
- Exposure
- Risk Score

### Publishes

- RiskCalculated
- RiskLimitReached
- DrawdownExceeded

---

## 12.11 Portfolio Service

### Responsibility

Manage trading portfolios.

### Owns

- Portfolios
- Allocations
- Portfolio Health

### Publishes

- PortfolioUpdated
- PortfolioHealthChanged

---

## 12.12 Decision Service

### Responsibility

Generate trading decisions.

### Owns

- Decision
- Confidence
- Explainability

### Publishes

- DecisionGenerated
- DecisionRejected

---

## 12.13 Policy Service

### Responsibility

Approve or reject trading decisions.

### Owns

- Policies
- Policy Evaluations

### Publishes

- DecisionApproved
- DecisionRejected

---

## 12.14 Execution Service

### Responsibility

Manage order lifecycle.

### Owns

- Orders
- Positions
- Execution Requests

### Publishes

- OrderSubmitted
- PositionOpened
- PositionClosed

---

## 12.15 Connector Service

### Responsibility

Communicate with MetaTrader.

### Owns

- Connector State
- Synchronization

### Publishes

- ConnectorConnected
- ConnectorDisconnected

---

## 12.16 AI Service

### Responsibility

Provide AI-assisted analysis and model inference.

### Owns

- Models
- Recommendations
- Predictions

### Publishes

- RecommendationGenerated
- ModelActivated

---

## 12.17 Marketplace Service

### Responsibility

Commercial product distribution.

### Owns

- Products
- Purchases

### Publishes

- ProductPurchased
- ProductInstalled

---

## 12.18 Licensing Service

### Responsibility

Commercial licensing.

### Owns

- Licenses
- Activations

### Publishes

- LicenseActivated
- LicenseExpired

---

## 12.19 Notification Service

### Responsibility

Deliver notifications.

### Owns

- Notification Queue
- Delivery History

### Publishes

- NotificationSent
- NotificationFailed

---

## 12.20 Audit Service

### Responsibility

Immutable event recording.

### Owns

- Audit Records

### Publishes

None

Every domain SHALL write immutable events to the Audit Service.

---

# 13. Service Communication Rules

---

## Rule 1

Services SHALL own their own data.

---

## Rule 2

Services SHALL NOT directly update another service's database.

---

## Rule 3

Cross-service communication SHALL occur through:

- Domain Events
- Approved APIs

---

## Rule 4

Every published event SHALL contain:

- Event ID
- Aggregate ID
- Event Version
- Timestamp
- Correlation ID
- Causation ID

---

## Rule 5

Every service SHALL expose:

- Health Endpoint
- Metrics Endpoint
- Version Endpoint

---

# 14. Runtime Quality Rules

Every service SHALL be:

- Stateless
- Independently Deployable
- Independently Testable
- Independently Observable
- Independently Recoverable

---

# End of Chapter

**Upcoming Chapters**

- Event-Driven Architecture
- Command & Query Architecture (CQRS)
- AI Runtime Architecture
- Failure Recovery Architecture
- Scalability Architecture
- Deployment Architecture

**End of Current Revision**