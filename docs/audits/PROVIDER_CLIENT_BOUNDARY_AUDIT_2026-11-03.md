# TDBK Provider–Client Boundary Audit

**Audit date:** 2026-11-03  
**Repository:** `thuram34/tdbk-v2-platform`  
**Audited ref:** `main` at `61f54dcf9805475ba993a5dc675985caece771f1`  
**Method:** Read-only GitHub inspection of repository tree and selected source/configuration files. No local shell, tests, deployment, live Firebase project or GCP console access was available. This is a source audit, not a penetration test or production certification.

## Executive conclusion

**Do not rebuild TDBK from zero.** The repository already contains a kernel security layer, tenant and branch authority, DBK registry, provisioning workflow, lifecycle manager, capability/entitlement logic, subscription routes, and explicit default-deny Firestore and Storage rules.

The architecture is partially represented in code. The remaining task is to prove that all production request paths consistently enforce it and that client-facing workflows and commercial operations use the authoritative services.

**Release position: NOT CERTIFIED for multi-client production by this audit.** This is not a finding that every path is insecure. It reflects unexecuted tests, unverified live infrastructure and specific issues requiring targeted validation.

## 1. Existing implementation mapped to the three planes

| Plane | Existing implementation | Source-level assessment |
|---|---|---|
| TDBK Control Plane | `src/platform/dbkRegistry.ts`, `src/platform/provisioning/provisioningService.ts`, `src/platform/lifecycle/lifecycleManager.ts` | DBK identity, provisioning and lifecycle primitives exist. |
| Commercial Control | `src/platform/subscription/subscriptionRouter.ts`, subscription service/repository, capability entitlement | Subscription and entitlement paths exist; full billing/reconciliation and client-facing commercial lifecycle need end-to-end verification. |
| Client Workspace / DBK | `/tenants/{tenantId}`, branch repository/manager, workspace manager, business DNA and capability state | Tenant and branch concepts exist; operational collection coverage and client UI ownership need a complete inventory. |
| Service Gateway | `src/kernel/context/contextFactory.ts`, `tenantIsolation.ts`, `masterAuthority.ts`, `branchAuthority.ts`, `rbacEngine.ts`, `routeGuards.ts` | A central authorization kernel exists. Route-by-route adoption is not yet proven. |
| Persistence/security | `firestore.rules`, Firestore repositories, `storage.rules` | Firestore and Storage default-deny catch-alls exist; Admin SDK API boundaries need route-level verification. |

## 2. Confirmed positive controls

### 2.1 Firestore default deny
At the audited ref, `firestore.rules` has a recursive catch-all denying reads and writes. It defines explicit access for Sokoni public participant projections, tenant roots, branches and security audit logs. No generic tenant-subcollection catch-all is present.

New operational collections are not automatically client-readable/writable through Firestore client SDK. Server APIs using Firebase Admin SDK bypass Firestore Security Rules and must independently authorize every operation.

### 2.2 Tenant authority
`masterAuthority.assertTenantAuthority()` distinguishes platform master, business-owner portfolio membership, owner-operator and tenant-bound roles. Business-owner access checks durable DBK Registry ownership.

### 2.3 Production token verification
`tokenVerifier.verifyTokenAsync()` uses Firebase Admin ID-token verification in production; plain base64 JSON tokens are not accepted as production identities. Test injection is guarded against production use outside the test runner.

### 2.4 Persistent branch ownership
`branchAuthority.assertPersistentBranchContext()` checks tenant authority and loads the durable branch record, requiring that it belongs to the requested DBK and is active.

### 2.5 Storage fail-closed baseline
`storage.rules` denies all paths except the public Sokoni participant media path. Tenant file flows therefore need an intentionally designed authenticated server-mediated path or narrowly scoped future rule.

## 3. Findings requiring action

### P1 — Synthetic master identity inside production-capable provisioning workflow

