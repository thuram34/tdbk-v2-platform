# TDBK ENGINE STATUS

## Last Updated
2026-09-22

## Current Phase
Production Hardening Gate 01 — Authorization and Persistence Integrity

## Current Objective
Audit the production-facing TDBK V2 Engine for authorization boundaries and persistence integrity only. Do not redesign architecture or modify DBK UI, Sokoni, external bridges, or unrelated defects.

## Completed
- Inspected current `ENGINE-STATUS.md`, `ENGINE_PUBLIC_DISCOVERY_CONTRACT.md`, `DBK-STATUS.md`, and attempted to read `SOKONI-STATUS.md`; the Sokoni status file is absent and was not inferred.
- Audited production-facing API/service authorization paths through `securityContextFactory`, `masterAuthority`, `tenantIsolation`, `branchAuthority`, RBAC, provisioning, lifecycle, connector configuration, capability activation, and agent command boundaries.
- Verified tenant -> DBK authorization is server-side through `masterAuthority.assertTenantAuthority()` and durable DBK Registry ownership/tenant binding.
- Verified branch authorization is server-side through `branchAuthority.assertPersistentBranchContext()` and durable branch ownership/status checks; `contextFactory` and RBAC invoke the persistent branch boundary for target branches.
- Verified production branch writes use Firestore `branchRepository`; synchronous branch maps are retained for test/runtime compatibility and are not the production persistence source in the inspected persistent paths.
- Verified workflow persistence uses Firestore workflow instances, workflow-step execution state, leases, and transactional workflow+outbox creation; the in-memory workflow map is treated as a cache/recovery aid rather than durable authority.
- Verified financial transaction/ledger persistence through the Firestore financial ledger repository and existing financial integrity tests.
- Verified capability state persistence through `capabilityStateRepository` under tenant-scoped Firestore paths.
- Verified connector configuration persistence through `connectorConnectionRepository` with tenant-bound paths and secret references rather than raw secrets.
- Verified entitlement production evaluation reads durable DBK subscription tier; the synchronous in-memory subscription store is explicitly legacy/test-only and is not the production authority used by `evaluatePersistentActivation()`.
- Verified owner portfolio state is derived from the authoritative DBK Registry rather than a separate portfolio datastore.
- Verified production test-route isolation: `/api/test/*` is centrally blocked in production and requires explicit non-production enablement.
- Verified demo seeding has a production guard and does not silently seed demo DBKs through the normal production bootstrap call.
- Recorded the audit in `docs/PRODUCTION_HARDENING_GATE_01_2026-09-22.md`.

## In Progress
- No production code fix is in progress. This gate found no narrowly safe authorization/persistence fix that could be applied without making an architectural decision.
- CI execution for the audit documentation commit must be obtained from GitHub Actions; local npm execution is unavailable through the connected repository tooling.

## Verified
- Authorization boundary: **PASS** for inspected production-facing APIs/services.
- Tenant -> DBK authority: **PASS**.
- Tenant -> branch durable authority: **PASS**.
- Critical production persistence: **PASS** for DBK identity, branch, workflow, financial, capability/entitlement, connector, and derived portfolio state.
- Critical process-local state: **PASS** for the inspected production paths; identified in-memory stores are documented as test/cache compatibility layers rather than production authority.
- Synthetic/demo/test isolation: **MASTER REVIEW REQUIRED** because provisioning internally constructs a hard-coded synthetic `TDBK_MASTER_ADMIN` service context for workflow steps.
- Test/typecheck/lint/build: **NOT EXECUTED LOCALLY** because repository tooling exposes source/CI APIs but no local shell execution. No passing result is claimed.
- CI: the audit documentation commit is expected to trigger repository CI, but a completed result is not yet available at this status update.

## New Engine Contracts
- None. This gate was audit-only and deliberately did not introduce authorization or persistence architecture.

## Contracts Required by DBK
- No new DBK contract introduced by this gate.
- Existing Engine tenant/branch authorization and durable public-organization projection remain authoritative.

