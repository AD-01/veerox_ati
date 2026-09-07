# VEEROX ATI

**Document ID:** 016  
**Document Name:** MT5 Agent Communication Protocol Specification (MACPS)  
**Version:** 1.0.0  
**Chapter:** Command Protocol, Synchronization Engine, EA Deployment, Security & Recovery

---

# 13. Command Execution Protocol

The Veerox Agent SHALL execute only commands that originate from the Veerox ATI Platform.

The Agent SHALL NOT generate trading commands autonomously.

---

## 13.1 Command Lifecycle

```text id="command-lifecycle"
Platform
    │
    ▼
Command Created
    │
    ▼
Command Signed
    │
    ▼
Command Delivered
    │
    ▼
Agent Validates
    │
    ▼
Command Queued
    │
    ▼
MT5 Executes
    │
    ▼
Execution Result Returned
    │
    ▼
Platform Updated
```

Every command SHALL have a unique `commandId` and SHALL be processed exactly once from the Agent's perspective (idempotent handling).

---

## 13.2 Supported Commands

| Command | Description |
|---------|-------------|
| ExecuteTrade | Open a new position |
| ModifyPosition | Update SL/TP or volume |
| ClosePosition | Close an open position |
| ClosePartial | Partial position close |
| CancelOrder | Cancel pending order |
| InstallEA | Install Expert Advisor |
| UpdateEA | Update Expert Advisor |
| RemoveEA | Remove Expert Advisor |
| RestartTerminal | Restart MT5 terminal |
| RestartAgent | Restart Veerox Agent |
| Synchronize | Trigger immediate synchronization |

---

## 13.3 Command Payload

```json id="command-payload"
{
  "commandId": "cmd_001",
  "commandType": "ExecuteTrade",
  "accountId": "acc_001",
  "symbol": "XAUUSD",
  "direction": "BUY",
  "volume": 0.50,
  "price": 3350.25,
  "stopLoss": 3345.00,
  "takeProfit": 3362.50,
  "expiresAt": "2026-08-07T10:05:00Z"
}
```

---

# 14. Trade Execution Protocol

Execution SHALL follow the sequence below.

```text id="trade-sequence"
Receive Command
        │
        ▼
Validate Signature
        │
        ▼
Validate Account
        │
        ▼
Validate Terminal
        │
        ▼
Submit Order to MT5
        │
        ▼
Receive Broker Response
        │
        ▼
Persist Local Result
        │
        ▼
Send Result to Platform
```

The Agent SHALL immediately report:

- Acceptance
- Rejection
- Partial Fill
- Complete Fill
- Failure
- Timeout

---

# 15. Synchronization Engine

The Synchronization Engine maintains consistency between the Platform and MetaTrader.

Synchronization SHALL support:

- Full Synchronization
- Incremental Synchronization
- Manual Synchronization
- Automatic Synchronization
- Recovery Synchronization

---

## 15.1 Synchronization Scope

The following entities SHALL be synchronized:

- Accounts
- Orders
- Deals
- Positions
- Trade History
- Symbol Specifications
- Terminal Status
- Account Statistics

---

## 15.2 Synchronization Frequency

| Entity | Default Interval |
|---------|------------------|
| Heartbeat | 30 Seconds |
| Account Summary | 30 Seconds |
| Open Positions | 5 Seconds |
| Orders | 5 Seconds |
| Deals | Real-Time |
| Trade History | 5 Minutes |
| Symbol Metadata | 24 Hours |

Intervals SHALL be configurable by the Platform.

---

## 15.3 Reconciliation

The Agent SHALL detect:

- Missing Orders
- Missing Positions
- Missing Deals
- Volume Mismatches
- Price Mismatches
- Unexpected Position Closures

Every mismatch SHALL generate a reconciliation report for the Platform.

---

# 16. Expert Advisor Deployment Protocol

The Agent SHALL manage the complete lifecycle of Expert Advisors.

---

## Deployment Flow

```text id="ea-deployment"
Platform
      │
      ▼
Package Download
      │
      ▼
Checksum Validation
      │
      ▼
Signature Validation
      │
      ▼
Install Package
      │
      ▼
Configure Inputs
      │
      ▼
Attach to Chart
      │
      ▼
Activation Confirmation
      │
      ▼
Status Returned
```

Deployment SHALL fail immediately if checksum or signature validation fails.

---

## Supported Package Types

- EX5
- MQ5 (Development)
- ZIP
- Signed Package Bundle

---

# 17. Security Model

Every communication SHALL be encrypted using TLS.

