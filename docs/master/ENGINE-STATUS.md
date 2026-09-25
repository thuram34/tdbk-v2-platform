# TDBK ENGINE STATUS

## Last Updated
2026-09-25

## Current Phase
Production Hardening — Gate 04 Provider Side-Effect Capability Contract

## Current Objective
Normalize and verify the authoritative side-effect capability declaration at the Engine bridge registry/adapter boundary without inventing provider idempotency or changing execution identity, workflow leases, reconciliation architecture, provisioning identity, DBK, or Sokoni.

## Task Completed
**COMPLETE — capability contract normalized.**

The Engine now distinguishes four Gate 04 capability facts at the authoritative registry boundary:

1. `providerIdempotency` — whether the provider contract guarantees caller-supplied stable-key deduplication.
2. `providerReconciliation` — whether authoritative provider-state recovery exists after UNKNOWN.
3. `automaticUnknownReplay` — whether UNKNOWN may be replayed automatically. This remains `false` for every current connector because none is provider-idempotent.
4. `providerOperationIdentityRequired` — whether the deterministic Engine execution-derived provider operation identity is required for safe side-effect tracking. This is `true` for all current side-effecting bridge definitions.

No provider idempotency was invented. M-Pesa remains `providerIdempotency: false` and `providerReconciliation: true`. Generic Bank, eTIMS, SMS, Email, and WhatsApp remain `false/false`.

## Authoritative Registry Normalization
`src/orchestration/bridge/registry.ts` is the authoritative declaration boundary. All seeded production bridge definitions now explicitly declare all four Gate 04 policy fields. Runtime registration also normalizes legacy two-field definitions with conservative defaults:

- `automaticUnknownReplay` defaults to `false`;
- `providerOperationIdentityRequired` defaults to `true`.

This prevents a legacy/custom registry definition from silently weakening the UNKNOWN safety boundary.

## Adapter Compatibility
The executable adapters continue to expose the established provider capability pair (`providerIdempotency`, `providerReconciliation`). The registry regression test requires those executable declarations to match the authoritative registry and separately verifies the normalized recovery policy. No adapter was falsely upgraded to provider idempotency.

Current declarations:

| Connector | Provider idempotency | Reconciliation | Automatic UNKNOWN replay | Engine operation identity |
|---|---:|---:|---:|---:|
| M-Pesa / Safaricom Daraja | false | true | false | required |
| Generic Bank | false | false | false | required |
| eTIMS | false | false | false | required |
| SMS | false | false | false | required |
| Email | false | false | false | required |
| WhatsApp | false | false | false | required |

## Provider-Contract Verification — 2026-09-25
The next Gate 04 task was to establish or verify an authoritative provider-side idempotency contract before propagating the Engine-derived provider-operation identity.

For M-Pesa/Daraja, the current official Safaricom Developer Portal exposes Daraja API documentation and a Transaction Status API, but the publicly accessible official material reviewed here does **not** establish a documented caller-supplied idempotency key contract for STK Push that guarantees provider-side deduplication of repeated submissions. The official portal therefore does not provide sufficient evidence to change `providerIdempotency` from `false` or to safely propagate the Engine-derived operation identity as an M-Pesa idempotency key.

Decision: **M-Pesa remains non-idempotent at the Engine capability boundary.** No provider API behavior was inferred, invented, or implemented.

This is a verification result, not evidence that Safaricom can never provide such a contract. A future provider-specific contract may be adopted only when authoritative Safaricom documentation or equivalent provider-controlled evidence establishes the required semantics.

Official evidence reviewed:
- Safaricom Daraja Developer Portal
- Safaricom Transaction Status API listing

## Architectural Boundaries Preserved
- `WorkflowStepExecution.executionKey`: **PRESERVED**
- `deriveProviderOperationIdentity(executionKey, operation)`: **PRESERVED**
- `IdempotencyRecord.idempotencyKey + requestHash`: **PRESERVED**
- Workflow lease/reclaim model: **PRESERVED**
- UNKNOWN / reconciliation safety: **PRESERVED**
- Financial ledger authority: **PRESERVED**
- No second idempotency store: **NOT INTRODUCED**
- Provider APIs: **NOT INVENTED**
- Provisioning service identity: **NOT TOUCHED**
- DBK: **NONE**
- Sokoni: **NONE**

## Exact Files Changed In The Normalization Task
- `src/orchestration/bridge/types.ts`
- `src/orchestration/bridge/registry.ts`
- `src/orchestration/tests/gate04ExternalSideEffect.test.ts`
- `docs/master/ENGINE-STATUS.md`

No connector adapter implementation was changed because the existing executable capability pair was already consistent with the authoritative declarations. No provider API was implemented.

## Verification
Repository inspection covered:
- `src/orchestration/bridge/types.ts`
- authoritative bridge registry
- M-Pesa adapter
- Generic Bank adapter
- eTIMS adapter
- SMS adapter
- Email adapter
- WhatsApp adapter
- provider-operation identity implementation
- Gate 04 workflow execution/replay boundary
- Gate 04 regression tests
- Gate 04 documentation

Focused regression coverage now verifies:
- registry declaration agrees with each executable adapter's provider capability pair;
- M-Pesa remains non-idempotent and reconciliation-capable;
- all current connectors reject automatic UNKNOWN replay;
- all current side-effecting connector definitions require the Engine provider-operation identity;
- legacy registry definitions are normalized to conservative Gate 04 defaults;
- existing deterministic identity, durable mapping, reclaim, and UNKNOWN tests remain present.

**npm test: NOT EXECUTED** — repository tooling available in this session exposes GitHub operations but no local npm/shell execution.

**npm run typecheck: NOT EXECUTED**

**npm run lint: NOT EXECUTED**

**npm run build: NOT EXECUTED**

No unexecuted verification is claimed as PASS.

## Remaining Gate 04 Work
Gate 04 is **NOT COMPLETE**. Remaining work is outside this normalization/contract-verification slice:

1. Implement provider-specific idempotency propagation only after an authoritative provider contract exists.
2. Complete authoritative UNKNOWN/reconciliation enforcement for connectors that cannot safely replay ambiguous non-idempotent operations.
3. Complete remaining reconciliation/audit/financial-safety hardening as separate Engine tasks.

M-Pesa must remain non-idempotent until authoritative Safaricom evidence establishes a compatible provider-side deduplication contract.

## MASTER REVIEW REQUIRED
No new architectural decision was introduced beyond confirming the existing blocker. The provider-contract blocker remains: no current connector has been established as supporting provider-side idempotency compatible with the Engine-derived identity.

## DBK Impact
**NONE.** No DBK files or authority were modified.

## Sokoni Impact
**NONE.** No Sokoni files or authority were modified.

## Next Single Engine Task
**Implement the UNKNOWN/reconciliation enforcement boundary for non-idempotent external side effects, without introducing provider idempotency claims or changing workflow identity/lease architecture.**

## Evidence
- Main normalization baseline: `68cd266534b5654cf158880bd309b4dd844290e0`
- Capability contract type commit: `34a1fc9f5ea939e318b5797a28f036e8381014f3`
- Registry normalization commit: `ed9d1023876ddbc69794008eb8bc054c728ec71a`
- Regression test commit: `3c5d12e6aed1ecdd3aee01d74dcee20f394fdf70`
- This provider-contract verification/status update: pending this write
