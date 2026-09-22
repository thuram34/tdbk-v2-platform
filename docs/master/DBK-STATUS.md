# DBK STATUS

## Last Updated
2026-09-22

## Current Phase
DBK Experience Contract Binding

## Current Objective
Bind the next incomplete organization onboarding experience surface to existing Engine-owned blueprint and capability contracts without creating replacement authority.

## Completed
- Completed the Experience Contract Binding task.
- Selected the Business Context / Engine-resolved capability setup surface as the next incomplete experience slice.
- Refined the existing BusinessDiscovery UX to distinguish Engine-resolved blueprint state from local setup requests.
- Default capabilities returned by the Engine blueprint are now presented as fixed Engine-included capabilities and cannot be locally toggled off.
- Non-default capability selections remain local setup intent until the existing Engine capability activation contract is invoked during provisioning.
- Existing identity initialization, DBK provisioning and capability enablement calls were preserved unchanged.

## In Progress
- None. This task is complete and intentionally stopped.

## Verified
- Current implementation commit: `b135ea384887f681d24a4c1833f5fd6f585ab598`.
- Only `src/components/onboarding/BusinessDiscovery.tsx` was changed for the implementation.
- Existing `/api/blueprints` data remains the source of blueprint and supported-capability presentation.
- Existing `/api/platform/dbks` remains the source of existing owner DBKs.
- Existing `/api/kernel/identity/initialize-owner` remains the identity initialization boundary.
- Existing `/api/platform/provision` remains the provisioning authority.
- Existing `/api/capability/enable` remains the capability activation authority.
- No DBK datastore, tenant store, Business DNA store, entitlement logic, payment logic, workflow state, publication authority or Sokoni logic was introduced.
- Default capability behavior now matches the existing provisioning implementation: defaults are not sent through `/api/capability/enable` because the provisioning engine initializes them.
- Responsive behavior remains based on the existing Tailwind `sm` / `md` / `lg` layout classes.

## Engine Contracts Consumed
- AuthContext / authenticated identity boundary.
- `/api/blueprints` — existing Engine-backed blueprint and supported-capability contract.
- `/api/platform/dbks` — existing Engine-backed owner DBK listing.
- `/api/kernel/identity/initialize-owner` — existing identity initialization contract.
- `/api/platform/provision` — existing DBK provisioning contract.
- `/api/capability/enable` — existing Engine capability activation contract.

## Engine Contracts Intentionally Deferred
- Authoritative Business Context -> persistent Business DNA onboarding contract.
- DBK-facing recommendation contract.
- Authoritative onboarding capability discovery beyond the existing blueprint response.
- Any new payment, connector, notification or document contract.
- Public organization publication/read authorization.

## New Engine Dependencies
- None.

## Sokoni Dependencies
- None introduced.
- No Sokoni backend, discovery datastore, publication authority or integration logic was changed.

## Blocking Issues
- Local Node/npm verification is unavailable in the connected repository environment; `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` were not executed.
- GitHub Actions reports no workflow run associated with implementation commit `b135ea384887f681d24a4c1833f5fd6f585ab598`, so CI cannot be claimed as passing evidence.
- Business DNA persistence, recommendation and public publication contracts remain Engine/Master dependencies.

## MASTER REVIEW REQUIRED
- Business Context -> authoritative Business DNA onboarding contract.
- DBK-facing Engine Recommendation contract.
- Authoritative onboarding capability-discovery contract.
- Engine public publication authority and anonymous public-read authorization.
- Existing client-generated `dbkId` input to `/api/platform/provision` remains an Engine contract concern; no DBK replacement was created.

## UX Decisions
- Blueprint and capability data returned by the Engine are visually distinguished from local user setup choices.
- Engine-included/default capabilities cannot be deselected locally because the existing provisioning contract treats them as blueprint defaults.
- Optional capabilities are described as setup requests, not granted entitlements.
- Capability activation still occurs only through the existing Engine endpoint after provisioning.
- Loading, error and provisioning states remain explicit.
- No recommendation is fabricated where the Engine recommendation contract is unresolved.

## Architecture Concerns
- `BusinessDiscovery` still generates the `dbkId` supplied to the existing provisioning contract; this pre-existing boundary was intentionally not redesigned.
- The onboarding narrative remains local UI state because no verified Business DNA persistence contract was introduced.
- The selected blueprint is presentation/selection state until passed to the existing Engine provisioning contract.
- Public experience remains separate from public organization publication and Sokoni.

## Files / Areas Changed
- `src/components/onboarding/BusinessDiscovery.tsx` — refined Engine-bound blueprint/capability setup UX.
- `docs/master/DBK-STATUS.md` — updated continuity record.
- No TDBK Engine source changed.
- No Sokoni source changed.

## Next Recommended DBK Task
**SINGLE TASK:** Await Master direction after review. No further DBK task is started by this task.

## Evidence
- Implementation commit: `b135ea384887f681d24a4c1833f5fd6f585ab598`.
- Status update commit follows this implementation commit.
- Repository inspection confirmed the implementation uses existing Engine endpoints only.
- `npm run typecheck`: NOT EXECUTED — no runnable Node workspace available.
- `npm run lint`: NOT EXECUTED — no runnable Node workspace available.
- `npm test`: NOT EXECUTED — no runnable Node workspace available.
- `npm run build`: NOT EXECUTED — no runnable Node workspace available.
- GitHub Actions workflow runs for `b135ea384887f681d24a4c1833f5fd6f585ab598`: none returned.
- Engine/Sokoni file modification check: only DBK UI and DBK status files changed in this task.
