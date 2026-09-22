# DBK STATUS

## Last Updated
2026-09-22

## Current Phase
DBK Experience Flow Contract Audit

## Current Objective
Audit the existing DBK public organization flow against verified Engine contracts and the DBK Phase 0 dependency boundary without creating backend logic, duplicate authority, DBK storage, or Sokoni assumptions.

## Completed
- Audited the current application entry flow in `src/App.tsx`.
- Audited the existing public gateway in `src/public/PublicGateway.tsx`.
- Audited authenticated onboarding in `src/components/onboarding/BusinessDiscovery.tsx`.
- Audited the existing DBK workspace entry in `src/components/experience/DbkApp.tsx` and the Engine-backed shell.
- Audited the owner portfolio implementation in `src/components/experience/OwnerPortfolioView.tsx`.
- Audited the authoritative capability discovery implementation in `src/capability/discovery.ts`.
- Audited the current Engine public organization contract in `src/platform/public/publicOrganizationProjection.ts` through `docs/master/ENGINE-STATUS.md`.
- No backend code, DBK datastore, public organization datastore, or Sokoni implementation was created.

## In Progress
- None for this task. This audit is complete and intentionally stopped here.

## Verified
- `PublicGateway` exists and provides the current public entry experience.
- Authenticated onboarding exists in `BusinessDiscovery`.
- `BusinessDiscovery` currently calls Engine endpoints for owner identity initialization, DBK provisioning, blueprint retrieval, DBK listing, and capability enablement.
- The Engine's `DiscoveryEngineService` is the authoritative capability-discovery implementation and evaluates Business DNA, blueprint compatibility, existing capability state, entitlement, and dependencies. DBK onboarding currently does not consume this discovery contract.
- The Engine now has a concrete `PublicOrganizationProjection` contract, but anonymous/public read authorization and persisted publication authority remain unresolved. `ELIGIBLE` must not be treated as `PUBLISHED`.
- `DbkShell` remains Engine-backed through the existing experience resolver/command boundaries.
- Owner/operator multi-DBK support exists, but `src/App.tsx` currently filters the top-level DBK list to `ACTIVE` records and therefore can hide non-active Engine states before the owner-facing portfolio can display them.
- The repository's current top-level public flow is not a complete `Landing -> Intent -> Solution -> Industry -> Capability -> Registration -> Business Context -> Engine Recommendation -> Capability Selection -> Engine Provisioning -> Workspace` contract flow.

## Engine Contracts Consumed
- Authentication through `AuthContext` / Firebase token acquisition.
- `/api/platform/dbks` for Engine-owned DBK listing.
- `/api/kernel/identity/initialize-owner` for Engine owner initialization.
- `/api/blueprints` for Engine-provided blueprint metadata used by current onboarding.
- `/api/platform/provision` for Engine DBK provisioning.
- `/api/capability/enable` for Engine capability activation.
- Existing `DbkShell` experience resolution and Engine-backed commands.
- Engine `BusinessDnaManager` and `DiscoveryEngineService` were verified as authoritative contracts, but are NOT currently invoked by the public onboarding flow.
- Engine `PublicOrganizationProjection` is verified as the public-safe projection boundary, but DBK has no public anonymous read/publication authority to invoke yet.

## New Engine Dependencies
- None introduced.

## Sokoni Dependencies
- None introduced.
- No Sokoni implementation was inspected or modified as an implementation target.
- `docs/master/SOKONI-STATUS.md` is still absent from the repository; no Sokoni status assumptions were made.
- Public DBK -> Sokoni handoff remains outside this task.

## Blocking Issues
- **Engine Recommendation:** no repository-verified DBK-facing recommendation contract was found for the onboarding stage. Current onboarding jumps from blueprint selection to capability selection.
- **Business Context -> Business DNA:** current `BusinessDiscovery` captures `narrative`, but the value is not sent to an Engine Business DNA contract. The current flow therefore does not establish the requested Business Context -> Engine DNA boundary.
- **Capability Discovery:** current onboarding reads `supportedCapabilities` from `/api/blueprints` and locally toggles selections, instead of consuming the authoritative `DiscoveryEngineService` result with entitlement/dependency state.
- **Top-level owner state:** `src/App.tsx` filters DBKs to `ACTIVE`, which hides Engine-owned provisioning/inactive/error states from the initial owner flow.
- **Public publication:** Engine `PublicOrganizationProjection` exists, but publication persistence and anonymous public read authorization are still blocked by Engine MASTER REVIEW decisions.

