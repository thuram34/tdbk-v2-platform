# TDBK ENGINE STATUS

## Last Updated
2026-09-22

## Current Phase
Provisioning Service Identity Authority Review

## Current Objective
Resolve the provisioning workflow's internal service-identity authority question only. No DBK, Sokoni, public discovery, bridge, or unrelated Engine work is included in this cycle.

## Completed
- Completed the focused audit of the production-capable DBK provisioning workflow's synthetic internal principal.
- Located the synthetic identity creation in `src/platform/provisioning/provisioningService.ts`, in `createStepContext()`.
- Verified the public provisioning entrypoint authorizes the initiating principal before workflow creation with `masterAuthority.assertOwnerOrMasterAuthority(...)`.
- Verified the workflow itself is created and executed with the initiating `SecurityContext`; therefore the workflow lifecycle's `principalId` and initial provisioning audit attribution preserve the initiating actor.
- Enumerated the production provisioning steps that actually construct/use the synthetic context: `PROVISIONING_INITIALIZE_DNA`, `PROVISIONING_INITIALIZE_CAPABILITIES`, `PROVISIONING_INITIALIZE_BRANCHES`, `PROVISIONING_CREATE_WORKSPACE_STATE`, and `PROVISIONING_VERIFY_AND_ACTIVATE`.
- Confirmed `PROVISIONING_VALIDATE_IDENTITY`, `PROVISIONING_VALIDATE_BLUEPRINT`, and `PROVISIONING_ASSIGN_ENTITLEMENT` do not consume the synthetic context.
- Verified the synthetic principal is materially broad: `id=usr_master_provisioner`, `roles=['TDBK_MASTER_ADMIN']`, `permissions=['*']`, `isMaster=true`, `tokenSource='SERVICE_KEY'`, with `tenantId` set to the DBK being provisioned.
- Verified `MasterAuthorityService` treats `isMaster=true` plus `TDBK_MASTER_ADMIN` as global platform authority. This means the synthetic identity is not a least-privilege tenant-scoped provisioning identity.
- Verified internal service calls made with the synthetic context can therefore be attributed to `usr_master_provisioner`, while workflow-level start/completion/failure events continue to use the initiating principal from the workflow execution context.
- Determined that the repository has no separate established Engine service-principal registry/permission model that would allow safely narrowing this synthetic identity without defining a new authority contract.

## In Progress
- None. This single-task audit is complete.

## Verified
- Public provisioning authorization boundary: **PASS** — the initiating context is checked before the workflow is created.
- Initiating actor preservation at workflow boundary: **PASS** — `createPersistentWorkflow()` and `executeWorkflow()` receive the original `SecurityContext`, and workflow audit/events use `context.principal.id`.
- Synthetic internal executor existence: **PASS** — explicitly identified and bounded to the registered provisioning step handlers.
- Synthetic executor least privilege: **MASTER REVIEW REQUIRED** — it is a global `TDBK_MASTER_ADMIN` with `*` permissions rather than a documented dedicated least-privilege service authority.
- Initiating actor vs internal executor separation: **PARTIAL / MASTER REVIEW REQUIRED** — workflow lifecycle records preserve the initiating principal, but the existing `AuditLogger` has only one `principalId` field, so service calls made with the synthetic context are recorded under the synthetic executor rather than carrying a separate first-class initiating-actor field.
- Propagating the initiating identity: **MASTER REVIEW REQUIRED** — direct propagation would change the authority assumptions of provisioning operations that currently rely on Master-level permissions, particularly branch creation and final activation.
- Dedicated least-privilege provisioning service identity as the long-term model: **MASTER REVIEW REQUIRED** — architecturally preferable only if the Engine first establishes an authoritative service-principal/permission contract; the repository currently does not contain that contract.
- Current temporary retention: **MASTER REVIEW REQUIRED** — the synthetic identity is not exposed as a public API principal in the inspected provisioning path, but its global authority and audit-attribution semantics prevent a PASS classification for production identity hardening.
- Tests/typecheck/lint/build: **NOT EXECUTED** — connected repository tooling does not provide local npm command execution in this task. No passing result is claimed.

## New Engine Contracts
- None implemented. No speculative service-principal authority was introduced.

