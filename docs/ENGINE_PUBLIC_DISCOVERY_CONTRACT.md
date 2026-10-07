# TDBK Engine Public Authority Contract

**Status:** ACTIVE — Public Organization Projection / Publication Boundary
**Scope:** TDBK Engine only
**Authority:** TDBK Engine / Master Authority
**Last Updated:** 2026-09-22

## 1. Purpose

This document is the durable Engine contract for the first public-discovery dependency shared by DBK and Sokoni:

1. Public Organization Projection
2. Public Publication / Discoverability Authority boundary

It does **not** authorize a marketplace, search infrastructure, provider/product/service masters, or a Sokoni/DBK datastore.

The governing rule remains:

> DBK and Sokoni consume Engine authority. They do not create replacement business, publication, organization, branch, provider, product, service, discovery, workflow, transaction, or financial authority.

## 2. Existing Authority Reused

The implementation was reconciled against the current repository before adding the public contract.

| Concern | Existing authority | Treatment |
|---|---|---|
| DBK identity | `src/platform/dbkRegistry.ts` / `DbkIdentity` | authoritative source |
| DBK lifecycle | `DbkLifecycleStatus` | authoritative eligibility input |
| Branch topology/location | `DbkIdentity.branchTopology` / `DbkBranch` | authoritative source |
| Workspace state/version | `workspaceManager` / existing projection | existing L7 consistency pattern |
| Capability authority | capability registry/discovery/entitlement | unchanged; not redefined as public publication |
| Authenticated L7 projection | `src/platform/projection/experienceProjection.ts` | reusable projection pattern |
| Audit | existing Kernel audit | publication/projection actions must use Engine audit when state-changing authority is later approved |

## 3. Public Organization Projection

### 3.1 Authoritative source

The public organization projection is derived from the authoritative `DbkIdentity` held by the DBK Registry. Branches are derived from `DbkIdentity.branchTopology`.

No public organization record is persisted as a second master.

### 3.2 Current implemented projection

```ts
PublicOrganizationProjection {
  dbkId: string
  displayName: string
  sector: SectorType
  branches: PublicOrganizationBranch[]
  stateVersion: {
    configurationVersion: number
    updatedAt: string
  }
  eligibility: 'ELIGIBLE' | 'SUSPENDED' | 'INELIGIBLE'
}
```

### 3.3 Public-safe fields

Currently exposed by the Engine projection:

- `dbkId` — stable Engine DBK identity
- `displayName` — organization-facing display identity
- `sector` — existing Business DNA/DBK sector classification
- active branch identity/name/type
- active branch public location fields already present on the authoritative branch record: county, town, address
- headquarters marker
- configuration version and authoritative update timestamp for consistency detection
- derived public eligibility

### 3.4 Private fields excluded

The public projection deliberately excludes:

- legal name
- subscription tier
- master owner
- creator identity
- lifecycle history
- arbitrary metadata
- internal configuration
- internal permissions
- private customer/transaction state
- internal capability lifecycle state
- financial information

No field is public merely because it exists on `DbkIdentity`.

### 3.5 DBK relationship

`dbkId` remains the canonical Engine identity. DBK owns the organization-facing presentation but does not create a public organization master.

The projection is therefore:

```text
DBK Registry
    -> DbkIdentity
    -> L7 public-safe projection
    -> DBK / Sokoni
```

### 3.6 Branch/location representation

Only branches with authoritative branch status `ACTIVE` are included.

Each projected branch contains:

- branch ID
- branch name
- branch type
- county, town and address where present on the authoritative branch record
- headquarters marker

Archived/inactive branches are excluded.

This contract does **not** establish service area, delivery area, geofencing, user-location matching, or approximate-location semantics. Those remain `MASTER DECISION REQUIRED`.

### 3.7 Capabilities exposed publicly

**None are currently exposed by this contract.**

The Engine already has capability discovery, entitlement, and lifecycle authority, but the repository does not establish a public-safe capability metadata contract. Exposing internal capability IDs/names as public organization claims would therefore be an architectural assumption.

