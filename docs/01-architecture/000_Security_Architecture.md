# VEEROX ATI

**Document ID:** 017  
**Document Name:** Security Architecture Specification (SASec)  
**Version:** 1.0.0  
**Status:** Baseline

---

# 1. Purpose

This document defines the complete security architecture for the Veerox Autonomous Trading Intelligence (ATI) Platform.

It specifies:

- Security Principles
- Zero Trust Architecture
- Identity & Access Management
- Authentication
- Authorization
- Encryption
- Secret Management
- Key Management
- Agent Security
- API Security
- Infrastructure Security
- Threat Modeling
- Compliance
- Incident Response

This document SHALL be the authoritative security specification for the Veerox ATI platform.

---

# 2. Security Objectives

The platform SHALL guarantee:

- Confidentiality
- Integrity
- Availability
- Authenticity
- Non-Repudiation
- Auditability
- Least Privilege
- Defense in Depth

Security SHALL be considered a core architectural concern rather than an implementation detail.

---

# 3. Zero Trust Architecture

The platform SHALL implement a Zero Trust security model.

Core principles:

- Never Trust
- Always Verify
- Least Privilege
- Continuous Validation
- Explicit Authorization
- Device Verification
- Identity-Centric Access

Every request SHALL be authenticated and authorized regardless of network location.

---

# 4. Identity and Access Management (IAM)

Every actor interacting with the platform SHALL possess a verifiable identity.

Supported identities include:

- Human Users
- Organizations
- Workspaces
- Services
- Connectors (Veerox Agents)
- API Clients

Authentication SHALL precede authorization for every request.

---

# 5. Authentication

Supported authentication mechanisms:

- Username & Password
- OAuth 2.1
- OpenID Connect (OIDC)
- Multi-Factor Authentication (MFA)
- Service-to-Service JWT
- API Keys
- Mutual TLS (recommended for Agent communication)

Passwords SHALL:

- Never be stored in plaintext.
- Be hashed using Argon2id.
- Be protected against offline attacks.

---

# 6. Authorization

The platform SHALL implement layered authorization.

Authorization models:

- Role-Based Access Control (RBAC)
- Attribute-Based Access Control (ABAC)

Example Roles

```text id="roles"
Platform Administrator

Organization Administrator

Workspace Administrator

Trader

Viewer

Support Engineer

Developer
```

Authorization SHALL be enforced in the Application Layer before business logic execution.

---

# 7. Session Security

Every authenticated session SHALL include:

- Session Identifier
- Refresh Token
- Expiration Time
- Device Information
- IP Metadata
- Revocation Status

Security requirements:

- Secure Cookies (Web)
- HttpOnly
- SameSite
- Token Rotation
- Session Revocation
- Idle Timeout
- Absolute Timeout

## Token Expiration Policy

**STATUS: FINAL / APPROVED (S-05)**

The following token and session expiration policies are enforced globally:

### Access Token
- **Lifetime:** 15 minutes

### Refresh Token
- **Idle timeout:** 7 days

### Session
- **Idle timeout:** 7 days
- **Absolute maximum:** 30 days

### Rotation
- Refresh tokens rotate on every successful refresh.

### Concurrent Refresh
- A 30-second grace period is permitted to safely handle legitimate concurrent refresh requests. This prevents race conditions while maintaining revocation security.

---

# 8. API Security

All APIs SHALL require authentication except explicitly designated public endpoints.

Security controls:

- JWT Validation
- Scope Validation
- Rate Limiting
- Input Validation
- Request Size Limits
- Content-Type Validation
- Replay Protection
- Correlation IDs

Public APIs SHALL be versioned.

Deprecated versions SHALL follow a documented retirement policy.

---

# 9. Agent Security

The Veerox Agent SHALL be treated as a trusted workload only after successful authentication.

The Agent SHALL validate:

- Platform Identity
- Command Signature
- Protocol Version
- Connector Identity
- Package Signature

The Platform SHALL validate:

- Connector Identity
- Agent Version
- Certificate (where applicable)
- Heartbeat Integrity

Compromised Agents SHALL be revocable.

---

# 10. Secret Management

Sensitive secrets SHALL NEVER be stored in source code.

Examples:

- Database Credentials
- API Keys
- JWT Signing Keys
- Broker Credentials
- Encryption Keys
- OAuth Secrets
- Cloud Credentials

Secrets SHALL be rotated periodically.

Recommended solutions:

- HashiCorp Vault
- Cloud Secret Managers
- Kubernetes Secrets (encrypted at rest)

---

# 11. Key Management

The platform SHALL define a centralized Key Management strategy.

Key categories:

- Signing Keys
- Encryption Keys
- TLS Certificates
- Package Signing Keys

Key rotation SHALL be supported without service downtime.

Private keys SHALL never leave the trusted key management boundary.

---

# 12. Encryption Standards

### Data in Transit

All communication SHALL use:

- TLS 1.3 (preferred)
- TLS 1.2 (minimum where legacy compatibility is required)

---

### Data at Rest

Sensitive data SHALL be encrypted using:

- AES-256-GCM

---

### Password Hashing

- Argon2id

---

### Package Signing

- Ed25519 or equivalent modern digital signature algorithm

---

### Message Integrity

- HMAC-SHA-256 (where symmetric integrity verification is appropriate)

---

# End of Part 1

The next chapter defines:

- Infrastructure Security
- Network Security
- Database Security
- Logging & Audit
- Threat Modeling (STRIDE)
- Compliance
- Disaster Recovery Security
- Security Monitoring
- Incident Response
- Secure Development Lifecycle (SDL)

These sections complete the enterprise security architecture for Veerox ATI.