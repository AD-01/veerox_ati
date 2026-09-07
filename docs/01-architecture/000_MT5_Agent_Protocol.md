# VEEROX ATI

**Document ID:** 016  
**Document Name:** MT5 Agent Communication Protocol Specification (MACPS)  
**Version:** 1.0.0  
**Status:** Baseline

---

# 1. Purpose

This document defines the complete communication protocol between:

- Veerox ATI Platform
- Veerox Agent
- MetaTrader 5 Terminal
- Broker Trading Servers

The Veerox Agent SHALL act as a secure execution bridge between the cloud platform and local MetaTrader terminals running on Windows VPS infrastructure.

This document is the authoritative implementation specification for the Veerox Agent.

---

# 2. Architecture Overview

```text id="agent-architecture"
                    VEEROX ATI CLOUD
                           │
             REST API + WebSocket + Event Bus
                           │
                    Secure TLS Channel
                           │
─────────────────────────────────────────────────────────────
                    WINDOWS VPS
─────────────────────────────────────────────────────────────

                Veerox Agent Service
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
 MT5 Terminal 1   MT5 Terminal 2   MT5 Terminal N
       │               │                │
 Broker Server    Broker Server    Broker Server
```

---

# 3. Design Principles

The Agent SHALL:

- Never contain business logic.
- Never calculate risk.
- Never select strategies.
- Never generate AI recommendations.
- Never bypass platform authorization.

The Agent SHALL only:

- Execute approved commands.
- Synchronize MetaTrader state.
- Monitor terminal health.
- Transfer data securely.
- Report execution results.

---

# 4. Agent Responsibilities

The Veerox Agent SHALL provide the following capabilities:

## Trading

- Execute Orders
- Modify Positions
- Close Positions
- Cancel Pending Orders

---

## Synchronization

- Accounts
- Orders
- Deals
- Positions
- History
- Symbols
- Terminal Status

---

## Deployment

- Install EA
- Remove EA
- Activate EA
- Deactivate EA
- Update EA

---

## Monitoring

- Terminal Health
- VPS Health
- MT5 Connectivity
- Broker Connectivity

---

## Security

- Mutual Authentication
- Command Verification
- Secure Transport
- Certificate Validation

---

# 5. Agent Runtime Components

```text id="agent-components"
Veerox Agent

├── Communication Module

├── Authentication Module

├── MT5 Terminal Manager

├── Execution Engine

├── Synchronization Engine

├── EA Deployment Manager

├── Health Monitor

├── Update Manager

├── Configuration Manager

└── Local Event Queue
```

Each module SHALL remain independently testable.

---

# 6. Agent Startup Sequence

```text id="startup-sequence"
Agent Start
      │
      ▼
Load Configuration
      │
      ▼
Initialize Local Storage
      │
      ▼
Authenticate Platform
      │
      ▼
Discover MT5 Terminals
      │
      ▼
Register Agent
      │
      ▼
Synchronize Accounts
      │
      ▼
Synchronize Orders
      │
      ▼
Synchronize Positions
      │
      ▼
Heartbeat Started
      │
      ▼
Ready
```

The Agent SHALL reject execution requests until startup completes successfully.

---

# 7. Agent Registration Protocol

Endpoint

```http id="agent-register"
POST /api/v1/agents/register
```

Registration Payload

```json id="register-payload"
{
  "agentVersion": "1.0.0",
  "protocolVersion": "1.0",
  "machineId": "HOST-ABC123",
  "hostname": "VPS-01",
  "operatingSystem": "Windows Server 2025",
  "cpuCores": 8,
  "memoryGB": 32,
  "terminalCount": 4,
  "supportedPlatform": "MetaTrader5"
}
```

Response

```json id="register-response"
{
  "connectorId": "con_001",
  "heartbeatInterval": 30,
  "configurationVersion": 5
}
```

---

# 8. Authentication

Every Agent SHALL authenticate before exchanging operational data.

Authentication SHALL include:

- Connector ID
- Mutual TLS (recommended for production)
- Signed JWT
- Protocol Version Validation
- Certificate Validation

Expired credentials SHALL prevent command execution.

---

# 9. Communication Channels

The Agent SHALL use multiple communication channels.

| Channel | Purpose |
|----------|---------|
| REST | Registration & Synchronization |
| WebSocket | Real-Time Commands |
| HTTPS | File Downloads |
| Event Queue | Local Processing |

---

# 10. Heartbeat Protocol

Heartbeat Interval

Default

```text id="heartbeat"
30 Seconds
```

Heartbeat Payload

```json id="heartbeat-payload"
{
  "connectorId": "con_001",
  "status": "ONLINE",
  "cpu": 28,
  "memory": 42,
  "activeTerminals": 4,
  "activeAccounts": 12,
  "queueDepth": 3,
  "timestamp": "2026-08-07T10:00:00Z"
}
```

Missed heartbeats SHALL trigger connector health degradation and monitoring alerts.

---

# 11. Agent State Machine

```text id="agent-state"
STARTING
      │
      ▼
REGISTERING
      │
      ▼
SYNCHRONIZING
      │
      ▼
READY
      │
      ├─────────────┐
      ▼             │
EXECUTING           │
      │             │
      ▼             │
SYNCHRONIZING ◄─────┘
      │
      ▼
UPDATING
      │
      ▼
STOPPING
      │
      ▼
OFFLINE
```

State transitions SHALL be deterministic and fully auditable.

---

# 12. Local Queue

The Agent SHALL maintain a persistent local command queue.

Queue characteristics:

- FIFO processing
- Persistent storage
- Crash recovery
- Retry support
- Duplicate detection

The queue SHALL preserve commands during temporary network outages.

---

# End of Part 1

The next chapter defines:

- Order Execution Protocol
- Position Synchronization
- EA Deployment Protocol
- Auto Update Mechanism
- Offline Recovery
- Security Model
- Failure Handling
- Command Lifecycle
- Message Formats
- Performance Requirements

These sections will provide the complete implementation blueprint for the Veerox Agent.