# DBK STATUS

## Last Updated
2026-09-22

## Current Phase
DBK Public Experience Flow UI

## Current Objective
Build the safe presentation layer for the visible DBK organization journey while unresolved Engine contracts remain authoritative and deferred.

## Completed
- Added a dedicated DBK public organization journey covering Landing -> Intent -> Solutions -> Industry -> Capability presentation -> Registration entry.
- Kept intent, solution, industry and capability examples explicitly presentation-only; they do not become Engine taxonomy, entitlement or capability authority.
- Preserved the existing Engine-backed authentication, provisioning, capability enablement and workspace entry boundaries.
- Preserved owner/operator multi-organization support and stopped filtering the Engine DBK list down to ACTIVE records at the top-level application boundary.
- Added organization selection presentation that shows Active, Setting up, Needs attention, Inactive and unknown/unavailable lifecycle states without inventing local lifecycle authority.
- Added public-flow progress, loading, disabled, error and retry/return states.
- Kept recommendation, Business DNA persistence, authoritative capability discovery, public publication and Sokoni integration deferred where no verified DBK-facing Engine contract exists.

## In Progress
- None for this task. This task is complete and intentionally stopped here.

## Verified
- `src/public/DbkExperienceFlow.tsx` is presentation-only and contains no backend calls or persistence.
- Public intent/solution/industry content is explicitly labelled as presentation context rather than authoritative Engine taxonomy.
- Capability cards explicitly state that they do not grant access or create entitlement.
- Registration hands the user to the existing authentication/onboarding boundary rather than creating local identity or organization state.
- `src/App.tsx` continues to consume `/api/platform/dbks` for Engine-owned organization listing.
- Top-level DBK lifecycle states are no longer filtered to `ACTIVE`; non-active Engine states remain visible to the owner/operator.
- Active organization entry continues to resolve through the existing `DbkApp` / Engine-backed experience boundary.
- Existing `BusinessDiscovery` remains the Engine-backed provisioning path; no new provisioning implementation was introduced.

## Engine Contracts Consumed
- Existing `AuthContext` authentication boundary.
- Existing `/api/platform/dbks` Engine-owned DBK listing.
- Existing `BusinessDiscovery` Engine contracts for owner initialization, blueprint retrieval, provisioning and capability enablement remain unchanged.
- Existing `DbkApp` / Experience Resolver workspace boundary remains unchanged.
- Existing Engine capability authority remains the source of truth; the new public capability cards are only explanatory UI.

## Engine Contracts Intentionally Deferred
- Business Context -> authoritative Business DNA persistence.
- DBK-facing Engine Recommendation contract.
- Authoritative capability-discovery contract for onboarding recommendation/selection.
- Public organization publication/read authorization.
- Any new payment, connector, notification or document contracts not already exposed through the existing DBK workspace.

## New Engine Dependencies
- None introduced.

## Sokoni Dependencies
- None introduced.
- No Sokoni backend logic, datastore, discovery authority or integration contract was created.
- Public organization exposure remains deferred until Engine publication authority is resolved.

## Blocking Issues
- Engine Recommendation contract remains unresolved.
- Business Context is still presentation state in `BusinessDiscovery`; no DBK-owned Business DNA persistence was introduced.
- Authoritative onboarding capability discovery remains Engine/Master work.
- Public publication authority and anonymous public-read authorization remain unresolved.

## MASTER REVIEW REQUIRED
- Define/approve the DBK-facing Engine Recommendation contract.
- Define/approve how onboarding context enters the existing Business DNA authority.
- Confirm the DBK-facing authoritative capability-discovery contract.
- Resolve Engine public publication authority and anonymous public-read authorization before public organization profiles are exposed.
- Do not create DBK substitutes for any of these contracts.

## UX Decisions
- The public journey can safely explain TDBK through presentation-only intent, solution, industry and capability examples before authentication.
- Capability presentation must explicitly distinguish informational examples from authoritative capability activation.
- Registration is an entry into Engine-backed identity/onboarding, not a DBK-owned account creation system.
- Owner/operator organization selection displays Engine lifecycle states rather than hiding them for simplicity.
- Non-active organizations are visible but are not opened as active workspaces.
- The DBK public journey does not claim to provide recommendations until the Engine recommendation contract exists.

## Architecture Concerns
- `BusinessDiscovery` still generates the `dbkId` passed into the existing Engine provisioning contract. This remains an unresolved Engine contract concern from the previous audit; this task did not create another identifier authority.
- `BusinessDiscovery` still captures `narrative` locally without sending it to an authoritative Business DNA contract. This task deliberately did not invent one.
- The new public journey intentionally does not persist intent, industry or capability presentation choices.
- The legacy `PublicGateway.tsx` remains in the repository as an existing presentation surface; this task introduced the new flow at the application entry boundary rather than modifying its static showcase authority.

## Files / Areas Changed
- `src/public/DbkExperienceFlow.tsx` — new DBK public organization experience flow UI.
- `src/App.tsx` — routes the public entry through the new presentation flow and preserves all Engine-owned organization lifecycle states.
- `docs/master/DBK-STATUS.md` — durable milestone record.
- No Engine files changed.
- No Sokoni files changed.
- No DBK datastore/backend authority added.

## Next Recommended DBK Task
**SINGLE TASK:** Verify this public experience flow in the real application preview and run the repository's typecheck/lint/build/test suite against the resulting commit. Do not add Engine contracts or Sokoni integration as part of that verification task.

## Evidence
- Public flow implementation commit: `fd1dd1c2c6513a62f7f3807f2afc05770953bde2`.
- Application integration commit: `6063cfbeeb893bb67efb08fdafb0811c38016865`.
- This status update commit: to be confirmed by repository head after write.
- Repository inspection confirmed the existing Engine-backed DBK listing/provisioning/workspace boundaries before implementation.
- No local test/typecheck/lint/build execution was available through the connected repository tooling; therefore no passing build/test claim is made.
