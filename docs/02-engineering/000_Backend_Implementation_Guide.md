# VEEROX ATI

**Document ID:** 023  
**Document Name:** Backend Implementation Guide (BIG)  
**Version:** 1.0.0  
**Status:** Baseline

---

# 1. Purpose

This guide defines the implementation standards for all backend services within the Veerox Autonomous Trading Intelligence (ATI) Platform.

Unlike the System Architecture Specification (011) and Service Contracts (015), this document focuses on **how services SHALL be implemented**, including project layout, dependency injection, transaction handling, event publishing, and coding patterns.

This document SHALL be used as the day-to-day engineering handbook for backend development.

---

# 2. Backend Technology Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 24 LTS |
| Language | TypeScript 5.x |
| Framework | NestJS 11 |
| ORM | Prisma ORM |
| Database | PostgreSQL 17 |
| Cache | Redis |
| Event Bus | RabbitMQ (Kafka-ready abstraction) |
| Validation | Zod |
| Authentication | Clerk + JWT |
| Logging | Pino |
| Observability | OpenTelemetry |

---

# 3. Monorepo Layout

```text
apps/
    web/
    admin/

services/
    identity-service/
    organization-service/
    workspace-service/
    market-service/
    ai-service/
    strategy-service/
    ea-service/
    risk-service/
    decision-service/
    policy-service/
    execution-service/
    portfolio-service/
    connector-service/
    marketplace-service/
    licensing-service/
    billing-service/
    notification-service/
    audit-service/

packages/
    core/
    contracts/
    events/
    sdk/
    ui/
    config/
    telemetry/

agents/
    veerox-agent/

infrastructure/
docs/
scripts/
tools/
```

Services SHALL remain independently deployable.

---

# 4. Standard Service Structure

Every backend service SHALL use the following structure.

```text
src/

application/

domain/

infrastructure/

presentation/

contracts/

configuration/

tests/
```

No additional top-level folders SHALL be introduced without architectural approval.

---

# 5. Dependency Injection

Dependency Injection SHALL be constructor-based.

Rules:

- Depend on interfaces, not implementations.
- Domain Layer SHALL NOT use DI containers directly.
- Infrastructure implementations SHALL be registered at application startup.
- Circular dependencies SHALL NOT be permitted.

---

# 6. Request Lifecycle

```text
HTTP Request
      │
      ▼
Controller
      │
      ▼
Command / Query
      │
      ▼
Application Handler
      │
      ▼
Domain
      │
      ▼
Repository
      │
      ▼
Database
      │
      ▼
Domain Events
      │
      ▼
Outbox
      │
      ▼
Event Bus
```

Business logic SHALL execute exclusively within the Domain layer.

---

# 7. Repository Pattern

Repositories SHALL expose domain-oriented methods.

Example responsibilities:

- Persist Aggregates
- Retrieve Aggregates
- Enforce Persistence Boundaries

Repositories SHALL NOT contain business rules.

---

# 8. Transaction Management

Every business transaction SHALL satisfy ACID guarantees where applicable.

Rules:

- One aggregate per transaction (preferred)
- Distributed workflows SHALL use Sagas
- Long-running transactions SHALL be avoided
- Database transactions SHALL remain short-lived

---

# 9. Outbox Pattern

Every published business event SHALL first be written to the Outbox table.

Flow:

```text
Business Transaction
        │
        ▼
Commit Database
        │
        ▼
Persist Outbox Record
        │
        ▼
Background Publisher
        │
        ▼
RabbitMQ
```

Direct event publication from business transactions SHALL NOT be permitted.

---

# 10. Idempotency

The following operations SHALL be idempotent:

- Payment Processing
- License Activation
- Order Submission
- Connector Registration
- Synchronization Requests
- Event Processing

Duplicate requests SHALL return deterministic results.

---

# 11. Background Processing

Background workers SHALL process:

- Event Publication
- Notification Delivery
- AI Inference Jobs
- Analytics Aggregation
- Scheduled Tasks
- Cleanup Operations

Background tasks SHALL support retry, timeout, and dead-letter handling.

---

# 12. Configuration

Every service SHALL load configuration from external sources.

Configuration categories:

- Database
- Cache
- Queue
- Authentication
- Storage
- AI Providers
- Broker Integrations
- Feature Flags

Configuration SHALL be validated during service startup.

---

# End of Part 1

The next chapter defines:

- Exception Handling
- Logging & Observability Hooks
- Health Checks
- Service Startup Sequence
- Graceful Shutdown
- Database Migration Workflow
- Development Workflow
- Local Development Environment
- Backend Governance
- Implementation Checklist

These sections complete the backend implementation guide for Veerox ATI.