A public capability projection is `MASTER DECISION REQUIRED` and must reuse the capability registry rather than create a second capability catalog.

### 3.8 Version/state consistency

The projection carries:

- `configurationVersion`
- authoritative `updatedAt`

This is the minimum consistency information already justified by the DBK identity model. `workspaceVersion` is not exposed because the public projection is sourced directly from the canonical DBK identity rather than creating a second workspace snapshot.

Consumers must treat the projection as a read model and must not write state back through it.

### 3.9 Eligibility

The implemented eligibility evaluator is deliberately derived from the existing DBK lifecycle authority:

| DBK lifecycle | Public eligibility |
|---|---|
| `ACTIVE` | `ELIGIBLE` |
| `SUSPENDED` | `SUSPENDED` |
| `PROVISIONING` | `INELIGIBLE` |
| `PROVISIONING_FAILED` | `INELIGIBLE` |
| `ARCHIVED` | `INELIGIBLE` |

This is an eligibility gate, **not publication state**.

An `ELIGIBLE` organization must not be interpreted as publicly published until a publication authority exists.

### 3.10 Authorization

The projection itself does not create a new authorization system.

For authoritative DBK reads, existing `dbkRegistry` authorization and Kernel/Master authority remain authoritative. The existing authenticated `ExperienceProjectionService` already enforces tenant access before compiling workspace state.

A public unauthenticated read path requires a publication authority that can authorize public visibility. That path is not invented here.

### 3.11 L7 request/response boundary

The implemented pure projection boundary is:

```text
Authoritative DbkIdentity
        -> projectPublicOrganization(dbk)
        -> PublicOrganizationProjection
```

The eventual public HTTP/API request contract is intentionally **not** invented yet because public publication authority is not persisted in the current Engine.

When approved, the L7 request must identify the public organization and return only a currently published, eligible, public-safe projection. It must not query or write a DBK/Sokoni-owned public datastore.

### 3.12 Error behavior

The projection function is deterministic and does not invent error semantics.

For an eventual public L7 read endpoint, the following semantics are required but the exact API error envelope remains `MASTER DECISION REQUIRED`:

- unknown organization -> not found / non-discoverable
- ineligible organization -> not publicly visible
- suspended organization -> not publicly visible
- unpublished organization -> not publicly visible
- unauthorized internal request -> existing Engine authorization error
- malformed request -> existing API validation error

No private-state details should be disclosed through these errors.

### 3.13 Audit

Projection reads are read-model operations and must not create business-state audit mutations merely because a consumer renders them.

Any future publication/unpublication/suspension state mutation must use the existing Engine audit authority and record actor, organization, previous state, new state, reason, correlation/request identity, and timestamp.

The exact publication event/audit vocabulary is `MASTER DECISION REQUIRED` because no repository-verified publication authority currently exists.

## 4. Public Publication / Discoverability Authority

### 4.1 Repository finding

The repository does **not** currently contain a generic persisted public publication authority.

Existing DBK lifecycle state is authoritative for operational lifecycle, but it cannot safely be reinterpreted as a publication preference/state. In particular, `ACTIVE` does not mean an organization has opted into public discovery.

Therefore the Engine must not silently map:

```text
ACTIVE -> PUBLISHED
```

### 4.2 Justified states today

Only the following public-facing eligibility outcomes are justified by existing authority:

```text
ELIGIBLE
SUSPENDED
INELIGIBLE
```

They are derived from existing DBK lifecycle state and are implemented in `evaluatePublicOrganizationEligibility()`.

They are **not** a publication state machine.

### 4.3 Requested publication lifecycle

The proposed sequence:

```text
DRAFT
-> REVIEW/ELIGIBILITY
-> PUBLISHED
-> UNPUBLISHED
-> SUSPENDED
```

cannot be implemented as a persistent Engine lifecycle yet because the repository has no verified owner, persistence model, authorization rule, or audit/event vocabulary for publication.

Accordingly:

**MASTER DECISION REQUIRED**

