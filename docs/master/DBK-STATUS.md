# DBK STATUS

## Last Updated
2026-09-22

## Current Phase
DBK Experience Contract Binding

## Current Objective
Bind the next incomplete organization onboarding experience surface to existing Engine-owned blueprint and capability contracts without creating replacement authority.

## Completed
- Bound the authenticated owner/organization experience to the existing Engine-owned organization list and Experience Resolver flow.
- `src/App.tsx` now consumes the Engine-provided `sector` field directly from `/api/platform/dbks` instead of deriving sector identity from `blueprintId`.
- Confirmed `src/components/experience/DbkShell.tsx` consumes `/api/platform/dbks`, `/api/experience/resolve/:dbkId`, and `/api/experience/command` for organization, workspace, branch, navigation and operational state.
- Kept the completed Public Experience Flow unchanged and closed.
- Marked the existing PublicGateway workspace showcase as explicitly illustrative/reference data; it is not live organization data.

## In Progress
- None. This task is complete and intentionally stopped.

## Verified
- Implementation commits: `87146f5d0c4ad2bb3b335f380540f39c26d6ef99`, `2ed4448b2f8016043f36b28b46b5599662e491eb`.
- No TDBK Engine source was changed.
- No Sokoni source was changed.
- No duplicate organization, tenant, Business DNA, capability, entitlement, transaction, payment, receipt, workflow, audit or publication store was introduced.
- Public showcase metrics remain static reference content and are explicitly labelled as such.
- Public organization projection remains Engine-owned and projection-only; DBK does not invent an anonymous public API because publication/read authorization is not established.

## Engine Contracts Consumed
- AuthContext / authenticated identity boundary.
- `/api/blueprints` — existing Engine-backed blueprint and supported-capability contract.
- `/api/platform/dbks` — existing Engine-backed owner DBK listing.
- `/api/kernel/identity/initialize-owner` — existing identity initialization contract.
- `/api/platform/provision` — existing DBK provisioning contract.
- `/api/capability/enable` — existing Engine capability activation contract.

## Engine Contracts Intentionally Deferred
- Anonymous public organization read/publication authorization.
- Public capability projection/publication claims.
- Any future Sokoni handoff contract.
- Business Context -> authoritative persistent Business DNA onboarding contract where not already exposed to DBK.

## New Engine Dependencies
- None.

## Sokoni Dependencies
- None introduced.
- No Sokoni backend, discovery datastore, publication authority or integration logic was changed.

## Blocking Issues
- Local Node/npm test, typecheck, lint and build execution is unavailable in the connected GitHub repository environment.
- GitHub Actions validation for the new commits must be checked before claiming the validation gate as passed.

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
- `src/App.tsx` — consume authoritative Engine sector field in owner portfolio.
- `src/public/PublicGateway.tsx` — distinguish illustrative showcase data from live organization truth.
- `docs/master/DBK-STATUS.md` — continuity record.

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
