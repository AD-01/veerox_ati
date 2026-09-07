# VEEROX ATI

**Document ID:** 011  
**Document Name:** System Architecture Specification (SAS)  
**Version:** 1.0.0  
**Status:** Baseline  
**Classification:** Enterprise Architecture  
**Repository:** `/architecture/011_System_Architecture_Specification.md`

---

# 1. Purpose

This document defines the complete software architecture of the Veerox Autonomous Trading Intelligence (ATI) Platform.

It specifies:

- Architectural principles
- System decomposition
- Domain boundaries
- Runtime architecture
- Communication patterns
- Technology standards
- Scalability model
- Deployment model

This document SHALL be considered the architectural source of truth for implementation.

---

# 2. Architecture Vision

Veerox ATI SHALL NOT be implemented as a traditional monolithic Expert Advisor.

Instead, it SHALL be implemented as an intelligent, modular, event-driven trading platform where every business capability is isolated into independently evolvable domains.

The architecture SHALL prioritize:

- Capital Protection
- Domain Isolation
- High Cohesion
- Low Coupling
- Scalability
- Explainability
- Observability
- Fault Isolation

---

# 3. Architectural Style

The platform SHALL combine the following architectural patterns:

### Primary Pattern

- Domain-Driven Design (DDD)

### Supporting Patterns

- Event-Driven Architecture (EDA)
- Hexagonal Architecture (Ports & Adapters)
- Clean Architecture
- CQRS (where appropriate)
- Repository Pattern
- Strategy Pattern
- Policy Pattern
- Specification Pattern
- Adapter Pattern
- Factory Pattern
- Dependency Injection

Business logic SHALL remain independent of infrastructure.

---

# 4. Architectural Principles

---

## ARC-001 — Domain Ownership

Each business domain SHALL own:

- Business Logic
- Data
- Events
- APIs
- Validation Rules

No domain SHALL directly modify another domain's data.

---

## ARC-002 — Dependency Direction

Dependencies SHALL always point inward.

Infrastructure SHALL depend on business logic.

Business logic SHALL NEVER depend on infrastructure.

---

## ARC-003 — Event Communication

Business domains SHALL communicate primarily through Domain Events.

Direct synchronous communication SHALL be minimized.

---

## ARC-004 — Stateless Services

Application services SHALL remain stateless whenever possible.

Persistent state SHALL exist only in approved storage systems.

---

## ARC-005 — Infrastructure Independence

Business rules SHALL remain executable without:

- Database
- MT5
- Redis
- FastAPI
- React
- Docker

---

# 5. High-Level Architecture

```text
                            ┌────────────────────────────┐
                            │     React Dashboard        │
                            └─────────────┬──────────────┘
                                          │
                                   REST / WebSocket
                                          │
                    ┌─────────────────────▼─────────────────────┐
                    │              API Gateway                  │
                    └─────────────────────┬─────────────────────┘
                                          │
        ┌──────────────────────────────────────────────────────────────┐
        │                     Application Layer                        │
        └──────────────────────────────────────────────────────────────┘
          │          │          │          │           │
          ▼          ▼          ▼          ▼           ▼
  Identity   Market Intelligence   Strategy   Risk   Portfolio
      │             │                 │         │         │
      └─────────────┴────────────┬────┴─────────┴─────────┘
                                 ▼
                         Decision Engine
                                 │
                                 ▼
                          Policy Engine
                                 │
                                 ▼
                         Execution Engine
                                 │
                                 ▼
                         MT5 Connector Layer
                                 │
                                 ▼
                        MetaTrader 5 Terminals
```

---

# 6. Domain Architecture

The platform SHALL consist of the following bounded contexts:

| Domain | Responsibility |
|----------|---------------|
| Identity | Authentication & Authorization |
| Organization | Multi-tenant Management |
| Workspace | Trading Workspaces |
| Market Intelligence | Market Analysis |
| News Intelligence | News Processing |
| Calendar Intelligence | Economic Calendar |
| Sentiment Intelligence | Sentiment Analysis |
| Strategy | Strategy Registry |
| Expert Advisor | EA Registry |
| Strategy Orchestrator | Strategy Selection |
| Risk | Capital Protection |
| Portfolio | Portfolio Management |
| Decision | Trading Decisions |
| Policy | Governance |
| Execution | Trade Execution |
| Connector | MT5 Communication |
| Marketplace | Product Distribution |
| Licensing | License Management |
| Billing | Payments |
| AI | Learning & Intelligence |
| Notification | Communication |
| Audit | Immutable History |
| Administration | Platform Management |

Each bounded context SHALL evolve independently.

---

# 7. Layered Architecture

The platform SHALL be organized into the following layers:

### Layer 1

Presentation

- React
- Next.js
- WebSocket UI

---

### Layer 2

Application

- Use Cases
- Commands
- Queries

---

### Layer 3

Domain

- Entities
- Aggregates
- Value Objects
- Policies
- Specifications
- Domain Services

---

### Layer 4

Infrastructure

- PostgreSQL
- Redis
- FastAPI
- MT5 Connector
- Message Broker
- Object Storage

The Domain Layer SHALL remain independent from all other layers.

---

# 8. Core Decision Pipeline

Every trading opportunity SHALL pass through the following immutable pipeline:

```text
Market Data
        │
        ▼
Market Intelligence
        │
        ▼
Strategy Orchestrator
        │
        ▼
Expert Advisor Selection
        │
        ▼
Risk Assessment
        │
        ▼
Decision Engine
        │
        ▼
Policy Engine
        │
        ▼
Execution Engine
        │
        ▼
MT5 Connector
        │
        ▼
MetaTrader 5
```

No stage SHALL be skipped.

---

# 9. Architectural Constraints

The following constraints are mandatory:

- No business logic inside React.
- No business logic inside MT5 Connector.
- No direct database access across bounded contexts.
- No external API calls from Domain Layer.
- No shared mutable state between domains.
- Every state change SHALL generate a domain event.
- Every critical action SHALL generate an audit event.
- Every execution SHALL be explainable.

---

# 10. Architecture Quality Attributes

The architecture SHALL optimize for:

- Scalability
- Reliability
- Security
- Maintainability
- Extensibility
- Testability
- Observability
- Fault Isolation
- Explainability
- Commercial Extensibility

These quality attributes SHALL take precedence over implementation convenience.

---

# End of Chapter 1

**Upcoming Chapters**

- Runtime Architecture
- Service Architecture
- Domain Interaction Model
- Event Bus Architecture
- Command & Query Architecture
- AI Architecture
- Deployment Architecture
- Security Architecture
- Scalability Architecture
- Failure Recovery Architecture

**End of Current Revision**