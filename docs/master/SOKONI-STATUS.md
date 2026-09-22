# SOKONI STATUS

## Last Updated
2026-09-22

## Current Phase
Phase 1 — Sokoni UX Vertical Slice

## Current Objective
Build the first Sokoni discovery experience around the technician journey while keeping the UI explicitly separated from authoritative Engine state.

## Completed
- Phase 0 Engine dependency audit recorded.
- Phase 1 Sokoni Experience Contract recorded in `docs/sokoni/PHASE1_EXPERIENCE_CONTRACT.md`.
- Audited existing DBK experience projection, capability discovery, experience resolver, and transaction authority before implementation.
- Read the current Engine and DBK status/handoff records and the active Engine public-discovery boundary contract before implementation.
- Added the Sokoni discovery adapter boundary without creating a backend or marketplace authority.
- Added a mobile-first technician discovery UX prototype for `"My computer is slow."`.
- Added intent presentation, location selection UX, discovery results, provider detail, request CTA, and explicit Engine handoff placeholder.
- Added an explicit DEMO/UX boundary so prototype data cannot be mistaken for live Engine truth.
- Added a focused adapter-boundary test.
- Exposed the prototype from the existing public gateway without replacing the existing DBK public gateway.

## In Progress
- UX vertical slice is implemented as a prototype; authoritative public discovery/request contracts remain unresolved.
- Runtime verification is pending in an environment with repository dependencies available.

## Verified
- Existing DBK experience projection remains the DBK-facing authority and was not repurposed.
- Existing capability discovery remains DBK capability discovery/activation authority and was not repurposed as marketplace search.
- Existing DBK experience resolver and sale transaction authority were not modified.
- Existing Engine public-discovery contract confirms that generic public discovery, publication, provider, product/service, availability and request/quote contracts remain blocked pending Master review.
- Existing DBK status confirms DBK must consume Engine authority and must not invent a Sokoni API or public organization projection.
- No Sokoni marketplace master records were created.
- No Sokoni backend, search infrastructure, public discovery persistence, transaction logic, payment logic, or workflow logic was added.
- The technician provider shown by the prototype is explicitly labelled as a reference/demo preview, not a claimed live provider.
- Demo provider data contains no fabricated price, live availability, verification, payment, request status, or Engine transaction state.

## Engine Contracts Consumed
- Existing DBK/public entry surface only for navigation into the prototype.
- Existing Engine/DBK architecture as documented by `docs/master/ENGINE-STATUS.md` and `docs/ENGINE_PUBLIC_DISCOVERY_CONTRACT.md`.
- Future `SokoniPublicDiscoveryAdapter` is an experience boundary only and is not an Engine implementation.

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
- GAP-17 — Public trust projection.
- GAP-19 — Public location/privacy boundary.

## DBK Dependencies
- Existing public gateway remains intact.
- Future provider/business presentation must consume DBK/Engine-authoritative organization data through an approved public projection.
- Provider operational consequences must continue to return to DBK/Engine authority; Sokoni does not own provider operations.

## Blocking Issues
- The prototype cannot claim live public discovery because the Engine public-discovery contract explicitly says GAP-05/GAP-06/GAP-18 remain unresolved.
- Provider identity/coverage/availability/trust cannot be represented as authoritative until GAP-04/GAP-08/GAP-09/GAP-17 are resolved.
- Request creation is intentionally stopped at the handoff placeholder because GAP-10 is unresolved.
- Quote/approval remains blocked by GAP-11.
- Payment, receipt, and completion are not implemented in Sokoni and must remain Engine-owned.

## MASTER REVIEW REQUIRED
- GAP-20, GAP-05, GAP-06, GAP-18 for public discovery/search/matching.
- GAP-01/GAP-02/GAP-03/GAP-04 for public business/product/service/provider projections.
- GAP-07/GAP-08/GAP-09/GAP-17/GAP-19 for location, coverage, availability, trust and privacy boundaries.
- GAP-10/GAP-11 for request and quote/approval handoff.
- Do not promote the demo adapter into an Engine integration until the relevant Master contracts are approved.

## Discovery Journeys Verified
- UX walkthrough implemented: `My computer is slow.` → interpreted need → location → discovery presentation → provider card → provider detail → request CTA → Engine handoff placeholder.
- The journey is **UX/prototype verified only**, not live Engine/runtime verified.
- No claim is made that provider matching, availability, request creation, quote, payment, receipt, or completion is live.

## UX Decisions
- Primary entry: “What do you need?”
- Natural-language need is the first-class input.
- Location is user-selected and explicitly presented as discovery context.
- Results are framed as possibilities, not fabricated marketplace truth.
- Provider detail explains the prototype boundary instead of inventing commercial facts.
- Request CTA stops at a clearly labelled Engine handoff placeholder.
- The user sees the distinction between Sokoni presentation and Engine authority.
- Mobile-first layouts use large touch targets, progressive disclosure, compact cards, and bottom-friendly actions.

## Architecture Concerns
- `SokoniPublicDiscoveryAdapter` is deliberately an interface boundary, not a transport/API implementation.
- `demoSokoniDiscoveryAdapter` is demo-only and must not be treated as an authoritative provider source.
- Existing `DiscoveryEngineService` must not be repurposed as public marketplace search.
- Existing DBK `DbkExperienceProjection` must not be treated as a public Sokoni projection without an explicit Engine contract.
- Existing sale/payment/financial authority remains outside Sokoni.
- No unresolved gap may be converted into Sokoni-owned backend state.

## Files / Areas Changed
- `src/sokoni/SokoniDiscoveryAdapter.ts` — experience adapter contract and explicitly non-authoritative technician preview.
- `src/sokoni/SokoniExperience.tsx` — mobile-first Sokoni technician discovery UX.
- `src/sokoni/SokoniDiscoveryAdapter.test.ts` — focused prototype boundary tests.
- `src/App.tsx` — exposes Sokoni prototype from the existing public gateway via a UI entry point/query state; existing DBK flow remains intact.
- `docs/master/SOKONI-STATUS.md` — updated durable status/handoff record.
- No Engine or marketplace backend files changed.

## Next Recommended Sokoni Task
Keep the UX boundary stable and wait for Master TDBK Engine resolution of GAP-20/GAP-05/GAP-06/GAP-18 and the public entity projection contracts. Once an authoritative contract is approved, replace only the demo adapter implementation with the approved Engine integration while preserving the existing Sokoni screens and explicit state boundary. Then extend the same contract-first approach to provider request initiation (GAP-10).

## Evidence
- Phase 1 contract commit: `b720ef408bbed2e9aae4507ea07c116c79962bb4`.
- Adapter commit: `3f3ebc5d582426ca30d860a024b798df13d21289`.
- UX commit: `8db17eb8ba595518eb0b6587c958c335a0b6d547`.
- App integration commit: `84588d60d9ce2d2b7b451c64cbc0c114bf91c552`.
- Focused test commit: `edb995d23ffd862ce324d6cd7b52af5aeb846d84`.
- Latest status commit: `4c725d39af8f37ff0c9753fab99fc81c607ec750` before this correction.
- Automated test/typecheck/lint/build execution was attempted via the available runtime but could not be run because the environment could not clone/access the GitHub repository; therefore no passing runtime/build claim is made.
