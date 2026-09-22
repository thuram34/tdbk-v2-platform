# DBK STATUS

## Last Updated
2026-09-22

## Current Phase
DBK-01A — Organization-facing Experience Shell

## Current Objective
Refine the existing Engine-backed DBK portfolio and workspace shell into a clean organization-facing experience without creating duplicate authority or changing Engine contracts.

## Completed
- Established the DBK Website Experience Contract in `docs/DBK_WEBSITE_EXPERIENCE_CONTRACT.md`.
- Inspected the existing Engine capability-discovery implementation before defining DBK capability UX.
- Inspected the existing Engine Experience Resolver and confirmed it already composes workspace, branch, navigation, dashboard, capability discovery, principal context, and Engine-backed commands.
- Inspected the existing Experience type contract.
- Inspected the existing dynamic navigation engine.
- Inspected the existing `DbkShell` and confirmed an Engine-backed authenticated DBK shell already exists.
- Inspected the existing `OwnerPortfolioView` and confirmed a multi-DBK owner portfolio and Engine-backed registration surface already exists.
- Refined `OwnerPortfolioView` into organization-facing language and removed visible canonical DBK ID, tenant-slug, subscription-tier, provisioning-service, SHA UI, and internal isolation terminology from the normal owner journey.
- Refined `DbkShell` while preserving `/api/platform/dbks`, `/api/experience/resolve/:dbkId`, and `/api/experience/command` as the existing Engine-backed boundaries.
- Removed developer/test controls from the normal DBK workspace header: role simulation, Phase 5/6 test launchers, multi-business test suite, coherence-engine test surface, and Master Console shortcut are no longer presented as organization navigation.
- Preserved the useful organization-facing AI & documents entry point.
- Added explicit organization-facing loading, unauthorized, error, empty, provisioning/setup, inactive/disabled, and retry states.
- Preserved owner/operator multi-DBK switching and Engine-backed branch switching.
- Kept developer/test components in the repository rather than deleting them; they remain outside the normal DBK organization journey.

## In Progress
- DBK-01A verification: typecheck, lint, test, and build evidence is pending local/CI execution.
- Visual/browser inspection of the refined shell remains to be performed in the actual application preview.
- DBK-02 preparation: public landing/intent/solution/industry/capability experience has not yet been implemented or fully verified.

## Verified
- `src/experience/experienceResolver.ts` remains the existing authenticated DBK experience resolver.
- `src/experience/types.ts` defines the existing DBK experience vocabulary and resolved payload.
- `src/experience/navigation/navigationEngine.ts` derives navigation from Engine workspace state, enabled capabilities, roles, and permissions.
- `src/capability/discovery.ts` is the authoritative capability discovery surface and evaluates Business DNA, blueprint compatibility, DBK capability records, entitlement, and dependencies.
- `src/components/experience/DbkShell.tsx` consumes `/api/experience/resolve/:dbkId` and `/api/experience/command` rather than creating local operational truth.
- `src/components/experience/OwnerPortfolioView.tsx` consumes the existing Engine provisioning endpoint `/api/platform/provision`; its UI now hides internal provisioning identifiers from normal users.
- `Business DNA`, capability registry, capability entitlement, DBK capability lifecycle, workspace compilation, branch context, transactions, and audit remain existing Engine dependencies and were not duplicated.
- `package.json` confirms the repository scripts are `test`, `typecheck`, `lint`, and `build`.
- Commit `4994aaca7e7f225e9e53cac5772fe1bab650d544` currently has GitHub commit status `pending` with no reported status checks yet.

## Engine Contracts Consumed
- Identity/authentication through existing AuthContext and Engine-authorized API requests.
- DBK registry / DBK identity through `/api/platform/dbks`.
- DBK provisioning through the existing `/api/platform/provision` endpoint.
- Business DNA through the existing Engine experience/capability layer; DBK does not persist DNA.
- Capability registry.
- Capability discovery.
- Capability entitlement and dependency evaluation.
- DBK capability lifecycle/provisioning.
- Workspace compilation.
- Experience resolution through `/api/experience/resolve/:dbkId`.
- Dynamic navigation from the resolved Engine experience.
- Branch context and Engine-backed `SWITCH_BRANCH` command.
- Existing Engine experience commands.
- Transaction execution through existing Engine services.
- Engine audit.

