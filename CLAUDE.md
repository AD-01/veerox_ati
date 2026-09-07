# VEEROX ATI

# CLAUDE.md

**Version:** 1.0.0  
**Status:** Repository Entry Point

---

# Welcome

Welcome to the **Veerox Autonomous Trading Intelligence (ATI)** project.

This repository contains an enterprise-grade AI-powered trading platform built using Domain-Driven Design (DDD), Clean Architecture, CQRS, Event-Driven Architecture, and a Microservices approach.

Before making **any** code changes, you SHALL understand the project architecture and implementation rules defined in the referenced documents.

This file is the primary entry point for AI-assisted development.

---

# Primary Mission

Your responsibility is to:

- Preserve the architecture.
- Produce production-quality code.
- Maintain consistency across all modules.
- Prevent architectural erosion.
- Deliver maintainable implementations.

You are expected to think like a **Principal Software Engineer**, not a code completion tool.

---

# Required Reading Order

Before implementing any feature, consult the documentation in the following order.

## Project Foundation

1. PROJECT_CONTEXT.md
2. DEVELOPMENT_ROADMAP.md
3. MASTER_SYSTEM_PROMPT.md
4. CLAUDE_RULES.md
5. TASK_TEMPLATE.md

---

## Product Documentation

- Project Constitution
- Project Charter
- Vision & Product Strategy
- Product Requirements Document (PRD)

---

## Technical Documentation

- Software Requirements Specification (SRS)
- System Architecture Specification
- API Specification
- Database Design Specification
- Event Catalog
- Service Contracts
- MT5 Agent Protocol
- Security Architecture
- Deployment & Operations Guide
- Testing & QA
- Coding Standards
- UI/UX Design System
- Frontend Architecture
- Backend Implementation Guide
- AI Architecture
- DevOps Runbooks

When documents overlap, the higher-level architectural document takes precedence.

---

# Development Workflow

Every engineering task SHALL follow this sequence:

```text id="workflow"
Understand Requirement
        │
        ▼
Review Documentation
        │
        ▼
Impact Analysis
        │
        ▼
Implementation Plan
        │
        ▼
Implementation
        │
        ▼
Testing
        │
        ▼
Documentation Update
        │
        ▼
Completion Report
```

No implementation SHALL skip mandatory phases.

---

# Architecture Principles

The platform SHALL always follow:

- Domain-Driven Design
- Clean Architecture
- CQRS
- Event-Driven Architecture
- API-First Design
- Security by Design
- Test-Driven Validation
- Observability

Architectural consistency is more important than implementation speed.

---

# Implementation Order

Whenever building a feature, implement layers in this order:

1. Domain
2. Application
3. Infrastructure
4. Presentation
5. Tests
6. Documentation

Do not reverse or bypass this sequence.

---

# Non-Negotiable Rules

Always:

- Keep business logic inside the Domain layer.
- Use repositories for persistence.
- Publish domain events for significant business actions.
- Respect service boundaries.
- Preserve backward compatibility unless intentionally versioned.
- Add tests for new behavior.
- Update documentation when architecture or contracts change.

Never:

- Access another service's database.
- Put business logic in controllers.
- Put business logic in repositories.
- Invent undocumented APIs.
- Ignore existing project documentation.
- Introduce temporary hacks as permanent solutions.

---

# Module Dependency Order

Modules SHALL be developed in the following sequence:

```text id="module-order"
Identity
      │
Organization
      │
Workspace
      │
Connector
      │
Market Intelligence
      │
AI
      │
Strategy
      │
Expert Advisor
      │
Risk
      │
Decision
      │
Policy
      │
Execution
      │
Portfolio
      │
Marketplace
      │
Licensing
      │
Billing
      │
Notification
      │
Administration
```

Do not implement downstream modules before prerequisite modules are complete.

---

# Definition of Done

A task is complete only when:

- Code compiles successfully.
- Tests pass.
- Architecture remains compliant.
- Security requirements are satisfied.
- Logging and observability are preserved.
- Documentation is updated where required.
- No critical TODOs remain.

---

# If Requirements Conflict

If a user request conflicts with:

- Project architecture
- Business rules
- Service boundaries
- Development roadmap

Do **not** silently implement the change.

Instead:

1. Explain the conflict.
2. Identify the affected documentation.
3. Recommend an architecturally correct solution.

---

# Current Project Status

Current Phase:

**Architecture Complete — Implementation Ready**

Next Objective:

Implement the platform according to the Development Roadmap, beginning with the foundational modules and progressing milestone by milestone.

---

# Final Directive

Treat this repository as a long-term enterprise software product.

Optimize every implementation for:

- Maintainability
- Reliability
- Scalability
- Security
- Readability
- Testability

Every code contribution should be something that another senior engineer can confidently build upon years later.