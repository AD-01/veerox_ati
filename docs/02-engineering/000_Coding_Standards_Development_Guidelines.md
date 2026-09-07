# VEEROX ATI

**Document ID:** 020  
**Document Name:** Coding Standards & Development Guidelines (CSDG)  
**Version:** 1.0.0  
**Status:** Baseline

---

# 1. Purpose

This document defines the mandatory software engineering standards for the Veerox Autonomous Trading Intelligence (ATI) Platform.

It specifies:

- Repository Standards
- Coding Standards
- Architectural Rules
- Domain-Driven Design Rules
- CQRS Rules
- Event-Driven Development Standards
- API Standards
- Database Standards
- Error Handling
- Logging
- Testing Requirements
- Git Workflow
- Documentation Standards

This document SHALL be the authoritative engineering handbook for all developers and AI coding assistants.

---

# 2. Engineering Principles

All software SHALL be developed according to the following principles:

- Simplicity
- Readability
- Maintainability
- Testability
- Determinism
- Security by Design
- Performance Awareness
- Explicitness over Implicit Behavior

Code SHALL optimize for long-term maintainability rather than short-term convenience.

---

# 3. Repository Structure

The repository SHALL follow a domain-oriented structure.

```text id="repository-structure"
apps/
services/
packages/
libs/
agents/
infrastructure/
docs/
scripts/
tests/
tools/
```

Each bounded context SHALL remain isolated.

Shared utilities SHALL reside only within approved shared libraries.

---

# 4. Clean Architecture Rules

Every backend service SHALL implement the following layers:

```text id="clean-architecture"
Presentation

↓

Application

↓

Domain

↓

Infrastructure
```

Dependency Rule

Outer layers MAY depend on inner layers.

Inner layers SHALL NEVER depend on outer layers.

---

# 5. Domain-Driven Design Rules

Every domain SHALL contain:

- Aggregates
- Entities
- Value Objects
- Domain Services
- Domain Events
- Repository Interfaces

Business rules SHALL exist only inside the Domain layer.

Infrastructure SHALL NEVER contain business logic.

---

# 6. CQRS Rules

Commands SHALL:

- Modify state
- Return minimal responses
- Generate domain events

Queries SHALL:

- Never modify state
- Be optimized for reading
- Remain side-effect free

Commands SHALL NOT return large business objects.

---

# 7. Event-Driven Development

Every business state transition SHALL publish a domain event.

Events SHALL be:

- Immutable
- Versioned
- Replayable
- Idempotent

Business logic SHALL NOT depend on event ordering across unrelated aggregates.

---

# 8. API Design Standards

REST APIs SHALL follow consistent conventions.

Examples

```text id="api-standard"
GET    /strategies

GET    /strategies/{id}

POST   /strategies

PUT    /strategies/{id}

DELETE /strategies/{id}
```

Requirements:

- Versioned APIs
- Consistent HTTP Status Codes
- Pagination
- Filtering
- Sorting
- Validation
- Correlation IDs

---

# 9. Database Standards

Requirements:

- UUID Primary Keys
- Foreign Keys
- Indexing
- Transactions
- Versioned Migrations
- Soft Deletes (where applicable)
- Optimistic Locking

Raw SQL SHALL be limited to justified performance scenarios.

---

# 10. Error Handling

Errors SHALL be classified.

Categories

- Validation
- Business
- Infrastructure
- External Integration
- Security
- Unexpected

Every error SHALL include:

- Error Code
- Human-readable Message
- Correlation ID

Internal implementation details SHALL NOT be exposed through public APIs.

---

# 11. Logging Standards

Logging SHALL be structured.

Every log SHALL include:

- Timestamp
- Service Name
- Correlation ID
- Severity
- Message

Sensitive information SHALL NEVER be logged.

---

# 12. Naming Conventions

Examples

Classes

```text id="class-names"
RiskAssessmentService

StrategyRepository

TradeDecision
```

Interfaces

```text id="interfaces"
IRiskRepository

IExecutionGateway
```

Methods

```text id="methods"
calculateRisk()

generateDecision()

executeTrade()
```

Variables

```text id="variables"
riskScore

tradeVolume

marketSnapshot
```

Naming SHALL be descriptive and consistent.

---

# End of Part 1

The next chapter defines:

- Code Review Standards
- Git Workflow
- Branching Strategy
- Pull Request Rules
- Documentation Standards
- Dependency Management
- Security Coding Standards
- Performance Guidelines
- AI Coding Assistant Rules
- Engineering Governance

These sections complete the engineering handbook for Veerox ATI.