**Evidence:** `src/platform/provisioning/provisioningService.ts` defines `createStepContext()` with hard-coded principal `usr_master_provisioner`, role `TDBK_MASTER_ADMIN`, wildcard permissions and `SERVICE_KEY` token source. The context is passed into persistent Business DNA binding and capability initialization.

**Risk:** Internal provisioning steps and audit attribution can appear to execute as a synthetic global master rather than as the initiating owner or a narrowly scoped provisioning service principal. This weakens attribution and blurs the provider/client authority boundary.

**Required correction:** Replace the synthetic master with an explicit non-user service principal and dedicated provisioning capability. It must have only workflow-required operations, be impossible to mint from client identity claims, preserve initiating actor and tenant as immutable audit metadata, and be accepted only by the internal workflow execution boundary. Do not simply rename the fake master or give a generic service token global privileges.

**Status:** Confirmed source-level concern; design and tests required before repair.

### P1 — Route-by-route authorization coverage is not yet demonstrated

**Evidence:** `server.ts` contains individually implemented API handlers. Several correctly build a security context and delegate to authority services (connector, tenant verification, audit, agent execution and subscriptions). Reusable Express guards exist in `src/kernel/security/routeGuards.ts`, but the inspected server routes do not consistently apply a single guarded-router pattern.

**Risk:** An overlooked handler may authenticate incompletely, use a caller-supplied tenant ID without a matching authority check, or call a privileged service with an anonymous context. Firestore rules do not protect Admin SDK operations.

**Required correction:** Maintain an endpoint inventory with method, path, data classification, auth requirement, tenant/branch source, required permission/role, service authority check and test reference. Require negative tests for missing auth, forged tenant, wrong tenant, wrong branch, insufficient role and disabled entitlement.

**Status:** Coverage gap confirmed; no blanket claim that every endpoint is vulnerable.

### P1 — Firestore branch rule role field does not match the canonical claim writer

**Evidence:** `firebaseIdentityManager.setTdbkClaims()` writes top-level `roles` as an array (and nested `tdbk.roles`), but the branch rules in `firestore.rules` check `request.auth.token.role == 'TENANT_ADMIN'` (singular field). The same rules use top-level `tenantId`, which the writer does populate.

**Risk:** A tenant admin whose claims are provisioned through this identity manager may be denied branch writes through the Firestore client SDK because the singular `role` claim is not written. The current behavior fails closed rather than granting excess access, but it can cause authorization inconsistency and tempt future broadening of rules.

**Required correction:** Choose one canonical claim contract. Prefer array-based roles consistently, or explicitly populate a singular compatibility role only when unambiguous and tested. Update emulator tests to validate actual custom-claim shape against deployed rules. Do not loosen rules to accept unverified client input.

**Status:** Confirmed source-level contract mismatch; runtime impact should be verified in Firebase Emulator.

### P2 — Synchronous branch helper is permissive without tenant proof, but no direct production call site was found

**Evidence:** `branchAuthority.assertBranchContext()` returns a branch context for a non-master principal with null/undefined `branchId`, without independently verifying that branch's tenant. Repository search found it called by the synchronous `rbacEngine.authorize()` method and tests; no direct production service call to `rbacEngine.authorize()` was found in the audited source search. Production code paths found use `authorizeAsync()` or `assertPersistentBranchContext()`.

**Risk:** The synchronous primitive is unsafe as a standalone resource authorization decision and could be misused by future code. Current search did not establish an active production exploit path.

**Required correction:** Mark the synchronous helper as context-only/test-only or deprecate it for production authorization. Add a test proving all production resource access uses the persistent async branch authority path.

**Status:** Unsafe primitive confirmed; no direct production callsite identified in this search. Verify comprehensively before treating as exploitable.

### P2 — Tenant operational data is server-mediated, but client data-access contract is not fully documented

**Evidence:** Firestore rules deny unspecified descendants and Storage denies non-Sokoni paths.