## New Engine Dependencies
- None introduced by DBK-01A.
- No new API, datastore, authority, or Engine contract was created.

## Sokoni Dependencies
- No Sokoni integration was implemented.
- `docs/master/SOKONI-STATUS.md` was requested for continuity but is not present in the repository as of this task; no Sokoni assumptions were made because of that absence.
- DBK must not invent a Sokoni API, datastore, discovery authority, or public organization projection.
- Public organization/Sokoni handoff remains blocked pending an authoritative contract.

## Blocking Issues
- Public DBK/public organization projection contract is not verified in the repository.
- Sokoni integration contract is not verified in the repository.
- The refined owner registration UI still calls the existing Engine provisioning endpoint because that contract already exists; no replacement onboarding backend was created.
- Automated verification has not yet been executed in this environment; GitHub reports the latest shell commit as pending with zero status checks currently returned.

## MASTER REVIEW REQUIRED
- Define/verify authoritative public organization projection and publication contract.
- Define/verify Engine-to-Sokoni discovery/handoff contract.
- Verify production-facing payment and external connector contracts before exposing corresponding customer actions.
- Verify authoritative notification/document/growth contracts where the Experience Layer does not already expose the required surface.
- Resolve production security/readiness concerns before broadening sensitive organization operations.

## UX Decisions
- Owner landing language is now `My Organizations` / `Manage your organizations` rather than platform/runtime terminology.
- Organization cards expose name, industry, state, location count, and an organization action; internal identifiers are hidden from the normal journey.
- Organization switching remains Engine-backed through the existing DBK list and experience resolver.
- Branch/location switching remains an Engine command and is not implemented as local state authority.
- Developer/test tools are isolated by removal from the normal DBK navigation rather than deletion from the repository.
- Subscription tier is not presented as a registration input in the normal owner experience; the existing provisioning contract receives its existing default without exposing that implementation detail to the user.
- Registration now asks for organization name, organization type, and optional primary location rather than canonical identifiers or provisioning terminology.
- Technical failures are translated into loading, success/setup, empty, unauthorized, error, disabled/inactive, and retry states.
- The DBK workspace continues to render navigation supplied by the Engine rather than rebuilding navigation locally.

## Architecture Concerns
- Existing registration requires an internal `dbkId` because the verified Engine provisioning endpoint currently requires it. DBK derives this identifier privately from the organization name and does not present it as a user-facing tenant identifier. This is an implementation dependency, not a new DBK authority.
- Existing role/test simulation has been removed from the normal shell. Engine roles and permissions remain authoritative; no replacement role-selection UI was introduced.
- Existing test/coherence panels remain in the repository for engineering use; they are no longer part of the normal organization workspace path.
- No local DBK datastore, public organization master, Sokoni authority, or alternate capability/permission system was introduced.

## Files / Areas Changed
- `src/components/experience/OwnerPortfolioView.tsx` — organization-facing owner portfolio, registration UX, status handling, and business language.
- `src/components/experience/DbkShell.tsx` — organization workspace shell, Engine-backed context handling, developer-control isolation, responsive navigation, and UI state handling.
- `docs/master/DBK-STATUS.md` — this milestone/continuity record.
- No Engine source files changed.
- No Sokoni source files changed.
- No DBK datastore or public-organization authority created.

## Next Recommended DBK Task
Complete DBK-01A verification in the application environment: run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; inspect the actual DBK shell/portfolio in preview; fix only DBK-domain issues found. After verification, begin **DBK-02 — Public Intent Experience** (`Landing -> Intent -> Solution -> Industry -> Capability`) using verified Engine metadata only. Do not begin public organization projection or Sokoni integration.

## Evidence
- DBK contract commit: `303c00e4e13740a048cc929628e48acee96a2574`.
- Owner portfolio refinement commit: `7ea4b11fc0be8a1b0e85764e4967bdd0823ebca4`.
- DBK shell refinement commit: `4994aaca7e7f225e9e53cac5772fe1bab650d544`.
- GitHub status for `4994aaca7e7f225e9e53cac5772fe1bab650d544`: `pending`, zero status checks returned at the time of this update.
- Repository scripts verified from `package.json`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Actual browser screenshot/preview verification and local command execution were not available through the connected repository tooling during this task; no passing test/build claim is made.