The Agent SHALL validate:

- Connector Identity
- JWT Signature
- Command Signature
- Protocol Version
- Package Signature

The Agent SHALL reject:

- Expired Commands
- Unknown Connectors
- Invalid Signatures
- Unsupported Protocol Versions
- Unauthorized Accounts

---

# 18. Offline Recovery

The Agent SHALL continue operating safely during temporary connectivity loss.

Recovery workflow:

```text id="offline-recovery"
Connection Lost
        │
        ▼
Store Commands Locally
        │
        ▼
Continue Local Monitoring
        │
        ▼
Retry Connection
        │
        ▼
Reauthenticate
        │
        ▼
Synchronize Pending Data
        │
        ▼
Resume Normal Operation
```

No synchronized data SHALL be discarded during offline periods.

---

# 19. Auto Update Protocol

The Platform MAY instruct the Agent to perform a software update.

Update workflow:

```text id="auto-update"
Update Available
        │
        ▼
Download Package
        │
        ▼
Checksum Verification
        │
        ▼
Digital Signature Verification
        │
        ▼
Graceful Shutdown
        │
        ▼
Install Update
        │
        ▼
Restart Agent
        │
        ▼
Health Verification
        │
        ▼
Registration
```

Rollback SHALL occur automatically if startup validation fails.

---

# 20. Failure Handling

The Agent SHALL classify failures into the following categories:

| Category | Examples |
|----------|----------|
| Network | Connection timeout, DNS failure |
| Authentication | Invalid token, expired certificate |
| Broker | Trade rejected, trading disabled |
| MT5 | Terminal unavailable, API error |
| Execution | Partial fill, order rejection |
| System | Disk full, insufficient memory |
| Update | Checksum mismatch, failed installation |

Every failure SHALL include:

- Error Code
- Human-readable Description
- Timestamp
- Correlation ID
- Retry Recommendation

---

# 21. Performance Requirements

| Metric | Target |
|---------|--------:|
| Heartbeat Latency | < 2 Seconds |
| Command Validation | < 50 ms |
| Order Submission | < 500 ms (excluding broker latency) |
| Position Synchronization | < 5 Seconds |
| EA Installation | < 10 Seconds |
| Agent Startup | < 30 Seconds |
| Recovery After Reconnect | < 60 Seconds |

---

# 22. Operational Rules

The Veerox Agent SHALL comply with the following rules:

1. Execute only authenticated platform commands.
2. Never implement business logic.
3. Preserve command ordering where required.
4. Persist pending work before execution.
5. Synchronize state after every successful execution.
6. Report every execution outcome to the Platform.
7. Support safe restart without data loss.
8. Reject duplicate command execution using command identifiers.
9. Validate all downloadable artifacts before installation.
10. Maintain backward compatibility within the supported protocol version range.

---

# 23. Protocol Completion Statement

This specification defines the complete operational contract between the Veerox ATI Platform and the Veerox Agent.

The protocol ensures:

- Secure Communication
- Deterministic Command Execution
- Reliable State Synchronization
- Safe Expert Advisor Deployment
- Automatic Recovery
- Operational Resilience
- Enterprise-Grade Security
- High Availability

The Veerox Agent SHALL function exclusively as a secure execution bridge between the cloud platform and MetaTrader terminals while remaining independent of business decision-making.

---

# END OF DOCUMENT

**Document:** 016_MT5_Agent_Protocol.md

**Status:** COMPLETE

---

# Documentation Progress

✅ 000 – Project Constitution  
✅ 001 – Project Charter  
✅ 002 – Vision & Product Strategy  
✅ 003 – Product Requirements Document (PRD)  
✅ 004 – Domain Model Specification  
✅ 010 – Software Requirements Specification (SRS)  
✅ 011 – System Architecture Specification (SAS)  
✅ 012 – API Specification  
✅ 013 – Database Design Specification (DDS)  
✅ 014 – Event Catalog Specification (ECS)  
✅ 015 – Service Contracts Specification (SCS)  
✅ 016 – MT5 Agent Communication Protocol Specification (MACPS)

---

# Next Phase

**017_Security_Architecture.md**

This document will define:

- Zero Trust Architecture
- Authentication & Authorization
- RBAC & ABAC
- Secret Management
- Key Management
- Encryption Standards
- Secure Communication
- API Security
- Agent Security
- Infrastructure Security
- Audit & Compliance
- Threat Model (STRIDE)
- Incident Response
- Disaster Recovery Security

This will serve as the authoritative security blueprint for the entire Veerox ATI ecosystem.