# SOKONI STATUS

## Last Updated
2026-09-22

## Current Phase
Phase 1 — Entity Detail Experience Slice

## Current Objective
Extend Sokoni one level above the completed discovery shell by making non-provider discovery cards open a reusable entity-detail presentation surface. This remains UX-only and uses demo/reference data while public Engine contracts are unresolved.

## Completed
- Completed the previous Discovery Experience Shell; treated as closed.
- Added a reusable entity-detail presentation layer to Product, Service, Business, Job, Opportunity and Offer cards.
- Added mobile-friendly detail presentation with a dismissible modal/drawer treatment.
- Kept the ProviderCard flow unchanged so the technician journey continues into the existing provider profile and Engine handoff boundary.
- Added explicit DEMO / UX DETAIL labeling inside entity details.
- Added copy that explicitly prevents demo detail from implying price, stock, seller identity, availability, publication, coverage, trust, eligibility or application state.
- Reused the existing Sokoni card visual language and existing card data types.

## In Progress
- No backend implementation is in progress.
- No public discovery, publication, provider, product, service, search, location matching or request contract is being implemented here.

## Verified
- Entity details are presentation-only local UI state; opening a detail does not create or persist a record.
- Cards remain driven by existing Sokoni UX/reference data types.
- ProviderCard continues to use its existing `onSelect` navigation rather than the new generic demo detail treatment.
- No Engine or DBK source files were modified.
- No marketplace/search/database authority was added.

## Engine Contracts Consumed
- None beyond the existing Sokoni UX presentation types and demo adapter already present in the repository.
- No new public Engine contract was assumed.

## Engine Contracts Intentionally NOT Assumed
- Public publication authority.
- Anonymous public organization read API.
- Public business discovery/search.
- Public capability/service projection.
- Public provider projection.
- Public product projection.
- Public location matching/service-area semantics.
- Public relevance/matching.
- Provider availability/coverage.
- Public trust projection.
- Discovery → request.
- Request → quote/approval.

## DBK Dependencies
- None added.
- DBK remains the organization-facing operating surface.
- No DBK internals or master records were changed.

## Blocking Issues
- Authoritative entity detail cannot replace the demo detail until the corresponding Engine public projection/read contracts are approved.
- Public business/service/provider/product/opportunity/offer truth remains blocked on Engine contracts.

## MASTER REVIEW REQUIRED
- Public publication/read authority and lifecycle.
- Public search/discovery/relevance contract.
- Public capability/service projection.
- Provider projection, trust, availability and coverage.
- Product projection.
- Location-aware discovery/privacy semantics.
- Discovery → request and request → quote/approval contracts.
- Public jobs/opportunities/offers contracts where authoritative action or state is required.

## Discovery Journeys Verified
- Technician journey remains: `My printer isn't working.` → understood need → discovery presentation → provider profile → Request Service → Engine handoff placeholder.
- Non-provider discovery cards now support a clear next step: card → demo entity detail → return to discovery.
- No demo entity detail claims a live transaction, provider match, availability, pricing or publication state.

## UX Decisions
- Entity detail is intentionally a presentation layer, not a new entity authority.
- Details are opened locally and dismissed locally; no persistence is created.
- The detail surface uses a consistent Sokoni visual treatment across entity types.
- Provider detail remains a distinct experience because provider/request behavior is already represented by the technician vertical slice.
- Demo/reference content remains visibly separated from authoritative Engine state.

## Architecture Concerns
- The generic detail shell must not evolve into a local master-record or persistence layer.
- Future authoritative entity projections must plug into existing presentation boundaries rather than replace them with parallel Sokoni truth.
- No local publication flag, search index, provider master, product master, service master, request database, transaction authority or payment authority may be added to support this UI.

## Files / Areas Changed
- `src/sokoni/SokoniPresentationCards.tsx` — added reusable local entity-detail presentation behavior to Product, Service, Business, Job, Opportunity and Offer cards.
- `docs/master/SOKONI-STATUS.md` — updated with this slice, dependencies, blockers and evidence.
- No Engine source files changed.
- No DBK source files changed.
- No backend/search/database/marketplace authority added.

## Next Recommended Single Sokoni Task
Visual/runtime verification of the completed Sokoni Experience/UI slices against the synchronized repository state. Do not begin another feature or Engine integration until that verification is complete.

## Evidence
- Previous shell commit: `a3f76c61e6e39684fb00213008509c46804fadee`.
- Previous reusable card commit: `c0f30bc557f351b1a8aef403be04aa1b1c8ee6ed`.
- Entity detail slice commit: `e4ec61bc3a7bb8869d75f25d68b8352317944705`.
- Repository scripts available in `package.json`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Remote GitHub tooling in this session does not provide a local command execution environment; therefore no typecheck, lint, test or build pass is claimed.
- No Engine or DBK files were changed in this task.
