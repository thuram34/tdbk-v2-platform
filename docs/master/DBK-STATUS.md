# DBK STATUS

## Last Updated
2026-09-25

## Current Phase
DBK-07 Engine Recommendation Consumption — COMPLETE

## DBK-07 Engine Recommendation Boundary
The Engine exposes `/api/dna/:dbkId/recommendations` and returns ranked capability recommendations with reasons and scores. This is an Engine decision surface; DBK must display it and must not recompute recommendation scores.

## Current Objective
Bind onboarding completion to verified Engine-owned Business DNA by confirming the provisioned DBK has authoritative durable DNA before entering the workspace.

## Completed
- Bound the authenticated capability discovery surface to `ExperienceDiscoveryItem.status` returned by the existing Engine `ExperienceResolver` contract.
- DBK now presents the Engine-resolved states `OPERATIONAL`, `DISCOVERABLE`, `UPGRADE_REQUIRED`, `CONFIGURATION_REQUIRED`, and `SUSPENDED` distinctly.
- Capability activation remains an Engine command through the existing `ENABLE_CAPABILITY` boundary.
- DBK no longer reduces capability state to the local `isEnabled` / `isEntitled` combination when deciding how the user-facing capability state should be presented.
- Configuration-required capabilities stop at the UI boundary because the repository does not expose a verified DBK configuration payload contract for this surface.
- The capability discovery heading now uses `CAPABILITY DISCOVERY` rather than marketplace terminology, keeping authenticated capability activation distinct from Sokoni discovery.
- Existing public flow, onboarding flow, organization portfolio, workspace, branch context, and Engine authority remain unchanged.

## Engine Contracts Consumed
- `AuthContext` / authenticated identity boundary.
- `/api/platform/dbks` — owner DBK identity/status listing.
- `/api/experience/resolve/:dbkId` — authoritative authenticated DBK experience projection, including `discoveryItems`, entitlement state, capability state, permissions and workspace context.
- `/api/experience/command` — authoritative capability activation boundary using `ENABLE_CAPABILITY`.
- `/api/dna/:dbkId/recommendations` — Engine-owned capability recommendation surface consumed after authoritative onboarding persistence.
- `ExperienceDiscoveryItem.status` in `src/experience/types.ts` — existing Engine/Experience vocabulary for capability presentation.
- `src/capability/discovery.ts` and `src/capability/evaluator.ts` — Engine-owned entitlement/dependency evaluation consumed upstream by the resolver.

## No New Authority
This task introduced no:
- identity authority
- tenant store
- organization master
- Business DNA store
- capability registry
- entitlement engine
- permission authority
- transaction/payment/receipt truth
- workflow/event authority
- AI authority
- connector authority
- publication authority
- Sokoni datastore

## Deferred / MASTER REVIEW REQUIRED
- **Business Context narrative persistence.** Resolved: Engine Business DNA now exposes `businessContextNarrative`, with an authenticated update contract, validation, durable Firestore persistence and audit logging. DBK submits onboarding narrative through that Engine boundary and verifies the returned authoritative value.
- **Engine DBK recommendation contract.** Resolved: Engine now owns deterministic capability recommendation generation from authoritative Business DNA, including business context, blueprint compatibility and capability state. DBK consumes the returned recommendations without reimplementing the scoring logic.
- **DBK recommendation presentation.** Resolved: onboarding now retrieves the Engine recommendation surface after provisioning/context persistence and presents returned recommendations without auto-enabling them.
- **Configuration payload contract for capability configuration.** `CONFIGURATION_REQUIRED` is exposed by the Experience contract, but this task does not invent the payload/schema needed by `CONFIGURE_CAPABILITY`.
- **Anonymous public organization publication/read authority.** Remains outside this task.
- **Sokoni integration/handoff contract.** No Sokoni logic introduced.

## Architecture Integrity
- DBK remains an Experience Layer.
- Engine remains authoritative for capability eligibility, entitlement, dependency evaluation, permission and activation.
- `DISCOVERABLE` is not treated as `ENABLED`.
- `CONFIGURATION_REQUIRED` is not treated as operational.
- `SUSPENDED` is not presented as activatable.
- No local capability eligibility or entitlement calculation was introduced.
- No fake backend API was created.

## Files Changed
- `src/components/experience/DiscoveryMarketplaceView.tsx` — Engine-status-driven capability presentation and activation UI.
- `src/components/onboarding/BusinessDiscovery.tsx` — verifies authoritative Business DNA after Engine provisioning, then consumes and presents Engine capability recommendations before entering the workspace.
- `docs/master/DBK-STATUS.md` — continuation state, dependency and verification record.

## Verification
- Repository inspected from latest GitHub default branch before implementation.
- `package.json` confirms available scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Local Node/npm execution is unavailable in the connected GitHub repository environment; tests, typecheck, lint and build were therefore not executed locally.
- GitHub Actions query for implementation commit `793307de9208231b5a6b696d179195c2274bea0d` returned `total_count: 0`; no CI result is claimed as passing evidence.
- No TDBK Engine repository was modified.
- No Sokoni repository or Sokoni logic was modified.

## Result
The onboarding flow now treats Engine provisioning as the Business DNA authority, verifies the durable `/api/dna/:dbkId` projection, persists Business Context through the Engine, and then consumes `/api/dna/:dbkId/recommendations` before handing the user into the DBK workspace. Recommendations are presentation-only and are never auto-enabled or recomputed locally.

## Next SINGLE Task
**MASTER REVIEW REQUIRED — Validate the DBK recommendation boundary end-to-end.**

The implementation is complete at the DBK presentation boundary. Before further feature work, verify the Engine endpoint and onboarding path together in a real authenticated environment; no local tests or CI results are claimed from this change.
