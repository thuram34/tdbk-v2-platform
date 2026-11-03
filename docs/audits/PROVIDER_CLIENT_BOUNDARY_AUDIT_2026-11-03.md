# TDBK Provider–Client Boundary Audit

**Audit date:** 2026-11-03  
**Repository:** `thuram34/tdbk-v2-platform`  
**Audited ref:** `main` at `61f54dcf9805475ba993a5dc675985caece771f1`  
**Method:** Read-only inspection of repository tree and selected source/configuration files through GitHub. No local shell, tests, deployment, live Firestore project or GCP console access was available. Findings below are source-level observations, not a penetration test or production certification.

## Executive conclusion

**The repository already contains substantial elements of the provider/client separation. Do not rebuild the platform from zero.** The current implementation has a kernel security layer, tenant and branch authority, DBK registry, provisioning workflow, lifecycle manager, capability/entitlement logic, subscription routes, and explicit default-deny Firestore and Storage rules.

The architecture is therefore partially represented in code. The next task is to verify that all production request paths use the same boundary and that the client experience and commercial operations are wired to these authoritative services.

**Release position: NOT CERTIFIED for multi-client production by this audit.** This is not a claim that every path is insecure. It means the audit did not execute tests or verify live infrastructure and found issues requiring targeted validation.

## 1. Existing implementation mapped to the three planes

| Plane | Existing implementation | Source-level assessment |
|---|---|---|
| TDBK Control Plane | `src/platform/dbkRegistry.ts`, `src/platform/provisioning/provisioningService.ts`, `src/platform/lifecycle/lifecycleManager.ts` | DBK identity, provisioning and lifecycle primitives exist. |
| Commercial Control | `src/platform/subscription/subscriptionRouter.ts`, subscription service/repository, capability entitlement | Subscription and entitlement paths exist; full billing/reconciliation and client-facing commercial lifecycle need end-to-end verification. |
| Client Workspace / DBK | `/tenants/{tenantId}`, branch repository/manager, workspace manager, business DNA and capability state | Tenant and branch concepts exist; actual operational collection coverage and UI ownership need a complete inventory. |
| Service Gateway | `src/kernel/context/contextFactory.ts`, `tenantIsolation.ts`, `masterAuthority.ts`, `branchAuthority.ts`, `rbacEngine.ts`, `routeGuards.ts` | A central authorization kernel exists. Route-by-route adoption is not yet proven. |
| Persistence/security | `firestore.rules`, Firestore repositories, `storage.rules` | Firestore and Storage default-deny catch-alls exist; server-side Admin SDK access must be checked at every API boundary. |

## 2. Confirmed positive controls

### 2.1 Firestore default deny

At the audited ref, `firestore.rules` has a recursive catch-all denying reads and writes. It defines explicit access for Sokoni public participant projections, tenant roots, branches and security audit logs. No generic tenant-subcollection catch-all is present in this file.

Implication: new operational collections are not automatically client-readable/writable through Firestore client SDK. This is a good fail-closed baseline, but server APIs using Admin SDK bypass Firestore Security Rules and must independently authorize every operation.

### 2.2 Tenant authority

`masterAuthority.assertTenantAuthority()` distinguishes platform master, business owner portfolio membership, owner-operator and tenant-bound roles. Business-owner access checks durable DBK Registry ownership. This is stronger than trusting a tenant ID from the browser.

### 2.3 Production token verification

`tokenVerifier.verifyTokenAsync()` documents and implements Firebase Admin ID-token verification in production; plain base64 JSON tokens are not accepted as production identities. Test injection is guarded against production use outside the test runner.

### 2.4 Branch ownership

`branchAuthority.assertPersistentBranchContext()` checks tenant authority and loads the durable branch record, requiring that the branch belongs to the requested DBK and is active.

### 2.5 Storage fail-closed baseline

`storage.rules` denies all paths except the public Sokoni participant media path. This avoids accidentally exposing arbitrary tenant files. It also means tenant document/media upload flows must use a deliberately designed, authenticated server-mediated path or a narrowly scoped future rule.

## 3. Findings requiring action

### P1 — Synthetic master identity inside production-capable provisioning workflow

**Evidence:** `src/platform/provisioning/provisioningService.ts` defines `createStepContext()` with hard-coded principal `usr_master_provisioner`, role `TDBK_MASTER_ADMIN`, wildcard permissions and `SERVICE_KEY` token source. This context is passed into persistent Business DNA binding.

**Risk:** Internal provisioning steps and audit attribution can appear to execute as a synthetic global master rather than as the initiating owner or a narrowly scoped provisioning service principal. This weakens attribution and makes the provider/client authority boundary harder to reason about.

**Required correction:** Replace the synthetic master with an explicit, non-user service principal and a dedicated provisioning capability. The service principal must have only the operations needed for the workflow, be impossible to mint from client identity claims, carry the initiating actor and tenant as separate immutable audit metadata, and be accepted only by the internal workflow execution boundary. Do not simply rename the fake master or grant a generic service token global privileges.

**Status:** Confirmed source-level concern; design and tests required before repair.

### P1 — Synchronous branch authorization primitive can be misused without tenant proof

**Evidence:** `branchAuthority.assertBranchContext()` grants a non-master principal access to any requested branch when `principal.branchId` is null/undefined. It does not itself validate the requested branch's tenant ownership. The async `assertPersistentBranchContext()` does validate tenant authority and durable branch ownership.

**Risk:** Any production path that calls the synchronous primitive alone could treat tenant-wide branch scope as global branch scope.

