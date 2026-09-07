# VEEROX ATI

**Document ID:** 010  
**Document:** Software Requirements Specification (SRS)  
**Chapter:** Decision Intelligence, Policy Engine & Execution Requirements  
**Version:** 2.0.0

---

# DECISION ENGINE REQUIREMENTS

---

## DEC-001 — Decision Request Processing

### Requirement

The Decision Engine SHALL process every eligible trading opportunity received from the Strategy Orchestrator.

### Priority

Critical

### Source

Business Requirement

### Preconditions

- Strategy evaluation completed.
- Market Snapshot available.
- Risk evaluation completed.

### Postconditions

- Decision object created.

### Acceptance Criteria

Every Decision SHALL receive a globally unique Decision ID.

---

## DEC-002 — Decision Context Assembly

### Requirement

The Decision Engine SHALL assemble all required contextual information before generating a decision.

### Acceptance Criteria

The context SHALL include:

- Market Snapshot
- Strategy
- Expert Advisor
- Portfolio
- Risk Assessment
- Open Positions
- Pending Orders
- News Status
- Economic Calendar Status
- Workspace Configuration

---

## DEC-003 — Decision Generation

### Requirement

The Decision Engine SHALL generate exactly one primary decision for each evaluation cycle.

### Acceptance Criteria

Supported decisions:

- Execute Trade
- Reject Trade
- Wait
- Pause Strategy
- Resume Strategy
- Close Position
- Reduce Position
- Replace Strategy

Only one Primary Decision SHALL exist for a Decision Context.

---

## DEC-004 — Decision Confidence

### Requirement

The Decision Engine SHALL calculate a Decision Confidence Score.

### Acceptance Criteria

The score SHALL consider:

- Market Confidence
- Strategy Confidence
- Risk Score
- Data Quality
- Historical Performance

Range:

0–100

---

## DEC-005 — Decision Explainability

### Requirement

Every generated decision SHALL contain a structured explanation.

### Acceptance Criteria

The explanation SHALL identify:

- Why the decision was generated.
- Which market conditions were evaluated.
- Which strategy was selected.
- Which policies affected the outcome.
- Which risk factors influenced the result.

---

## DEC-006 — Decision History

### Requirement

The platform SHALL permanently retain every generated Decision.

### Acceptance Criteria

Decision history SHALL be searchable.

---

## DEC-007 — Decision Timeline

### Requirement

The platform SHALL maintain a chronological timeline for every Decision.

### Acceptance Criteria

Timeline SHALL include:

- Market Snapshot
- Strategy Evaluation
- Risk Evaluation
- Policy Validation
- Execution Result

---

## DEC-008 — Decision Events

### Requirement

The Decision Domain SHALL publish versioned Decision events.

### Acceptance Criteria

Supported events:

- DecisionGenerated
- DecisionApproved
- DecisionRejected
- DecisionExpired

---

# POLICY ENGINE REQUIREMENTS

---

## POL-001 — Mandatory Policy Validation

### Requirement

Every Decision SHALL be validated by the Policy Engine before execution.

### Priority

Critical

### Acceptance Criteria

Execution SHALL NOT occur without successful policy approval.

---

## POL-002 — Policy Rule Evaluation

### Requirement

The Policy Engine SHALL evaluate all active policy rules applicable to the current Decision Context.

### Acceptance Criteria

Rules MAY include:

- Risk Policies
- Organization Policies
- Workspace Policies
- Strategy Policies
- Portfolio Policies
- Compliance Policies
- Emergency Policies

---

## POL-003 — Trading Session Policy

### Requirement

The Policy Engine SHALL validate whether trading is permitted during the current market session.

### Acceptance Criteria

Restricted sessions SHALL prevent new execution.

---

## POL-004 — News Protection Policy

### Requirement

The Policy Engine SHALL evaluate High Impact News before approving execution.

### Acceptance Criteria

Configured news protection rules SHALL be enforced automatically.

---

## POL-005 — Emergency Policy

### Requirement

The Policy Engine SHALL support emergency operational policies.

### Acceptance Criteria

Emergency policies MAY:

- Pause Automation
- Reject Execution
- Close Positions
- Reduce Exposure
- Disable Strategy

---

## POL-006 — Policy Decision

### Requirement

Every Policy evaluation SHALL produce exactly one result.

### Acceptance Criteria

Possible outcomes:

- Approved
- Rejected
- Manual Approval Required

---

## POL-007 — Policy Versioning

### Requirement

Policy definitions SHALL be version-controlled.

### Acceptance Criteria

Historical policy versions SHALL remain available.

---

## POL-008 — Policy Audit

### Requirement

Every policy evaluation SHALL generate an immutable audit record.

---

# EXECUTION REQUIREMENTS

---

## EXEC-001 — Execution Request Creation

### Requirement

The Execution Domain SHALL create an Execution Request only after successful Policy approval.

### Priority

Critical

### Acceptance Criteria

Execution Requests SHALL include:

- Decision ID
- Strategy ID
- EA ID
- Trading Account
- Symbol
- Volume
- Order Type

---

## EXEC-002 — Execution Validation

### Requirement

The Execution Domain SHALL validate every Execution Request before transmission.

### Acceptance Criteria

Validation SHALL include:

- Symbol
- Account Status
- Connector Status
- Position Size
- Order Parameters

---

## EXEC-003 — Order Submission

### Requirement

