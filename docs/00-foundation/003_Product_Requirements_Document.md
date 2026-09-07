# VEEROX ATI

**Document ID:** 003  
**Document Name:** Product Requirements Document (PRD)  
**Version:** 1.0.0  
**Status:** Approved Baseline  
**Classification:** Internal Product Specification  
**Owner:** Veerox Software  
**Repository:** `/docs/003_Product_Requirements_Document.md`

---

# Revision History

| Version | Date | Status | Description |
|----------|------|--------|-------------|
| 1.0.0 | 2026-08-07 | Approved Baseline | Initial approved PRD |

---

# 1. Purpose

This document defines the business requirements, functional scope, product capabilities, user expectations, and acceptance criteria for Veerox Autonomous Trading Intelligence Platform (ATI).

This document answers:

- What problem is being solved?
- Who is the product built for?
- What capabilities must exist?
- What is included in Version 1?
- What is explicitly excluded?

This document defines **business requirements only**.

Implementation details belong to the Software Requirements Specification (SRS).

---

# 2. Product Overview

Veerox ATI is an enterprise-grade cloud platform that continuously analyzes financial markets, external intelligence, portfolio exposure, execution policies, and trading strategies before authorizing or rejecting trade execution.

The platform acts as a centralized intelligence layer while Expert Advisors function only as execution plugins.

---

# 3. Product Goals

The platform SHALL:

- Improve trading decision quality.
- Reduce unnecessary trades.
- Preserve trading capital.
- Centralize strategy management.
- Coordinate multiple Expert Advisors.
- Support multiple trading accounts.
- Provide explainable decisions.
- Deliver enterprise scalability.
- Enable plugin extensibility.

---

# 4. Target Users

## 4.1 Retail Trader

Characteristics:

- One or few trading accounts
- Manual or semi-automated trading
- Strategy marketplace access
- Performance analytics

---

## 4.2 Professional Trader

Characteristics:

- Multiple accounts
- Multiple strategies
- Portfolio management
- Risk monitoring

---

## 4.3 Prop Firm Trader

Characteristics:

- Strict drawdown limits
- Daily loss restrictions
- Evaluation compliance
- Rule enforcement

---

## 4.4 Fund Manager

Characteristics:

- Client portfolios
- Multi-account supervision
- Capital allocation
- Enterprise reporting

---

## 4.5 Strategy Developer

Characteristics:

- Publish Expert Advisors
- Publish strategies
- Sell source code
- Manage versions
- Manage licenses

---

## 4.6 Enterprise Customer

Characteristics:

- Multiple users
- Organization management
- White-label deployment
- API integration
- Role-based administration

---

# 5. Product Operating Modes

## Manual Mode

The platform provides intelligence only.

The user decides and executes trades.

---

## Assisted Mode

The platform provides recommendations.

Execution requires user approval.

---

## Autonomous Mode

The platform performs:

- Market analysis
- Risk evaluation
- Strategy selection
- Policy validation
- Trade execution

without manual approval, subject to configured permissions.

---

# 6. Functional Capabilities

## FC-001 Identity Management

The platform SHALL support:

- User registration
- Authentication
- Multi-factor authentication
- Password recovery
- User profile management
- Role management
- Organization membership

---

## FC-002 Organization Management

The platform SHALL support:

- Organizations
- Teams
- Workspaces
- Member invitations
- Permission inheritance

---

## FC-003 Trading Accounts

The platform SHALL support:

- Multiple broker accounts
- Live accounts
- Demo accounts
- Account grouping
- Account tagging
- Account health monitoring

---

## FC-004 Market Intelligence

The platform SHALL continuously evaluate:

- Market regime
- Trend
- Range
- Volatility
- Liquidity
- Spread
- Trading session
- Market health

Outputs SHALL be consumable by downstream intelligence engines.

---

## FC-005 External Intelligence

The platform SHALL support integration with external providers through adapter interfaces.

Examples include:

- Economic calendars
- Financial news
- Sentiment providers
- Market data providers

The platform SHALL allow replacing providers without modifying core business logic.

---

## FC-006 Strategy Registry

The platform SHALL maintain a centralized strategy catalog.

Each strategy SHALL include:

- Strategy ID
- Version
- Category
- Asset class
- Supported symbols
- Timeframes
- Risk profile
- Dependencies
- Status

---

## FC-007 Expert Advisor Registry

Each Expert Advisor SHALL be registered independently.

Metadata SHALL include:

- EA ID
- Version
- Author
- Binary package
- Source package availability
- Compatible strategies
- Compatible connectors
- License type

---

## FC-008 Strategy Orchestrator

The Strategy Orchestrator SHALL:

- Evaluate available strategies.
- Rank strategies.
- Select active strategies.
- Pause strategies.
- Resume strategies.
- Retire strategies.
- Coordinate multiple Expert Advisors.

The orchestrator SHALL own the strategy lifecycle.

---

## FC-009 Dynamic Strategy Switching

The platform SHALL continuously monitor active strategies.

A strategy transition SHALL evaluate:

- Current market regime
- Open positions
- Floating P/L
- Portfolio exposure
- Risk score
- News impact
- Liquidity
- Policy constraints

The platform SHALL decide one of the following:

