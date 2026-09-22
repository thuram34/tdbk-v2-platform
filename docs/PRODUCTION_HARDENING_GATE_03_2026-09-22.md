# TDBK V2 ENGINE — PRODUCTION HARDENING GATE 03

## Scope
One hardening boundary only: durable workflow-step lease idempotency/concurrency.

Excluded: provisioning identity, readiness architecture, DBK, Sokoni, public discovery, payment/bridge logic, and unrelated defects.

## Starting State
Repository state began at `fddcbf951984ad8bf5f21a8d5b646085302b1a38`.

The previous readiness gate was treated as closed. The provisioning service-identity decision was not reopened or changed.

## Selected Gap
The existing durable workflow-step execution repository defines the execution key as the idempotency boundary, but `claimExecution()` previously allowed a second claim while an active lease belonged to the same worker.

Previous behavior:
- active lease was rejected only when `current.workerId !== workerId`;
- the same worker could re-claim the same active execution key;
- the repository incremented `attemptCount` and rewrote the execution lease;
- a caller could therefore re-enter a live step execution and potentially invoke the step handler more than once under the same worker identity.

This contradicted the repository's established statement that the durable execution key is the workflow-step idempotency boundary.

## Fix
Changed only `WorkflowStepExecutionRepository.claimExecution()` so **any active lease is exclusive**, regardless of whether the claimant has the same worker ID.

A second claim now returns `null` while the existing execution lease is live. Completed and failed executions retain their existing idempotent return behavior. Expired leases can still be reclaimed through the existing recovery mechanism.

No new authority, persistence model, or idempotency contract was introduced.

## Test Added
`src/persistence/tests/workflowStepExecutionIdempotency.test.ts`

The focused test proves:
1. first claim creates `EXECUTING` state with attempt count 1;
2. second claim with the same execution key and same worker returns `null` while the lease is active;
3. durable attempt count remains 1;
4. durable worker ownership remains unchanged.

## Architectural Boundary Preserved
- Firestore remains authoritative production persistence.
- The existing deterministic execution key remains the idempotency boundary.
- Existing workflow lease/recovery semantics remain intact.
- Tenant-scoped execution paths remain unchanged.
- No external provider idempotency contract was invented.
- No provisioning service identity was modified.
- No audit-system redesign was introduced.

## Verification
The connected repository environment does not expose a local shell/npm execution path. Therefore:
- typecheck: NOT EXECUTED
- lint: NOT EXECUTED
- focused test: NOT EXECUTED
- full tests: NOT EXECUTED
- production build: NOT EXECUTED

No passing execution result is claimed.

The source and focused test were inspected after modification. GitHub repository CI is expected to run from the resulting commit, but a completed CI result was not available during this task.

## Remaining Hardening Risks
- Crash-after-external-side-effect-before-`completeExecution()` remains an at-least-once delivery risk for external side effects; solving that generally requires an established downstream idempotency contract and is outside this single correction.
- Runtime readiness remains the previously documented architectural boundary and was not reopened.
- Provisioning service identity remains at the previously documented `MASTER REVIEW REQUIRED` boundary and was not reopened.

## Files Changed
- `src/persistence/firestore/repositories/workflowStepExecutionRepository.ts`
- `src/persistence/tests/workflowStepExecutionIdempotency.test.ts`
- `docs/PRODUCTION_HARDENING_GATE_03_2026-09-22.md`
- `docs/master/ENGINE-STATUS.md`

No DBK or Sokoni files changed.

## Classification
**PASS after focused correction**, subject to repository CI execution because local verification is unavailable.
