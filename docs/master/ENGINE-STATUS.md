# TDBK ENGINE STATUS

## Last Updated
2026-09-23

## Current Phase
Production Hardening — Gate 04 Implementation Slice 2: Safe Side-Effect Execution & UNKNOWN Recovery

## Current Objective
Establish the authoritative Engine contract for external side effects across worker crash, lease expiry, transport ambiguity, provider callbacks, and reconciliation without introducing a second authority or claiming universal exactly-once execution.

## Task Performed
Implemented Gate 04 Slice 2 only: the existing durable provider-operation mapping is now wired into the Engine workflow side-effect boundary, with pre-side-effect binding, durable outcome recording, and conservative UNKNOWN recovery. The broader Gate 04 contract remains incomplete.

## Gate 04 Decision
**DECIDED — IMPLEMENTATION AUTHORIZED.**

The Engine execution identity remains the existing durable `WorkflowStepExecution.executionKey`. The existing durable request-binding contract (`IdempotencyRecord.idempotencyKey` + `requestHash`) remains authoritative for the logical request and is not redesigned.

For a side-effecting workflow step, the provider-operation identity must be deterministic from the canonical Engine execution identity plus connector operation. It must not depend on worker ID, attempt count, time, or randomness.

Where the provider supports idempotency, the connector must pass the stable operation key and honor the provider's actual deduplication semantics. Where the provider does not support idempotency, the Engine must not blindly replay an ambiguous side effect after lease expiry. The operation becomes UNKNOWN / RECONCILIATION_REQUIRED until provider state is authoritatively resolved.

The Engine does not claim universal exactly-once external execution. Exactly-once is claimable only where the provider contract itself guarantees deduplication for the stable operation identity (or equivalent provider-specific semantics).

## Authoritative State / Mapping
The existing Engine durable execution authority remains the source of truth for execution ownership and execution outcome. Provider operation/reference metadata must be attached to that existing execution authority or to an already-authoritative domain record such as `FinancialTransaction`; no parallel idempotency database/store is permitted.

For financial operations, `PENDING` / `RECONCILIATION_REQUIRED` is the safe state during an ambiguous provider outcome. Ledger truth is created only through the existing financial ledger authority after authoritative confirmation.

## Audit Contract
External side-effect transitions must be auditable with semantics that distinguish, where applicable: `REQUESTED`, `PROVIDER_ACCEPTED`, `PROVIDER_REJECTED`, `UNKNOWN_OUTCOME`, `RECONCILIATION_REQUIRED`, `RECONCILED_SUCCESS`, and `RECONCILED_FAILURE`. Audit is evidence, not execution authority.

## Connector Contract
Every production side-effecting connector must declare whether it supports:
- provider-side idempotency compatible with the Engine operation key; and/or
- authoritative provider query/reconciliation after UNKNOWN.

A connector supporting neither is not eligible for automatic replay of a non-idempotent side effect after an ambiguous outcome.

## Repository Evidence Reviewed
- `src/persistence/firestore/repositories/idempotencyRepository.ts`
- `src/persistence/types.ts`
- `src/persistence/firestore/repositories/workflowStepExecutionRepository.ts`
- `src/orchestration/workflow/engine.ts`
- `src/orchestration/outbox/outboxEngine.ts`
- `src/orchestration/bridge/types.ts`
- `src/orchestration/bridge/adapters/mpesaBridge.ts`
- `src/orchestration/bridge/adapters/etimsBridge.ts`
- `src/persistence/firestore/repositories/connectorConnectionRepository.ts`
- `src/persistence/firestore/repositories/reconciliationRepository.ts`
- `src/finance/reconciliationService.ts`
- `src/kernel/audit/auditLogger.ts`
- `src/persistence/firestore/repositories/auditRepository.ts`
- relevant M-Pesa duplicate/restart/idempotency tests and reconciliation persistence tests

## Important Existing Evidence
- `requestHash` mismatch protection is already implemented in the durable idempotency repository.
- Workflow-step leases prevent concurrent duplicate claims but do not prove provider-side exactly-once effects.
- M-Pesa already has a conservative `RECONCILIATION_REQUIRED` path when provider acceptance is known but local binding is uncertain, and duplicate callbacks are protected.
- eTIMS currently has no connected production provider client, so this review does not invent an eTIMS provider contract.
- Financial persistence already has `providerReference` and `RECONCILIATION_REQUIRED`, and confirmed reconciliation is routed through the ledger rather than status-only mutation.

## Implementation Status
**SLICE 2 COMPLETE — GATE 04 NOT COMPLETE.**

Implemented:
- deterministic provider-operation identity derived from `executionKey + connector operation` using SHA-256;
- explicit bridge capability declaration for provider-side idempotency and provider reconciliation;
- durable provider-operation mapping fields on the existing `WorkflowStepExecution` authority;
- persisted canonical provider operation name plus provider/reference metadata;
- worker-owned transactional binding of provider operation/reference metadata;
- workflow handlers can durably prepare a side effect before the external call and record the provider outcome against the same execution identity;
- recovery refuses blind replay of `UNKNOWN_OUTCOME` / `RECONCILIATION_REQUIRED` operations when provider idempotency is not supported;
- a handler's local success result cannot promote a durable UNKNOWN/reconciliation-required outcome to completed Engine truth;
- recovery parks unresolved non-idempotent provider outcomes in `WAITING_FOR_EXTERNAL_RESULT` rather than converting reconciliation-required state into a workflow failure;
- focused regression coverage for identity determinism, capability declaration, durable association, reclaim preservation, and UNKNOWN execution safety.

No second idempotency store was introduced. Existing requestHash/idempotency and workflow lease contracts were preserved.

## Verification
- Latest repository architecture inspected: **COMPLETED**
- Slice 2 implementation reviewed after final recovery-safety fix: **COMPLETED**
- Current Engine status inspected: **COMPLETED**
- Existing idempotency/requestHash hardening inspected: **COMPLETED**
- Workflow execution lease model inspected: **COMPLETED**
- Connector architecture/configuration/health inspected: **COMPLETED**
- M-Pesa/eTIMS paths inspected: **COMPLETED**
- Reconciliation/financial persistence inspected: **COMPLETED**
- Audit model inspected: **COMPLETED**
- Retry/duplicate callback/outbox tests/docs inspected: **COMPLETED**
- Typecheck: **NOT EXECUTED** — connected GitHub tooling does not expose local npm/shell execution.
- Lint: **NOT EXECUTED**
- Targeted tests: **NOT EXECUTED**
- Full tests: **NOT EXECUTED**
- Production build: **NOT EXECUTED**
- CI execution evidence for this documentation-only decision: **NOT AVAILABLE**
No unverified PASS is claimed.

## Scope Boundary
- DBK: **NONE**
- Sokoni: **NONE**
- Provisioning service identity: **NOT TOUCHED**
- Existing request-binding idempotency: **PRESERVED**
- Existing workflow lease authority: **PRESERVED**
- Duplicate state outside Engine: **NOT INTRODUCED**

## Remaining Gate 04 Work
Not complete. Remaining work includes provider-specific idempotency propagation where actually supported, authoritative provider reconciliation handling, audit transition semantics, and financial safety enforcement across ambiguous outcomes. Connector declarations must also remain consistent with executable bridge behavior.

## Next Single Engine Task
Normalize and verify provider side-effect capability declarations at the authoritative bridge registry/adapter boundary. Do not implement provider APIs, redesign connector configuration, or expand into DBK/Sokoni.