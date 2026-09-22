# SOKONI STATUS

## Last Updated
2026-09-22

## Current Phase
Phase 1 — Sokoni Experience Contract

## Current Objective
Establish a durable, repository-backed Sokoni experience boundary against the actual TDBK Engine and DBK authorities, without creating duplicate marketplace truth or inventing unresolved Engine contracts.

## Completed
- Phase 0 Engine dependency audit recorded.
- Phase 1 Sokoni Experience Contract recorded in `docs/sokoni/PHASE1_EXPERIENCE_CONTRACT.md`.
- Audited existing DBK experience projection before defining Sokoni dependencies.
- Audited existing capability discovery and distinguished DBK capability discovery from public Sokoni discovery.
- Audited existing DBK experience resolver and existing sale transaction authority.
- Defined public, authenticated, and provider/seller Sokoni screen/action boundaries.
- Defined the technician reference journey: need → discovery → provider → request → quote/approval where supported → payment → receipt → completion.
- Recorded explicit non-duplication rules.
- Recorded Engine-owned dependencies as `MASTER REVIEW REQUIRED`.

## In Progress
- Awaiting Master TDBK Engine resolution of Sokoni-facing contracts GAP-01 through GAP-20.
- Preparing for implementation only after authoritative contracts are verified.

## Verified
- Repository baseline for the Phase 1 audit: `main` at commit `7e4f9d2863106851ca86a673b59831fbca7d7f8a`.
- `src/platform/projection/experienceProjection.ts` provides a tenant-aware DBK experience projection; it is not a verified public Sokoni marketplace projection.
- `src/capability/discovery.ts` provides DBK capability discovery/activation authority; it is not a public marketplace search engine.
- `src/experience/experienceResolver.ts` is existing DBK experience/command authority and routes `EXECUTE_SALE` through the existing sale transaction service.
- `src/business/sales/saleTransactionService.ts` exists and must remain authoritative for its supported transaction path.
- No Sokoni marketplace database, search index, provider master, product master, service master, independent request system, or independent payment authority was added by Phase 1.

## Engine Contracts Consumed
- Existing DBK identity/tenant context.
- Existing DBK experience projection.
- Existing capability discovery authority for DBK capability state.
- Existing DBK experience resolver/command routing.
- Existing sale transaction authority where its existing contract applies.
- Existing Engine financial/workflow/event/security foundations as dependencies, without duplication.

## Engine Contracts Required
- GAP-20 — Sokoni-facing L7 projection/API contract.
- GAP-05 — Public discovery contract.
- GAP-06 — Public search contract.
- GAP-01 — Public business projection.
- GAP-04 — Public provider projection.
- GAP-03 — Public service projection.
- GAP-02 — Public product projection.
- GAP-07 — Location-aware discovery contract.
- GAP-18 — Discovery relevance/matching contract.
- GAP-10 — Discovery → request contract.
- GAP-11 — Request → quote/approval contract.
- GAP-08 — Provider coverage model.
- GAP-09 — Provider availability model.
- GAP-12 — Public business publishing.
- GAP-13 — Provider/seller discovery onboarding.
- GAP-17 — Public trust projection.
- GAP-19 — Public location/privacy boundary.
- GAP-14 — Jobs domain.
- GAP-15 — Opportunities domain.
- GAP-16 — Public offers/promotions domain.

## DBK Dependencies
- DBK remains authoritative for organization-facing operation and organization data.
- DBK-published business/service/product/provider information must become Sokoni-discoverable through an Engine-authorized public projection/publication contract.
- Sokoni must route operational consequences back to Engine/DBK authority rather than maintaining a parallel operating state.

## Blocking Issues
- No verified public Sokoni discovery/search contract.
- No verified public projections for businesses, products, services, or providers.
- No verified generic provider coverage/availability contract.
- No verified Sokoni-facing request → quote/approval contract.
- Jobs, opportunities, and public offers/promotions contracts are not verified.
- Public trust and location/privacy boundaries are not verified.

## MASTER REVIEW REQUIRED
- All unresolved GAP-01 through GAP-20 items listed above are outside Sokoni authority and require Master TDBK Engine/Architecture review before dependent backend implementation.
- In particular, GAP-20, GAP-05, GAP-06, GAP-10, and GAP-11 form the primary dependency chain for the technician vertical slice.

## Discovery Journeys Verified
- Technician reference journey has been contractually mapped, but is **not yet end-to-end runtime verified** because required public discovery/request contracts remain unresolved.
- No claim is made that public search or marketplace matching is implemented.

## UX Decisions
- Primary Sokoni question: “What do you need?”
- Core experience: NEED → DISCOVER → UNDERSTAND → MATCH → SELECT → ACT → TRANSACT → COMPLETE.
- Mobile-first, local, action-oriented discovery experience.
- Sokoni presents authoritative state; it does not create operating truth.
- Saved discovery state may reference authoritative entities; it must not clone master records.
- Location UX must be consent-aware and user-controlled.

## Architecture Concerns
- Existing `DiscoveryEngineService` must not be repurposed as a public marketplace search engine.
- Existing DBK `DbkExperienceProjection` must not be treated as a public Sokoni projection without an explicit Engine contract.
- Existing sale/payment/financial authority must not be bypassed by Sokoni.
- A UI mock is not evidence of an Engine contract.
- No unresolved gap may be silently converted into a Sokoni-owned backend authority.

## Files / Areas Changed
- `docs/sokoni/PHASE1_EXPERIENCE_CONTRACT.md` — Phase 1 contract, on branch `sokoni/phase1-experience-contract`.
- `docs/master/SOKONI-STATUS.md` — durable Sokoni status/handoff record.
- No production Engine or marketplace code changed.

## Next Recommended Sokoni Task
Wait for Master TDBK Engine/Architecture to resolve the required public contracts. Once a contract is approved, audit the exact implementation surface again, then implement only the Sokoni Experience Layer binding to that authoritative contract. First implementation target should remain the technician discovery/request vertical slice.

## Evidence
- Phase 1 contract commit: `b720ef408bbed2e9aae4507ea07c116c79962bb4`.
- Phase 1 draft PR: #27 (`sokoni/phase1-experience-contract`).
- Repository audit evidence is captured in `docs/sokoni/PHASE1_EXPERIENCE_CONTRACT.md`.
- Status file commit is the commit created immediately after this update on the same Sokoni branch.
- No runtime tests were required for this documentation-only status update.