## Contracts Required by DBK
- None introduced by this audit.

## Contracts Required by Sokoni
- None introduced by this audit.

## Blocking Issues
- The provisioning workflow uses a synthetic `TDBK_MASTER_ADMIN` executor with `permissions=['*']` rather than an explicitly documented least-privilege provisioning service identity.
- Audit events have a single `principalId`; workflow lifecycle events preserve the initiating actor, but internal service-operation audits use the synthetic executor identity. A first-class actor/executor distinction is not currently established.
- Propagating the initiating principal directly may break legitimate provisioning operations because some provisioning steps currently execute under global Master semantics.
- The Engine currently lacks an established service-principal registry/permission contract from which a narrowly scoped provisioning identity could be derived.

## MASTER REVIEW REQUIRED
- Decide whether provisioning should remain a dedicated Engine service-execution model or establish a new least-privilege service-principal authority model.
- If a service identity remains authoritative, define its exact permissions and tenant/DBK scope instead of relying on `TDBK_MASTER_ADMIN` + `*`.
- Decide whether audit architecture must represent both `initiatingActor` and `executingPrincipal` for internally executed workflows.
- Decide whether provisioning operations currently requiring Master authority should remain service-authorized or be reworked to authorize the initiating actor per step.

## Risks / Architecture Concerns
- `createStepContext()` is explicitly commented as a "mock master context". Despite that naming, it is used by production-capable provisioning handlers, so the identity is operational rather than merely test data.
- `masterAuthority.isMasterAdmin()` grants global authority to any principal carrying both `isMaster=true` and the `TDBK_MASTER_ADMIN` role. The synthetic context satisfies both conditions.
- The synthetic context's `tenantId` is set to the target DBK, but this does not constrain its authority because Master authority is globally accepted before tenant-specific checks.
- Replacing the synthetic context with the initiating principal without an explicit authority analysis could make provisioning fail for legitimate Business Owner requests, because the current provisioning handlers invoke operations that may depend on Master-level authority.
- No code workaround was applied because the requested task explicitly prohibits speculative security changes and the repository lacks a pre-existing least-privilege service-principal authority contract.

## Files / Areas Changed
- `docs/master/ENGINE-STATUS.md` — updated with the focused provisioning service-identity audit and final classification.
- No production source files changed.
- No DBK files changed.
- No Sokoni files changed.
- No public discovery files changed.
- No bridge files changed.

## Next Recommended Engine Task
Resolve the `MASTER REVIEW REQUIRED` provisioning service-principal authority decision and, only after that decision, implement the narrowly defined authority contract if authorized. Do not bundle audit attribution redesign or unrelated hardening into that task unless explicitly authorized.

## Dependency Handoffs

### DBK
No dependency or implementation change. DBK must continue treating Engine provisioning authorization as authoritative and must not create a parallel provisioning identity model.

### SOKONI
No dependency or implementation change. Sokoni remains unaffected by this identity-authority review.

## Evidence
- Repository: `thuram34/tdbk-v2-platform`.
- `src/platform/provisioning/provisioningService.ts`: `createStepContext()` creates `usr_master_provisioner`, `TDBK_MASTER_ADMIN`, `permissions=['*']`, `isMaster=true`, `tokenSource='SERVICE_KEY'`; production-capable steps 3, 5, 6, 7 and 8 consume it.
- `src/platform/provisioning/provisioningService.ts`: `provisionDbk()` authorizes the initiating context before workflow creation and passes the original context into `createPersistentWorkflow()` / `executeWorkflow()`.
- `src/orchestration/workflow/engine.ts`: workflow start/completion/failure audits/events use `context.principal.id`; workflow execution is invoked with the original provisioning workflow context.
- `src/kernel/master/masterAuthority.ts`: `isMasterAdmin()` recognizes `isMaster=true` plus `TDBK_MASTER_ADMIN`, and `assertTenantAuthority()` grants such principals global authority.
- `src/kernel/audit/auditLogger.ts`: `AuditEvent` records a single `principalId`; there is no first-class executor/initiator pair.
- Prior Gate 01 finding: `docs/PRODUCTION_HARDENING_GATE_01_2026-09-22.md`.
- No local test/typecheck/lint/build execution evidence is available; no passing result is claimed.
