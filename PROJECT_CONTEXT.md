# VEEROX ATI

# PROJECT_CONTEXT.md

Version: 1.0

Status: MASTER PROJECT CONTEXT

---

# PROJECT OVERVIEW

Project Name

VEEROX ATI

Full Name

Veerox Autonomous Trading Intelligence Platform

Project Type

Enterprise AI-Powered Autonomous Trading Platform

---

# PROJECT GOAL

The objective of Veerox ATI is to build a world-class enterprise trading platform capable of:

- Managing multiple organizations and workspaces.
- Connecting securely to MetaTrader 5 through the Veerox Agent.
- Collecting and analyzing live trading and market data.
- Using AI to recommend trading strategies and Expert Advisors.
- Performing deterministic risk analysis.
- Producing explainable trading decisions.
- Executing approved trades through MT5.
- Managing portfolios, licensing, billing, and marketplace functionality.

The platform is intended to operate as an enterprise SaaS product with multi-tenant architecture.

---

# ARCHITECTURAL STYLE

The entire platform SHALL follow:

- Domain-Driven Design (DDD)
- Clean Architecture
- CQRS
- Event-Driven Architecture
- Microservices
- Event Sourcing Ready
- API First
- Security First
- Test First
- Cloud Native

These architectural principles SHALL NOT be violated.

---

# TECHNOLOGY STACK

Frontend

- Next.js 16+
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- TanStack Table
- Apache ECharts
- React Hook Form
- Zod

Backend

- NestJS 11
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- RabbitMQ
- OpenTelemetry
- Pino Logger

Infrastructure

- Docker
- Kubernetes
- GitHub Actions
- Object Storage
- CDN
- WAF

Agent

- Windows Service
- MetaTrader 5 Integration
- Secure WebSocket
- HTTPS
- Local Queue
- Auto Update

---

# PLATFORM MODULES

Identity

Organization

Workspace

Market Intelligence

Artificial Intelligence

Strategy

Expert Advisor

Strategy Orchestrator

Risk

Decision

Policy

Execution

Portfolio

Connector

Marketplace

Licensing

Billing

Notification

Audit

Administration

Every module SHALL remain an independent bounded context.

---

# BUSINESS RULES

The following business rules SHALL NEVER change without explicit architectural approval.

1.

AI never executes trades.

2.

Risk evaluation always precedes execution.

3.

Policy validation always follows decision generation.

4.

Execution always occurs through the Veerox Agent.

5.

Every important business action publishes a Domain Event.

6.

Business logic exists only inside the Domain Layer.

7.

Repositories never contain business logic.

8.

Controllers never contain business logic.

9.

Services never access another service's database.

10.

Every production action is auditable.

---

# IMPLEMENTATION ORDER

Development SHALL follow this order.

1

Identity

↓

Organization

↓

Workspace

↓

Connector

↓

Market Intelligence

↓

AI

↓

Strategy

↓

Expert Advisor

↓

Risk

↓

Decision

↓

Policy

↓

Execution

↓

Portfolio

↓

Marketplace

↓

Licensing

↓

Billing

↓

Notifications

↓

Administration

---

# FRONTEND PRINCIPLES

The frontend SHALL:

- Use Server Components by default.
- Use Client Components only where interaction is required.
- Consume typed APIs.
- Never contain business logic.
- Remain responsive.
- Follow the shared design system.
- Support dark and light themes.
- Follow WCAG accessibility guidance.

---

# BACKEND PRINCIPLES

Backend services SHALL:

- Own their databases.
- Expose versioned APIs.
- Publish immutable events.
- Implement CQRS.
- Follow Clean Architecture.
- Follow DDD.
- Use Dependency Injection.
- Support observability.

---

# DATABASE PRINCIPLES

- UUID primary keys.
- Version-controlled migrations.
- Soft delete where appropriate.
- Optimistic locking.
- Outbox pattern.
- ACID transactions.
- Audit logging.

---

# EVENT PRINCIPLES

Events SHALL be:

- Immutable
- Versioned
- Replayable
- Idempotent

Events SHALL represent completed business facts.

---

# AGENT PRINCIPLES

The Veerox Agent SHALL:

- Never make business decisions.
- Never evaluate risk.
- Never generate AI recommendations.
- Execute only authenticated platform commands.
- Synchronize MT5 state.
- Maintain heartbeats.
- Recover safely after outages.

---

# QUALITY REQUIREMENTS

Every feature SHALL include:

- Unit Tests
- Integration Tests
- Contract Tests
- Documentation Updates

No feature is complete until testing is complete.

---

# SECURITY REQUIREMENTS

Every request SHALL be:

Authenticated

Authorized

Validated

Logged

Audited

Sensitive information SHALL never be exposed.

---

# DEVELOPMENT PHILOSOPHY

The project optimizes for:

- Maintainability
- Scalability
- Predictability
- Reliability
- Security
- Long-term evolution

Implementation speed SHALL NEVER compromise architecture.

---

# AUTHORITATIVE DOCUMENTS

When implementing functionality, consult these documents in order:

1. Project Constitution
2. Project Charter
3. Product Requirements Document (PRD)
4. Software Requirements Specification (SRS)
5. System Architecture Specification (SAS)
6. API Specification
7. Database Design Specification
8. Event Catalog
9. Service Contracts
10. Security Architecture
11. Frontend Architecture
12. Backend Implementation Guide
13. AI Architecture
14. Coding Standards

If two documents appear to conflict, the higher document in this list takes precedence until the conflict is resolved through architecture review.

---

# CURRENT PROJECT STATUS

Current phase:

**Architecture Complete**

Implementation status:

- Documentation Complete
- Coding Not Started
- Database Not Initialized
- Services Not Implemented
- Frontend Not Implemented
- MT5 Agent Not Implemented
- AI Pipeline Not Implemented

The implementation SHALL begin according to the documented development roadmap and architecture.

---

# FINAL DIRECTIVE

Claude Code SHALL treat this document as the persistent project context for every implementation task.

Before generating code, verify that the requested change conforms to the architecture, service boundaries, business rules, and implementation order defined in this document.

If a requested implementation conflicts with this context, pause implementation and explain the architectural conflict before proceeding.