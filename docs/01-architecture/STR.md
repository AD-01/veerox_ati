# VEEROX ATI

**Document ID:** 010  
**Document:** Software Requirements Specification (SRS)  
**Chapter:** Strategy Intelligence Requirements  
**Version:** 2.0.0

---

# STRATEGY REQUIREMENTS

---

## STR-001 — Strategy Registration

### Requirement

The system SHALL maintain a centralized Strategy Registry containing all trading strategies available to the platform.

### Priority

Critical

### Source

Business Requirement

### Preconditions

- Strategy package passes validation.
- Strategy metadata is complete.

### Postconditions

- Strategy becomes available for deployment.

### Acceptance Criteria

Every strategy SHALL contain:

- Strategy ID
- Name
- Version
- Description
- Author
- Supported Assets
- Supported Symbols
- Supported Timeframes
- Risk Profile
- Required Indicators
- Required Market Conditions
- Status

---

## STR-002 — Strategy Versioning

### Requirement

The system SHALL support immutable strategy versioning.

### Acceptance Criteria

- Every published version SHALL receive a unique version identifier.
- Previous versions SHALL remain available.
- Active executions SHALL NOT automatically migrate to newer versions.

---

## STR-003 — Strategy Lifecycle

### Requirement

The system SHALL support the following strategy lifecycle states:

- Draft
- Testing
- Approved
- Active
- Suspended
- Archived
- Deprecated

### Acceptance Criteria

Invalid state transitions SHALL be rejected.

---

## STR-004 — Strategy Compatibility Validation

### Requirement

The system SHALL validate strategy compatibility before activation.

### Acceptance Criteria

Validation SHALL include:

- Asset compatibility
- Symbol compatibility
- Timeframe compatibility
- EA compatibility
- Connector compatibility
- License validation

---

## STR-005 — Strategy Activation

### Requirement

Only approved strategies SHALL be activated.

### Acceptance Criteria

Strategy activation SHALL generate a StrategyActivated event.

---

## STR-006 — Strategy Suspension

### Requirement

The platform SHALL allow active strategies to be suspended without deletion.

### Acceptance Criteria

Suspended strategies SHALL NOT generate new trade signals.

Existing positions SHALL remain under policy control.

---

## STR-007 — Strategy Retirement

### Requirement

The platform SHALL support permanent retirement of deprecated strategies.

### Acceptance Criteria

Retired strategies SHALL remain available for historical analysis.

---

## STR-008 — Strategy Performance Tracking

### Requirement

The system SHALL maintain historical performance metrics for every strategy.

### Acceptance Criteria

Metrics SHALL include:

- Net Profit
- Win Rate
- Profit Factor
- Maximum Drawdown
- Recovery Factor
- Average Trade Duration
- Average Risk
- Average Reward

---

## STR-009 — Strategy Metadata Search

### Requirement

The system SHALL support searchable strategy metadata.

### Acceptance Criteria

Search SHALL support:

- Name
- Symbol
- Asset Class
- Author
- Risk Profile
- Tags
- Status

---

## STR-010 — Strategy Event Publishing

### Requirement

The platform SHALL publish lifecycle events for every strategy state transition.

### Acceptance Criteria

Events SHALL be versioned.

---

# EXPERT ADVISOR REQUIREMENTS

---

## EA-001 — Expert Advisor Registration

### Requirement

The platform SHALL maintain a centralized Expert Advisor Registry.

### Acceptance Criteria

Every EA SHALL include:

- EA ID
- Version
- Binary Package
- Digital Signature
- Supported Strategies
- Compatible Connectors
- License Requirements

---

## EA-002 — Expert Advisor Validation

### Requirement

The platform SHALL validate every Expert Advisor before deployment.

### Acceptance Criteria

Validation SHALL include:

- Binary integrity
- Digital signature
- Version compatibility
- Dependency validation

---

## EA-003 — Expert Advisor Deployment

### Requirement

The platform SHALL deploy validated Expert Advisors to approved execution environments.

### Acceptance Criteria

Deployment SHALL generate deployment history.

---

## EA-004 — Expert Advisor Assignment

### Requirement

The platform SHALL associate one or more Expert Advisors with compatible strategies.

### Acceptance Criteria

Invalid assignments SHALL be rejected.

---

## EA-005 — Manual EA Selection

### Requirement

Authorized users SHALL manually assign a specific Expert Advisor to a workspace, portfolio, trading account, or strategy.

### Business Rationale

Support professional traders who prefer explicit execution control instead of automatic EA selection.

### Acceptance Criteria

- Manual selection SHALL override automatic EA selection until revoked.
- The selected EA SHALL still pass policy validation before execution.
- Manual assignments SHALL be fully audited.
- Users SHALL be warned if the selected EA is incompatible with the current market regime.

---

## EA-006 — Dynamic EA Selection

### Requirement

The platform SHALL automatically select the most suitable Expert Advisor based on current market conditions.

### Acceptance Criteria

Selection SHALL consider:

