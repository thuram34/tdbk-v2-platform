# TDBK ENGINE STATUS

## Last Updated
2026-09-22

## Current Phase
Production Hardening Gate 04 — External Side-Effect Idempotency

## Current Objective
Close one concrete unresolved production-hardening gap without changing established architecture. Gate 04 evaluates the external side-effect idempotency boundary after worker crash or lease expiry. Provisioning identity, readiness, DBK, and Sokoni remain closed/excluded.

## Completed
- Continued from the closed Gate 02 state and did not reopen its readiness decision.
- Confirmed the provisioning service-identity decision remains independently stopped at `MASTER REVIEW REQUIRED`; no provisioning identity code was altered.
- Inspected `src/persistence/firestore/repositories/workflowStepExecutionRepository.ts` and its durable execution-key/lease model.
- Identified a concrete idempotency defect: `claimExecution()` previously rejected an active lease only when the current worker differed from the requesting worker. The same worker could therefore reclaim a live execution key, increment `attemptCount`, and overwrite the active execution state.
- Corrected only the active-lease condition so every live lease is exclusive, including same-worker reclaims.
- Preserved existing behavior for completed/failed executions and expired-lease recovery.
- Added a focused regression test proving a same-worker second claim is rejected while the lease is active and durable attempt count remains one.
- Inspected the resulting commits/diff and corrected an accidental unrelated formatting-only change to `getInstance()` so the production source diff is limited to the active-lease hardening.
- Recorded the focused evidence in `docs/PRODUCTION_HARDENING_GATE_03_2026-09-22.md`.

## In Progress
- Gate 04 is **BLOCKED / MASTER REVIEW REQUIRED**.
- No production implementation was invented because the remaining gap crosses the Engine-to-external-provider contract boundary.

## Selected Hardening Gate
**Gate 04 — External Side-Effect Idempotency Across Worker Crash/Lease Expiry**

## Finding
**MASTER REVIEW REQUIRED** — architectural decision required before safe implementation.

### Gap Found
The Engine durably protects workflow execution ownership with a Firestore lease, but an external side effect can succeed before durable `completeExecution()` is recorded. If the worker crashes or the lease expires, a later worker can legitimately retry the side effect. The existing durable execution key therefore does not by itself guarantee exactly-once external effects.

This is an Engine-to-provider contract gap, not a safe local implementation defect.

## Why It Mattered
A concurrent/re-entrant call could previously obtain the same live execution key, increment the durable attempt counter, and cause the workflow layer to enter the same step more than once. For side-effecting workflow steps this creates an avoidable duplicate-execution risk.

## Architectural Boundary Preserved
- Firestore remains authoritative production persistence.
- Existing tenant-scoped workflow execution paths remain unchanged.
- Existing workflow lease/recovery architecture remains unchanged.
- Existing execution key remains the idempotency authority; no duplicate source of truth was added.
- No client-side authority was added.
- No provisioning service identity was changed.
- No audit-system redesign was introduced.
- No external bridge/payment behavior was changed.

## Exact Files Changed
- `docs/PRODUCTION_HARDENING_GATE_04_2026-09-22.md` — records the concrete blocker and required architectural decision.
- `docs/master/ENGINE-STATUS.md` — records Gate 04 status and boundary.

No production source file was changed.

**DBK/Sokoni production files were not modified.**

## Verification Performed
- Repository inspection: **COMPLETED**.
- Source diff inspection: **COMPLETED**.
- Focused test source inspection: **COMPLETED**.
- TypeScript/typecheck: **NOT EXECUTED** — local npm/shell execution unavailable through connected repository tooling.
- Lint: **NOT EXECUTED**.
- Focused test execution: **NOT EXECUTED**.
- Full test suite: **NOT EXECUTED**.
- Production build: **NOT EXECUTED**.
- No passing execution result is claimed.

## Remaining Hardening Risks
- External side-effect idempotency/reconciliation remains unresolved pending Master architectural decision.
- Runtime readiness remains at its previous architectural decision boundary and was not reopened.
- Provisioning service identity remains at its previous `MASTER REVIEW REQUIRED` boundary and was not reopened.

