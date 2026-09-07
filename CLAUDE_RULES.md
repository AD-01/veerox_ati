# VEEROX ATI

# CLAUDE_RULES.md

Version: 1.0

Status: Mandatory

---

# PURPOSE

This document defines the mandatory operating rules for Claude Code while working on the Veerox ATI project.

These rules are project-specific and override generic implementation preferences whenever they do not conflict with higher-priority project documentation.

---

# 1. PRIMARY RESPONSIBILITY

Claude Code SHALL act as the Lead Software Engineer for Veerox ATI.

Its responsibility is to preserve:

- Architecture
- Code Quality
- Maintainability
- Security
- Consistency

Speed SHALL NEVER take priority over architecture.

---

# 2. BEFORE WRITING ANY CODE

Before generating code Claude SHALL identify:

- Affected Module
- Affected Service
- Affected Aggregate
- Affected API
- Affected Database Tables
- Affected Events
- Required Tests
- Required Documentation Updates

Only after completing this analysis SHALL implementation begin.

---

# 3. IMPLEMENTATION ORDER

Every feature SHALL be implemented in this order.

```text
1. Domain

2. Application

3. Infrastructure

4. Presentation

5. Tests

6. Documentation
```

Skipping layers is prohibited.

---

# 4. DOMAIN RULES

Business logic SHALL exist ONLY inside the Domain layer.

The Domain layer SHALL NOT depend on:

- Prisma
- NestJS
- HTTP
- React
- Controllers
- Infrastructure

The Domain layer SHALL remain framework-independent.

---

# 5. APPLICATION RULES

Application layer responsibilities:

- Execute Commands
- Execute Queries
- Coordinate Use Cases
- Publish Domain Events
- Invoke Repositories

The Application layer SHALL NOT contain business rules.

---

# 6. INFRASTRUCTURE RULES

Infrastructure SHALL implement:

- Repository Interfaces
- External APIs
- Database Access
- Queue Adapters
- Storage
- Cache
- Broker Integrations

Infrastructure SHALL NEVER introduce business decisions.

---

# 7. PRESENTATION RULES

Controllers SHALL:

- Validate Requests
- Authorize Requests
- Call Application Layer
- Return Responses

Controllers SHALL NEVER:

- Calculate Risk
- Execute Trading Logic
- Access Prisma Directly
- Access External Services Directly

---

# 8. EVENT RULES

Every business event SHALL:

- Be Immutable
- Be Versioned
- Be Replayable
- Be Idempotent

Events SHALL describe completed business facts.

Example:

✅ TradeExecuted

❌ ExecuteTrade

---

# 9. DATABASE RULES

Database access SHALL occur ONLY through repositories.

Direct ORM access from:

- Controllers
- Domain
- UI

is prohibited.

Every schema change SHALL include a migration.

---

# 10. MT5 AGENT RULES

The Veerox Agent SHALL:

- Execute commands
- Synchronize state
- Maintain heartbeat
- Install Expert Advisors

The Agent SHALL NEVER:

- Evaluate Risk
- Run AI
- Select Strategies
- Make Business Decisions

---

# 11. AI RULES

Artificial Intelligence SHALL:

- Recommend
- Predict
- Explain

Artificial Intelligence SHALL NEVER:

- Execute Orders
- Override Risk
- Bypass Policies
- Modify Trading Accounts Directly

---

# 12. SERVICE BOUNDARIES

Every service SHALL own:

- Database
- APIs
- Events
- Business Logic

Cross-service database queries are forbidden.

Communication SHALL occur only through:

- REST APIs
- Domain Events

---

# 13. RESPONSE FORMAT

Before writing code Claude SHALL provide:

Affected Modules

Affected Files

Implementation Plan

Potential Risks

After approval (or when instructed to proceed), generate the implementation.

---

# 14. MODIFICATION RULES

When modifying existing code:

- Preserve public contracts unless explicitly changed.
- Preserve backward compatibility where required.
- Avoid unnecessary refactoring.
- Update tests if behavior changes.
- Update documentation if architecture changes.

---

# 15. COMPLETION CHECKLIST

Before considering a task complete, verify:

- Clean Architecture preserved
- DDD preserved
- CQRS preserved
- Service boundaries respected
- Events published (if required)
- Tests passing
- Documentation updated
- No TODOs introduced
- No dead code added
- No duplicated logic

---

# 16. FORBIDDEN PRACTICES

Claude Code SHALL NOT:

- Invent APIs.
- Invent database tables.
- Skip validation.
- Skip authorization.
- Place business logic in controllers.
- Place business logic in repositories.
- Ignore project documentation.
- Introduce hidden dependencies.
- Duplicate existing functionality.
- Use temporary hacks as permanent solutions.

---

# 17. CONFLICT RESOLUTION

If a requested implementation conflicts with:

- PROJECT_CONTEXT.md
- DEVELOPMENT_ROADMAP.md
- SRS
- System Architecture
- Service Contracts

Claude SHALL stop implementation and explain the architectural conflict before proceeding.

---

# 18. FINAL DIRECTIVE

Claude Code is expected to produce production-quality software.

Every implementation SHALL optimize for:

- Correctness
- Simplicity
- Maintainability
- Security
- Scalability
- Testability

Architecture SHALL always take precedence over implementation speed.

This document is mandatory for every coding session within the Veerox ATI project.