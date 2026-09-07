# VEEROX ATI

**Document ID:** 010  
**Document:** Software Requirements Specification (SRS)  
**Chapter:** Risk Intelligence & Portfolio Requirements  
**Version:** 2.0.0

---

# RISK MANAGEMENT REQUIREMENTS

---

## RISK-001 — Pre-Trade Risk Evaluation

### Requirement

The system SHALL perform a complete risk evaluation before every trade execution request.

### Priority

Critical

### Source

Business Requirement

### Preconditions

- Trading decision has been generated.
- Market Snapshot is available.
- Portfolio state is synchronized.

### Postconditions

- A Risk Assessment SHALL be produced.

### Acceptance Criteria

The evaluation SHALL include:

- Account Risk
- Portfolio Risk
- Symbol Risk
- Currency Exposure
- Margin Risk
- Drawdown Risk
- Correlation Risk
- Strategy Risk

No execution SHALL proceed without a completed Risk Assessment.

---

## RISK-002 — Risk Score Calculation

### Requirement

The platform SHALL calculate a normalized Risk Score for every execution request.

### Acceptance Criteria

Risk Score SHALL range from:

```text
0 – 100
```

Where:

- 0–20 = Very Low Risk
- 21–40 = Low Risk
- 41–60 = Moderate Risk
- 61–80 = High Risk
- 81–100 = Critical Risk

---

## RISK-003 — Dynamic Position Sizing

### Requirement

The platform SHALL determine recommended position size using configurable risk models.

### Acceptance Criteria

Calculation SHALL consider:

- Account Balance
- Equity
- Free Margin
- Maximum Risk %
- Stop Loss Distance
- Market Volatility
- Portfolio Exposure
- Strategy Risk Profile

---

## RISK-004 — Daily Risk Limit

### Requirement

The platform SHALL enforce configurable daily risk limits.

### Acceptance Criteria

When the configured daily risk threshold is reached:

- New execution SHALL be blocked.
- Existing positions SHALL remain under policy control.
- A RiskLimitReached event SHALL be published.

---

## RISK-005 — Weekly Risk Limit

### Requirement

The system SHALL support weekly portfolio risk limits.

### Acceptance Criteria

Weekly limits SHALL be independently configurable.

---

## RISK-006 — Monthly Risk Limit

### Requirement

The system SHALL support monthly portfolio risk limits.

### Acceptance Criteria

Monthly limits SHALL be evaluated independently of daily and weekly limits.

---

## RISK-007 — Drawdown Protection

### Requirement

The platform SHALL continuously monitor account and portfolio drawdown.

### Acceptance Criteria

Drawdown SHALL support:

- Absolute Drawdown
- Relative Drawdown
- Daily Drawdown
- Weekly Drawdown
- Monthly Drawdown

---

## RISK-008 — Equity Protection

### Requirement

The system SHALL continuously monitor account equity.

### Acceptance Criteria

Configured equity thresholds MAY trigger:

- Position Reduction
- Trading Suspension
- Emergency Stop
- Administrator Notification

---

## RISK-009 — Margin Protection

### Requirement

The platform SHALL prevent execution when projected margin utilization exceeds configured limits.

### Acceptance Criteria

Margin calculations SHALL occur before execution approval.

---

## RISK-010 — Correlation Risk

### Requirement

The platform SHALL evaluate correlation between existing and proposed positions.

### Acceptance Criteria

Correlation SHALL consider:

- Currency correlation
- Symbol correlation
- Strategy correlation
- Portfolio correlation

---

## RISK-011 — Exposure Limits

### Requirement

The platform SHALL enforce configurable exposure limits.

### Acceptance Criteria

Limits SHALL be configurable by:

- Symbol
- Currency
- Strategy
- Portfolio
- Workspace

---

## RISK-012 — Risk Policy Override

### Requirement

The platform SHALL support controlled risk overrides for authorized users.

### Acceptance Criteria

Every override SHALL:

- Require permission
- Record justification
- Generate audit records
- Expire according to policy

---

## RISK-013 — AI Risk Recommendation

### Requirement

The AI Risk Engine SHALL generate advisory recommendations based on current market conditions and portfolio state.

### Business Rationale

Provide intelligent decision support without bypassing mandatory risk controls.

### Acceptance Criteria

Recommendations MAY include:

- Reduce Position Size
- Delay Entry
- Close Partial Position
- Pause Strategy
- Reduce Portfolio Exposure

Recommendations SHALL NOT override mandatory risk policies.

---

## RISK-014 — Risk Evaluation History

### Requirement

