# SOKONI STATUS

## Last Updated
2026-09-22

## Current Phase
Phase 1 — Public Discovery Contract Consumption Audit

## Current Objective
Determine exactly which Sokoni UX surfaces can safely consume the latest authoritative TDBK Engine public-organization projection without creating Sokoni backend authority, marketplace masters, search infrastructure, or invented Engine contracts.

## Completed
- Read the existing Sokoni Phase 1 contract on the Sokoni branch.
- Inspected the current Sokoni branch state and compared it with `main`.
- Reconciled the audit against the latest `docs/ENGINE_PUBLIC_DISCOVERY_CONTRACT.md` and `docs/master/ENGINE-STATUS.md` on `main`.
- Reconciled the audit against `docs/master/DBK-STATUS.md` on `main`.
- Confirmed the Engine now has an implemented `PublicOrganizationProjection` pure projection boundary derived from authoritative `DbkIdentity` and active branch topology.
- Confirmed the Engine projection exposes only public-safe organization identity, sector, active branch/location fields, headquarters marker, state version, and derived eligibility.
- Confirmed the Engine projection does NOT expose public capability/service metadata, provider data, product data, publication state, service area, user-location matching, or anonymous public read authorization.
- Confirmed Sokoni's existing `SokoniPublicDiscoveryAdapter` remains a UX-only boundary and demo adapter; it is not an Engine integration.
- Confirmed no Sokoni marketplace master records, search infrastructure, duplicate records, request/payment/workflow authority, or DBK internals were added by this audit.

## In Progress
- No implementation work is in progress for this audit.
- The Sokoni branch is behind `main` and diverged from it; the branch must not bind to the newer Engine projection until the branch is synchronized with the latest Engine state.

## Verified

| Surface / dependency | Classification | Finding |
|---|---|---|
| Public business discovery | BLOCKED — ENGINE CONTRACT REQUIRED | `PublicOrganizationProjection` exists, but there is no approved persisted publication authority or anonymous public L7 read path. `ELIGIBLE` cannot be treated as `PUBLISHED`. |
| Public organization profile | BLOCKED — ENGINE CONTRACT REQUIRED | The Engine projection shape exists and is suitable as the authoritative read model, but Sokoni cannot safely consume it publicly until the approved publication/read authorization path exists. |
| Business → DBK experience handoff | BLOCKED — ENGINE CONTRACT REQUIRED | `dbkId` is canonical Engine identity, but a public discovery-to-DBK handoff requires the public organization read/publication boundary to be approved. Sokoni must not infer visibility from `ELIGIBLE`. |
| Public capability/service presentation | MASTER REVIEW REQUIRED | The Engine explicitly exposes no public-safe capability metadata through the current public organization projection. Existing capability discovery is DBK capability activation/discovery, not public Sokoni discovery. |
| Provider discovery boundary | MASTER REVIEW REQUIRED | No public provider projection contract exists. The public organization projection cannot be reinterpreted as provider authority. |
| Product discovery boundary | MASTER REVIEW REQUIRED | No public product projection contract exists. Existing transaction/product-related authority cannot be repurposed as public product discovery. |
| Location presentation boundary | BLOCKED — ENGINE CONTRACT REQUIRED for public use | Active branch county/town/address and headquarters marker are safely projected by the Engine. However, anonymous/public consumption still requires the approved publication/read path. User-location matching, service area, delivery area, geofencing and approximate-location semantics remain unresolved. |
| Discovery → request handoff | BLOCKED — ENGINE CONTRACT REQUIRED | No approved Sokoni-facing discovery/request contract exists. The existing Engine transaction authority is not a generic public service-request contract. |

## Engine Contracts Consumed
- `PublicOrganizationProjection` — Engine-owned pure public-safe organization projection shape, implemented on `main` in `src/platform/public/publicOrganizationProjection.ts`.
- `PublicOrganizationEligibility` — derived `ELIGIBLE | SUSPENDED | INELIGIBLE` outcome from authoritative DBK lifecycle state.
- `projectPublicOrganization(dbk)` — pure projection boundary.
- Authoritative `DbkIdentity` and `branchTopology` as the source for organization identity and active branch/location representation.
- Existing authenticated DBK `ExperienceProjectionService` remains a DBK projection pattern only; it is not consumed as Sokoni public discovery.
- Existing Engine capability discovery remains DBK capability activation/discovery and is not repurposed for Sokoni.

## Engine Contracts Required
- Approved public publication authority and persistence boundary.
- Approved anonymous/public L7 read authorization and error envelope for `PublicOrganizationProjection`.
- Public discovery/search contract before Sokoni can claim public business discovery.
- Public capability/service projection before Sokoni can claim public service discovery.
- Public provider projection before provider discovery can become authoritative.
- Public product projection before product discovery can become authoritative.
- Location-aware discovery/service-area/user-location privacy semantics.
- Discovery relevance/matching contract.
- Discovery → request contract.
- Request → quote/approval contract.
- Provider availability and coverage contracts.
- Public trust projection.

