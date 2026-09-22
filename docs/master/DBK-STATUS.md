# DBK STATUS

## Last Updated
2026-09-23

## Current Phase
DBK-05 Capability Activation UX

## Current Objective
Bind authenticated capability discovery and activation presentation to the Engine-resolved capability status without inferring entitlement, eligibility, configuration, or suspension locally.

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
- **Business Context -> authoritative persistent Business DNA onboarding contract.** The DBK onboarding UI captures a narrative locally, but no verified DBK-facing persistence contract was located. DBK must not fabricate one.
- **Engine DBK recommendation contract.** Blueprint/capability metadata is available, but a verified recommendation authority that transforms business context into recommendations was not located.
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
- `docs/master/DBK-STATUS.md` — continuation state, dependency and verification record.

## Verification
- Repository inspected from latest GitHub default branch before implementation.
- `package.json` confirms available scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Local Node/npm execution is unavailable in the connected GitHub repository environment; tests, typecheck, lint and build were therefore not executed locally.
- GitHub Actions query for implementation commit `793307de9208231b5a6b696d179195c2274bea0d` returned `total_count: 0`; no CI result is claimed as passing evidence.
- No TDBK Engine repository was modified.
- No Sokoni repository or Sokoni logic was modified.

## Result
DBK capability discovery now consumes the Engine's complete resolved capability-state vocabulary instead of deriving presentation from partial local flags. Activation remains Engine-authorized. Missing configuration authority remains a clean boundary rather than a fabricated implementation.

## Next SINGLE Task
**MASTER REVIEW REQUIRED: verify and expose the authoritative Business Context -> Business DNA onboarding contract.**

If that contract is confirmed, the next DBK implementation should bind the existing onboarding context UI to it. If it is not confirmed, DBK must remain at the boundary and document the dependency rather than creating local Business DNA persistence.
