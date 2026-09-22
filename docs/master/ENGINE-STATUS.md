# TDBK ENGINE STATUS

## Last Updated
2026-09-22

## Current Phase
Phase 2 — Engine Public Authority: Public Organization Projection and Publication Boundary

## Current Objective
Move from audit into the smallest Engine-owned public authority contract that DBK and Sokoni can safely consume, without creating duplicate public organization, marketplace, provider, product, service, search, workflow, or financial authority.

## Completed
- Read the current Engine status and public-discovery contract before implementation.
- Read the DBK status and attempted to read `docs/master/SOKONI-STATUS.md`; the Sokoni status file is not present in the repository and is therefore not treated as evidence.
- Re-inspected `src/platform/dbkRegistry.ts`, `src/platform/types.ts`, and `src/platform/projection/experienceProjection.ts` before implementing the public contract.
- Confirmed `DbkIdentity` and `branchTopology` are the authoritative source for organization identity and branch/location state.
- Confirmed existing `ExperienceProjectionService` remains the L7 projection pattern and was not duplicated or modified.
- Implemented the smallest justified public-safe organization projection in `src/platform/public/publicOrganizationProjection.ts`.
- Implemented lifecycle-derived public eligibility without creating a second publication state machine.
- Added focused tests in `src/platform/tests/publicOrganizationProjection.test.ts`.
- Replaced the previous broad reconciliation document with an explicit Public Organization Projection and Publication Boundary contract in `docs/ENGINE_PUBLIC_DISCOVERY_CONTRACT.md`.

## In Progress
- GitHub CI run for commit `18cad7f65d5ca3d68434b57bdf9790117d8a2bde` is running the repository's full verification gate.
- Publication authority itself remains unresolved because no repository-verified persisted publication owner/store exists.

## Verified
- repository source inspection: completed for DBK identity, lifecycle, branch topology, existing L7 projection, capability types, package scripts, and CI workflow.
- focused test implementation: present and committed; execution pending CI result.
- full tests: CI run `TDBK V2 CI` #532 is `in_progress` for commit `18cad7f65d5ca3d68434b57bdf9790117d8a2bde`.
- typecheck: pending CI run #532.
- lint: pending CI run #532.
- production build: pending CI run #532.
- deployment: not part of this task and not claimed.
- contracts: Public Organization Projection and Publication Boundary contract updated and committed.
- publication persistence: intentionally NOT implemented because repository inspection did not establish a safe authoritative owner.

## New Engine Contracts
- `PublicOrganizationProjection` in `src/platform/public/publicOrganizationProjection.ts`.
- `PublicOrganizationEligibility` with only repository-justified derived outcomes: `ELIGIBLE`, `SUSPENDED`, `INELIGIBLE`.
- `projectPublicOrganization(dbk)` pure L7 projection boundary.
- `evaluatePublicOrganizationEligibility(status)` derived from existing authoritative `DbkLifecycleStatus`.
- Public publication remains a separate authority and is not silently mapped from `ACTIVE` to `PUBLISHED`.

## Contracts Required by DBK
- `PublicOrganizationProjection` is now defined and implemented as a public-safe Engine projection.
- DBK may consume `dbkId`, `displayName`, `sector`, active branch identity/location, headquarters marker, state version, and derived eligibility.
- DBK must not expose excluded private fields or convert `ELIGIBLE` into `PUBLISHED`.
- Anonymous/public read authorization and publication persistence remain blocked pending publication authority approval.

## Contracts Required by Sokoni
- Same `PublicOrganizationProjection` is the Engine-owned organization projection boundary.
- Sokoni may consume the projection only through an approved public publication/read path.
- Sokoni must not create `SokoniOrganization`, publication state, provider/product/service masters, or discovery storage.
- Public capability claims are not exposed yet because no public-safe capability metadata contract was verified.

## Blocking Issues
- No repository-verified persisted public publication authority exists.
- Existing `ACTIVE` DBK lifecycle state cannot safely be treated as public `PUBLISHED` state.
- No repository-verified public publication owner/store/event vocabulary exists.
- No public anonymous L7 read endpoint has been implemented because doing so before publication authority would create an unsafe visibility assumption.
- `docs/master/SOKONI-STATUS.md` is absent from the repository; no Sokoni status claims are based on it.

## MASTER REVIEW REQUIRED
- Publication owner: DBK owner/operator, Master authority, or a combined authorization model.
- Publication persistence location and authority.
- Whether `DRAFT`, `REVIEW`, `PUBLISHED`, and `UNPUBLISHED` are required persisted states.
- Independent public suspension/revocation semantics versus existing DBK `SUSPENDED` lifecycle.
- Publication audit/event vocabulary.
- Anonymous public L7 read authorization/error envelope.
- Public-safe capability metadata contract.
- Public discovery location/service-area semantics.

## Risks / Architecture Concerns
- `ACTIVE` means operational DBK lifecycle, not public publication consent.
- `ELIGIBLE` is intentionally not `PUBLISHED`.
- The new projection is a read model and must never become business-state authority.
- Branch location is reused from authoritative DBK branch state; delivery/service-area semantics remain unresolved.
- Capability IDs/names are not exposed until a public-safe capability metadata contract exists.
- No search infrastructure, marketplace database, provider/product/service master, or marketplace workflow was introduced.
- Existing Engine authorization, capability, runtime, audit, financial and identity authority remains untouched.

## Files / Areas Changed
- `src/platform/public/publicOrganizationProjection.ts` — new Engine-owned public-safe organization projection and lifecycle-derived eligibility.
- `src/platform/tests/publicOrganizationProjection.test.ts` — focused projection/privacy/eligibility tests.
- `docs/ENGINE_PUBLIC_DISCOVERY_CONTRACT.md` — formalized public organization projection and publication boundary.
- `docs/master/ENGINE-STATUS.md` — this durable handoff.

## Next Recommended Engine Task
Resolve the publication authority decisions in `MASTER REVIEW REQUIRED`. Once approved, implement only the smallest persisted publication authority and its audit/events, then expose the approved L7 public organization read contract. Do not proceed to search, Provider/Product/Service projection, or discovery-to-request until that boundary is stable.

## Dependency Handoffs

### DBK
The Engine now provides a concrete `PublicOrganizationProjection` shape. DBK should consume it rather than create a public organization record. DBK presentation may proceed against the projection shape, but public visibility must remain gated by the eventual Engine publication authority. DBK must not locally publish an `ELIGIBLE` organization.

### SOKONI
Sokoni should treat `PublicOrganizationProjection` as the organization projection boundary once the Engine publication/read path is approved. Sokoni must not build a parallel organization/publication datastore. Public discovery and search remain downstream work.

## Evidence
- Repository: `thuram34/tdbk-v2-platform`.
- Prior Engine contract baseline: `docs/ENGINE_PUBLIC_DISCOVERY_CONTRACT.md`.
- Existing DBK authority: `src/platform/dbkRegistry.ts`, `src/platform/types.ts`.
- Existing L7 projection: `src/platform/projection/experienceProjection.ts`.
- CI workflow: `.github/workflows/ci.yml` runs typecheck, lint, test, production build and Docker validation on pushes to `main`.
- Implementation commit sequence: `3faf91bd6330158ca3ac7a415a64bb315c9d739e` (projection), `4eec9259449bf03a25e73e08ffdaea2008ffc0ae` (test correction), `18cad7f65d5ca3d68434b57bdf9790117d8a2bde` (contract update; CI head).
- CI run: `TDBK V2 CI` run #532, status `in_progress` at time of this update.
- No test/typecheck/lint/build success is claimed until CI completes.
