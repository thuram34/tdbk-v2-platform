# TDBK ENGINE STATUS

## Last Updated
2026-09-22

## Current Phase
Provisioning Service Identity Authority Decision

## Current Objective
Resolve the provisioning workflow's internal executor authority question only. No DBK, Sokoni, public discovery, bridge, or unrelated Engine work is included in this cycle.

## Completed
- Re-read the prior Gate 01 finding at commit `1f4c6c577d175da3a5d6ea8398ea3f2beb3eed40`.
- Inspected `src/platform/provisioning/provisioningService.ts`, `src/kernel/master/masterAuthority.ts`, `src/kernel/authorization/rbacEngine.ts`, `src/kernel/audit/auditLogger.ts`, and `src/orchestration/workflow/engine.ts`.
- Confirmed `createStepContext()` is the sole inspected construction point for the synthetic provisioning executor.
- Confirmed the public `provisionDbk()` boundary authorizes the initiating principal before creating the provisioning workflow.
- Confirmed workflow creation/execution preserves the initiating `SecurityContext` for workflow lifecycle attribution and worker identity, while provisioning handlers replace it with the synthetic executor for selected internal operations.
- Confirmed the synthetic executor is `usr_master_provisioner`, role `TDBK_MASTER_ADMIN`, permissions `['*']`, `isMaster=true`, `tokenSource='SERVICE_KEY'`.
- Confirmed `MasterAuthorityService.isMasterAdmin()` recognizes `isMaster=true` + `TDBK_MASTER_ADMIN`, and RBAC treats Master authority as a global override.
- Confirmed the target `tenantId` on the synthetic principal does not constrain Master authority; Master authorization is accepted before tenant-specific checks.
- Confirmed provisioning steps using the synthetic executor include Business DNA binding, capability initialization/persistence, branch creation, workspace compilation, and final DBK activation.
- Confirmed workflow lifecycle audit/events preserve the initiating principal, while the existing audit event schema has one `principalId`, so internal calls made with the synthetic executor are attributed to that executor.
- Confirmed there is no already-established Engine service-principal registry, dedicated provisioning role, or least-privilege permission contract from which a safe replacement identity can be derived.

## In Progress
- None. This single-task decision review is stopped at the architectural decision boundary.

## Decision
**MASTER REVIEW REQUIRED — no existing authority model is sufficient to safely select A, B, or C without defining a new contract.**

### Option A — dedicated least-privilege provisioning service authority
This is the only model that can preserve the current internal-service execution semantics while removing the unjustified global `TDBK_MASTER_ADMIN` + `*` authority. However, implementing it requires a new Engine-owned service-principal contract defining identity registration, exact permissions, tenant/DBK scope, issuance/authentication, and authorization behavior. None of those contracts currently exist as an established authority in the repository. Therefore it cannot be safely implemented under the instruction to avoid inventing architecture.

### Option B — initiating-principal authority
This is not an established equivalent for the current workflow executor model. Direct propagation would cause provisioning steps to execute under the initiating Business Owner/Master identity rather than an internal executor. Existing provisioning operations include calls currently relying on Master-level authority, so propagation could change legitimate provisioning behavior. It also would not solve restart/recovery semantics unless the initiating execution identity were durably represented in the workflow authority. Therefore it cannot be selected as a safe correction from the current repository state.

### Option C — another already-established Engine model
No such model was found. The established workflow model preserves the initiating context at workflow execution/lifecycle boundaries, but it does not define a separate least-privilege service identity for internal provisioning steps. The existing Master model is global, not provisioning-scoped.

## Authority Model
Current model, as actually implemented:
1. External provisioning request is authorized by `masterAuthority.assertOwnerOrMasterAuthority(context.principal, 'provisionDbk', ...)`.
2. The provisioning workflow is created/executed with the initiating `SecurityContext`.
3. Selected internal handlers construct a synthetic global Master executor.
4. The synthetic executor is therefore an internal implementation identity, but its authority is broader than a provisioning-specific least-privilege authority.
5. The target DBK tenant ID on that executor is metadata, not an effective restriction, because Master authorization is globally accepted.

This is **not classified PASS as a final authority model**. It is classified **MASTER REVIEW REQUIRED**.

## Initiating Actor vs Executor Semantics
- Initiating actor: preserved at provisioning entry, DBK creation/lifecycle history, workflow creation, workflow lifecycle audit/events, and workflow execution context.
- Internal executor: `usr_master_provisioner` for the five provisioning handlers that construct `createStepContext()`.
- Audit limitation: `AuditEvent` contains a single `principalId`. Consequently, internal service-operation audit records identify the synthetic executor, while workflow-level events identify the initiating actor. There is no first-class actor/executor pair.
- This does **not** justify redesigning the audit system in this task. Whether a dual attribution contract is required must follow the authority decision.