The platform SHALL submit validated execution requests to the configured Connector.

### Acceptance Criteria

Submission SHALL be idempotent.

Duplicate submissions SHALL be prevented.

---

## EXEC-004 — Order Status Tracking

### Requirement

The platform SHALL continuously monitor execution status.

### Acceptance Criteria

Supported statuses:

- Pending
- Accepted
- Executed
- Partially Executed
- Rejected
- Cancelled
- Expired

---

## EXEC-005 — Position Synchronization

### Requirement

The platform SHALL synchronize every executed position with the connected trading platform.

### Acceptance Criteria

Synchronization SHALL include:

- Entry Price
- Stop Loss
- Take Profit
- Volume
- Profit/Loss
- Swap
- Commission

---

## EXEC-006 — Position Modification

### Requirement

The platform SHALL support post-execution position management.

### Acceptance Criteria

Supported operations:

- Modify Stop Loss
- Modify Take Profit
- Break Even
- Trailing Stop
- Partial Close
- Full Close

---

## EXEC-007 — Pending Order Management

### Requirement

The platform SHALL manage pending orders throughout their lifecycle.

### Acceptance Criteria

Supported operations:

- Create
- Modify
- Cancel
- Expire

---

## EXEC-008 — Intelligent Position Exit

### Requirement

The platform SHALL continuously evaluate active positions after execution.

### Business Rationale

Allow the platform to intelligently manage positions when market conditions change.

### Acceptance Criteria

Evaluation SHALL consider:

- Current Market Regime
- Risk Score
- News Events
- Strategy Status
- Portfolio Exposure
- Profit Target
- Stop Loss Policy

Possible outcomes:

- Hold Position
- Close Position
- Partial Close
- Transfer Management
- Apply Trailing Stop

---

## EXEC-009 — Strategy Transition Execution

### Requirement

When the Strategy Orchestrator replaces an active strategy, the Execution Domain SHALL safely transition execution responsibilities.

### Business Rationale

Prevent inconsistent execution during dynamic strategy switching.

### Acceptance Criteria

The transition SHALL include:

- Active Position Review
- Pending Order Review
- EA Replacement
- State Synchronization
- Audit Record Generation

---

## EXEC-010 — Autonomous Execution

### Requirement

The platform SHALL support fully autonomous trade execution.

### Acceptance Criteria

Autonomous execution SHALL require:

- Approved Decision
- Approved Policy
- Healthy Connector
- Active License
- Authorized Automation Mode

---

## EXEC-011 — Manual Execution

### Requirement

The platform SHALL support manual approval before execution.

### Acceptance Criteria

Execution SHALL remain pending until approved or expired.

---

## EXEC-012 — Emergency Stop

### Requirement

The platform SHALL support immediate suspension of new executions.

### Acceptance Criteria

Emergency Stop SHALL:

- Reject new execution requests.
- Preserve execution history.
- Notify administrators.
- Maintain synchronization with open positions.

---

## EXEC-013 — Execution Recovery

### Requirement

Following connector failures or system interruptions, the platform SHALL automatically reconcile execution state.

### Acceptance Criteria

Recovery SHALL include:

- Position Synchronization
- Pending Order Synchronization
- Trade History Verification
- Account Balance Verification

---

## EXEC-014 — Multi-Account Execution

### Requirement

The platform SHALL support simultaneous execution across multiple managed trading accounts.

### Acceptance Criteria

Execution SHALL remain isolated per account while preserving centralized orchestration.

---

## EXEC-015 — Execution Events

### Requirement

The Execution Domain SHALL publish versioned execution events.

### Acceptance Criteria

Supported events:

- OrderSubmitted
- OrderExecuted
- OrderRejected
- PositionOpened
- PositionModified
- PositionClosed
- ExecutionRecovered

---

# MT5 CONNECTOR REQUIREMENTS

---

## CONN-001 — MT5 Connector Registration

### Requirement

The platform SHALL support one or more MetaTrader 5 Connector instances.

### Acceptance Criteria

Each connector SHALL have a unique Connector ID.

---

## CONN-002 — Trading Account Connection

### Requirement

The Connector SHALL establish and maintain authenticated communication with configured MetaTrader 5 terminals.

### Acceptance Criteria

Connection health SHALL be monitored continuously.

---

## CONN-003 — Real-Time Synchronization

### Requirement

The Connector SHALL synchronize:

- Orders
- Positions
- Deals
- Balance
- Equity
- Margin

with minimal latency.

---

## CONN-004 — Connector Health

### Requirement

The platform SHALL continuously evaluate Connector operational health.

### Acceptance Criteria

Health metrics SHALL include:

- Availability
- Latency
- Synchronization Delay
- Failure Count
- Recovery Status

---

## CONN-005 — Connector Isolation

### Requirement

The Connector SHALL NOT contain business rules, decision logic, or risk evaluation.

### Acceptance Criteria

The Connector SHALL function exclusively as an execution communication layer between Veerox ATI and MetaTrader 5.

---

# Chapter Summary

This chapter defines the complete execution pipeline of Veerox ATI:

**Strategy Intelligence → Decision Engine → Policy Engine → Execution Engine → MT5 Connector → MetaTrader 5**

The architecture enforces that no trade reaches MetaTrader without passing through all mandatory validation layers, preserving the platform's **Capital First** philosophy while enabling fully autonomous execution.

**End of Decision, Policy & Execution Requirements**