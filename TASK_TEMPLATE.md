# VEEROX ATI

# TASK_TEMPLATE.md

Version: 1.0

Status: Mandatory

Purpose:

This document defines the mandatory workflow Claude Code SHALL follow for every implementation task within the Veerox ATI project.

No feature, bug fix, refactoring, or enhancement SHALL bypass this process.

---

# STANDARD TASK LIFECYCLE

Every task SHALL pass through the following phases.

```text
Receive Task
      │
      ▼
Understand Requirement
      │
      ▼
Architecture Analysis
      │
      ▼
Dependency Analysis
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
Validation
      │
      ▼
Completion Report
```

---

# PHASE 1 — REQUIREMENT ANALYSIS

Before writing code Claude SHALL identify:

Task Summary

Business Goal

Expected Result

Acceptance Criteria

Open Questions (if any)

If the requirement is ambiguous, implementation SHALL pause until clarification is obtained.

---

# PHASE 2 — IMPACT ANALYSIS

Claude SHALL identify all affected areas.

Affected Services

Affected Modules

Affected APIs

Affected Events

Affected Database Tables

Affected UI Components

Affected Tests

Affected Documentation

No implementation SHALL begin without completing this analysis.

---

# PHASE 3 — IMPLEMENTATION PLAN

The plan SHALL include:

Files to Create

Files to Modify

Migration Requirements

API Changes

Database Changes

Event Changes

Testing Strategy

Rollback Considerations

The implementation SHALL follow the documented project architecture.

---

# PHASE 4 — IMPLEMENTATION

Implementation SHALL follow this order:

1. Domain
2. Application
3. Infrastructure
4. Presentation
5. Tests
6. Documentation

Each layer SHALL compile successfully before proceeding to the next.

---

# PHASE 5 — TESTING

Minimum validation:

- Unit Tests
- Integration Tests
- Contract Tests (if APIs or events change)

Where applicable:

- End-to-End Tests
- Performance Tests
- Security Validation

No feature SHALL be considered complete without appropriate testing.

---

# PHASE 6 — DOCUMENTATION

Claude SHALL update documentation when changes affect:

- APIs
- Database Schema
- Events
- Configuration
- Architecture
- Operational Procedures

Minor internal refactoring that does not change behavior MAY omit documentation updates.

---

# PHASE 7 — VALIDATION CHECKLIST

Before marking a task complete, verify:

- Architecture preserved
- Service boundaries respected
- CQRS preserved
- DDD preserved
- Security validation complete
- Error handling complete
- Logging added where appropriate
- Telemetry preserved
- Tests passing
- Documentation updated

If any mandatory item fails, the task SHALL remain incomplete.

---

# PHASE 8 — COMPLETION REPORT

Every completed task SHALL conclude with:

Task Summary

Implemented Components

Files Created

Files Modified

Database Changes

API Changes

Events Published

Tests Added

Documentation Updated

Known Limitations (if any)

Next Recommended Task

This report SHALL provide sufficient detail for another engineer to continue development.

---

# BUG FIX WORKFLOW

For defect resolution, Claude SHALL follow:

1. Reproduce the issue.
2. Identify the root cause.
3. Explain the root cause.
4. Propose the fix.
5. Implement the smallest safe change.
6. Add or update tests to prevent regression.
7. Verify the fix.
8. Document behavior changes if applicable.

Temporary workarounds SHALL be clearly identified and tracked.

---

# REFACTORING WORKFLOW

Refactoring SHALL:

- Preserve external behavior.
- Preserve API contracts unless intentionally changed.
- Reduce complexity.
- Improve readability.
- Improve maintainability.
- Avoid unnecessary scope expansion.

Refactoring SHALL NOT introduce unrelated feature changes.

---

# RESPONSE TEMPLATE

Unless instructed otherwise, Claude SHOULD structure implementation responses as follows:

1. Requirement Summary
2. Impact Analysis
3. Implementation Plan
4. Code Changes
5. Testing Performed
6. Validation Results
7. Completion Report

This structure promotes consistency and reviewability.

---

# FINAL DIRECTIVE

Claude Code SHALL treat this document as the mandatory operating procedure for every engineering task within the Veerox ATI project.

Following a consistent workflow is considered as important as writing correct code.

No implementation SHALL bypass this process.