## Verified
- Provisioning entry authorization: **PASS** — initiating context is checked before workflow creation.
- Workflow initiating-actor preservation: **PASS** — workflow lifecycle code uses the original execution context's principal.
- Synthetic executor location: **PASS** — `createStepContext()` in `src/platform/provisioning/provisioningService.ts`.
- Synthetic executor authority: **PASS as evidence** — it is globally recognized as `TDBK_MASTER_ADMIN` with `*` permissions.
- Least-privilege provisioning authority: **MASTER REVIEW REQUIRED** — no established dedicated authority exists.
- Initiating-principal substitution: **MASTER REVIEW REQUIRED** — not safe to implement without changing current authority assumptions.
- Existing alternative Engine authority: **MASTER REVIEW REQUIRED** — none found.
- Tests/typecheck/lint/build: **NOT EXECUTED** — connected repository tooling does not provide local npm command execution. No passing result is claimed.

## New Engine Contracts
None implemented.

### Contract that would be required if Master selects Option A
Before implementation, Master must explicitly authorize a new Engine-owned provisioning service-principal contract containing at minimum:
- stable service-principal identity
- non-human/service classification
- exact provisioning permissions (no wildcard permission)
- explicit tenant/DBK scope rules
- authorization primitive used by provisioning steps
- authentication/issuance mechanism for internal workflow execution
- durable executor identity for workflow recovery
- audit attribution rule distinguishing initiating actor from executing service identity, if required
- prohibition on using the service identity for unrelated platform administration

This is a definition of the missing contract, not an implementation or architectural assumption.

## Contracts Required by DBK
None introduced by this task.

## Contracts Required by Sokoni
None introduced by this task.

## Blocking Issues
- Current synthetic executor is global Master authority rather than a documented provisioning-scoped authority.
- No established least-privilege service-principal contract exists.
- Direct initiating-principal propagation could change legitimate provisioning authorization behavior and recovery semantics.
- Existing audit records distinguish the two identities only by event context, not through a first-class actor/executor pair.

## MASTER REVIEW REQUIRED
- Choose/authorize the authority contract: retain/rework service execution as a new least-privilege provisioning service principal, or explicitly authorize initiating-principal execution with the required durable workflow semantics.
- If Option A is selected, approve the service-principal contract described above before code implementation.
- If audit dual attribution is required by the selected authority model, authorize that narrowly scoped audit contract separately; no audit redesign was performed here.

## Risks / Architecture Concerns
- `createStepContext()` is named a mock context but is used by production-capable provisioning steps.
- `MasterAuthorityService` makes `TDBK_MASTER_ADMIN` global, so attaching the target DBK as `tenantId` does not provide least-privilege isolation.
- `RBACEngine` explicitly bypasses ordinary permission/tenant evaluation for Master principals, reinforcing that `permissions=['*']` is not the real limiting boundary.
- The workflow engine already has durable execution/recovery, but a future dedicated service identity must survive recovery without reverting to an ad hoc process-local principal.

## Files / Areas Changed
- `docs/master/ENGINE-STATUS.md` — updated with the final authority decision boundary.
- No production source files changed.
- No DBK files changed.
- No Sokoni files changed.
- No public discovery files changed.
- No bridge files changed.

## Verification Performed
Repository inspection only; no code implementation was performed.

Inspected:
- `src/platform/provisioning/provisioningService.ts`
- `src/kernel/master/masterAuthority.ts`
- `src/kernel/authorization/rbacEngine.ts`
- `src/kernel/audit/auditLogger.ts`
- `src/orchestration/workflow/engine.ts`
- relevant existing Gate 01 status/evidence

Tests/typecheck/lint/build: **NOT EXECUTED** because local repository command execution is unavailable through the connected tooling.

## Unresolved Issues
- Authority model remains at the explicit Master decision boundary described above.
- No code workaround was introduced.

## Next Recommended Engine Task
After Master resolves the authority decision, implement exactly the authorized provisioning service-identity contract (and focused tests) if a new contract is approved. Do not bundle audit redesign or unrelated hardening into that task.

## Dependency Handoffs

### DBK
No impact. No DBK code or authority was changed. DBK continues to consume Engine provisioning authority only.

### SOKONI
No impact. No Sokoni code or authority was changed.

## Evidence
- Repository: `thuram34/tdbk-v2-platform`.
- Decision-review starting evidence: `1f4c6c577d175da3a5d6ea8398ea3f2beb3eed40`.
- `src/platform/provisioning/provisioningService.ts`: synthetic executor construction and consuming provisioning handlers.
- `src/kernel/master/masterAuthority.ts`: global Master recognition and tenant authority behavior.
- `src/kernel/authorization/rbacEngine.ts`: Master override and wildcard permission behavior.
- `src/kernel/audit/auditLogger.ts`: single `principalId` attribution model.
- `src/orchestration/workflow/engine.ts`: initiating context preservation and durable workflow execution/recovery.
- No test/typecheck/lint/build PASS is claimed without execution evidence.
