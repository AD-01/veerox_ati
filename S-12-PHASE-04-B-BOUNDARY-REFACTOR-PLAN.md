# S-12 Phase 04-B Boundary Refactor Plan

## 1. Executive Summary
Before proceeding to S-12 Phase 04-C implementation, the Phase 04-B implementation (`EvaluatePolicyCommandHandler`) must be refactored. Currently, Phase 04-B oversteps its boundaries by aggregating policy outcomes, merging effective limits, and producing a final authorization state wrapped in a single `PolicyEvaluatedEvent`. 

This refactor will separate responsibilities: Phase 04-B will evaluate each policy independently, persist individual `PolicyEvaluation` records, and emit an individual `PolicyEvaluatedEvent` for each policy. All aggregation and final resolution will be removed from Phase 04-B so it can be properly implemented in Phase 04-C.

---

## 2. Boundary Clarification

### **Remains in Phase 04-B (Evaluation)**
- Consuming `EvaluatePolicyCommand`.
- Loading the `Decision` and extracting evaluation context.
- Loading active policies for the workspace/organization.
- Invoking `PolicyEngineService` to evaluate **each** policy independently.
- Generating deterministic evaluation IDs (`uuidv5(correlationId + policyId)`).
- Persisting individual `PolicyEvaluation` database records.
- Creating an `AuditLog` entry per policy evaluation.
- Emitting an individual `PolicyEvaluatedEvent` **per policy**.
- Idempotency handling at the individual evaluation level.

### **Moves to Phase 04-C (Resolution)**
- Cross-policy `Deny-Wins` outcome aggregation (`finalOutcome`).
- Merging of `effectiveLimits` across all policies.
- Concatenation of all `EventPolicyViolation` arrays across policies.
- Emitting the final resolved authorization state (`PolicyDecisionResolvedEvent`).

---

## 3. File-Level Refactoring Plan

### 3.1. Affected Prisma Models
**File:** `packages/database/prisma/schema.prisma`
- **Model `PolicyEvaluation`:**
  - **Current:** Has `@unique` on `correlationId`. This is a critical bug preventing multiple policies from being saved for the same decision (subsequent saves fail with `P2002` and are incorrectly swallowed as concurrent execution duplicates).
  - **Proposed Change:** 
    - Remove `@unique` from `correlationId`.
    - Add composite unique constraint: `@@unique([correlationId, policyId])`.
  - **Reason:** To allow exactly one evaluation record per policy, per decision correlation.

### 3.2. Affected Handlers
**File:** `services/policy-service/src/application/handlers/evaluate-policy.command-handler.ts`
- **Current:** Evaluates all policies in a loop, aggregates outcomes into `finalOutcome` and limits into `mergedEffectiveLimits`, and publishes a single `PolicyEvaluatedEvent` (with a zeroed-out policyId).
- **Proposed Changes:**
  - **Remove** `finalOutcome`, `allViolations`, `mergedEffectiveLimits`, and `prohibitions` aggregation variables.
  - **Modify Loop:** Inside the `for (const policy of activePolicies)` loop, immediately instantiate and publish a `PolicyEvaluatedEvent` for that specific policy using `policy.id` and the individual `result`.
  - **Idempotency Fix:** Update the `P2002` error check to log/skip safely per policy, ensuring we still emit the event if the record already exists (or skip if the event was already emitted).
  - **Zero Policies Fallback:** Retain the fallback mechanism that emits a single "Null Policy" evaluation (ALLOW) when no active policies exist, so Phase 04-C knows there are no constraints.

### 3.3. Affected Events
**File:** `packages/events/src/policy.events.ts`
- **Current:** `PolicyEvaluatedEvent` currently serves as the final aggregate event.
- **Proposed Changes:** 
  - The structure of `PolicyEvaluatedEvent` is already compliant with the Phase 04-C requirement (it contains `policyId`, `policyVersion`, `outcome`, `effectiveLimits`, `violations`, etc.).
  - **No changes required to the event class itself.** The change is purely semantic: the handler will now populate it with individual policy data instead of aggregate data.

### 3.4. Affected Repositories
**File:** `services/policy-service/src/domain/interfaces/policy-evaluation.repository.interface.ts` (and Prisma implementation)
- **Current:** Interface assumes single correlation saves.
- **Proposed Changes:** 
  - Update `save()` calls and tests to reflect the new composite unique constraint. No major interface changes expected, but Prisma types will regenerate.

### 3.5. Affected Tests
**File:** `services/policy-service/src/application/handlers/evaluate-policy.command-handler.spec.ts`
- **Current:** Asserts that exactly one `PolicyEvaluatedEvent` is emitted with aggregated limits.
- **Proposed Changes:**
  - Update mocks and assertions to expect **multiple** `PolicyEvaluatedEvent` publications (one for each mocked active policy).
  - Assert that each event contains the correct `policyId` and independent evaluation results.
  - Assert that no limit aggregation occurs.

---

## 4. Implementation Constraints & Rules
- **DO NOT** create mocks or bypass security.
- **DO NOT** delete the underlying `policy-engine.service.ts` evaluation logic.
- **DO NOT** create the Phase 04-C `PolicyDecisionResolvedEvent` or resolution logic during this refactor.

## 5. Status
**S-12-PHASE-04-B-BOUNDARY-REFACTOR-PLAN STATUS: READY FOR REVIEW**
Please approve this refactoring plan before implementation of the Phase 04-B fixes and Phase 04-C discovery/implementation continues.
