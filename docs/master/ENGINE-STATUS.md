# TDBK ENGINE STATUS

## Last Updated
2026-09-23

## Current Phase
Production Hardening — Gate 04 Provider-Specific Idempotency

## Current Objective
Determine whether one current production bridge has an authoritative provider contract that supports a stable idempotency/deduplication key compatible with the Engine-derived provider-operation identity. Implement propagation only if that contract is established.

## Task Completed
**BLOCKED — no eligible connector established.**

The repository was inspected before implementation. The existing Engine already provides the required deterministic provider-operation identity through `deriveProviderOperationIdentity(executionKey, operation)`, and WorkflowStepExecution remains the durable execution authority. The Gate 04 workflow engine also refuses replay after `UNKNOWN_OUTCOME` / `RECONCILIATION_REQUIRED` when provider idempotency is not supported. No second idempotency store or alternate execution identity was introduced.

The candidate connector was M-Pesa because it is the only currently connected production-capable side-effecting adapter in the repository. Its adapter explicitly declares `providerIdempotency: false` and `providerReconciliation: true`. The current production STK Push request contains the documented Daraja request fields but no Engine-derived idempotency key is propagated to Safaricom. The current adapter uses the provider's returned `CheckoutRequestID` as the provider reference after the provider accepts the request. It therefore cannot safely be changed to claim provider-side idempotency without authoritative evidence that Safaricom Daraja STK Push accepts a caller-supplied stable idempotency key and guarantees deduplication for it.

## Provider Contract Evidence
Authoritative Safaricom Daraja documentation was checked through the Safaricom Developer Portal. The portal establishes Daraja 3.0 as the official M-PESA API platform, but the publicly retrievable material available in this review did **not establish an STK Push caller-supplied idempotency-key field or a provider-side deduplication guarantee compatible with the Engine-derived operation identity**. The available official portal search results did not expose such a contract.

This is insufficient evidence for safely setting M-Pesa `providerIdempotency` to true or adding an invented header/body field. Therefore implementation was intentionally stopped.

Official source reviewed: Safaricom Daraja Developer Portal — `https://developer.safaricom.co.ke/` and its API documentation index. The portal describes Daraja 3.0 as the M-PESA API platform, but the reviewed material does not establish the required idempotency contract. citeturn0search0turn0search1

## Current Engine → M-Pesa Path
1. `WorkflowStepExecution.executionKey` is the canonical Engine execution identity.
2. `deriveProviderOperationIdentity(executionKey, 'STK_PUSH')` deterministically derives the Engine provider-operation identity.
3. `prepareExternalSideEffect()` and the durable execution repository already preserve this identity at the Engine boundary.
4. `MpesaBridge.execute()` currently performs the production STK Push using the normal Daraja request body and does not propagate the Engine-derived operation identity to Safaricom.
5. Safaricom returns `MerchantRequestID` / `CheckoutRequestID`; the adapter persists the returned provider reference in the existing authoritative financial transaction boundary.
6. Ambiguous provider acceptance/local persistence failure is routed to reconciliation rather than being converted to successful ledger truth.

The existing path therefore preserves conservative UNKNOWN/reconciliation behavior, but it does **not** provide provider-side idempotency.

## Connector Capability State
| Connector | Provider idempotency | Reconciliation | Decision |
|---|---:|---:|---|
| M-Pesa / Safaricom Daraja | false | true | **BLOCKED for propagation** — no authoritative provider deduplication contract established |
| Generic Bank | false | false | Not eligible — no connected production provider contract |
| eTIMS | false | false | Not eligible — production provider client is not connected |
| SMS | false | false | Not eligible — no authoritative provider idempotency contract established |
| Email | false | false | Not eligible — no authoritative provider idempotency contract established |
| WhatsApp | false | false | Not eligible — no authoritative provider idempotency contract established |

No connector was promoted to provider-idempotent capability.

