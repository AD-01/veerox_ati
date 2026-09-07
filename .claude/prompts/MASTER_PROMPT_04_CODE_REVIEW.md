# VEEROX ATI

# MASTER_PROMPT_04_CODE_REVIEW.md

**Purpose:** Perform a comprehensive engineering review of code before it is merged or released.

---

# Context

Use the repository documentation as the source of truth.

Review the implementation against:

- CLAUDE.md
- PROJECT_CONTEXT.md
- CLAUDE_RULES.md
- TASK_TEMPLATE.md
- Architecture documents
- Service contracts
- API contracts
- Coding standards

Review against the documented architecture, not against personal coding preferences.

---

# Input

The user may provide:

- Source files
- Pull Request
- Module
- Feature
- Service
- Commit
- Folder
- Repository

---

# Step 1 — Understand Scope

Identify:

- Purpose of the change
- Affected modules
- Affected services
- Affected contracts
- Intended business outcome

Do not review in isolation if surrounding architectural context is required.

---

# Step 2 — Architecture Review

Verify:

- Clean Architecture
- DDD boundaries
- CQRS separation
- Service ownership
- Dependency direction
- Event usage
- Repository usage
- Layer separation

Report every architectural violation.

---

# Step 3 — Code Quality Review

Evaluate:

- Readability
- Maintainability
- Naming consistency
- Complexity
- Duplication
- Dead code
- Single Responsibility Principle
- Error handling

Recommend improvements where appropriate.

---

# Step 4 — Security Review

Check for:

- Missing authorization
- Missing authentication
- Input validation gaps
- Secret exposure
- Injection risks
- Unsafe logging
- Sensitive data leakage
- Insecure defaults

Highlight all findings by severity.

---

# Step 5 — Performance Review

Review:

- Database queries
- N+1 query risks
- Caching opportunities
- Memory usage
- CPU-intensive logic
- Network efficiency
- Blocking operations

Only recommend optimizations with a clear benefit.

---

# Step 6 — Testing Review

Verify:

- Unit tests
- Integration tests
- Contract tests
- Edge cases
- Failure scenarios
- Regression coverage

Identify missing or weak test coverage.

---

# Step 7 — Documentation Review

Determine whether updates are required for:

- APIs
- Database schema
- Events
- Configuration
- Architecture
- Operational procedures

Flag any missing documentation.

---

# Step 8 — Technical Debt Review

Identify:

- Temporary workarounds
- Architecture drift
- Future maintenance risks
- Coupling issues
- Scalability concerns

Explain the impact and suggest remediation where practical.

---

# Output Format

Provide the review using the following structure.

## Executive Summary

Overall assessment.

---

## Strengths

Positive aspects of the implementation.

---

## Findings

Categorize findings by severity.

### Critical

Must be fixed before merge.

### High

Strongly recommended before merge.

### Medium

Can be scheduled.

### Low

Optional improvements.

---

## Architecture Compliance

State whether the implementation complies with the documented architecture.

---

## Test Coverage Assessment

Summarize existing and missing coverage.

---

## Documentation Assessment

List required documentation updates.

---

## Merge Recommendation

Choose exactly one:

- Approve
- Approve with Minor Changes
- Request Changes
- Reject

Explain the reasoning.

---

# Review Principles

Review against:

- Project standards
- Documented architecture
- Maintainability
- Business correctness

Do not reject changes solely because of stylistic preferences when they comply with project standards.

---

# Final Directive

Your objective is to improve the quality of the codebase while preserving development velocity.

Every recommendation should be actionable, technically justified, and aligned with the Veerox ATI architecture.