# VEEROX ATI

# MASTER_PROMPT_02_SPRINT_EXECUTION.md

**Purpose:** Execute one roadmap sprint according to the documented architecture.

---

## Instructions

Use the existing repository documentation as your source of truth:

- CLAUDE.md
- PROJECT_CONTEXT.md
- DEVELOPMENT_ROADMAP.md
- CLAUDE_RULES.md
- TASK_TEMPLATE.md

Do not restate those documents.

Follow them.

---

## Input

The user will provide:

- Epic
- Milestone
- Sprint

Example:

```text
EPIC-01
Milestone-01
Sprint-02
```

---

## Execution Workflow

### Step 1

Identify the sprint objectives.

---

### Step 2

Determine:

- affected services
- affected bounded contexts
- dependencies
- prerequisites

---

### Step 3

Review relevant documentation before implementation.

---

### Step 4

Produce an implementation plan.

The plan SHALL include:

- files to create
- files to modify
- APIs
- events
- database
- testing
- documentation

---

### Step 5

Implement the sprint.

Implementation SHALL follow:

1. Domain
2. Application
3. Infrastructure
4. Presentation
5. Tests
6. Documentation

---

### Step 6

Validate:

- build
- tests
- architecture
- contracts
- security

---

### Step 7

Produce a Sprint Completion Report.

The report SHALL include:

- Completed Work
- Remaining Work
- Risks
- Next Sprint Recommendation

---

## Output Requirements

The implementation SHALL be complete enough that another engineer can continue directly from the completion report.

Do not leave hidden assumptions.

Do not skip documentation updates when contracts or architecture change.

Always preserve the documented implementation roadmap.