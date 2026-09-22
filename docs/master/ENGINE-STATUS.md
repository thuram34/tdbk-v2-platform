# TDBK ENGINE STATUS

## Last Updated
2026-09-22

## Current Phase
Production Hardening — Idempotency Request Binding

## Current Objective
Close one concrete production-hardening gap using the existing authoritative Engine idempotency contract. Do not reopen provisioning identity, runtime readiness, DBK, Sokoni, public discovery, payment, or bridge architecture.

## Task Performed
Hardened the existing durable idempotency repository so an idempotency key cannot silently be reused for a different request payload.

## Exact Hardening Gap
`IdempotencyRecord` already contains `requestHash`, and all major idempotent callers already populate it. However, `claimIdempotencyRecord()` previously ignored the stored hash. When an existing claim expired, a caller could reuse the same tenant/key with a different `requestHash` and overwrite the durable record, changing the operation represented by the same idempotency key.

This was a concrete integrity defect in an already-established Engine contract; it did not require a new authority or API model.

## Why It Mattered
Idempotency keys are intended to bind retries/replays to the same logical request. Allowing a different request under the same durable key weakens replay safety and can turn a retry identifier into an operation-substitution mechanism after expiry.

## Change Made
`src/persistence/firestore/repositories/idempotencyRepository.ts`
- Compare an existing durable `requestHash` with the incoming record inside the existing Firestore transaction.
- Reject a mismatched request with the existing `KernelError` validation/error mechanism and HTTP 409 semantics.
- Perform the comparison before status handling, so mismatch is rejected for COMPLETED, IN_PROGRESS, and expired records.
- Preserve existing CLAIMED / COMPLETED / IN_PROGRESS behavior when the request hash matches.
- Preserve the existing tenant-scoped Firestore path and transactional authority.

`src/persistence/tests/idempotencyRepositoryHardening.test.ts`
- Added regression coverage for a mismatched request after expiry.
- Added coverage proving the same request hash can reclaim an expired record.
- Added coverage proving a mismatched request is rejected even when the original record is already COMPLETED.

## Architectural Boundary Preserved
- Firestore remains the authoritative idempotency state.
- Existing `IdempotencyRecord.requestHash` remains the authority; no duplicate state was introduced.
- Existing `IdempotencyClaimResult` contract was not changed.
- Existing tenant isolation was preserved.
- Existing provisioning identity model was not touched.
- Existing workflow execution lease model was not touched.
- No external-provider idempotency architecture was invented.
- No client-side authority was added.
- No DBK or Sokoni source was modified.

## Verification Performed
- Latest GitHub repository state inspected before implementation: **COMPLETED**.
- Latest Engine status and prior Gate 04 blocker inspected: **COMPLETED**.
- Idempotency repository implementation inspected: **COMPLETED**.
- Existing `requestHash` contract and all major call sites inspected: **COMPLETED**.
- Focused regression test added: **COMPLETED**.
- Resulting source scope inspected: **COMPLETED**.
- Typecheck: **NOT EXECUTED** — local npm/shell execution is unavailable through the connected repository tooling.
- Lint: **NOT EXECUTED**.
- Targeted test execution: **NOT EXECUTED**.
- Full test suite: **NOT EXECUTED**.
- Production build: **NOT EXECUTED**.
- No passing execution result is claimed without execution evidence.

## Remaining Hardening Risks
- The Gate 04 external side-effect crash/retry boundary remains unresolved: provider-side idempotency/reconciliation still requires a separate Master architectural decision.
- Provisioning service identity remains at its previously closed `MASTER REVIEW REQUIRED` boundary and was not reopened.
- Runtime readiness remains at its previous decision boundary and was not reopened.
- Verification commands remain unexecuted because repository tooling does not expose local shell/npm execution.

## MASTER REVIEW REQUIRED
- Gate 04 external side-effect idempotency/reconciliation remains a separate architectural decision.
- This task did not alter or resolve that boundary.

## DBK Impact
NONE. No DBK source was modified and no DBK contract changed.

## Sokoni Impact
NONE. No Sokoni source was modified and no Sokoni contract changed.

## Exact Files Changed
- `src/persistence/firestore/repositories/idempotencyRepository.ts`
- `src/persistence/tests/idempotencyRepositoryHardening.test.ts`
- `docs/master/ENGINE-STATUS.md`

## Next Recommended Engine Task
**STOP.** Do not automatically begin another hardening area. Master should review the remaining external side-effect idempotency/reconciliation contract before assigning its implementation task.

## Evidence
- Repository: `thuram34/tdbk-v2-platform`.
- Latest repository history inspected before task: latest commits included separate DBK work; no DBK source was modified by this task.
- Production hardening code commit: `bd2b1a14e8114066f4bb7f65b10d57528a8909b2`.
- Focused regression test commit: `bb4b26bdeab913eec113d1321ad716db65a7d71c`.
- Status update commit: recorded by the subsequent `ENGINE-STATUS.md` update.
