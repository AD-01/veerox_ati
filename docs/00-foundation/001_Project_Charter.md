# VEEROX ATI

**Document ID:** 001  
**Document Name:** Project Charter  
**Version:** 1.0.0  
**Status:** Approved Baseline  
**Classification:** Internal Engineering Document  
**Owner:** Veerox Software  
**Repository:** `/docs/001_Project_Charter.md`

---

# Revision History

| Version | Date | Status | Description |
|----------|------|--------|-------------|
| 1.0.0 | 2026-08-07 | Approved Baseline | Initial approved project charter |

---

# 1. Executive Summary

Veerox Autonomous Trading Intelligence Platform (ATI) is an enterprise-grade, cloud-native trading intelligence platform designed to replace isolated Expert Advisors with a centralized intelligence-driven decision ecosystem.

Instead of relying on a single trading strategy or Expert Advisor, Veerox continuously evaluates market conditions, external intelligence, portfolio exposure, risk constraints, and execution policies before making any trading decision.

The platform is designed to become the central intelligence layer between financial markets and execution platforms while maintaining complete transparency, modularity, scalability, and explainability.

---

# 2. Business Case

Current retail trading solutions suffer from several structural limitations.

Most systems:

- Execute predefined trading rules.
- Operate independently from other strategies.
- Lack portfolio awareness.
- Ignore changing market regimes.
- Offer limited explainability.
- Have poor extensibility.
- Are tightly coupled to a single execution platform.

These limitations increase operational risk, reduce adaptability, and make long-term maintenance difficult.

Veerox ATI addresses these limitations through a centralized decision architecture capable of orchestrating multiple strategies under a unified intelligence framework.

---

# 3. Project Vision

Build the world's most trusted Autonomous Trading Intelligence Platform capable of delivering explainable, policy-driven, and risk-aware trading decisions across multiple brokers, execution environments, and financial markets.

---

# 4. Project Mission

Develop a production-ready enterprise platform that:

- Observes financial markets continuously.
- Understands market context.
- Integrates multiple intelligence sources.
- Selects appropriate trading strategies.
- Protects trading capital.
- Coordinates Expert Advisors.
- Executes validated trading decisions.
- Explains every automated action.
- Supports long-term platform evolution.

---

# 5. Business Objectives

The project SHALL achieve the following objectives.

## Primary Objectives

- Capital preservation.
- Centralized decision making.
- Dynamic strategy orchestration.
- Enterprise-grade risk governance.
- Explainable automation.
- Multi-account management.
- Multi-strategy coordination.
- Plugin ecosystem.

## Secondary Objectives

- SaaS subscription platform.
- EA marketplace.
- Strategy marketplace.
- Plugin marketplace.
- Enterprise licensing.
- White-label deployments.
- Developer ecosystem.

---

# 6. Strategic Goals

## Short-Term Goals

- Establish the core platform architecture.
- Build Market Intelligence.
- Build Risk Intelligence.
- Build Strategy Orchestrator.
- Build Execution Gateway.
- Deliver MT5 integration.
- Deliver Marketplace.
- Deliver Backtesting Center.

## Medium-Term Goals

- Multi-broker support.
- Multi-asset support.
- Mobile platform.
- Enterprise reporting.
- AI Trading Coach.
- Advanced analytics.

## Long-Term Goals

- Institutional platform.
- Public developer SDK.
- Strategy ecosystem.
- Broker ecosystem.
- Multi-exchange execution.
- Enterprise API platform.

---

# 7. Product Scope

The initial platform SHALL include the following capabilities.

## Identity Management

- Authentication
- Authorization
- User Profiles
- Roles
- Permissions
- Organizations

---

## Market Intelligence

- Market regime detection.
- Trend analysis.
- Volatility analysis.
- Liquidity analysis.
- Session analysis.
- Correlation analysis.
- Market health evaluation.

---

## External Intelligence

Support multiple external information providers.

Examples include:

- Economic calendars.
- Financial news.
- Market sentiment.
- Market data providers.

All providers SHALL be integrated through provider adapters.

---

## Strategy Management

- Strategy Registry.
- Strategy Metadata.
- Strategy Lifecycle.
- Strategy Versioning.
- Strategy Activation.
- Strategy Retirement.

---

## Expert Advisor Management

- EA Registry.
- EA Lifecycle.
- EA Health.
- Binary Distribution.
- Source Distribution.
- Version Management.

---

## Strategy Orchestration

The Strategy Orchestrator SHALL:

- Evaluate available strategies.
- Rank strategies.
- Select active strategies.
- Pause strategies.
- Resume strategies.
- Retire strategies.
- Coordinate multiple EAs.
- Execute transition policies.

---

## Dynamic Strategy Switching

The platform SHALL continuously monitor:

- Market regime.
- Risk conditions.
- Portfolio state.
- Open positions.
- News impact.
- Liquidity.
- Spread conditions.

Strategy transitions SHALL occur only after Policy Engine approval.

---

## Risk Intelligence

The platform SHALL manage:

- Position sizing.
- Portfolio exposure.
- Drawdown protection.
- Margin protection.
- Daily limits.
- Weekly limits.
- Monthly limits.
- Symbol exposure.
- Currency exposure.
- Strategy exposure.

---

## Decision Intelligence

The Decision Engine SHALL determine:

- Trade
- Hold
- Wait
- Reject
- Pause
- Reduce Risk
- Switch Strategy
- Close Positions

