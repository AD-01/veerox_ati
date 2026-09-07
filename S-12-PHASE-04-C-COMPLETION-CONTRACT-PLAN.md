# S-12 Phase 04-C: Completion Contract Architectural Plan

## 1. Existing Architecture Findings
- `EvaluatePolicyCommandHandler` dynamically queries active policies at runtime.
- For `N` active policies, `N` independent `PolicyEvaluation` database records are inserted and `N` independent `PolicyEvaluatedEvent`s are published.
- If `N=0`, the handler explicitly returns without persisting or emitting anything.
- `PolicyEvaluatedEvent` lacks any fields denoting `totalPolicies` or `expectedPolicyCount`.
- `DecisionGeneratedEvent` initiates the flow but does not and cannot contain the expected policy count, as active policies are resolved by the policy service dynamically.
- `Decision` and `PolicyEvaluation` Prisma models do not have any fields to track the completeness of an evaluation set.

## 2. Why Current Architecture Cannot Resolve Completion
Without an explicit completion signal:
1. **Out-of-order Delivery:** P04-C cannot know if the first `PolicyEvaluatedEvent` it receives is the *only* one, or the first of many. It cannot safely apply Deny-Wins logic without risking premature resolution.
2. **Zero-Policy Ambiguity:** Because `N=0` yields zero events, P04-C would wait indefinitely for events that will never arrive. It cannot distinguish between "zero policies apply" and "message bus latency."

## 3. Authoritative Completion Mechanism
To resolve this, Phase 04-B must emit an authoritative completion signal **after** evaluating all applicable policies. This signal will contain the absolute `expectedPolicyCount`. 
Phase 04-C will act as an aggregator (Saga/Process Manager pattern), accumulating events (or counting persisted DB records) and comparing the count against `expectedPolicyCount`. When `receivedCount === expectedPolicyCount`, it computes the final Deny-Wins resolution.

## 4. Event Contract
Create a new domain event in `@veerox/events`: **`PolicyEvaluationCompletedEvent`**

```typescript
export class PolicyEvaluationCompletedEvent extends DomainEvent {
  constructor(
    public readonly decisionId: string,
    public readonly correlationId: string,
    public readonly organizationId: string,
    public readonly workspaceId: string,
    public readonly expectedPolicyCount: number, // Explicit total count
    public readonly evaluatedPolicyIds: string[], // Explicit list of policies
    public readonly completedAt: Date,
  ) {
    super();
  }
}
```
*Note: This event does not duplicate the evaluation outcomes, it strictly provides structural completeness guarantees.*

## 5. Required Schema Changes
Phase 04-C requires a deterministic way to track aggregation state. We must introduce a new Prisma model in `packages/database/prisma/schema.prisma`:

```prisma
model PolicyResolutionState {
  correlationId       String   @id @map("correlation_id") @db.Uuid
  decisionId          String   @unique @map("decision_id") @db.Uuid
  organizationId      String   @map("organization_id") @db.Uuid
  workspaceId         String   @map("workspace_id") @db.Uuid
  expectedPolicyCount Int?     @map("expected_policy_count")
  status              String   @default("PENDING") @db.VarChar(30) // PENDING, RESOLVED, FAILED
  finalOutcome        String?  @db.VarChar(30) // ALLOW, REJECT
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt           DateTime @updatedAt @map("updated_at") @db.Timestamp(6)

  @@index([workspaceId])
  @@index([organizationId])
  @@map("policy_resolution_states")
}
```

## 6. Required P04-B Changes
Modify `EvaluatePolicyCommandHandler`:
- After the `activePolicies` loop (or immediately if `activePolicies.length === 0`), publish the `PolicyEvaluationCompletedEvent`.
- The event must accurately reflect the number of successfully evaluated policies (excluding any that critically failed and threw errors, though errors currently halt the entire command).

## 7. Required P04-C Changes
Implement two event handlers in `policy-service`:
1. `PolicyEvaluatedEventHandler`: On receipt, upserts `PolicyResolutionState` (status=PENDING) and checks if the total persisted `PolicyEvaluation` records match `expectedPolicyCount`. If matched, trigger final resolution.
2. `PolicyEvaluationCompletedEventHandler`: On receipt, upserts `PolicyResolutionState` with `expectedPolicyCount`. Checks if the total persisted `PolicyEvaluation` records match. If matched (especially critical for `expectedPolicyCount === 0`), trigger final resolution.
3. Emit `PolicyDecisionResolvedEvent` upon final ALLOW/REJECT resolution and transition `status` to `RESOLVED`.

