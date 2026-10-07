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

## Master Architectural Decision

**DECIDED — Gate 04 contract is established. Implementation is intentionally NOT started.**

The Engine contract is:

1. **Engine execution identity:** the existing durable `WorkflowStepExecution.executionKey` remains the canonical identity of one logical workflow-step execution. Worker IDs and lease attempts are ownership metadata, not new operation identities.
2. **Idempotency identity:** the existing durable Engine idempotency request binding remains the authority for the incoming logical request. A side-effecting workflow step must derive its provider-operation identity deterministically from the canonical Engine execution identity plus the connector operation. The derivation must be stable across retries and must never depend on worker ID, attempt count, wall-clock time, or random values.
3. **Provider-side idempotency:** where a provider explicitly supports idempotency, the connector MUST pass the stable Engine-derived provider-operation key and MUST preserve the provider's documented deduplication scope/semantics. The Engine may claim at-most-one logical provider operation only to the extent that the provider contract actually guarantees deduplication for that key.
4. **Providers without idempotency:** a connector that cannot provide provider-side deduplication MUST NOT pretend to provide exactly-once external effects. After an ambiguous transport/process failure, the Engine MUST NOT blindly replay a non-idempotent side effect. The execution enters an UNKNOWN / reconciliation-required path until provider state is resolved.
5. **Retry after lease expiry:** lease expiry authorizes another worker to recover Engine execution ownership; it does NOT by itself authorize repeating an ambiguous external side effect. Recovery must first inspect the durable Engine execution/provider-operation record and, where supported, query or reconcile provider state using the provider reference or deterministic operation identity.
6. **Unknown external outcome:** UNKNOWN is a first-class operational outcome at the Engine/connector boundary. It means the provider outcome is not known, not that the operation failed. Financial operations MUST remain pending/reconciliation-required and MUST NOT be posted as successful until authoritative provider evidence is obtained.
7. **Durable mapping:** the authoritative mapping between Engine execution and provider operation belongs to the existing Engine durable execution authority. Connector-specific provider references, operation identifiers, and reconciliation state may be recorded as execution outcome metadata or in the domain's existing authoritative transaction record (for example, `FinancialTransaction.providerReference` / `RECONCILIATION_REQUIRED`). No parallel idempotency store or client-side authority is permitted.
8. **Audit semantics:** the Engine must distinguish at minimum `REQUESTED`, `PROVIDER_ACCEPTED`, `PROVIDER_REJECTED`, `UNKNOWN_OUTCOME`, `RECONCILIATION_REQUIRED`, `RECONCILED_SUCCESS`, and `RECONCILED_FAILURE` where those states are applicable. Audit records are evidence of transitions; they are not the source of execution truth.
9. **Financial safety:** ambiguous payment/tax/financial operations default to non-posting states. A provider reference alone is evidence for reconciliation/correlation, not permission to create ledger truth. Ledger posting remains governed by the existing financial truth layer and balanced immutable entries.
10. **Connector compatibility:** every side-effecting production connector must declare its idempotency/reconciliation capability. A connector is production-safe for a side effect only if it either (a) supports provider-side idempotency compatible with the Engine contract, or (b) has a provider-specific authoritative query/reconciliation path that prevents blind replay after UNKNOWN. Connectors supporting neither are not eligible for automatic retry of non-idempotent side effects.

### Exactly-once boundary

The Engine does **not** claim universal exactly-once external execution. Exactly-once logical provider effect is claimable only for a provider operation when the provider itself guarantees deduplication under the stable idempotency key, or equivalent provider-specific semantics. Otherwise the Engine guarantees durable identity, conservative retry behavior, and reconciliation rather than exactly-once execution.

### Current repository evidence that shaped the decision

- `IdempotencyRecord.requestHash` already binds a logical request to its durable idempotency key.
- `WorkflowStepExecution` already provides durable execution identity, attempt count, lease ownership, output, error, and completion state.
- `MpesaBridge` already demonstrates the required conservative financial pattern in one boundary: it persists a pending transaction, binds a provider reference when received, and can move an uncertain accepted-provider case to `RECONCILIATION_REQUIRED` rather than claiming success.
- `FinancialTransaction` already supports `PENDING`, `POSTED`, `FAILED`, `REVERSED`, and `RECONCILIATION_REQUIRED`, with `providerReference` and `providerReceiptReference`.
- `ReconciliationService` and `ReconciliationRepository` already prevent status-only promotion to POSTED and route confirmed reconciliation through the authoritative ledger.
- `EtimsBridge` currently refuses production submission because no provider client is connected; therefore no production eTIMS side-effect contract is being invented by this review.
- The outbox and workflow lease mechanisms remain at-least-once delivery mechanisms; their durable completion records do not by themselves prove an external provider effect.

### Implementation boundary

This is an architectural decision only. No production source was changed. The next task is a single implementation task to encode this contract in the existing Engine/bridge boundary, starting with capability declaration and the durable execution/provider-operation mapping. No DBK, Sokoni, provisioning identity, or existing request-binding redesign is authorized by this decision.

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


## Grand Operation Superseding Status — 2026-10-07

The historical Gate 04 rule remains valid: the Engine must not invent provider idempotency.

The current branch now adds an authoritative reconciliation action for providers that expose a supported reconciliation contract. Ambiguous M-Pesa operations can be reconciled through the registered query operation and the waiting workflow is resumed from the durable reconciled state. Providers without an authoritative reconciliation contract remain unresolved rather than being guessed or replayed.
