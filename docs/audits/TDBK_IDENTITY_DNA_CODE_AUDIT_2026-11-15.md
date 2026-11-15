# TDBK Identity & Business DNA Code Audit — 2026-11-15

**Scope:** Source-level inspection of identity claims, Firestore tenant paths, Business DNA persistence, synchronous cache access and blueprint validation.  
**Branch:** `docs/tdbk-master-dna-blueprint-v1`  
**Status:** Partial remediation committed; CI execution and deployed verification pending.

## 1. Identity contract confirmed

The source establishes the following invariant:

`tenantId === dbkId`

- `dbkId` is the domain-level Business/DBK identifier in Blueprint and Business DNA types.
- `tenantId` is the storage/security-boundary identifier used by Firestore paths and Firebase custom claims.
- `src/persistence/types.ts` explicitly documents the invariant.
- `src/persistence/firestore/firestoreClient.ts` restricts authoritative paths to `/tenants/{tenantId}/...`.
- `BusinessDnaRepository` stores the aggregate at `/tenants/{tenantId}/configuration/business_dna`.
- `FirebaseIdentityManager` writes top-level `tenantId` claims (and a nested TDBK claim projection).
- `firestore.rules` authorizes tenant membership using `request.auth.token.tenantId`.

**Decision:** retain both names in their respective contexts; do not run a global rename. Enforce equality whenever both names occur in one payload or aggregate.

## 2. Security issue identified and remediated in this branch

### S-01 — synchronous Business DNA access trusted BUSINESS_OWNER role alone

Before this branch's fix, `BlueprintValidator.assertTenantAccess()` returned success for any principal with the `BUSINESS_OWNER` role, without checking ownership of the requested DBK. This differed from `MasterAuthorityService.assertTenantAuthority()`, which checks portfolio ownership against the authoritative DBK Registry.

The synchronous methods are cache-backed. A role-only bypass could therefore expose a cached business aggregate across portfolios if a caller reached one of those methods.

**Change committed:** synchronous cache-backed access now permits:
- A principal explicitly identified as TDBK master (both `isMaster === true` and `TDBK_MASTER_ADMIN` role); or
- A tenant-bound principal whose `principal.tenantId` exactly matches the requested DBK and has at least one role.

A Business Owner with no exact tenant claim must use the persistent path, where portfolio ownership is checked against the DBK Registry. Role possession alone no longer grants synchronous cross-business cache access.

**Important:** this does not replace route-by-route authorization review. Every production API must still use the authoritative persistent authorization path.

## 3. DNA integrity issues identified and remediated in this branch

### D-01 — aggregate and nested identity could disagree
The validator checked that both identifiers existed but did not require `dna.dbkId === dna.identity.dbkId`.

**Change committed:** mismatch is now rejected.

### D-02 — branch topology allowed duplicate IDs and inconsistent cardinality
The validator required one HQ but did not reject duplicate branch IDs or enforce the stated SINGLE_BRANCH / MULTI_BRANCH cardinality.

**Change committed:** rejects empty/duplicate branch IDs, empty branch names, SINGLE_BRANCH with anything other than one branch, and MULTI_BRANCH with fewer than two branches.

### D-03 — enabled capability IDs could be empty or duplicated
**Change committed:** rejects empty/non-string IDs and duplicate capability IDs.

## 4. Automated tests added

New test file: `src/blueprint/tests/businessDnaIntegrity.test.ts`.

Cases:
1. Reject aggregate/nested identity mismatch.
2. Reject duplicate branch IDs.
3. Reject inconsistent single-branch topology.
4. Reject duplicate capability IDs.
5. Reject Business Owner role-only cross-business cache access.
6. Permit exact-tenant synchronous access and reject a different tenant.
7. Require explicit master identity plus master role for the synchronous bypass.

**Test execution status:** tests have been added to the branch but have not yet been executed in this environment. CI must pass before these changes are considered verified.

## 5. Additional risks found; not yet changed

### R-01 — compiler fallback after persistent read failure
`BlueprintCompiler.compileWorkspace()` first calls `getPersistentBusinessDna()` and catches any error before attempting the synchronous cache-backed `getBusinessDna()` path. The tightened synchronous guard blocks role-only Business Owner cross-tenant access, but fallback on arbitrary persistence errors can still serve cached state for a same-tenant request. Production request paths should prefer `compilePersistentWorkspace()` and must not convert an unavailable/failed authoritative read into a successful stale read.

### R-02 — capability status is overstated by compilation
`compileFromBlueprintAndDna()` currently maps membership in `enabledCapabilityIds` directly to `OPERATIONAL`. That does not independently prove plan entitlement, dependencies, configuration, permission readiness or a live runtime handler. The compiled status should eventually distinguish ENABLED from OPERATIONAL/VERIFIED and consume the authoritative capability resolver.

### R-03 — blueprint registry mutability
`BlueprintRegistry.registerBlueprint()` writes to the same `id@version` key without an immutable-publication guard. Published versions need an explicit lifecycle and mutation policy; current registry behavior alone does not enforce immutability.

### R-04 — synchronous cache methods remain in codebase
`bindBlueprintToDbk()`, `getBusinessDna()` and `saveBusinessDna()` are cache-backed compatibility/test methods. Production routes must be audited to ensure they call persistent variants and do not fall back to cache on authorization, not-found, timeout or provider errors.

### R-05 — blueprint defaults and entitlement remain separate concerns
DNA binding seeds `enabledCapabilityIds` from blueprint defaults. Provisioning also initializes entitlement/capability records. The UI/compiler must not interpret DNA membership as proof that a capability is entitled, configured or operational.

## 6. Next implementation order

1. Run targeted DNA validator tests and the full Phase 1 suite.
2. Run typecheck, lint and production build.
3. Audit every route calling `compileWorkspace`, `getBusinessDna`, `saveBusinessDna` or `bindBlueprintToDbk`.
4. Replace production compiler fallbacks with explicit persistent-read behavior; retain test-only compatibility deliberately.
5. Make capability compilation consume entitlement/dependency/configuration/runtime readiness instead of DNA flags alone.
6. Enforce immutable published blueprint versions with tests.
7. Run tenant A / tenant B API and Firestore rules negative tests.
8. Verify the deployed Cloud Run revision separately from CI.

## 7. Evidence boundary

This is a source inspection and branch change record. It does not certify:
- CI success for this branch;
- production Cloud Run behavior;
- live Firebase custom claims or deployed Firestore rules;
- production data migration or backup restore;
- M-Pesa, eTIMS, WhatsApp or other provider readiness.
