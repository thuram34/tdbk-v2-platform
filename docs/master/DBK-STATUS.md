# DBK STATUS

## Last Updated
2026-09-22

## Current Phase
DBK-01 — Experience Shell / DBK Experience Foundation

## Current Objective
Convert the existing Engine-backed DBK experience foundation into the organization-facing DBK website experience without creating duplicate authority.

## Completed
- Established the DBK Website Experience Contract in `docs/DBK_WEBSITE_EXPERIENCE_CONTRACT.md`.
- Inspected the existing Engine capability-discovery implementation before defining DBK capability UX.
- Inspected the existing Engine Experience Resolver and confirmed it already composes workspace, branch, navigation, dashboard, capability discovery, principal context, and Engine-backed commands.
- Inspected the existing Experience type contract.
- Inspected the existing dynamic navigation engine.
- Inspected the existing `DbkShell` and confirmed an Engine-backed authenticated DBK shell already exists.
- Inspected the existing `OwnerPortfolioView` and confirmed a multi-DBK owner portfolio and registration surface already exists.
- Confirmed no concrete `Sokoni` implementation or clearly named public-organization projection contract was found in repository search.

## In Progress
- DBK-01: determine which existing DBK shell/UI surfaces can be retained, refined, or replaced within the DBK website domain.
- DBK-02 preparation: public landing/intent/solution/industry/capability experience has not yet been verified as an existing implementation.
- Replace developer-facing terminology in organization-facing DBK UX where appropriate, without changing Engine authority.

## Verified
- `src/experience/experienceResolver.ts` is the existing authenticated DBK experience resolver.
- `src/experience/types.ts` defines the existing DBK experience vocabulary and resolved payload.
- `src/experience/navigation/navigationEngine.ts` derives navigation from Engine workspace state, enabled capabilities, roles, and permissions.
- `src/capability/discovery.ts` is the authoritative capability discovery surface and evaluates Business DNA, blueprint compatibility, DBK capability records, entitlement, and dependencies.
- `src/components/experience/DbkShell.tsx` already consumes `/api/experience/resolve/:dbkId` and `/api/experience/command` rather than creating local operational truth.
- `src/components/experience/OwnerPortfolioView.tsx` already presents multiple DBKs and calls Engine provisioning through `/api/platform/provision`.
- `Business DNA`, capability registry, capability entitlement, DBK capability lifecycle, workspace compilation, branch context, transactions, and audit are existing Engine dependencies and must be reused.

## Engine Contracts Consumed
- Identity/authentication through existing AuthContext and Engine-authorized API requests.
- DBK registry / DBK identity.
- Business DNA.
- Capability registry.
- Capability discovery.
- Capability entitlement and dependency evaluation.
- DBK capability lifecycle/provisioning.
- Workspace compilation.
- Experience resolution.
- Dynamic navigation.
- Branch context.
- Experience commands.
- Transaction execution through Engine services.
- Engine audit.

## New Engine Dependencies
- None introduced by this DBK task.
- Public organization projection remains undefined/unverified.

## Sokoni Dependencies
- No Sokoni implementation was found in the current repository search.
- DBK must not invent a Sokoni API, datastore, discovery authority, or public organization projection.
- Sokoni handoff remains blocked pending an authoritative contract.

## Blocking Issues
- Public DBK/public organization projection contract is not verified in the repository.
- Sokoni integration contract is not verified in the repository.
- The existing `OwnerPortfolioView` contains developer/platform terminology and a direct DBK provisioning form; DBK UX refinement is needed before treating it as the final public organization onboarding experience.
- The existing authenticated shell contains developer/test-suite controls; these require DBK-domain UX cleanup before production organization presentation.

## MASTER REVIEW REQUIRED
- Define/verify authoritative public organization projection and publication contract.
- Define/verify Engine-to-Sokoni discovery/handoff contract.
- Verify production-facing payment and external connector contracts before exposing corresponding customer actions.
- Verify authoritative notification/document/growth contracts where the Experience Layer does not already expose the required surface.
- Resolve production security/readiness concerns before broadening sensitive organization operations.

## UX Decisions
- DBK presents Engine-authorized state; it does not infer authoritative eligibility or entitlement locally.
- `DISCOVERABLE != ENABLED` remains mandatory in capability UX.
- One owner/operator may manage multiple DBKs.
- Organization switching changes Engine context; DBK does not create a second tenancy model.
- Public DBK pages must be projections of authoritative Engine-approved data.
- Customer-facing UX should use organization/business language rather than Engine implementation terminology.
- Technical failures must be translated into loading, success, empty, error, unauthorized, provisioning, disabled, or action-required states.

## Architecture Concerns
- Existing DBK UI is materially ahead of the public website experience, but some surfaces are explicitly platform/test oriented rather than polished organization-facing UX.
- Existing registration UI exposes implementation concepts such as canonical DBK IDs, tenant slugs, subscription tiers, and provisioning terminology; these should not become the default public onboarding language.
- Existing role selector/test controls in the shell must not be treated as authoritative role assignment; Engine roles and permissions remain authoritative.
- No local DBK datastore or alternate authority may be introduced to make missing Engine contracts appear complete.

## Files / Areas Changed
- `docs/DBK_WEBSITE_EXPERIENCE_CONTRACT.md` — durable DBK architectural/experience contract.
- `docs/master/DBK-STATUS.md` — shared DBK continuation/status record.
- No Engine source files changed by this task.
- No Sokoni source files changed by this task.

## Next Recommended DBK Task
DBK-01A — Refine the existing `DbkShell` and `OwnerPortfolioView` as organization-facing experience surfaces while preserving their existing Engine API dependencies. Remove or isolate developer/test controls from the normal DBK journey, replace implementation-heavy copy with business language, and retain Engine-backed portfolio/workspace switching. Then verify the public landing/intent experience before implementing DBK-02.

## Evidence
- DBK contract commit: `303c00e4e13740a048cc929628e48acee96a2574`.
- Current repository inspection performed 2026-09-22 against `thuram34/tdbk-v2-platform`.
- Verified source files include `src/experience/experienceResolver.ts`, `src/experience/types.ts`, `src/experience/navigation/navigationEngine.ts`, `src/capability/discovery.ts`, `src/components/experience/DbkShell.tsx`, and `src/components/experience/OwnerPortfolioView.tsx`.
- No public-organization/Sokoni implementation was located by repository search during this task.