- Current Market Regime
- Strategy Compatibility
- Risk Profile
- Historical Performance
- Workspace Policy
- Portfolio Risk
- License Availability

---

## EA-007 — EA Health Monitoring

### Requirement

The platform SHALL continuously monitor operational health of deployed Expert Advisors.

### Acceptance Criteria

Health SHALL include:

- Running
- Paused
- Failed
- Restarting
- Disconnected

---

## EA-008 — EA Source Code Distribution

### Requirement

The Marketplace SHALL support distribution of Expert Advisor source code where permitted by the product license.

### Business Rationale

Support commercial sale of both compiled Expert Advisors and source code packages.

### Acceptance Criteria

- Source code SHALL only be downloadable after successful license validation.
- Download authorization SHALL be checked before every download.
- Every download SHALL be recorded in the audit log.
- Products marked as Binary Only SHALL never expose source code.

---

# STRATEGY ORCHESTRATOR REQUIREMENTS

---

## SO-001 — Strategy Evaluation

### Requirement

The Strategy Orchestrator SHALL continuously evaluate all eligible strategies for the current market.

### Acceptance Criteria

Evaluation SHALL occur whenever:

- Market Snapshot changes.
- Risk changes.
- Portfolio changes.
- Policy changes.
- News impact changes.

---

## SO-002 — Strategy Ranking

### Requirement

The Strategy Orchestrator SHALL rank candidate strategies before selection.

### Acceptance Criteria

Ranking SHALL consider:

- Market suitability
- Historical performance
- Current risk
- Confidence
- Policy compliance

---

## SO-003 — Strategy Selection

### Requirement

The Strategy Orchestrator SHALL select the highest-ranked eligible strategy for the current trading context.

### Acceptance Criteria

Only one Primary Strategy SHALL control a trading context unless Multi-Strategy Mode is explicitly enabled.

---

## SO-004 — Strategy Switching

### Requirement

The Strategy Orchestrator SHALL support controlled strategy transitions.

### Acceptance Criteria

Transitions SHALL occur only after:

- Risk validation
- Policy approval
- Portfolio evaluation

---

## SO-005 — Open Position Evaluation

### Requirement

Before replacing an active strategy, the Strategy Orchestrator SHALL evaluate every open position created by the currently active Expert Advisor.

### Business Rationale

Prevent unnecessary position closure and preserve profitable opportunities during changing market conditions.

### Acceptance Criteria

Each open position SHALL be classified as one of the following:

- Continue Under Current Strategy
- Transfer Monitoring to New Strategy
- Close Immediately
- Close When Profit Target Is Reached
- Close According To Risk Policy

The classification SHALL be recorded as part of the decision history.

---

## SO-006 — Dynamic Strategy Transition

### Requirement

When market conditions change, the Strategy Orchestrator SHALL determine whether to retain, pause, replace, or terminate the currently active strategy.

### Business Rationale

Adapt trading behavior to changing market conditions while minimizing unnecessary executions.

### Acceptance Criteria

The evaluation SHALL consider:

- Market Regime Change
- Volatility Change
- Liquidity Change
- High Impact News
- Portfolio Exposure
- Drawdown
- Confidence Score

Every transition SHALL be approved by the Policy Domain before execution.

---

## SO-007 — Automatic EA Replacement

### Requirement

When a new strategy is selected, the platform SHALL automatically assign the most appropriate compatible Expert Advisor.

### Acceptance Criteria

- Existing execution SHALL be synchronized.
- Previous EA state SHALL be archived.
- New EA activation SHALL be audited.

---

## SO-008 — Manual Override

### Requirement

Authorized users SHALL override automatic strategy selection.

### Acceptance Criteria

Manual overrides SHALL:

- Be permission-controlled.
- Be time-limited if configured.
- Be recorded in audit history.
- Display active override status in the dashboard.

---

## SO-009 — Strategy Recommendation History

### Requirement

The platform SHALL retain the history of all strategy evaluations and recommendations.

### Acceptance Criteria

Every evaluation SHALL include:

- Candidate Strategies
- Ranking Scores
- Selected Strategy
- Rejected Strategies
- Decision Timestamp

---

## SO-010 — Strategy Orchestrator Events

### Requirement

The Strategy Orchestrator SHALL publish versioned domain events for every strategy evaluation, selection, transition, suspension, and replacement.

### Acceptance Criteria

Events SHALL be consumable by:

- Decision Domain
- Analytics Domain
- Audit Domain
- Notification Domain

---

# Chapter Summary

This chapter defines the Strategy Intelligence Layer, including:

- Strategy lifecycle management
- Expert Advisor lifecycle
- Automatic and manual EA selection
- Dynamic strategy orchestration
- Market-aware strategy switching
- Open-position transition management
- Source code distribution through Marketplace
- Strategy recommendation history

These requirements establish the intelligence layer responsible for selecting **what should trade**, while leaving **whether it may trade** to the Policy Domain and **how it trades** to the Execution Domain.

**End of Strategy Intelligence Requirements**