**Required correction:** Search all call sites. Restrict the synchronous helper to non-authoritative/test/context-display use or change its contract so it cannot authorize access without a validated tenant context. All production branch resource operations must use the persistent async authority path and bind the branch to the same tenant.

**Status:** Confirmed behavior in source; exploitability depends on call sites and must be tested.

### P1 — Route-by-route authorization coverage is not yet demonstrated

**Evidence:** `server.ts` contains individually implemented API handlers. Several correctly build a security context and delegate to authority services (e.g. connector, tenant verification, audit, agent execution, subscriptions). The repository also has reusable Express guards in `src/kernel/security/routeGuards.ts`, but the inspected server routes do not consistently apply a single global guarded-router pattern.

**Risk:** A future or overlooked handler may authenticate incompletely, use a caller-supplied tenant ID without a matching authority check, or call a privileged service with an anonymous context. Admin SDK persistence is not protected by Firestore client rules.

**Required correction:** Build and maintain an endpoint inventory with method, path, data classification, auth requirement, tenant/branch source, required permission/role, service authority check and test reference. Use explicit route guards or a common route wrapper. Require negative tests for missing auth, forged tenant, wrong tenant, wrong branch, insufficient role and disabled entitlement.

**Status:** Coverage gap confirmed; no blanket claim that every endpoint is vulnerable.

### P1 — Tenant claim representation must be reconciled across Firebase Rules and server identity

**Evidence:** `firestore.rules` checks top-level `request.auth.token.tenantId` and top-level `request.auth.token.role`. `tokenVerifier.ts` accepts both nested `tdbk.tenantId / tdbk.roles` and top-level `tenantId / roles`. Identity claims are managed by `tdbkIdentityService`.

**Risk:** If the authoritative custom-claim writer populates only the nested TDBK claim shape, direct Firestore rule checks will not recognize those users. Conversely, divergent top-level and nested claims can create inconsistent authorization decisions.

**Required correction:** Inspect the exact Firebase custom-claim writer and define one canonical claim contract. If compatibility requires duplicated claims, write both atomically from the same trusted identity record and add tests proving parity. Do not loosen rules to accept arbitrary alternatives without a migration plan.

**Status:** Contract mismatch risk identified; actual claim payload must be confirmed from `firebaseIdentityManager` before changing rules.

### P2 — Tenant operational data is intentionally server-mediated, but client data-access contract is not fully documented

**Evidence:** Firestore rules allow only selected tenant/branch/audit operations and deny unspecified descendants. Storage denies all non-Sokoni paths.

**Risk:** The client workspace may rely on server APIs for all operational data and files. Without a documented contract, developers may add broad rules to unblock UI work or ship a client experience with incomplete data access/export.

**Required correction:** Document each tenant collection and storage object category with its authoritative repository/API, permitted roles, branch scope, retention and export behavior. Keep default deny.

### P2 — Sokoni participant media write rule lacks owner binding in the visible rule

**Evidence:** `storage.rules` permits any authenticated user to write image content under `/sokoni/participants/{participantId}/{mediaId}` subject to a size/content-type check; the visible rule does not compare the caller to the participant owner. Firestore comments describe owner-management as intentionally not implemented.

**Risk:** An authenticated user may be able to upload media into another participant's public namespace, depending on how participant IDs are issued and whether an upstream trusted upload flow exists.

**Required correction:** Bind uploads to a verified participant owner or route through a server-issued, short-lived upload authorization. Test cross-participant upload denial. Keep this as a Sokoni-specific boundary issue, separate from tenant business data.

### P2 — Health readiness and external production evidence remain unverified

**Evidence:** Historical `docs/PRODUCTION_AUDIT_2026-09-18.md` records that readiness was uptime-oriented and live bridges were MOCK at that audit date. The current source tree includes later code and cannot be assumed identical in behavior. The GitHub repo metadata/branch inspection does not prove the current Cloud Run revision, live credentials or provider certification.

**Required correction:** Re-audit the current health implementation and bridge registry, then verify GCP deployment, service account IAM, Firestore, Pub/Sub, Secret Manager and live connector sandbox/production evidence separately.

## 4. Priority implementation backlog

| Priority | Work item | Acceptance evidence |
|---|---|---|
| P0 | Endpoint authorization inventory | Every production route classified and mapped to a tested authority check |
| P0 | Provisioning service principal design | No synthetic user/master identity; least-privilege workflow identity; initiating actor preserved |
| P0 | Branch authorization call-site audit | No production resource access relies on sync branch helper alone |
| P1 | Canonical identity claim contract | Unit/integration tests prove claim writer, token verifier and Firestore rules agree |
| P1 | Cross-tenant negative test matrix | Deny read/write/list/export/storage/background job across tenant boundaries |
| P1 | Client data and file contract | Collection/API/storage ownership and export mapping documented |
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
- Tenant termination revokes access and follows the agreed export/retention/deletion policy.

## 6. Audit limitations

This audit did not:
- execute npm tests, typecheck, lint or production build;
- run Firebase Emulator cross-tenant tests;
- inspect live Firebase custom claims or deployed Firestore/Storage rules;
- inspect Cloud Run IAM, service configuration or production secrets;
- perform dynamic API fuzzing or penetration testing;
- certify M-Pesa, WhatsApp, eTIMS, email, SMS or bank integrations.

## 7. Recommended next step

Complete the P0 endpoint inventory and branch-helper call-site audit first. Then fix the provisioning service identity and canonical claim contract in separate, test-backed pull requests. Preserve the existing platform architecture and avoid broad tenant schema migration until the data-flow inventory is complete.