before introducing `DRAFT`, `REVIEW`, `PUBLISHED`, or `UNPUBLISHED` as authoritative persisted states.

### 4.4 Suspension

`SUSPENDED` is justified only as a derived public eligibility outcome from the existing authoritative DBK lifecycle status `SUSPENDED`.

It is not currently an independently managed publication suspension state.

If Master later approves independent public suspension, that state must be separately owned and audited rather than modifying DBK operational lifecycle semantics.

### 4.5 Publication eligibility rules already justified

A public organization candidate must:

1. resolve from an authoritative Engine DBK identity;
2. have a valid DBK identity;
3. be `ACTIVE` for `ELIGIBLE` status;
4. expose only public-safe fields;
5. contain only active branches in its branch projection;
6. not expose private lifecycle, ownership, entitlement, or financial state.

These rules do not grant publication.

### 4.6 What remains unresolved

The following publication decisions remain explicit:

- who opts an organization into public publication;
- whether publication is owner-controlled, Master-controlled, or both;
- whether a publication review state is required;
- whether publication is separate from DBK operational lifecycle;
- exact persisted publication owner/store;
- publication events;
- publication audit event names;
- public suspension/revocation semantics;
- whether public capability claims require separate approval;
- public API authorization semantics for anonymous discovery.

All are **MASTER DECISION REQUIRED**.

## 5. Security Boundary

Public projection must reuse Engine security and must never bypass:

- identity authority;
- tenancy;
- authorization;
- capability authority;
- audit;
- runtime authority;
- financial authority.

No public projection may expose customer PII, internal credentials, transaction state, subscription secrets, or internal operational configuration.

## 6. DBK Consumer Contract

DBK may consume `PublicOrganizationProjection` for organization-facing public presentation.

DBK must not:

- persist a second public organization master;
- decide publication independently;
- expose private Engine fields because they are available in `DbkIdentity`;
- convert `ELIGIBLE` into `PUBLISHED` locally.

## 7. Sokoni Consumer Contract

Sokoni may consume the same Engine projection once a public publication/read path is approved.

Sokoni must not:

- create `SokoniOrganization` as authoritative truth;
- create `SokoniProvider`/`SokoniProduct`/`SokoniService` masters;
- create its own publication state;
- treat `ELIGIBLE` as `PUBLISHED`;
- infer public availability from this projection.

## 8. Current Implementation

Implemented Engine-owned code:

- `src/platform/public/publicOrganizationProjection.ts`
- `src/platform/tests/publicOrganizationProjection.test.ts`

The implementation is deliberately pure and projection-only. It does not add persistence, a public API route, search, a publication collection, or a new authority.

## 9. Tests

Required tests now cover:

- public-safe field projection;
- exclusion of private identity/configuration/lifecycle data;
- active-branch filtering;
- lifecycle-derived eligibility;
- suspended/ineligible outcomes;
- absence of an invented publication state.

Repository CI remains the authoritative execution environment for the full test/typecheck/lint/build gate.

## 10. Next Authority Boundary

Before implementing an anonymous public L7 endpoint or publication persistence, Master must resolve the publication authority decisions in §4.6.

After that decision, the next Engine implementation should be the **smallest approved publication authority**, followed by the L7 public organization read contract.

Do not implement search infrastructure, provider/product/service masters, or marketplace workflows as part of this phase.


## 11. Grand Operation Update — 2026-10-07

The previously unresolved publication boundary is now implemented in the Engine:

- Durable publication state is stored at `/tenants/{dbkId}/publicPublication/organization`.
- Publication is owner/tenant-administrator controlled and audited.
- Only lifecycle-eligible ACTIVE DBKs can be published.
- Public discovery exposes only the existing public-safe organization projection.
- Public discovery has server routes for single organization and filtered organization lists.
- Sokoni consumes this contract through its TDBK public discovery adapter.
- Publication remains separate from DBK lifecycle; suspension/archival automatically makes the organization ineligible for public projection.

The remaining marketplace-specific Sokoni contracts remain separate from this Engine publication boundary.