## Contracts Required by Sokoni
- No new Sokoni contract introduced by this gate.
- Sokoni remains a consumer of Engine authority and must not create replacement authorization or persistence.

## Blocking Issues
- Production provisioning workflow uses `createStepContext()` with a hard-coded synthetic `TDBK_MASTER_ADMIN` principal (`usr_master_provisioner`, `SERVICE_KEY`) for internal provisioning steps. This was not changed because replacing internal authority propagation requires an architectural decision.
- Local command execution is unavailable in the connected repository environment, so test/typecheck/lint/build cannot be truthfully marked PASS from local execution.
- `docs/master/SOKONI-STATUS.md` remains absent from the repository.

## MASTER REVIEW REQUIRED
- Determine whether production provisioning step contexts may use a synthetic service principal or must propagate the initiating principal/service identity. This affects authorization attribution and audit semantics.
- Determine the authoritative CI verification result for the audit head.

## Risks / Architecture Concerns
- `src/platform/provisioning/provisioningService.ts` contains production-capable internal workflow steps executed with a synthetic Master principal. The current public provisioning boundary is authorized before workflow creation, but the internal identity is broader than the initiating Business Owner identity and should not be silently replaced during an audit.
- `dbkRegistry.saveDbk()` is a low-level persistence service method without its own tenant assertion; inspected production-facing callers are behind higher-level authorization boundaries. No direct public API for arbitrary `saveDbk()` access was found in this audit. Changing this lower-level contract would be broader than the requested production-facing API boundary and is therefore not implemented.
- `EntitlementEngineService` retains a synchronous in-memory legacy store for deterministic tests; production authorization uses the durable path. This legacy surface must not be used for production authorization.
- `BranchManagerService` retains synchronous in-memory accessors for deterministic tests/runtime compatibility; production persistent reads/writes use Firestore.

## Files / Areas Changed
- `docs/PRODUCTION_HARDENING_GATE_01_2026-09-22.md` — durable Gate 01 audit evidence and findings.
- `docs/master/ENGINE-STATUS.md` — updated durable Engine handoff for Gate 01.
- No Engine production source files changed.
- No DBK source files changed.
- No Sokoni source files changed.
- No external bridge source files changed.

## Next Recommended Engine Task
Stop here. The single Gate 01 task is complete. The next Engine task, when separately authorized, is to resolve the synthetic provisioning service-identity question and/or obtain the CI verification result; do not begin that work as part of this task.

## Dependency Handoffs

### DBK
No DBK implementation dependency was introduced. Continue consuming Engine authorization and persistence authority; do not create local authorization or persistence replacements.

### SOKONI
No Sokoni implementation dependency was introduced. Continue consuming Engine authority; do not create local authorization, organization, publication, provider, product, service, or discovery persistence.

## Evidence
- Repository: `thuram34/tdbk-v2-platform`.
- Audit head before status commit: `260348861d2b078496ae494c36ece116d67a835f`.
- Prior Engine head audited: `b56a2b89c455df772995d7a4c86ec190624ac8f5`.
- Audit evidence file: `docs/PRODUCTION_HARDENING_GATE_01_2026-09-22.md`.
- DBK identity authority: `src/platform/dbkRegistry.ts`.
- Tenant authority: `src/kernel/master/masterAuthority.ts`.
- Branch authority: `src/kernel/branch/branchAuthority.ts`.
- Persistent workflow authority: `src/orchestration/workflow/engine.ts`, `src/persistence/firestore/repositories/workflowInstanceRepository.ts`.
- Financial persistence: `src/persistence/firestore/repositories/financialLedgerRepository.ts` and financial integrity tests.
- Capability persistence: `src/persistence/firestore/repositories/capabilityStateRepository.ts`.
- Connector persistence: `src/persistence/firestore/repositories/connectorConnectionRepository.ts`.
- CI workflow: `.github/workflows/ci.yml` defines typecheck, lint, test, production build, and Docker validation.
- No passing test/typecheck/lint/build result is claimed without execution evidence.