**Risk:** Without a collection/API/storage map, developers may add broad rules to unblock client UI or ship incomplete client data access/export.

**Required correction:** Document each tenant collection and storage category with its authoritative repository/API, permitted roles, branch scope, retention and export behavior. Keep default deny.

### P2 — Sokoni participant media write rule lacks owner binding in the visible rule

**Evidence:** `storage.rules` permits any authenticated user to write image content under `/sokoni/participants/{participantId}/{mediaId}` subject to size/content-type checks; the visible rule does not compare caller identity to participant ownership.

**Risk:** An authenticated user may upload media into another participant's public namespace unless a separate trusted upload mechanism constrains participant IDs.

**Required correction:** Bind uploads to verified participant ownership or use server-issued, short-lived upload authorization. Test cross-participant upload denial. Keep this separate from tenant business data.

### P2 — Health readiness and external production evidence remain unverified

**Evidence:** Historical `docs/PRODUCTION_AUDIT_2026-09-18.md` records readiness and MOCK bridge concerns at that earlier audit date. The current tree contains later code, so those historical findings must not be assumed unchanged. GitHub inspection does not prove current Cloud Run revision, live credentials or provider certification.

**Required correction:** Re-audit current health and bridge implementations, then verify GCP deployment, service account IAM, Firestore, Pub/Sub, Secret Manager and connector sandbox/live evidence separately.

## 4. Priority implementation backlog

| Priority | Work item | Acceptance evidence |
|---|---|---|
| P0 | Endpoint authorization inventory | Every production route classified and mapped to a tested authority check |
| P0 | Provisioning service principal design | No synthetic user/master identity; least-privilege workflow identity; initiating actor preserved |
| P0 | Firestore claim/rules alignment | Emulator tests prove claim writer and rules agree |
| P1 | Cross-tenant negative test matrix | Deny read/write/list/export/storage/background job across tenant boundaries |
| P1 | Client data and file contract | Collection/API/storage ownership and export mapping documented |
| P2 | Synchronous branch helper guardrail | No production resource authorization relies on it |
| P2 | Sokoni media ownership | Cross-participant upload denied |
| P2 | Live infrastructure and connector verification | Dated GCP/bridge evidence tied to deployed commit |

## 5. Test matrix required before certification

- Anonymous request to every protected route → denied.
- Tenant A token + Tenant B path, query, body or nested resource → denied.
- Tenant A owner portfolio + DBK not owned by A → denied.
- Branch A principal + Branch B resource in same tenant → denied.
- Tenant-wide principal + branch belonging to another tenant → denied.
- Client role attempting provider master operation → denied.
- Client user attempting role escalation or master grant → denied.
- Client cannot read another tenant's documents, exports, logs, connector metadata or storage objects.
- Support access expires, is scoped, records reason and actor, and cannot silently elevate to owner/master.
- Provisioning retries are idempotent and preserve initiating actor attribution.
- Subscription state and entitlement checks are enforced server-side.
- Tenant export returns only the requesting tenant's data.
- Tenant termination revokes access and follows agreed export/retention/deletion policy.
- Firestore Emulator confirms actual claim writer payload permits intended tenant-admin branch operations but denies other roles and tenants.

## 6. Audit limitations

This audit did not:
- execute npm tests, typecheck, lint or production build;
- run Firebase Emulator cross-tenant tests;
- inspect live Firebase custom claims or deployed Firestore/Storage rules;
- inspect Cloud Run IAM, service configuration or production secrets;
- perform dynamic API fuzzing or penetration testing;
- certify M-Pesa, WhatsApp, eTIMS, email, SMS or bank integrations.

## 7. Recommended next step

Complete the P0 endpoint inventory and provisioning service-identity design first. In parallel, fix and test the Firestore role-claim mismatch. Then build the full cross-tenant negative test suite. Preserve existing platform architecture and avoid broad tenant schema migration until the data-flow inventory is complete.
