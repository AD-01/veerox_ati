# VEEROX ATI

**Document ID:** 025  
**Document Name:** DevOps Runbooks  
**Version:** 1.0.0  
**Status:** Baseline

---

# 1. Purpose

This document provides the operational runbooks required to deploy, operate, troubleshoot, and maintain the Veerox ATI Platform in production.

Unlike the Deployment & Operations Guide, this document focuses on **step-by-step operational procedures** for Site Reliability Engineering (SRE), DevOps, and Operations teams.

---

# 2. Operational Principles

Operations SHALL prioritize:

- Service Availability
- Data Integrity
- Security
- Predictable Recovery
- Minimal Downtime
- Controlled Change

Every operational action SHALL be:

- Logged
- Auditable
- Repeatable
- Documented

---

# 3. Standard Incident Severity

| Severity | Description | Target Response |
|----------|-------------|----------------:|
| P0 | Platform unavailable / critical security incident | Immediate |
| P1 | Major business functionality unavailable | ≤ 15 Minutes |
| P2 | Partial degradation | ≤ 1 Hour |
| P3 | Minor issue | Next business cycle |

Incident severity SHALL determine escalation procedures.

---

# 4. Service Startup Runbook

Startup sequence:

```text id="startup-runbook"
Infrastructure
        │
        ▼
PostgreSQL
        │
        ▼
Redis
        │
        ▼
RabbitMQ
        │
        ▼
Core Services
        │
        ▼
Supporting Services
        │
        ▼
API Gateway
        │
        ▼
Frontend
        │
        ▼
Health Verification
```

Validation after startup:

- All services healthy.
- Database reachable.
- Message broker operational.
- Cache operational.
- Event consumers registered.
- API Gateway routing correctly.

---

# 5. Service Shutdown Runbook

Shutdown SHALL occur in reverse dependency order.

```text id="shutdown-runbook"
Frontend
        │
        ▼
API Gateway
        │
        ▼
Supporting Services
        │
        ▼
Core Services
        │
        ▼
RabbitMQ
        │
        ▼
Redis
        │
        ▼
PostgreSQL
```

Before shutdown:

- Drain incoming traffic.
- Complete active requests.
- Flush logs.
- Publish pending outbox events.
- Close connections gracefully.

---

# 6. Database Recovery Runbook

Recovery procedure:

1. Confirm incident scope.
2. Stop writes if necessary.
3. Verify latest backup.
4. Restore database.
5. Apply incremental recovery (PITR where applicable).
6. Validate schema version.
7. Validate data integrity.
8. Resume services.
9. Verify application health.

Recovery SHALL be documented with timestamps and validation evidence.

---

# 7. RabbitMQ Recovery Runbook

If the message broker becomes unavailable:

1. Confirm broker health.
2. Restart broker if appropriate.
3. Verify queue integrity.
4. Verify consumer registration.
5. Process pending outbox events.
6. Validate dead-letter queues.
7. Confirm event flow resumes normally.

No events SHALL be discarded without explicit approval.

---

# 8. Redis Recovery Runbook

If Redis fails:

1. Confirm failure.
2. Restart Redis service.
3. Re-establish connections.
4. Allow cache warm-up.
5. Verify session management.
6. Monitor application latency.

Redis SHALL be treated as a recoverable cache layer; persistent business data SHALL remain in the primary database.

---

# 9. MT5 Agent Recovery Runbook

Recovery procedure:

1. Verify Agent connectivity.
2. Re-authenticate Agent.
3. Confirm heartbeat.
4. Validate synchronized accounts.
5. Verify pending command queue.
6. Resume synchronization.
7. Validate execution status.

If recovery fails, escalate for manual investigation while preserving audit trails.

---

# 10. Certificate Rotation Runbook

Certificate rotation SHALL include:

- Issue replacement certificate.
- Validate certificate chain.
- Deploy to staging.
- Validate connectivity.
- Schedule production rotation.
- Replace certificate.
- Verify TLS.
- Revoke superseded certificate if applicable.

Rotation SHALL avoid service interruption whenever practical.

---

# 11. Secret Rotation Runbook

Secret rotation procedure:

1. Generate new secret.
2. Store in approved secret manager.
3. Update configuration.
4. Restart affected services (if required).
5. Validate authentication.
6. Remove old secret after successful transition.

Secret rotation SHALL be auditable.

---

# 12. Backup Verification Runbook

Verification procedure:

- Confirm backup completion.
- Verify checksum / integrity.
- Perform periodic restore test.
- Validate restored data.
- Record verification results.

Backups SHALL not be considered valid until restoration has been successfully demonstrated.

---

# End of Part 1

The next chapter defines:

- Kubernetes Operations
- Capacity Expansion
- Production Maintenance
- Emergency Trading Stop
- Incident Communication
- Change Management
- Post-Incident Review
- Operational Checklists
- Runbook Governance

These sections complete the operational handbook for Veerox ATI.