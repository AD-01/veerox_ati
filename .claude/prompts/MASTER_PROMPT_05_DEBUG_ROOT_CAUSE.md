# VEEROX ATI

# MASTER_PROMPT_05_DEBUG_ROOT_CAUSE.md

**Purpose:** Diagnose defects systematically, identify the true root cause, implement the smallest safe fix, and prevent regression.

---

# Context

Use the repository documentation as the authoritative source.

Review the implementation against:

- CLAUDE.md
- PROJECT_CONTEXT.md
- CLAUDE_RULES.md
- TASK_TEMPLATE.md
- Relevant architecture documents
- Service contracts
- API contracts

Do not assume the reported symptom is the root cause.

---

# Input

The user may provide:

- Error message
- Exception stack trace
- Logs
- Screenshots
- Code files
- Pull request
- Bug report
- Unexpected behavior
- Performance issue

---

# Step 1 — Reproduce the Problem

Determine:

- Expected behavior
- Actual behavior
- Reproduction steps
- Frequency
- Scope
- Environment

If the issue cannot be reproduced, explain what additional information is required before proposing a fix.

---

# Step 2 — Impact Analysis

Identify:

- Affected services
- Affected APIs
- Affected database tables
- Affected events
- Affected UI
- Affected integrations
- User impact
- Business impact

---

# Step 3 — Root Cause Analysis

Trace the execution flow.

Determine:

- Where the failure originates.
- Why it occurs.
- Why existing safeguards failed.
- Whether similar failures could occur elsewhere.

Avoid fixing only the visible symptom.

---

# Step 4 — Fix Strategy

Choose the smallest safe change that:

- Resolves the root cause.
- Preserves architecture.
- Preserves backward compatibility (unless intentionally changed).
- Minimizes regression risk.

Avoid broad refactoring unless required to solve the underlying issue.

---

# Step 5 — Implementation

When implementing the fix:

- Follow the documented architecture.
- Update only the necessary files.
- Preserve public contracts where appropriate.
- Keep the change focused.

---

# Step 6 — Regression Prevention

Determine whether the issue should result in:

- New unit tests
- New integration tests
- New contract tests
- Improved validation
- Better logging
- Better monitoring
- Documentation updates

Every critical defect SHOULD result in improved regression protection.

---

# Step 7 — Validation

Verify:

- Original issue resolved.
- Existing functionality preserved.
- Tests passing.
- No architectural violations introduced.
- No new warnings or errors introduced.

---

# Output Format

Provide the analysis using the following structure.

## Problem Summary

Describe the observed issue.

---

## Root Cause

Explain the actual cause.

---

## Impact

Summarize affected components and business impact.

---

## Fix Plan

Describe the chosen approach.

---

## Implementation

Summarize the code changes.

---

## Regression Prevention

List added tests, validations, or monitoring.

---

## Validation Results

Summarize verification performed.

---

## Remaining Risks

List any known limitations or follow-up work.

---

# Investigation Principles

Always:

- Follow evidence.
- Confirm assumptions.
- Reproduce before fixing when possible.
- Prefer deterministic explanations.

Never:

- Guess the cause.
- Hide uncertainty.
- Introduce unrelated changes.
- Rewrite large areas of code without justification.

---

# Severity Guidance

Classify the issue as:

- Critical
- High
- Medium
- Low

Severity SHALL influence urgency, testing depth, and review requirements.

---

# Final Directive

Your objective is not merely to remove an error message.

Your objective is to eliminate the underlying cause, preserve architectural integrity, and reduce the likelihood of similar failures in the future.