---

## Policy Engine

The Policy Engine SHALL validate:

- Trading sessions.
- Risk limits.
- Portfolio constraints.
- News restrictions.
- Broker restrictions.
- Strategy permissions.
- User permissions.

No execution SHALL bypass policy validation.

---

## Execution Gateway

Responsibilities include:

- Order validation.
- Execution routing.
- Retry handling.
- Execution logging.
- Response handling.
- Connector communication.

---

## Trading Connectors

Version 1 SHALL support:

- MetaTrader 5

Future versions MAY support:

- MetaTrader 4
- cTrader
- FIX
- Exchange APIs

Execution connectors SHALL remain free of business logic.

---

## Portfolio Intelligence

Capabilities include:

- Portfolio monitoring.
- Capital allocation.
- Risk aggregation.
- Multi-account management.
- Strategy allocation.
- Asset allocation.

---

## Marketplace

Marketplace SHALL support:

- Expert Advisors.
- Trading Strategies.
- Plugins.
- Indicators.
- Risk Models.
- Source Code Packages.

Supported commercial models:

- Purchase.
- Subscription.
- Rental.
- Trial.

---

## Licensing

Supported licenses:

- Trial
- Monthly
- Annual
- Lifetime
- Enterprise

Cloud validation SHALL be mandatory.

---

## Backtesting

Capabilities include:

- Historical replay.
- Tick simulation.
- Spread simulation.
- Commission simulation.
- Slippage simulation.
- Walk-forward testing.
- Strategy comparison.
- Portfolio backtesting.

---

## Analytics

Analytics SHALL provide:

- Equity curves.
- Drawdown reports.
- Profit factor.
- Win rate.
- Expectancy.
- Recovery factor.
- Strategy comparison.
- Portfolio reports.

---

## Notification System

Supported delivery channels:

- Dashboard
- Email
- Telegram
- WhatsApp
- Webhooks

---

# 8. Out of Scope

Version 1 SHALL NOT include:

- Broker infrastructure.
- Exchange infrastructure.
- High-frequency trading.
- Proprietary market data network.
- Autonomous business rule generation.
- Automatic source-code modification.
- Self-modifying production algorithms.

---

# 9. Target Users

The platform SHALL support:

- Retail Traders
- Professional Traders
- Prop Firm Traders
- Portfolio Managers
- Fund Managers
- EA Developers
- Enterprise Customers

---

# 10. Business Value

Veerox ATI delivers value by:

- Improving decision quality.
- Reducing trading risk.
- Centralizing strategy management.
- Increasing operational transparency.
- Reducing manual intervention.
- Enabling enterprise scalability.
- Simplifying long-term maintenance.

---

# 11. Project Deliverables

The project SHALL deliver:

- Cloud Platform
- Administration Portal
- Trading Dashboard
- Market Intelligence Engine
- Risk Intelligence Engine
- Strategy Orchestrator
- Decision Engine
- Policy Engine
- Execution Gateway
- MT5 Connector
- Plugin Framework
- Marketplace
- Licensing System
- Backtesting Platform
- Analytics Platform
- Notification Platform
- Developer SDK
- REST API
- WebSocket Infrastructure
- Complete Engineering Documentation
- Claude Code Prompt Library

---

# 12. Success Criteria

Version 1 SHALL be considered successful when:

- Core architecture is operational.
- All mandatory intelligence engines are functional.
- Strategy orchestration is operational.
- Dynamic strategy switching is functional.
- MT5 execution is stable.
- Marketplace is operational.
- Licensing is operational.
- Backtesting is operational.
- Explainability is available.
- Audit logging is complete.
- Documentation is complete.
- Production deployment is successful.

---

# 13. Risks

Major project risks include:

- Poor architecture decisions.
- Inconsistent business rules.
- External provider dependency.
- Broker integration limitations.
- Performance bottlenecks.
- Strategy transition failures.
- Insufficient testing.
- Security vulnerabilities.

Each risk SHALL be addressed within dedicated engineering specifications.

---

# 14. Assumptions

The following assumptions apply:

- External data providers expose reliable interfaces.
- Users possess supported trading accounts.
- Cloud infrastructure is continuously available.
- Plugin architecture remains the primary extension mechanism.
- Business rules remain configuration-driven.

---

# 15. Constraints

The project SHALL comply with:

- Project Constitution.
- Architecture Decision Records.
- Approved Product Requirements.
- Software Requirements Specification.
- Security Standards.
- Documentation Standards.

---

# 16. Dependencies

This document depends on:

- 000_Project_Constitution.md

Future documents depending on this charter include:

- Vision & Category Design
- Product Requirements Document
- Domain Model Specification
- Software Requirements Specification
- Architecture Bible
- Database Architecture
- API Contracts
- Module Specifications

---

# 17. Acceptance Criteria

This Project Charter SHALL be approved when:

- Business objectives are clearly defined.
- Product scope is fully established.
- Success criteria are measurable.
- Deliverables are identified.
- Constraints are documented.
- Risks are acknowledged.
- Dependencies are identified.

---

# 18. Closing Statement

The Project Charter formally authorizes the development of Veerox Autonomous Trading Intelligence Platform as an enterprise software engineering program.

All future planning, product decisions, engineering specifications, architectural designs, implementation contracts, and software development activities SHALL comply with this charter.

**End of Document**