## Gate 04 Evidence

### Exact Hardening Gap
The Engine durably protects workflow execution ownership with a Firestore lease, but an external side effect can succeed before durable `completeExecution()` is recorded. If the worker then crashes or the lease expires, a later worker can legitimately retry the side effect. The durable execution key therefore does not by itself guarantee exactly-once external effects.

### Evidence
- `src/persistence/firestore/repositories/workflowStepExecutionRepository.ts` provides durable claim, lease renewal, completion, failure, and expired-lease recovery.
- Gate 03 already documented the crash-after-external-side-effect-before-`completeExecution()` risk.
- Connector paths perform external side effects but there is no universal Engine contract establishing provider idempotency-key/reconciliation semantics.

### Change Made
No production code change. Created `docs/PRODUCTION_HARDENING_GATE_04_2026-09-22.md` documenting the blocker and required architectural decision.

### Required Master Decision
Define the authoritative contract for:
- Engine-to-provider idempotency keys;
- provider support requirements and unsupported-provider handling;
- retry/reconciliation behavior after lease expiry;
- authoritative mapping between Engine execution and provider operation.

A local flag, client-side suppression, or duplicate state store would weaken the established architecture and was deliberately not introduced.

### Verification
- Repository inspection: **COMPLETED**.
- Relevant workflow/connector source inspection: **COMPLETED**.
- Typecheck: **NOT EXECUTED** — local shell/npm unavailable through connected repository tooling.
- Lint: **NOT EXECUTED**.
- Targeted tests: **NOT EXECUTED**.
- Full tests: **NOT EXECUTED**.
- Production build: **NOT EXECUTED**.
- No passing execution result is claimed.

### Boundary
- DBK impact: **NONE**.
- Sokoni impact: **NONE**.
- Provisioning identity: **NOT TOUCHED**.
- Existing workflow lease authority: **PRESERVED**.
- Existing durable execution-key authority: **PRESERVED**.
- No duplicate source of truth introduced.

### Classification
**MASTER REVIEW REQUIRED**

The gap cannot be safely closed without deciding the external-provider idempotency/reconciliation contract.

## New Engine Contracts
- None. The correction enforces the existing durable execution-key/lease semantics.

## Contracts Required by DBK
- None introduced.
- DBK impact: **NONE**.

## Contracts Required by Sokoni
- None introduced.
- Sokoni impact: **NONE**.

## Blocking Issues
- Local test/typecheck/lint/build execution is unavailable through connected repository tooling.
- CI completion for the final hardening commit was not available during this task.

## MASTER REVIEW REQUIRED
- **Gate 04 requires Master review** for the Engine-to-provider idempotency/reconciliation contract.
- No implementation should begin until that contract is decided.
- Existing provisioning service-identity and runtime-readiness decisions remain untouched.

## Next Recommended Engine Task
**STOP.** Gate 04 is blocked pending Master review. After the decision, assign one implementation task for the approved external side-effect idempotency/reconciliation contract. Do not begin it automatically.

## Dependency Handoffs

### DBK
No Engine dependency introduced. No DBK source was changed by this task.

### SOKONI
No Engine dependency introduced. No Sokoni source was changed by this task.

## Evidence
- Repository: `thuram34/tdbk-v2-platform`.
- Gate 03 starting state: `fddcbf951984ad8bf5f21a8d5b646085302b1a38`.
- Hardening correction: `950c95bf6db901759d91d666bd4cd3c5fb39b6f6`.
- Focused regression test: `15da5c3aceea91554fd25cbe6f218be43012f01e`.
- Gate 03 evidence: `d9b26e2ac3bfe6e8fed7c972521d60b01697760a`.
- Scope-cleanup correction: `4a5c2934f463eea14d5b7ea68e1571fd1becac3c`.
- Gate 04 blocker: `docs/PRODUCTION_HARDENING_GATE_04_2026-09-22.md`.
- Concurrent DBK commits observed in repository history were separate work and were not modified by this Engine task.
