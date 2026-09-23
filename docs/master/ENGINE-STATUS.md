# TDBK ENGINE STATUS

## Last Updated
2026-09-23

## Current Phase
Production Hardening — Gate 04 Capability Declaration Normalization

## Current Objective
Verify that side-effect capability declarations at the authoritative bridge registry/adapter boundary match executable adapter behavior without inventing provider capabilities or changing the Gate 04 execution identity/recovery architecture.

## Task Performed
Completed the Gate 04 capability declaration normalization task. The authoritative registry and executable adapter declarations were inspected connector-by-connector. The concrete contradiction found was the Generic Bank bridge declaring provider reconciliation while its executable adapter explicitly reports that no production provider client is connected and therefore has no authoritative provider-state recovery path. That declaration was corrected to `providerReconciliation: false`. M-Pesa remains `providerReconciliation: true` because its executable path has a durable provider-reference callback/recovery path and conservative reconciliation handling; it does not claim provider-side idempotency. eTIMS, SMS, Email, and WhatsApp remain `false/false` because their current executable paths do not establish provider-side idempotency or authoritative provider-state reconciliation.

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

## Connector Capability Verification
| Connector | Provider idempotency | Authoritative reconciliation | Result |
|---|---:|---:|---|
| M-Pesa | false | true | PASS — executable adapter has durable provider-reference callback/recovery and reconciliation handling; `QUERY_TRANSACTION`/`RECONCILE` command branches themselves remain explicitly unavailable, so no provider query capability is claimed |
| Generic Bank | false | false | FIXED — adapter has no connected production provider client; UNKNOWN is simulated/conservatively surfaced, but no authoritative provider-state query/recovery path exists |
| eTIMS | false | false | PASS — current production path refuses submission because no provider client is connected |
| SMS | false | false | PASS — current adapter does not establish provider idempotency or authoritative reconciliation |
| Email | false | false | PASS — current adapter does not establish provider idempotency or authoritative reconciliation |
| WhatsApp | false | false | PASS — current adapter does not establish provider idempotency or authoritative reconciliation |

No connector is currently declared provider-idempotent. No provider capability was inferred from generic operation names or mocks.

## Implementation Status
**GATE 04 CAPABILITY NORMALIZATION COMPLETE — GATE 04 NOT COMPLETE.**

Implemented in this task:
- corrected the Generic Bank authoritative registry declaration from `providerReconciliation: true` to `false`;
- corrected the executable `BankBridge` declaration to `providerReconciliation: false`;
- aligned Gate 04 capability regression tests with all six side-effecting adapters and their registry definitions;
- preserved M-Pesa's existing reconciliation capability declaration because its executable callback/recovery path supports the already-established conservative reconciliation model.

No provider API was implemented. No provider-side idempotency claim was introduced. No execution identity, WorkflowStepExecution model, provisioning identity, DBK, or Sokoni architecture was changed.

## Verification
- Current main repository state inspected: **COMPLETED**
- Gate 04 architecture/documentation inspected: **COMPLETED**
- Bridge capability type/registry inspected: **COMPLETED**
- M-Pesa adapter inspected: **COMPLETED**
- Generic Bank adapter inspected: **COMPLETED**
- eTIMS adapter inspected: **COMPLETED**
- SMS adapter inspected: **COMPLETED**
- Email adapter inspected: **COMPLETED**
- WhatsApp adapter inspected: **COMPLETED**
- Registry/adapter capability regression updated for all six connectors: **COMPLETED**
- Typecheck: **NOT EXECUTED** — connected GitHub tooling does not expose local npm/shell execution.
- Lint: **NOT EXECUTED**
- Targeted tests: **NOT EXECUTED**
- Full tests: **NOT EXECUTED**
- Production build: **NOT EXECUTED**
- CI execution evidence for this task: **NOT AVAILABLE**
No unverified PASS is claimed for executable verification.

## Scope Boundary
- DBK: **NONE**
- Sokoni: **NONE**
- Provisioning service identity: **NOT TOUCHED**
- Existing request-binding idempotency: **PRESERVED**
- Existing workflow lease authority: **PRESERVED**
- Existing provider-operation identity: **PRESERVED**
- Reconciliation architecture: **PRESERVED**
- Duplicate state outside Engine: **NOT INTRODUCED**

## Remaining Gate 04 Work
Gate 04 remains incomplete. Remaining work includes provider-specific idempotency propagation where a real provider contract supports it, authoritative provider reconciliation handling beyond the existing M-Pesa recovery boundary, complete audit transition semantics, and financial safety enforcement across ambiguous outcomes.

## Next Single Engine Task
Implement provider-specific idempotency propagation for one connector only, but only after verifying an actual provider contract that guarantees deduplication for the Engine-derived operation identity. Do not invent provider semantics or expand into other connectors in that task.

## Evidence
- Main before task: `473db6f68d82290f1cd09dbe4cb2f4576a6f98fd`
- Capability normalization commits: `e091acbed8576f79206242103fa5b7c5e4861ff9`, `431544ad98187aad0518a61348f283b778142b12`, `c207651b30dbcda2e29fc8f9bece2c59f5e252f3`, `eee3df7aa3df0fa99254ae16fbf7844f46560a32`
- Exact implementation files changed: `src/orchestration/bridge/registry.ts`, `src/orchestration/bridge/adapters/bankBridge.ts`, `src/orchestration/tests/gate04ExternalSideEffect.test.ts`, `docs/master/ENGINE-STATUS.md`