## DBK Dependencies
- DBK remains the organization-facing operating surface.
- DBK must consume the Engine `PublicOrganizationProjection` rather than create a public organization master.
- DBK must not locally convert `ELIGIBLE` to `PUBLISHED`.
- DBK's existing authenticated experience projection/resolver remains separate from Sokoni public discovery.
- DBK public organization handoff remains gated by Engine publication/read authority.

## Blocking Issues
- The latest Engine public-organization contract is a projection contract, not yet a public publication/read API contract.
- No repository-verified persisted publication authority exists.
- No anonymous public L7 read endpoint is approved/implemented.
- Public capability metadata is explicitly absent from the current Engine public projection.
- Provider, product, service, search, relevance, availability, coverage, trust and discovery-to-request contracts remain unresolved.
- The Sokoni branch is `11` commits behind `main` and `8` commits ahead, so it is not currently synchronized with the latest Engine implementation.

## MASTER REVIEW REQUIRED
- Publication owner and persisted publication authority.
- Publication lifecycle/state semantics.
- Public anonymous L7 read authorization and error semantics.
- Public capability/service metadata contract.
- Public provider projection and trust/verification semantics.
- Public product projection.
- Public discovery/search/relevance contract.
- Location-aware discovery, service-area, geofencing and privacy semantics.
- Provider availability/coverage.
- Discovery → request and request → quote/approval contracts.

## Discovery Journeys Verified
- The existing technician UX prototype remains structurally valid as a demo journey: `My computer is slow.` → interpreted need → location → discovery presentation → provider card → provider detail → request CTA → Engine handoff placeholder.
- This audit does not promote that journey to live discovery because the required public discovery/provider/request contracts are not approved.
- No live provider, matching, availability, request, quote, payment, receipt or completion state is claimed.

## UX Decisions
- The existing Sokoni UX adapter boundary remains the correct integration seam.
- No UI redesign is required merely because `PublicOrganizationProjection` now exists.
- Public organization cards/profile UX may be bound to the Engine projection once an approved public publication/read path exists.
- Branch county/town/address can be displayed as authoritative organization location data once that read path exists.
- Sokoni must not display capability/service/provider/product claims merely by reading unrelated internal Engine structures.
- The demo provider remains explicitly non-authoritative.

## Architecture Concerns
- The Engine's new `PublicOrganizationProjection` is a genuine authoritative projection and removes the earlier ambiguity around the organization projection shape, but it does not authorize public visibility by itself.
- `ELIGIBLE` is not `PUBLISHED`.
- Existing `DiscoveryEngineService` must not be repurposed as Sokoni search.
- Existing DBK `DbkExperienceProjection` must not be substituted for the public organization projection.
- Sokoni must not create a local publication flag, provider master, product master, service master, search index, request database, or transaction authority to bridge any remaining gap.
- Because the Sokoni branch is behind `main`, any future Engine binding must first be based on the synchronized repository state rather than the stale branch baseline.

## Files / Areas Changed
- `docs/master/SOKONI-STATUS.md` — updated with this Public Discovery Contract Consumption Audit.
- No Sokoni source files changed.
- No Engine source files changed.
- No DBK source files changed.
- No schemas, databases, search infrastructure, APIs, marketplace masters, transaction logic, payment logic, or workflow logic added.

## Next Recommended Sokoni Task
Synchronize the Sokoni branch with the latest `main` Engine state, then perform a single contract-binding audit against the approved public organization read/publication path before replacing any demo adapter behavior.

## Evidence
- Sokoni branch HEAD at audit start: `9febcdec58cbdbdf45ac682fe49bc8f13164c507`.
- `main` at audit start: `b56a2b89c455df772995d7a4c86ec190624ac8f5`.
- Branch comparison: Sokoni branch is `8` commits ahead and `11` commits behind `main`; merge base `303c00e4e13740a048cc929628e48acee96a2574`.
- Latest Engine public contract: `docs/ENGINE_PUBLIC_DISCOVERY_CONTRACT.md` on `main`, including implemented `PublicOrganizationProjection` and unresolved publication authority.
- Latest Engine status: `docs/master/ENGINE-STATUS.md` on `main`.
- Latest DBK status: `docs/master/DBK-STATUS.md` on `main`.
- Existing Sokoni Phase 1 contract: `docs/sokoni/PHASE1_EXPERIENCE_CONTRACT.md` on the Sokoni branch.
- Existing Sokoni adapter: `src/sokoni/SokoniDiscoveryAdapter.ts` on the Sokoni branch; remains demo/UX-only.
- GitHub combined status for Sokoni HEAD `9febcdec58cbdbdf45ac682fe49bc8f13164c507`: no status entries returned at audit time.
- No test/typecheck/lint/build execution was claimed; this task was an audit/status-only task and no source implementation was changed.
