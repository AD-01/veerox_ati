# S-13 Expert Advisor Connectivity & Connector Foundation: Discovery Report

## 1. CURRENT STATE AUDIT

**Component Status Breakdown:**
- `strategy-service` (EA Aggregate/Model): **PARTIAL** (Metadata CRUD exists, but lacks connection configuration and provisioning).
- `TradingAccount` Model: **COMPLETE** (Schema is well-structured and tied to Workspace/Connector).
- `Connector` Model/Aggregate: **PARTIAL** (Basic CRUD in `workspace-service`, missing machine connectivity).
- `ConnectorHealth` / `ConnectorCommand`: **PARTIAL** (Models exist, but no producer/consumer implementation).
- `identity-service` (Authentication): **MISSING** (Machine-to-machine authentication does not exist. Only human JWT flows exist).
- `agents/veerox-agent`: **MISSING** (Directory is completely empty).
- `frontend apps`: **MISSING** (No UI for connection management).

---

## 2. EXPERT ADVISOR DOMAIN

**What Exists:**
- Registration (`RegisterExpertAdvisorCommand`)
- Identity, Name, Version, Binary URL, Source URL, Signature (`ExpertAdvisor` aggregate)
- Strategy Association
- Basic Lifecycle Status (`DRAFT`, `TESTING`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`, `DEPRECATED`)

**What is Missing:**
- EA specific operational configuration schemas.
- EA Connection Lifecycle states (e.g., `PROVISIONING`, `CONNECTING`, `CONNECTED`, `DISCONNECTED`).
- Real-time connectivity and heartbeat tracking.
- Explicit Trading Account association (currently abstracted through Workspace orchestration).

---

## 3. EA & CONNECTOR AUTHENTICATION

**Discovery Findings:**
The existing `identity-service` only supports human User JWT authentication (`login`, `refresh`, `logout`). There is no mechanism for a headless machine (Connector/Agent) to securely authenticate.

**Architectural Recommendation:**
The flow MUST be: **EA → ATI (Agent) → Connector → Veerox Platform**
The authentication must occur at the **Connector/Agent** level, not directly by the EA. The Veerox Agent authenticates as a specific Connector instance using a long-lived Provisioning Token, which is exchanged for short-lived JWTs (or persistent WebSocket connections). 

**Requirements for S-13:**
1. Generate `ConnectorSecret` upon Connector Registration.
2. Provide a new endpoint: `POST /api/v1/auth/connector` allowing a machine to exchange `connectorId` and `connectorSecret` for a secure, short-lived JWT.
3. Update `JwtAuthGuard` to recognize Machine Tokens vs Human Tokens for audit tracking.

---

## 4. CONNECTOR FOUNDATION

The `workspace-service` currently has basic CRUD for Connectors (`CreateConnectorCommand`, `UpdateConnectorCommand`).

**Abstraction Design:**
The `Connector` is the universal abstraction representing a physical or virtual bridge to an execution venue (e.g., MT5 Terminal, Binance API). EAs are hosted *behind* a Connector.

**S-13 Foundation Needs:**
- **Heartbeat Mechanism**: Tracking `lastSeen` and `healthScore` to automatically transition Connector to `DISCONNECTED` if a heartbeat is missed.
- **Agent Connectivity API**: Endpoints for the Connector to pull pending `ConnectorCommand`s and post `ConnectorResponse`s.

---

## 5. VEEROX AGENT

The `agents/veerox-agent` directory is empty.

**S-13 Scope for Agent:**
S-13 should implement a **Stub/Mock Agent SDK** to prove the architecture and authentication flow. A full C++/C# MT5 bridge should be deferred to a subsequent execution phase, but the network protocol must be fully verified in S-13.

---

## 6. EA ↔ PLATFORM CONNECTION MODEL

**Required State Machine:**
The existing `ACTIVE`/`SUSPENDED` lifecycle applies to the EA definition. A new state concept is required for the runtime connection.
1. `PROVISIONED` (Credentials generated)
2. `CONNECTING` (Agent handshake in progress)
3. `CONNECTED` (Heartbeat active)
4. `DISCONNECTED` (Heartbeat missed)
5. `REVOKED` (Credentials invalidated)

---

## 7. PLATFORM EA CONNECTION EXPERIENCE

**Frontend Contract (UI Requirements):**
- **Connector Management Panel**: Register a new MT5 Connector, generate API Secret, copy to clipboard.
- **Connection Status Dashboard**: Real-time indicator (Green/Red) based on last heartbeat.
- **Command Logs**: Read-only view of `ConnectorCommand` and `ConnectorResponse`.

---

## 8. TRADING ACCOUNT ASSOCIATION

**Database Integrity:**
The Prisma schema maps:
`Organization` 1..* `TradingAccount`
`Workspace` 1..* `TradingAccount`
`Connector` 1..* `TradingAccount`

This is architecturally correct. The EA does not bind directly to the account; the Connector manages the MT5 terminal which holds the Trading Accounts. The EA acts within that context. No schema changes are required for this relationship.

---

## 9. EVENT ARCHITECTURE

**Existing Events:**
- `ExpertAdvisorRegisteredEvent`
- `ExpertAdvisorStatusChangedEvent`
- `ConnectorCreatedEvent`
- `ConnectorUpdatedEvent`
- `ConnectorArchivedEvent`

**Missing Events Required for S-13:**
- `ConnectorProvisionedEvent` (Secret generated)
- `ConnectorConnectedEvent` (Initial heartbeat received)
- `ConnectorDisconnectedEvent` (Heartbeat timeout)
- `ConnectorHeartbeatReceivedEvent` (For health tracking)

---

## 10. API CONTRACT

**Proposed New Machine APIs (S-13):**
- `POST /api/v1/auth/connector` (Exchange ID+Secret for Token)
- `POST /api/v1/connectors/:id/heartbeat` (Submit health stats)
- `GET /api/v1/connectors/:id/commands/pending` (Long-polling or simple fetch)
- `POST /api/v1/connectors/:id/commands/:cmdId/response` (Submit execution result)

---

## 11. SECURITY & 12. AUDIT LOGGING

**Security Rules:**
- **Machine Identity**: Connectors must use a dedicated API token flow, never a human password.
- **Tenant Isolation**: A Connector Token is hard-bound to its `workspaceId`. Any command fetching must validate this.
- **Audit**: All provisioning (generating secrets) and revocation actions must be logged in `AuditLog` attributing the action to the human user.
- **Forbidden Pattern**: Never store plaintext Connector Secrets. Store a bcrypt hash of the secret in the DB (similar to `passwordHash`).

---

## 13. IDEMPOTENCY & 14. CONCURRENCY

- **Heartbeat Concurrency**: High-frequency heartbeats can cause DB lock contention. S-13 should implement an in-memory or Redis-based rate-limiter for heartbeats, flushing to Postgres periodically to prevent row-lock saturation on `ConnectorHealth`.
- **Command Acknowledgment**: Processing a `ConnectorCommand` must use atomic `UPDATE ... WHERE status = 'PENDING'` to prevent double-execution by competing Agent instances.

---

## 15. FAILURE / RECOVERY

- **Stale Heartbeat**: A cron job (or scheduled process) must sweep `Connector` records checking `lastHeartbeat < now() - 30s` and automatically transition them to `DISCONNECTED`.
- **Revocation**: If a connector is revoked, the `identity-service` must immediately invalidate the JWT to prevent further heartbeats.

---

## 16. MULTI-EA ARCHITECTURE & 17. FUTURE EXTENSIBILITY

**Can a future EA be added without core backend modification?**
**YES, IF** the Connector abstraction is strictly maintained. The platform must treat execution commands as JSON payloads payload delivered to the Connector. The specific EA handles parsing the JSON payload. Veerox does not need backend code changes for a new EA; it only needs to register the new EA metadata and send the correct standard JSON command through the existing Connector channel.

---

## 18. EXECUTION BOUNDARY

S-13 will **only** implement the secure bridge (Heartbeats, Command fetching, Response posting). It will **not** implement the business logic that generates a trade command.

---

## 19. FRONTEND BOUNDARY & 20. DATABASE AUDIT

- **Schema Check**: Existing models (`Connector`, `ConnectorHealth`, `ConnectorCommand`, `ConnectorResponse`) are 95% sufficient. 
- **Required Schema Addition**: `Connector` needs a `secretHash` field for authentication, or an entirely new `ConnectorCredential` model to handle rotation and revocation securely.

---

## FINAL QUESTIONS

1. **Can an EA currently connect to Veerox?** NO
2. **Can a future EA be added without core backend modification?** YES, if the Connector abstraction payload is kept generic (JSON-based).
3. **Does a real Connector Service exist?** NO (Only basic CRUD in Workspace Service).
4. **Does a real Veerox Agent exist?** NO.
5. **Is EA authentication production-ready?** NO.
6. **Is multi-EA architecture production-ready?** NO.
7. **What exact components must S-13 implement?** Machine Authentication, Connector Connectivity APIs (Heartbeat, Commands), Secret Provisioning, Status Tracking.
8. **What must remain OUT OF SCOPE?** Real trade execution, MT5 specific C++ agent code, Frontend implementation.
9. **What should S-14 implement after S-13?** The actual MT5 Agent bridge using this foundation, or the Execution Service linking Policies to ConnectorCommands.
10. **What is the safest implementation sequence?** 
    1. Schema updates (Credentials).
    2. Identity Service (Machine Token Exchange).
    3. Connector Connectivity APIs (Heartbeat, Fetch Commands).
    4. Connector SDK / Mock Agent for validation.

S-13 EA CONNECTOR DISCOVERY: COMPLETE

NEXT STEP:
Proceed to implement S-13 starting with Machine Authentication and Connector Credentials schema updates.
