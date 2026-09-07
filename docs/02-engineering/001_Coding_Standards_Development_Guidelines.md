# VEEROX ATI

**Document ID:** 020  
**Document Name:** Coding Standards & Development Guidelines (CSDG)  
**Version:** 1.0.0  
**Chapter:** Code Review, Git Workflow, AI Development Standards & Engineering Governance

---

# 13. Code Review Standards

Every code change SHALL undergo peer review before merging.

The review SHALL verify:

- Business correctness
- Architectural compliance
- Security
- Performance
- Test coverage
- Documentation updates
- Coding standards
- Error handling
- Logging
- Backward compatibility

Reviewers SHALL reject changes that violate documented architectural principles.

---

# 14. Git Workflow

The project SHALL use Git as the version control system.

Primary branches:

```text id="git-branches"
main

develop

release/*

hotfix/*

feature/*
```

Protected branches:

- main
- develop

Direct commits to protected branches SHALL NOT be permitted.

---

# 15. Commit Message Convention

Commits SHALL follow the Conventional Commits specification.

Examples

```text id="commit-examples"
feat(strategy): add market regime ranking

fix(execution): prevent duplicate order submission

refactor(risk): simplify exposure calculation

docs(api): update execution endpoints

test(ai): add recommendation integration tests

chore(ci): update GitHub Actions workflow
```

Every commit SHALL represent a single logical change.

---

# 16. Pull Request Standards

Every Pull Request SHALL include:

- Summary
- Business Purpose
- Technical Changes
- Testing Performed
- Migration Impact (if applicable)
- Breaking Changes (if any)
- Rollback Considerations
- Linked Work Item

Mandatory checks before merge:

- CI Passed
- Required Reviews Approved
- No Critical Security Findings
- No Unresolved Merge Conflicts

---

# 17. Documentation Standards

Every significant implementation change SHALL update relevant documentation.

Documentation SHALL include:

- Architecture
- API Contracts
- Event Contracts
- Database Changes
- Configuration Changes
- Operational Procedures

Code SHALL NOT become the only source of architectural knowledge.

---

# 18. Dependency Management

Dependencies SHALL satisfy the following requirements:

- Actively Maintained
- Security Reviewed
- Version Controlled
- License Compatible
- Business Justified

Unused dependencies SHALL be removed promptly.

Automatic dependency updates SHALL be validated before production use.

---

# 19. Secure Coding Standards

Developers SHALL follow secure coding practices.

Requirements include:

- Input Validation
- Output Encoding
- Parameterized Database Queries
- Authentication Enforcement
- Authorization Checks
- Secret Protection
- Safe File Handling
- Secure Random Number Generation

Security-sensitive functionality SHALL undergo additional review.

---

# 20. Performance Guidelines

Code SHALL be designed with predictable performance characteristics.

Requirements:

- Avoid unnecessary database queries.
- Minimize network round trips.
- Use caching where appropriate.
- Prefer asynchronous processing for long-running tasks.
- Measure before optimizing.

Performance optimizations SHALL preserve correctness and readability.

---

# 21. AI Coding Assistant Standards

AI-assisted development SHALL comply with the same engineering standards as human-written code.

AI-generated code SHALL:

- Follow documented architecture.
- Respect service boundaries.
- Follow naming conventions.
- Include appropriate tests.
- Avoid introducing undocumented dependencies.
- Preserve existing contracts.

AI-generated code SHALL be reviewed before integration.

---

# 22. Engineering Governance

Engineering governance SHALL include:

- Architecture Reviews
- Design Reviews
- Security Reviews
- Performance Reviews
- Dependency Reviews
- Release Reviews
- Post-Incident Reviews

Governance SHALL ensure long-term consistency across the platform.

---

# 23. Technical Debt Management

Technical debt SHALL be tracked explicitly.

Each identified debt item SHALL include:

- Description
- Business Impact
- Technical Impact
- Priority
- Planned Resolution

Temporary workarounds SHALL be documented and periodically reviewed.

---

# 24. Coding Standards Completion Statement

The Coding Standards & Development Guidelines define the mandatory engineering practices for Veerox ATI.

All contributors, whether human developers or AI coding assistants, SHALL comply with these standards to ensure:

- Consistent Architecture
- High Code Quality
- Maintainability
- Security
- Performance
- Testability
- Long-Term Scalability

This document, together with the architectural and operational specifications, forms the complete implementation handbook for the platform.

---

# END OF DOCUMENT

**Document:** 020_Coding_Standards_Development_Guidelines.md

**Status:** COMPLETE

---

# Documentation Progress

## Foundation

✅ 000 – Project Constitution  
✅ 001 – Project Charter  
✅ 002 – Vision & Product Strategy  
✅ 003 – Product Requirements Document (PRD)  
✅ 004 – Domain Model Specification  

## Core Engineering

✅ 010 – Software Requirements Specification (SRS)  
✅ 011 – System Architecture Specification (SAS)  
✅ 012 – API Specification  
✅ 013 – Database Design Specification (DDS)  
✅ 014 – Event Catalog Specification (ECS)  
✅ 015 – Service Contracts Specification (SCS)  
✅ 016 – MT5 Agent Communication Protocol Specification (MACPS)  
✅ 017 – Security Architecture Specification (SASec)  
✅ 018 – Deployment & Operations Guide (DOG)  
✅ 019 – Testing & Quality Assurance Specification (TQAS)  
✅ 020 – Coding Standards & Development Guidelines (CSDG)

---

# Next Phase (Recommended)

At this point, the **architecture is effectively complete**.

The next documents should move from architecture into implementation specifications:

1. **021_UI_UX_Design_System.md** – Design tokens, components, layouts, navigation, accessibility, themes, responsive behavior.
2. **022_Frontend_Architecture.md** – Next.js app structure, state management, routing, data fetching, component architecture.
3. **023_Backend_Implementation_Guide.md** – Project structure, service bootstrapping, dependency injection, repository implementations.
4. **024_AI_Architecture.md** – AI pipelines, model orchestration, feature engineering, inference lifecycle.
5. **025_DevOps_Runbooks.md** – Day-2 operations, monitoring playbooks, troubleshooting, maintenance procedures.

These documents will bridge the gap between the architecture you've defined and production-ready implementation by Claude Code.