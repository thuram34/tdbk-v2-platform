# TDBK V2 ENGINE — PRODUCTION HARDENING GATE 01

## Scope
Authorization and persistence integrity only.

Excluded from this gate: architecture redesign, Sokoni, DBK UI, external bridge implementation, and unrelated defects.

## Audit Basis
Repository head audited: `b56a2b89c455df772995d7a4c86ec190624ac8f5`.

Continuity documents inspected:
- `docs/master/ENGINE-STATUS.md`
- `docs/ENGINE_PUBLIC_DISCOVERY_CONTRACT.md`
- `docs/master/DBK-STATUS.md`
- `docs/master/SOKONI-STATUS.md` — absent; absence recorded rather than inferred

Relevant Engine implementation inspected:
- `server.ts`
- `src/kernel/master/masterAuthority.ts`
- `src/kernel/branch/branchAuthority.ts`
- `src/kernel/context/contextFactory.ts`
- `src/kernel/authorization/rbacEngine.ts`
- `src/platform/dbkRegistry.ts`
- `src/platform/branch/branchManager.ts`
- `src/platform/lifecycle/lifecycleManager.ts`
- `src/platform/provisioning/provisioningService.ts`
- `src/orchestration/workflow/engine.ts`
- `src/persistence/firestore/repositories/workflowInstanceRepository.ts`
- `src/persistence/firestore/repositories/financialLedgerRepository.ts`
- `src/persistence/firestore/repositories/capabilityStateRepository.ts`
- `src/persistence/firestore/repositories/connectorConnectionRepository.ts`
- `src/capability/entitlement.ts`
- `src/capability/evaluator.ts`
- `src/platform/seeder.ts`

## Findings

### 1. Production-facing command/API authorization — PASS

Production API boundaries inspected use `securityContextFactory` and then delegate authorization to Engine authority primitives/services. Examples include connector configuration, connector reads, audit reads, identity operations, DBK provisioning, lifecycle operations, capability activation, and agent commands.

`/api/test/*` is centrally blocked in production by an explicit environment guard; test routes require both non-production execution and `ENABLE_TEST_API=true`.

Health/live/readiness endpoints are intentionally operational endpoints and do not mutate tenant/business state.

### 2. Tenant → DBK → branch server-side authority — PASS

`masterAuthority.assertTenantAuthority()` enforces tenant ownership/membership using durable DBK Registry ownership for Business Owners and tenant binding for tenant roles.

`branchAuthority.assertPersistentBranchContext()` validates principal tenant, branch scope, durable branch ownership (`branch.dbkId === tenantId`) and active branch status.

`contextFactory` invokes persistent branch authorization when a target branch is supplied. `rbacEngine` also invokes persistent branch authorization when a branch is part of an authorization request.

`branchManager` mutation/read boundaries require tenant access and production reads can use Firestore-backed persistent branch methods.

### 3. Critical production state independent of process memory — PASS with constrained test/runtime caches

The audited production paths explicitly use Firestore as authoritative state for DBK identity, business state, capability state, connector configuration, financial transactions/ledger, and workflow instances.

Known in-memory structures remain for test compatibility or hot-cache/runtime purposes and are not the authoritative production source in the inspected production paths.

Specific examples:
- Entitlement production evaluation reads durable DBK subscription state.
- Workflow execution rehydrates durable Firestore state after restart.
- Branch production reads use `listPersistentBranches` / `getPersistentBranch`.

### 4. Critical writes durably persisted — PASS

Audited critical write paths persist to Firestore repositories.

Workflow creation uses `saveWorkflowWithOutbox()` transactionally for durable workflow + outbox creation; execution uses durable leases and persistent state writes.

Financial transaction/ledger services use `financialLedgerRepository`.

Capability state uses `capabilityStateRepository` under `/tenants/{tenantId}/capabilities/{capabilityId}`.

Connector configuration uses `connectorConnectionRepository` under `/tenants/{tenantId}/connections/{connectionId}`.

Branch creation writes through `branchRepository`.

DBK identity writes use `dbkRegistryRepository`.

### 5. Financial/workflow/entitlement/connector/portfolio/branch authoritative persistence — PASS

- Financial: Firestore financial ledger/transaction repository; financial integrity tests exercise persisted transaction and ledger state.
- Workflow: Firestore workflow instance repository plus workflow step execution/outbox persistence.
- Entitlement: production authority is the DBK's durable `subscriptionTier`; the synchronous in-memory entitlement store is explicitly marked legacy/test-only.
- Connector: Firestore connector connection repository with tenant-bound paths and secret references only.
- Portfolio: no separate portfolio authority is required; owner portfolio is derived from authoritative DBK Registry records and ownership fields.
- Branch: Firestore branch repository is authoritative for production branch state.

### 6. Synthetic/demo/test authority — MASTER REVIEW REQUIRED

Two distinct controls were verified:

1. Demo seeding is guarded against production in `seedDemoDbks()` and throws if invoked in production without the explicit test-only force path.
2. `/api/test/*` routes are centrally blocked in production and require explicit non-production enablement.

However, `src/platform/provisioning/provisioningService.ts` creates an internal `createStepContext()` with a hard-coded synthetic `TDBK_MASTER_ADMIN` principal (`usr_master_provisioner`, `SERVICE_KEY`) for provisioning workflow steps. This is not a public route bypass in the inspected flow, but it is synthetic authority inside a production-capable workflow and causes internal actions/audit attribution to use a synthetic Master identity.

Classification: **MASTER REVIEW REQUIRED**.

No replacement authority was invented during this audit because changing internal workflow identity propagation is an architectural decision beyond a safe narrow fix.

### 7. Verification execution — MASTER REVIEW REQUIRED

Repository scripts are present:
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

The connected repository tooling permits source inspection and GitHub Actions inspection but does not provide a local shell execution path for the repository. The previous CI run associated with the public-authority work was not available as a completed verification result for current audit head `b56a2b89c455df772995d7a4c86ec190624ac8f5`.

Therefore this gate does **not** claim passing test/typecheck/lint/build execution.

## Fixes Made

None.

No confirmed defect within the exact authorization/persistence scope was safely isolated for a non-architectural fix during this audit. The synthetic provisioning principal is explicitly deferred as `MASTER REVIEW REQUIRED` rather than replaced with an invented mechanism.

## Unresolved

1. Production provisioning workflow uses a synthetic internal Master principal for step contexts — MASTER REVIEW REQUIRED.
2. Current repository-connected environment cannot execute npm commands locally; CI verification for the audit head must be obtained separately — MASTER REVIEW REQUIRED.
3. `docs/master/SOKONI-STATUS.md` is absent; no Sokoni assumptions were made from that absence.

## Out of Scope / Not Changed

No changes were made to:
- Sokoni
- DBK UI
- external bridge implementations
- public discovery architecture
- publication authority
- marketplace/search infrastructure
- provider/product/service authority
- unrelated production defects

## Conclusion

The inspected production authorization and persistence paths satisfy the requested Gate 01 controls at the API/service boundary, with the explicit exceptions above. No unrelated work was performed.


## Grand Operation Superseding Status — 2026-10-07

The historical findings above remain the evidence record for the September audit. The synthetic provisioning identity finding has since been addressed on the current grand-operation branch: provisioning workflow metadata carries the authenticated initiating actor snapshot and step contexts no longer invent a TDBK_MASTER_ADMIN principal.

The remaining production requirement is final CI/runtime evidence on the current branch, not reinterpretation of this historical finding.
