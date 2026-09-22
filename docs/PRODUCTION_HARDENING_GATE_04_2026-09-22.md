# TDBK V2 ENGINE — PRODUCTION HARDENING GATE 04

## Scope

One unresolved production-hardening boundary only: **external side-effect idempotency after workflow execution ownership is lost or the process crashes before durable completion**.

Excluded: provisioning identity, readiness architecture, DBK, Sokoni, public discovery, unrelated authorization, and unrelated connector redesign.

## Exact Gap

The Engine now durably claims workflow steps with an exclusive Firestore lease. However, the lease protects **Engine execution ownership**, not the external side effect performed by a connector or downstream provider.

Failure sequence:

1. Engine durably claims an execution key.
2. Worker invokes an external side effect using a connector/provider.
3. Provider accepts the side effect.
4. Worker crashes, times out, or loses the lease before completeExecution() is durably committed.
5. A later worker legitimately reclaims the expired execution.
6. The Engine can invoke the provider again.

The existing workflow execution repository therefore provides at-least-once delivery across this crash boundary. The durable execution key alone cannot guarantee exactly-once external effects.

## Evidence

The existing repository contract exposes durable claimExecution(), lease expiry/reclamation, completeExecution(), and failExecution() operations.

The existing Engine therefore has authoritative execution state, but no universal contract tying an external provider's idempotency key to the Engine execution key.

The previous Gate 03 evidence explicitly identified this same remaining risk.

## Why It Matters

This boundary can duplicate externally visible operations such as payments, invoices, messages, or other connector side effects if a provider succeeds but the Engine does not durably record completion before worker failure.

Adding a local flag, client-side retry suppression, or a second Engine state store would not safely solve the problem and would violate the established authority model.

## Required Architectural Decision

**MASTER REVIEW REQUIRED**

The Engine needs one explicit policy for external side-effect idempotency before this gap can be safely closed.

The decision must define:

1. whether every side-effecting connector MUST accept an Engine-supplied idempotency key;
2. whether the canonical key is the existing durable workflow execution key or a derived connector-operation key;
3. how providers that do not support idempotency are handled;
4. whether such connectors are permitted for production side effects or require reconciliation/UNKNOWN state;
5. how retries after lease expiry are reconciled against provider state;
6. which layer owns the authoritative mapping between Engine execution and provider operation.

No implementation was made because these choices are architectural contracts, not safe local hardening changes.

## Change Made

No production code was changed.

This gate records the concrete blocker rather than inventing a workaround or duplicate authority.

## Verification

Repository inspection completed.

Relevant existing implementation inspected:

- src/persistence/firestore/repositories/workflowStepExecutionRepository.ts
- src/orchestration/outbox/outboxEngine.ts
- connector implementations including bank/eTIMS/WhatsApp paths
- docs/PRODUCTION_HARDENING_GATE_03_2026-09-22.md

Local shell/npm execution is not exposed through the connected repository tooling, so:

- typecheck: NOT EXECUTED
- lint: NOT EXECUTED
- targeted tests: NOT EXECUTED
- full tests: NOT EXECUTED
- production build: NOT EXECUTED

No passing execution result is claimed.

## Boundary

- DBK: NONE
- Sokoni: NONE
- Provisioning identity: NOT TOUCHED
- Existing workflow lease authority: PRESERVED
- Existing durable execution-key authority: PRESERVED
- No duplicate source of truth introduced.

## Classification

**MASTER REVIEW REQUIRED**

This gate is intentionally blocked pending the architectural decision above.

## Next Single Engine Task

STOP.

After Master decides the external side-effect idempotency/reconciliation contract, assign one implementation task for that contract. Do not begin it automatically.