## MASTER REVIEW REQUIRED
- Approve/define the DBK-facing Engine Recommendation contract if recommendation is to be a distinct authoritative stage.
- Approve/define how onboarding context is committed to the existing Business DNA authority before capability discovery.
- Confirm the DBK-facing API boundary for authoritative capability discovery during onboarding.
- Resolve Engine public publication authority and anonymous read authorization before DBK exposes public organization pages.
- No DBK workaround should be created for any of these gaps.

## UX Decisions
- Landing can remain a DBK-owned presentation surface without an Engine transaction.
- Public intent/solution/industry presentation must not silently become a second taxonomy authority. Current `BusinessSector` values in `PublicGateway` are presentation state only and are not verified as the authoritative Engine taxonomy.
- Local form state such as selected capability IDs is acceptable as temporary UX state, but it must not become capability authority or entitlement authority.
- Loading, error, provisioning, and retry states can be handled in DBK presentation; authoritative lifecycle state must continue to come from Engine.
- Owner/operator multi-organization selection must preserve all Engine-owned lifecycle states rather than filtering them out in the UI.
- Existing developer/engineering controls are not part of the normal organization journey.

## Architecture Concerns
- `BusinessDiscovery` generates a client-side `dbkId` (`dbk-${slug}-${timestamp}`) before calling the Engine provisioning endpoint. This is not persisted as a DBK datastore by the UI, but it is a DBK-generated identifier passed into Engine authority. Because the current Engine provisioning contract requires `dbkId`, this is an unresolved contract concern rather than something DBK should independently replace.
- `OwnerPortfolioView` similarly derives an internal DBK identifier from organization name for the current provisioning contract. Do not create another identifier authority to solve this locally.
- `BusinessDiscovery` initializes the owner identity and provisions directly; the current UI does not expose a distinct account -> organization -> Business DNA -> recommendation sequence.
- The current public gateway contains static showcase data and business-sector unions. These are presentation content, not verified Engine solution/industry authority.
- `App.tsx` contains a top-level engineering-mode path and developer control. This was not changed during this audit because removing or relocating it is outside the verified public-flow contract and should be handled only as a safe DBK UI change with no effect on Engine authority.

## Files / Areas Changed
- `docs/master/DBK-STATUS.md` — durable record of this audit and its contract findings.
- No application source files changed during this audit because the identified flow gaps require Engine contract decisions or contract alignment rather than safe local workarounds.
- No Engine files changed.
- No Sokoni files changed.

## Next Recommended DBK Task
**SINGLE TASK:** Align DBK onboarding with the verified Engine capability-discovery and Business DNA contract once the required Engine-facing onboarding contracts are confirmed by Master. Do not implement a DBK substitute for recommendation, Business DNA authority, or capability discovery.

## Evidence
- Audit head inspected: `b56a2b89c455df772995d7a4c86ec190624ac8f5`.
- DBK status was updated from the prior DBK milestone state.
- `src/App.tsx` inspected directly.
- `src/public/PublicGateway.tsx` inspected directly.
- `src/components/onboarding/BusinessDiscovery.tsx` inspected directly.
- `src/components/experience/DbkApp.tsx` inspected directly.
- `src/components/experience/OwnerPortfolioView.tsx` inspected directly.
- `src/capability/discovery.ts` inspected directly.
- `docs/master/ENGINE-STATUS.md` inspected; Engine public projection contract is implemented, while publication authority/read remains unresolved.
- No local test/typecheck/lint/build execution was available through the connected repository tooling during this audit; no passing verification claim is made.
- Commit generated by this status update: to be confirmed by repository head after write.
