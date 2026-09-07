# VEEROX ATI

# MASTER_PROMPT_03_FEATURE_IMPLEMENTATION.md

**Purpose:** Implement a single feature, module, or service according to the documented Veerox ATI architecture.

---

# Context

Use the repository documentation as the authoritative source.

Read and follow:

- CLAUDE.md
- PROJECT_CONTEXT.md
- DEVELOPMENT_ROADMAP.md
- CLAUDE_RULES.md
- TASK_TEMPLATE.md

Consult additional architectural documents only when relevant to the requested feature.

Do not restate the documentation.

Implement according to it.

---

# Input

The user will provide one of the following:

- Feature Name
- Module Name
- Service Name
- User Story
- Requirement
- Existing Issue
- Enhancement Request

Examples:

```text
Implement Identity Service

Implement Workspace Service

Implement MT5 Connector

Implement Billing Module

Implement User Registration
```

---

# Step 1 — Requirement Analysis

Identify:

- Business objective
- Functional requirements
- Non-functional requirements
- Acceptance criteria
- Dependencies

If the request is ambiguous, request clarification before implementation.

---

# Step 2 — Architecture Impact

Determine:

- Bounded Context
- Domain
- Service
- Aggregate(s)
- Repository
- APIs
- Events
- Database tables
- External integrations
- Frontend impact
- Documentation impact

Respect all documented service boundaries.

---

# Step 3 — Implementation Plan

Produce an implementation plan containing:

- Files to create
- Files to modify
- Folder locations
- Database migrations (if required)
- API endpoints
- Domain events
- Test strategy
- Rollback considerations

Do not begin coding until the plan is complete.

---

# Step 4 — Implementation

Follow the mandatory implementation order:

1. Domain
2. Application
3. Infrastructure
4. Presentation
5. Tests
6. Documentation

Generate production-ready code only.

Do not generate placeholders unless explicitly requested.

---

# Step 5 — Validation

Verify:

- Architecture compliance
- Build success
- Type safety
- Test success
- Security
- Logging
- Error handling
- Documentation updates

---

# Step 6 — Completion Report

Summarize:

- Implemented functionality
- Files created
- Files modified
- Database changes
- API changes
- Event changes
- Tests added
- Remaining work
- Recommended next feature

---

# Guardrails

Never:

- Break service boundaries.
- Duplicate business logic.
- Invent undocumented APIs.
- Access another service's database.
- Skip testing for behavior changes.
- Bypass documented implementation order.

If the request conflicts with the project architecture, explain the conflict and propose an architecturally compliant solution instead of implementing the conflicting change.

---

# Expected Outcome

The delivered feature SHALL:

- Integrate cleanly into the existing architecture.
- Be production-ready.
- Be testable.
- Be maintainable.
- Be consistent with every documented project standard.

The feature SHALL leave the codebase in a better state than before the implementation began.