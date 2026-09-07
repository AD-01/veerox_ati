# VEEROX ATI

# MASTER_PROMPT_07_RELEASE_REVIEW.md

**Version:** 1.0.0  
**Purpose:** Determine whether a feature, sprint, milestone, or the entire platform is ready for production release.

---

# Context

Use the repository documentation as the source of truth.

Review against:

- CLAUDE.md
- PROJECT_CONTEXT.md
- DEVELOPMENT_ROADMAP.md
- CLAUDE_RULES.md
- TASK_TEMPLATE.md
- All applicable architecture and engineering documents

Do not approve a release that conflicts with documented project standards.

---

# Input

The user may provide:

- Sprint
- Milestone
- Epic
- Module
- Service
- Pull Request
- Release Candidate
- Entire Repository

Examples:

```text id="release-input"
Review Sprint-04 for release

Review Identity Service

Review Release Candidate v1.0.0

Review entire repository
```

---

# Step 1 — Scope Verification

Identify:

- Release scope
- Affected modules
- Included features
- Excluded work
- Dependencies

Confirm that the requested scope is internally consistent.

---

# Step 2 — Architecture Compliance

Verify:

- Clean Architecture
- DDD
- CQRS
- Event-Driven Architecture
- Service boundaries
- Dependency direction

Identify any architectural deviations.

---

# Step 3 — Functional Readiness

Confirm:

- Acceptance criteria satisfied
- Business rules implemented
- User flows complete
- Error handling present
- Edge cases considered

---

# Step 4 — Security Review

Review:

- Authentication
- Authorization
- Input validation
- Secret handling
- Sensitive data protection
- Audit logging
- Security headers (where applicable)

Flag unresolved security issues by severity.

---

# Step 5 — Performance Review

Evaluate:

- API latency
- Database efficiency
- Caching strategy
- Resource usage
- Background processing
- Scalability considerations

Recommend optimization only when justified.

---

# Step 6 — Test Readiness

Confirm:

- Unit tests passing
- Integration tests passing
- Contract tests passing
- End-to-end tests (where applicable)
- Regression tests completed

List any gaps in automated coverage.

---

# Step 7 — Documentation Review

Verify documentation is current.

Review:

- APIs
- Database schema
- Events
- Configuration
- Deployment notes
- Operational procedures

Identify any required updates.

---

# Step 8 — Operational Readiness

Confirm:

- Monitoring configured
- Logging available
- Health checks implemented
- Metrics exposed
- Backup strategy documented
- Rollback procedure available

The release SHALL be operable by the DevOps team.

---

# Step 9 — Risk Assessment

Categorize remaining risks:

- Critical
- High
- Medium
- Low

Describe:

- Business impact
- Technical impact
- Recommended mitigation

---

# Step 10 — Release Decision

Choose exactly one outcome:

- **GO** — Ready for production.
- **GO WITH CONDITIONS** — Release permitted after listed actions.
- **NO GO** — Release blocked until critical issues are resolved.

Provide a clear justification.

---

# Output Format

## Executive Summary

High-level assessment.

---

## Architecture Status

Compliance summary.

---

## Functional Status

Completed functionality and notable gaps.

---

## Security Status

Findings and severity.

---

## Performance Status

Observations and recommendations.

---

## Test Status

Coverage summary and missing validation.

---

## Documentation Status

Required updates, if any.

---

## Operational Readiness

Deployment and support assessment.

---

## Risk Register

Outstanding risks with priority.

---

## Final Release Decision

State one of:

- GO
- GO WITH CONDITIONS
- NO GO

Explain the reasoning and list mandatory actions, if applicable.

---

# Review Principles

Always:

- Base conclusions on evidence.
- Differentiate blockers from recommendations.
- Preserve architectural standards.
- Focus on production readiness.

Never:

- Approve a release with unresolved critical issues.
- Ignore missing documentation that affects operations.
- Treat stylistic preferences as release blockers.

---

# Final Directive

Your responsibility is to protect the quality and stability of the Veerox ATI platform.

Approve releases only when they are technically sound, operationally supportable, and aligned with the documented architecture and engineering standards.