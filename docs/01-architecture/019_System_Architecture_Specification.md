# VEEROX ATI

**Document ID:** 011  
**Document Name:** System Architecture Specification (SAS)  
**Version:** 1.0.0  
**Chapter:** Technology Stack, Coding Standards & Engineering Principles

---

# 63. Technology Stack

## 63.1 Architecture Principle

Technology SHALL support the architecture.

Architecture SHALL NEVER be constrained by technology choices.

Technologies MAY evolve over time while preserving business domain independence.

---

# 63.2 Frontend

## Dashboard

Framework:

- Next.js (Latest Stable)

Language:

- TypeScript

UI:

- React

Styling:

- Tailwind CSS

Component Library:

- shadcn/ui

Charts:

- Apache ECharts

Real-Time:

- WebSocket
- Server-Sent Events (where appropriate)

State Management:

- TanStack Query
- Zustand

Forms:

- React Hook Form
- Zod

Authentication:

- Clerk (Initial)
- Internal Identity Service (Future)

---

# 63.3 Backend

Language:

- TypeScript

Framework:

- NestJS (Primary Recommendation)

Alternative:

- FastAPI (AI Services)

API:

- REST
- WebSocket
- Internal Event Bus

Validation:

- Zod
- class-validator

---

# 63.4 AI Platform

Languages:

- Python

Frameworks:

- FastAPI
- PyTorch
- XGBoost
- LightGBM
- Scikit-Learn

Experiment Tracking:

- MLflow

Feature Store:

- Redis + PostgreSQL

Model Registry:

- MLflow Registry

---

# 63.5 Database

Primary:

- PostgreSQL

Cache:

- Redis

Object Storage:

- S3 Compatible Storage

Search (Future):

- OpenSearch

Analytics (Future):

- ClickHouse

---

# 63.6 Message Broker

Primary Recommendation:

- RabbitMQ

Enterprise Scale Alternative:

- Apache Kafka

Background Jobs:

- BullMQ

---

# 63.7 Infrastructure

Containerization:

- Docker

Orchestration:

- Kubernetes

Ingress:

- NGINX Ingress

Reverse Proxy:

- Traefik (Optional)

Infrastructure as Code:

- Terraform

---

# 63.8 CI/CD

Source Control:

- GitHub

CI:

- GitHub Actions

Artifact Registry:

- GitHub Container Registry

Deployment:

- ArgoCD

---

# 63.9 Observability

Metrics:

- Prometheus

Dashboards:

- Grafana

Logs:

- Loki

Tracing:

- OpenTelemetry

Alerting:

- Alertmanager

---

# 63.10 Testing

Unit:

- Jest

Integration:

- Testcontainers

API:

- Supertest

E2E:

- Playwright

Load Testing:

- k6

---

# 64. Repository Architecture

```text
veerox-platform/

├── apps/
│
├── services/
│
├── packages/
│
├── infrastructure/
│
├── deployment/
│
├── architecture/
│
├── docs/
│
├── scripts/
│
└── tools/
```

Monorepo SHALL be mandatory.

---

# 65. Coding Standards

---

## General Rules

Business logic SHALL NOT exist inside:

- Controllers
- API Routes
- React Components
- Database Repositories

Business logic SHALL exist only inside Domain Services or Aggregates.

---

## Dependency Rules

Allowed dependency direction:

Presentation

↓

Application

↓

Domain

↓

Infrastructure

Reverse dependency SHALL NOT occur.

---

## Naming Rules

Examples:

```text
CreateWorkspaceCommand

WorkspaceAggregate

RiskAssessment

DecisionGeneratedEvent

StrategyRepository

PolicyEngine

TradingHealthService
```

---

## Folder Rules

Every bounded context SHALL contain:

```text
domain/

application/

infrastructure/

contracts/

tests/
```

---

# 66. Engineering Principles

Every engineer contributing to Veerox ATI SHALL follow:

- SOLID
- DRY
- KISS
- YAGNI
- Clean Code
- Clean Architecture
- Domain-Driven Design
- Event-Driven Design
- Twelve-Factor App Principles

---

# 67. Definition of Done (DoD)

A feature SHALL NOT be considered complete until:

- Business Rules Implemented
- Unit Tests Pass
- Integration Tests Pass
- Security Validation Complete
- Documentation Updated
- Domain Events Published
- Audit Events Implemented
- Observability Added
- Code Review Approved

---

# 68. Architectural Decision Records (ADR)

Every major architectural decision SHALL be documented using ADR.

ADR SHALL include:

- Context
- Decision
- Alternatives
- Consequences
- Status

No significant architectural change SHALL occur without an ADR.

---

# 69. Future Evolution

The architecture SHALL support future expansion including:

- MT4 Support
- cTrader Support
- DXtrade Support
- FIX Protocol
- Multi-Asset Trading
- Stocks
- Crypto
- Futures
- Options
- AI Copilot
- Institutional OMS
- Institutional RMS
- Strategy Marketplace
- AI Strategy Builder
- Reinforcement Learning Research Environment
- Mobile Applications
- White Label Platform
- Multi-Region Deployment

These future capabilities SHALL require extension rather than redesign.

---

# 70. Architecture Completion Statement

This System Architecture Specification establishes the complete technical blueprint for Veerox ATI.

Together with the Project Constitution, PRD, Domain Model, and SRS, it forms the architectural foundation for implementation.

No implementation SHOULD begin before these documents are accepted as the baseline architecture.

---

# End of Document

**Document:** 011_System_Architecture_Specification.md

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

---

# Next Phase (Most Critical)

From here, we move from **architecture** to **implementation specifications**:

1. **012_API_Specification.md** (Every REST/WebSocket API)
2. **013_Database_Design.md** (Every table, schema, indexes, constraints)
3. **014_Event_Catalog.md** (Every event payload)
4. **015_Service_Contracts.md** (Service interfaces)
5. **016_MT5_Agent_Protocol.md** (Communication between Veerox Platform ↔ Veerox Agent ↔ MT5)
6. **017_AI_Model_Specification.md**
7. **018_UI_UX_Specification.md**
8. **019_Implementation_Roadmap.md**
9. **020_Claude_Code_Master_Prompt.md**

These documents will be used directly by Claude Code to build the platform with minimal ambiguity.