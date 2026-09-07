# S-12 Phase 04-C Implementation Plan: Policy Resolution & Enforcement

## 1. Executive Summary
This document outlines the implementation plan for Phase 04-C, which is responsible for the final, deterministic cross-policy resolution and enforcement layer. It consumes individual `PolicyEvaluatedEvent`s and emits a final `PolicyDecisionResolvedEvent` (ALLOW/REJECT). However, this implementation is currently **BLOCKED** due to critical missing architectural dependencies regarding event completeness and the zero-policy resolution signal.

## 2. Current P04-B Architecture (Post Boundary Refactor)
Phase 04-B strictly evaluates policies independently. It emits one `PolicyEvaluatedEvent` per active policy and saves one `PolicyEvaluation` record. It performs no cross-policy aggregation, determines no final authorization outcome, and emits zero events if no active policies exist.

## 3. Exact P04-C Responsibility
Phase 04-C is responsible for cross-policy aggregation. It must consume individual evaluations, enforce Deny-Wins logic (ANY REJECT -> FINAL REJECT; ALL ALLOW -> FINAL ALLOW), calculate minimum numeric restrictive effective limits, aggregate all violations, and emit the final authorization outcome.

## 4. Domain Ownership
This is a core domain concern within the `policy-service`. The mathematical resolution of policy limits and rules must live purely in the domain layer, strictly isolated from infrastructure (NestJS, Prisma, EventBus).

## 5. Existing Models that can be reused
- `Decision`: Contains the original request context and decision ID.
- `PolicyEvaluation`: Contains individual policy evaluations.

## 6. New DB Models only if truly required
A new authoritative state model (e.g., `PolicyResolutionState`) may be necessary to safely accumulate events concurrently until the required evaluation set is fully received. However, because we lack a completion signal, designing this model is currently impossible.

## 7. Commands
- `ResolvePolicyDecisionCommand`

## 8. Queries
None strictly required for the core flow.

## 9. Event handlers
- `PolicyEvaluatedEventHandler`: Listens to incoming evaluations and triggers the resolution logic.

## 10. Event contracts
- Consumes: `PolicyEvaluatedEvent`
- Produces: `PolicyDecisionResolvedEvent`

## 11. Repository interfaces
- `IDecisionRepository` (existing)
- `IPolicyEvaluationRepository` (existing)
- `IPolicyResolutionRepository` (potentially new)

## 12. Idempotency
Must use PostgreSQL atomic transitions (e.g., specific `WHERE status = 'PENDING'`) to ensure that processing the same `PolicyEvaluatedEvent` multiple times or receiving concurrent events does not corrupt the aggregation or double-emit the final decision.

## 13. Concurrency
Concurrent events for the same `correlationId` must be serialized safely, typically through optimistic concurrency control (version increments) or pessimistic row-level locking on a parent resolution record.

## 14. Out-of-order handling
Events can arrive in any order. The system must buffer/aggregate them until the complete set is formed.

## 15. Completion detection
> [!WARNING]
> **CRITICAL BLOCKER:** There is no authoritative mechanism in the current database schema (`Decision`, `PolicyEvaluation`) or event schema (`PolicyEvaluatedEvent`, `DecisionGeneratedEvent`) to inform Phase 04-C of the total number of policies expected for a given decision. Phase 04-C cannot authoritatively know when all events have arrived without guessing or inventing a timeout.

## 16. Zero-policy handling
> [!WARNING]
> **CRITICAL BLOCKER:** Phase 04-B emits zero events when no active policies exist. Without a synthetic event (which was explicitly removed) or an explicit DB flag, Phase 04-C cannot distinguish between "zero policies were evaluated" and "the evaluation events have simply not arrived over the message bus yet."

## 17. Fail-closed behavior
If a resolution cannot be safely made (e.g., cross-tenant event, missing decision), it must explicitly REJECT and halt processing. It must never fail open.

## 18. Tenant isolation
Every incoming event's `organizationId` and `workspaceId` must strictly match the authoritative `Decision` record in the database.

## 19. Authorization
Determines final `ALLOW` or `REJECT` purely based on Deny-Wins policy limits.

## 20. Audit
Every final resolution must produce an audit log under the actor `system-ati`.

## 21. ATI boundary
Phase 04-C must NOT execute trades, communicate with brokers, or instruct MT5. `ALLOW` simply means the action passed the policy layer.

## 22. Deterministic resolution algorithm
Deny-wins. If ANY policy is REJECT, the final is REJECT. All must be ALLOW for a final ALLOW.

## 23. Effective limit aggregation
`EffectiveLimit = MIN(all applicable policy limits)`. A less restrictive policy must never override a stricter one.

## 24. Violation aggregation
Complete deterministic aggregation of all `violations` from all `PolicyEvaluatedEvent`s.

## 25. State machine
`PENDING` -> `RESOLVED` (ALLOW / REJECT). Once `RESOLVED`, the state is immutable.

## 26. Testing strategy
Plan encompasses 23 specific scenarios defined in the prompt (e.g., Single policy ALLOW, Deny-Wins, Concurrency, Zero-policy, Fail-closed boundaries).

## 27. Regression strategy
Ensure existing S-05 boundaries are not violated and S-12 Phase 04-B logic remains untouched.

## 28. Performance
No synchronous cross-service HTTP calls. Strictly async event-driven and fast local DB transactions.

## 29. Exact file-level impact
Blocked pending architectural decisions.

## 30. Implementation sequence
Blocked pending architectural decisions.

## 31. Validation gates
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`

## 32. Risk register
High Risk: Message ordering, duplicate delivery, missing completion contract.

## 33. Missing dependencies / architectural decisions
> [!IMPORTANT]
> **MISSING POLICY EVALUATION COMPLETION CONTRACT**
> Phase 04-C has no authoritative way to know how many policies Phase 04-B evaluated. 
>
> **MISSING ZERO-POLICY RESOLUTION SIGNAL**
> Phase 04-C cannot differentiate between a zero-policy scenario and network latency, because Phase 04-B emits no events and updates no authoritative state when zero policies apply.

==================================================

**FINAL STATUS: BLOCKED — ARCHITECTURAL DECISION REQUIRED**