The system SHALL permanently retain every completed Risk Assessment.

### Acceptance Criteria

Each assessment SHALL include:

- Inputs
- Calculated Scores
- Policies Applied
- Decision Outcome
- Timestamp

---

## RISK-015 — Risk Events

### Requirement

The platform SHALL publish versioned Risk Domain events.

### Acceptance Criteria

Supported events SHALL include:

- RiskCalculated
- RiskLimitReached
- DrawdownExceeded
- ExposureExceeded
- MarginWarning
- EmergencyRiskState

---

# PORTFOLIO REQUIREMENTS

---

## PORT-001 — Portfolio Creation

### Requirement

The platform SHALL support creation of one or more trading portfolios.

### Acceptance Criteria

Each portfolio SHALL have a unique identifier.

---

## PORT-002 — Trading Account Assignment

### Requirement

One or more trading accounts SHALL be assignable to a portfolio.

### Acceptance Criteria

Account assignments SHALL be validated before activation.

---

## PORT-003 — Portfolio Capital Allocation

### Requirement

The platform SHALL allocate capital across strategies according to configurable allocation models.

### Acceptance Criteria

Supported allocation models SHALL include:

- Fixed Allocation
- Equal Allocation
- Risk Weighted
- Percentage Based
- Manual Allocation

---

## PORT-004 — Portfolio Health Score

### Requirement

The platform SHALL calculate a Portfolio Health Score.

### Acceptance Criteria

The score SHALL consider:

- Risk Utilization
- Drawdown
- Diversification
- Margin Utilization
- Strategy Distribution
- Exposure
- Account Health

---

## PORT-005 — Multi-Account Synchronization

### Requirement

The platform SHALL continuously synchronize all accounts assigned to a portfolio.

### Acceptance Criteria

Synchronization SHALL include:

- Balance
- Equity
- Margin
- Open Positions
- Closed Positions
- Orders

---

## PORT-006 — Portfolio Rebalancing

### Requirement

The platform SHALL support automatic and manual portfolio rebalancing.

### Acceptance Criteria

Rebalancing SHALL require policy validation before execution.

---

## PORT-007 — Portfolio Diversification Analysis

### Requirement

The platform SHALL continuously evaluate portfolio diversification.

### Acceptance Criteria

Analysis SHALL include:

- Currency Distribution
- Symbol Distribution
- Strategy Distribution
- Market Regime Distribution

---

## PORT-008 — Portfolio Performance

### Requirement

The platform SHALL calculate comprehensive portfolio performance metrics.

### Acceptance Criteria

Metrics SHALL include:

- Net Profit
- Return %
- Profit Factor
- Recovery Factor
- Maximum Drawdown
- Average Trade
- Win Rate

---

## PORT-009 — Multi-Broker Portfolio

### Requirement

The platform SHALL support portfolios containing accounts from multiple supported brokers.

### Acceptance Criteria

Broker-specific implementation details SHALL remain abstracted through the Connector Domain.

---

## PORT-010 — Portfolio State Synchronization

### Requirement

The platform SHALL ensure that portfolio state remains synchronized with connected trading platforms.

### Acceptance Criteria

Synchronization SHALL detect:

- Missing Positions
- Missing Orders
- Balance Mismatch
- Margin Mismatch
- Execution Mismatch

---

## PORT-011 — Portfolio AI Optimization

### Requirement

The platform SHALL generate AI-assisted portfolio optimization recommendations.

### Business Rationale

Help users optimize capital allocation across multiple accounts and strategies.

### Acceptance Criteria

Recommendations MAY include:

- Reallocate Capital
- Replace Strategy
- Disable Underperforming EA
- Reduce Exposure
- Increase Diversification

Recommendations SHALL be advisory only.

---

## PORT-012 — Portfolio Event Publishing

### Requirement

The platform SHALL publish Portfolio Domain events whenever significant portfolio state changes occur.

### Acceptance Criteria

Events SHALL include:

- PortfolioCreated
- PortfolioUpdated
- PortfolioRebalanced
- PortfolioHealthChanged
- PortfolioRiskChanged

---

# Chapter Summary

This chapter defines the Risk Intelligence and Portfolio Management capabilities of Veerox ATI.

These requirements establish the platform's **Capital-First Architecture**, ensuring that every trading decision is evaluated for risk before execution and that all managed accounts are coordinated as intelligent portfolios rather than isolated trading accounts.

The Risk Domain SHALL always act as a mandatory control layer between Strategy Intelligence and the Decision Domain.

**End of Risk Intelligence & Portfolio Requirements**