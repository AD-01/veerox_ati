# VEEROX ATI

# MASTER_PROMPT_06_REFACTORING.md

**Purpose:** Improve the internal quality of existing code while preserving externally observable behavior and maintaining architectural integrity.

---

# Context

Use the repository documentation as the authoritative source.

Follow:

- CLAUDE.md
- PROJECT_CONTEXT.md
- CLAUDE_RULES.md
- TASK_TEMPLATE.md
- Coding Standards
- System Architecture
- Backend / Frontend Architecture

Refactoring SHALL preserve the documented architecture.

---

# Input

The user may provide:

- Service
- Module
- Folder
- Pull Request
- Source Files
- Component
- API
- Existing Implementation

Examples:

- Refactor Risk Service
- Refactor Dashboard module
- Refactor Portfolio aggregate
- Simplify Execution pipeline

---

# Refactoring Objective

The goal is to improve:

- Readability
- Maintainability
- Testability
- Performance (when justified)
- Simplicity
- Architectural consistency

Without changing externally visible behavior unless explicitly requested.

---

# Step 1 — Assessment

Identify:

- Current responsibilities
- Existing architecture
- Complexity
- Code smells
- Technical debt
- Duplication
- Coupling
- Cohesion

Determine whether refactoring is justified.

---

# Step 2 — Risk Analysis

Identify:

- Public APIs
- Shared contracts
- Database impact
- Events
- Dependencies
- Backward compatibility risks

List any areas requiring additional testing.

---

# Step 3 — Refactoring Plan

Describe:

- Components to refactor
- Expected improvements
- Files affected
- Sequence of changes
- Validation strategy

Avoid expanding scope beyond the agreed objective.

---

# Step 4 — Implementation

Apply improvements while preserving:

- Public behavior
- API contracts
- Business rules
- Service boundaries
- Event contracts

Prefer incremental, reviewable changes.

---

# Step 5 — Validation

Verify:

- Existing tests still pass.
- New behavior has not been introduced unintentionally.
- Architecture remains compliant.
- Performance has not regressed.
- Documentation remains accurate.

---

# Code Smells to Detect

Review for:

- Long methods
- Large classes
- Duplicate code
- Feature envy
- God objects
- Tight coupling
- Primitive obsession
- Deep nesting
- Dead code
- Unused dependencies

Recommend improvements only when they provide measurable value.

---

# Refactoring Principles

Always:

- Keep changes focused.
- Preserve behavior.
- Reduce complexity.
- Improve naming.
- Increase cohesion.
- Reduce coupling.

Never:

- Mix refactoring with unrelated feature work.
- Introduce breaking changes without approval.
- Rewrite stable code without clear benefit.
- Increase complexity to achieve stylistic preferences.

---

# Output Format

## Assessment

Current state and motivation.

---

## Risks

Compatibility and regression risks.

---

## Refactoring Plan

Proposed sequence of changes.

---

## Implementation Summary

Files modified and key improvements.

---

## Validation

Testing performed and verification results.

---

## Technical Debt Reduced

Summarize which issues were addressed.

---

## Remaining Opportunities

List optional future improvements outside the current scope.

---

# Completion Criteria

The refactoring is complete only when:

- Behavior is preserved.
- Complexity is reduced.
- Maintainability is improved.
- Tests pass.
- Architecture remains compliant.
- No unnecessary changes were introduced.

---

# Final Directive

Treat refactoring as an investment in the long-term health of the Veerox ATI codebase.

Every change should leave the code simpler, clearer, and easier to extend without altering its intended behavior.