## Architectural Boundary Preserved
- Existing `WorkflowStepExecution.executionKey`: **PRESERVED**
- Existing deterministic provider-operation identity: **PRESERVED**
- Existing `IdempotencyRecord.idempotencyKey + requestHash`: **PRESERVED**
- Existing workflow lease/reclaim model: **PRESERVED**
- Existing UNKNOWN/reconciliation semantics: **PRESERVED**
- Existing financial ledger authority: **PRESERVED**
- Provisioning service identity: **NOT TOUCHED**
- DBK: **NONE**
- Sokoni: **NONE**
- Second idempotency store: **NOT INTRODUCED**
- Provider API semantics: **NOT INVENTED**

## Exact Files Inspected
- `src/orchestration/bridge/types.ts`
- `src/orchestration/bridge/registry.ts`
- `src/orchestration/bridge/providerOperationIdentity.ts`
- `src/orchestration/bridge/adapters/mpesaBridge.ts`
- `src/orchestration/bridge/adapters/etimsBridge.ts`
- `src/orchestration/bridge/adapters/bankBridge.ts`
- `src/orchestration/bridge/adapters/smsBridge.ts`
- `src/orchestration/bridge/adapters/emailBridge.ts`
- `src/orchestration/bridge/adapters/whatsappBridge.ts`
- `src/orchestration/workflow/engine.ts`
- `src/orchestration/tests/gate04ExternalSideEffect.test.ts`
- `docs/PRODUCTION_HARDENING_GATE_04_2026-09-22.md`
- `docs/master/ENGINE-STATUS.md`

## Exact Files Changed
- `docs/master/ENGINE-STATUS.md` only.

No production source or tests were changed because the required provider contract was not established. This avoids creating a false exactly-once/idempotency guarantee.

## Verification
- GitHub main state inspected: **COMPLETED**
- Current bridge registry inspected: **COMPLETED**
- M-Pesa executable adapter inspected: **COMPLETED**
- Existing Engine provider-operation identity inspected: **COMPLETED**
- Existing workflow UNKNOWN/replay guard inspected: **COMPLETED**
- Existing Gate 04 regression tests inspected: **COMPLETED**
- Official Safaricom Daraja documentation reviewed: **COMPLETED**
- Provider idempotency contract established: **NO**
- Implementation tests: **NOT EXECUTED — no production implementation was made**
- `npm test`: **NOT EXECUTED** — repository connection exposes GitHub operations, not a local shell
- `npm run typecheck`: **NOT EXECUTED**
- `npm run lint`: **NOT EXECUTED**
- `npm run build`: **NOT EXECUTED**

No unexecuted test/build/typecheck/lint result is claimed as PASS.

## Blocking Issue
**MASTER REVIEW REQUIRED / PROVIDER CONTRACT GAP:** To implement provider-specific idempotency for M-Pesa, the Engine needs authoritative Safaricom documentation or an approved provider contract that explicitly defines a caller-controlled stable idempotency key for the relevant operation and its deduplication scope/guarantee. The current public evidence reviewed does not establish that contract.

Until that evidence exists, the correct Engine capability remains `providerIdempotency: false` and the current conservative reconciliation model must remain authoritative.

## Remaining Gate 04 Work
1. Establish an authoritative provider-side idempotency contract for a specific connector/operation before propagation.
2. Only then implement the minimal Engine-derived key propagation and focused duplicate-invocation regression test.
3. Complete remaining Gate 04 reconciliation/audit/financial-safety hardening separately; do not bundle it into this blocked task.

## Next Single Engine Task
**Obtain/verify an authoritative provider idempotency contract for one specific connector operation — preferably Safaricom Daraja STK Push if the provider documentation/support contract can establish caller-supplied deduplication semantics.** Do not modify production code until that contract is established.

## Evidence
- Current main commit at task start: `68cd266534b5654cf158880bd309b4dd844290e0`
- Current deterministic identity implementation: `src/orchestration/bridge/providerOperationIdentity.ts`
- Current M-Pesa capability declaration: `src/orchestration/bridge/adapters/mpesaBridge.ts`
- Current Gate 04 capability registry: `src/orchestration/bridge/registry.ts`
- Current Gate 04 execution/replay guard: `src/orchestration/workflow/engine.ts`
- Current Gate 04 regression coverage: `src/orchestration/tests/gate04ExternalSideEffect.test.ts`