## 8. Zero-Policy Behavior
If zero active policies exist, P04-B skips individual evaluations and directly emits `PolicyEvaluationCompletedEvent` with `expectedPolicyCount = 0`. P04-C receives this, upserts state, sees `expected (0) === received (0)`, and immediately resolves to a final `ALLOW`.

## 9. Event Ordering Behavior
- **Evaluations before Completion:** P04-C accumulates evaluations. When the completion event arrives, it provides the target `expectedPolicyCount`, triggering resolution.
- **Completion before Evaluations:** P04-C sets the `expectedPolicyCount`. As subsequent evaluations arrive, it counts them. When the last one arrives, it triggers resolution.

## 10. Duplicate Handling
- **Duplicate Completion Events:** Handled idempotently via standard DB `upsert`. The `expectedPolicyCount` remains the same.
- **Duplicate Evaluation Events:** The system relies on `COUNT(PolicyEvaluation)` from the DB. Because P04-B already enforces uniqueness on `[correlationId, policyId]`, the count of authoritative DB records remains perfectly stable regardless of duplicate events.

## 11. Concurrency Handling
Both event handlers will execute an atomic transactional verification:
1. Upsert `PolicyResolutionState`.
2. Count `PolicyEvaluation` where `correlationId = X`.
3. If `count >= expectedPolicyCount` AND `status == 'PENDING'`, atomically update `status = 'RESOLVED'` using `WHERE status = 'PENDING'` (Optimistic Locking).
4. If 0 rows updated (because another concurrent thread already resolved it), abort safely.
5. If updated successfully, execute resolution and emit `PolicyDecisionResolvedEvent`.

## 12. Multi-Instance Behavior
Because state and locks are fully delegated to PostgreSQL (Atomic conditional updates on `status`), multiple instances of `policy-service` can process events simultaneously without race conditions or double-resolutions.

## 13. Tenant Isolation
Both P04-B and P04-C handlers will strictly validate incoming event `organizationId` and `workspaceId` against the original `Decision` record before processing. Cross-tenant mismatches will immediately throw errors and fail closed.

## 14. Audit Implications
The final resolution logic inside P04-C will insert a single `AuditLog` entry under the `system-ati` actor, recording the transition from `PENDING` to `RESOLVED` with the aggregated `violations` and `effectiveLimits`.

## 15. Idempotency
- **Event idempotency:** P04-C's atomic `UPDATE ... WHERE status = 'PENDING'` ensures the final resolution is computed and the final event is published exactly once per `correlationId`.

## 16. Exact File-Level Impact
- `packages/events/src/policy.events.ts` (Add `PolicyEvaluationCompletedEvent` and `PolicyDecisionResolvedEvent`)
- `packages/database/prisma/schema.prisma` (Add `PolicyResolutionState`)
- `services/policy-service/src/application/handlers/evaluate-policy.command-handler.ts` (Emit completion event)
- `services/policy-service/src/application/handlers/evaluate-policy.command-handler.spec.ts` (Update tests)
- `services/policy-service/src/application/handlers/policy-evaluated.event-handler.ts` (NEW)
- `services/policy-service/src/application/handlers/policy-evaluation-completed.event-handler.ts` (NEW)
- `services/policy-service/src/domain/services/policy-resolution.service.ts` (NEW: Core Deny-Wins logic)

## 17. Testing Strategy
Unit testing will comprehensively mock concurrent event deliveries:
1. `PolicyEvaluationCompletedEvent` arrives before/after/during `PolicyEvaluatedEvent`s.
2. Zero-policy completion scenario.
3. Deny-wins mathematical aggregations (e.g., minimum limit constraints).
4. Idempotency against multiple identical concurrent events.

## 18. Validation Gates
- Prisma migration generation and validation.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`
- Unit tests covering all 23 scenarios.

## 19. Migration/Rollout Sequence
1. Implement and deploy `PolicyEvaluationCompletedEvent` and Schema changes.
2. Update P04-B to emit the new completion contract.
3. Implement and deploy P04-C event handlers to consume and process the completion safely.

## 20. Risks
- **Race conditions:** Handled via DB-level atomic updates.
- **Schema bloat:** `PolicyResolutionState` tracks the saga lifecycle. Old resolved states may eventually need a cleanup cron if table size grows unwieldy (Low risk currently).

==================================================

**FINAL STATUS: READY FOR IMPLEMENTATION**