- Continue
- Pause
- Resume
- Close positions
- Partial exit
- Switch strategy

No strategy transition SHALL occur without successful policy validation.

---

## FC-010 Risk Intelligence

The platform SHALL calculate:

- Position risk
- Portfolio risk
- Drawdown
- Margin utilization
- Exposure
- Daily loss
- Weekly loss
- Monthly loss
- Risk score

---

## FC-011 Decision Intelligence

The Decision Engine SHALL receive inputs from:

- Market Intelligence
- Strategy Intelligence
- Portfolio Intelligence
- Risk Intelligence
- Policy Engine

The engine SHALL generate one of the following decisions:

- Execute
- Reject
- Wait
- Reduce Risk
- Close Position
- Pause Trading
- Switch Strategy

---

## FC-012 Policy Engine

The Policy Engine SHALL validate:

- Risk rules
- Portfolio rules
- Session rules
- News restrictions
- Symbol restrictions
- User permissions
- Strategy permissions
- Organization policies

Execution SHALL be blocked whenever mandatory policies fail.

---

## FC-013 Execution Gateway

The Execution Gateway SHALL:

- Validate execution requests.
- Route orders.
- Communicate with trading connectors.
- Retry transient failures.
- Record execution logs.
- Return execution status.

---

## FC-014 Trading Connector

Version 1 SHALL support MetaTrader 5.

The connector SHALL:

- Receive execution commands.
- Submit orders.
- Monitor execution status.
- Report confirmations.

The connector MUST NOT contain business logic.

---

## FC-015 Portfolio Intelligence

The platform SHALL support:

- Multi-account monitoring
- Portfolio allocation
- Capital allocation
- Currency exposure
- Asset exposure
- Strategy exposure

---

## FC-016 Explainability Engine

Every automated decision SHALL record:

- Decision identifier
- Timestamp
- Selected strategy
- Rejected strategies
- Applied policies
- Risk summary
- Market summary
- Confidence score
- Execution outcome

---

## FC-017 Marketplace

The marketplace SHALL support:

Products:

- Expert Advisors
- Strategies
- Plugins
- Indicators
- Risk Models
- Source Code Packages

Commercial models:

- Purchase
- Subscription
- Rental
- Trial

---

## FC-018 Licensing

Supported licenses:

- Trial
- Monthly
- Annual
- Lifetime
- Enterprise

License validation SHALL occur through the cloud licensing service.

---

## FC-019 Backtesting Center

The platform SHALL support:

- Historical replay
- Tick replay
- Spread simulation
- Slippage simulation
- Commission simulation
- Walk-forward testing
- Portfolio backtesting
- Strategy comparison

---

## FC-020 Analytics

The platform SHALL provide:

- Equity curve
- Balance history
- Drawdown analysis
- Profit factor
- Recovery factor
- Win/Loss statistics
- Strategy comparison
- Portfolio analytics

---

## FC-021 Notifications

Supported notification channels:

- Dashboard
- Email
- Telegram
- WhatsApp
- Webhooks

---

# 7. User Stories

### US-001

As a trader,

I want the platform to automatically identify the current market regime,

so that the most appropriate strategy can be selected.

---

### US-002

As a trader,

I want the platform to stop unsafe trading,

so that my capital remains protected.

---

### US-003

As a portfolio manager,

I want to monitor all trading accounts from one dashboard,

so that operational oversight becomes centralized.

---

### US-004

As a strategy developer,

I want to publish my Expert Advisor,

so that users can purchase and activate it.

---

### US-005

As an autonomous trading user,

I want strategy switching to occur only after policy validation,

so that unnecessary transitions do not occur.

---

# 8. Business Rules

- Every execution SHALL originate from the Decision Engine.
- Every decision SHALL pass Policy Engine validation.
- Every Expert Advisor SHALL be managed through the Strategy Orchestrator.
- Every automated decision SHALL be explainable.
- Every strategy SHALL be version controlled.
- Every plugin SHALL be independently installable.
- Every marketplace purchase SHALL require license validation.

---

# 9. Out of Scope (Version 1)

The platform SHALL NOT include:

- Broker infrastructure
- Exchange infrastructure
- Proprietary liquidity
- High-frequency trading
- Automatic source-code generation
- Self-modifying production algorithms
- Direct broker management

---

# 10. Success Criteria

Version 1 SHALL be considered complete when:

- Users can connect MT5 accounts.
- Market Intelligence is operational.
- Strategy Orchestrator is operational.
- Dynamic Strategy Switching is operational.
- Risk Engine is operational.
- Decision Engine is operational.
- Policy Engine is operational.
- Marketplace is operational.
- Licensing is operational.
- Backtesting is operational.
- Explainability is operational.

---

# 11. Dependencies

Depends on:

- 000_Project_Constitution.md
- 001_Project_Charter.md
- 002_Vision_and_Category.md

Referenced by:

- 004_Domain_Model_Specification.md
- 005_Software_Requirements_Specification.md
- System Architecture Bible
- Database Architecture
- API Contracts

---

# 12. Closing Statement

This Product Requirements Document defines the complete business scope of Veerox ATI Version 1.

All engineering specifications, architectural designs, implementation contracts, and software development activities SHALL conform to the requirements established within this document.

**End of Document**