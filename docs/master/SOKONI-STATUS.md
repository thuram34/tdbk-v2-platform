# SOKONI STATUS

## Last Updated
2026-09-22

## Current Phase
Phase 1 — Discovery Experience Shell

## Current Objective
Build the Sokoni public discovery experience upward at the UI/presentation layer while unresolved Engine public-discovery contracts remain pending. No Sokoni backend authority is created.

## Completed
- Completed the Sokoni Discovery Experience Shell.
- Refined the mobile-first Sokoni Home around the primary question: `What do you need?`
- Added natural-language discovery entry and example phrases.
- Added user-controlled discovery-location presentation.
- Added category discovery for Services, Products, Businesses, Jobs, Opportunities and Offers.
- Added Search experience with intent entry, suggestions, refinement/location controls, loading, empty-by-state presentation, and error handling.
- Added reusable presentation components for Product, Service, Provider, Business, Job, Opportunity and Offer cards.
- Added mobile-first Home/Search/Activity/Account navigation.
- Refined the technician reference journey using `My printer isn't working.` → understood need → discovery presentation → provider profile → Request Service.
- Kept Request Service as an explicit Engine handoff placeholder; no request record is created.
- Kept demo/reference data explicitly separated from authoritative Engine state.
- Added an Activity placeholder that refuses to imply authoritative requests, purchases, applications or service status.

## In Progress
- No backend implementation is in progress.
- Public discovery, provider, product, service, publication, location-matching and request contracts remain outside the Sokoni shell.

## Verified
- Sokoni UI imports the existing UX-only `SokoniDiscoveryAdapter` rather than introducing a backend/search authority.
- Reusable cards carry explicit DEMO/PENDING state markers and do not claim live provider/product/service truth.
- Location is represented as user-selected UX state and is explicitly not provider coverage or matching truth.
- Request CTA opens an Engine handoff boundary message only; no request/workflow/payment operation is executed.
- Existing App integration remains the entry point for the Sokoni experience.
- No marketplace master records or duplicate Engine records were added.

## Engine Contracts Consumed
- Existing `SokoniPublicDiscoveryAdapter` UX boundary only, with its existing demo implementation.
- Existing `SokoniDiscoveryResult`, `SokoniDiscoveryIntent`, `SokoniLocationContext` and provider-preview types.
- No new public Engine contract was assumed or invented.

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
- Sokoni continues to treat DBK as the organization-facing operating surface.
- No DBK internals were modified.
- No DBK master records were created or duplicated.

## Blocking Issues
- Live discovery remains blocked on the approved Engine public-discovery/public-read contracts.
- Demo/reference presentation cannot be promoted to authoritative state until those contracts are approved and bound.

## MASTER REVIEW REQUIRED
- Public publication/read authority and lifecycle.
- Public search/discovery/relevance contract.
- Public capability/service projection.
- Provider projection, trust, availability and coverage.
- Product projection.
- Location-aware discovery/privacy semantics.
- Discovery → request and request → quote/approval contracts.

## Discovery Journeys Verified
- `My printer isn't working.` now has a complete visible UX path through provider presentation and request handoff placeholder.
- The existing computer-support reference journey remains structurally supported by the same presentation shell.
- Product, service, business, job, opportunity and offer presentation cards are available as UX-only surfaces.
- No journey claims a live Engine transaction state.

## UX Decisions
- Sokoni remains intent-first rather than directory-first.
- The primary action is discovery from natural language.
- Location is visible but user-controlled.
- Demo content is visually labelled so it cannot be mistaken for production truth.
- Presentation components are intentionally contract-shaped and replaceable at the adapter boundary.
- Mobile navigation prioritizes Home, Search, Activity and Account.
- Request is an explicit Engine handoff rather than a Sokoni workflow.

## Architecture Concerns
- The presentation shell must not be wired directly to internal Engine records.
- Existing demo adapter remains temporary and must not evolve into a marketplace backend.
- Future authoritative bindings must enter through an approved Engine public-discovery contract.
- No local publication flag, search index, provider master, product master, service master, request database, transaction authority or payment authority may be added to bridge current gaps.

## Files / Areas Changed
- `src/sokoni/SokoniExperience.tsx` — rebuilt the Sokoni discovery experience shell and technician vertical-slice presentation.
- `src/sokoni/SokoniPresentationCards.tsx` — added reusable ProductCard, ServiceCard, ProviderCard, BusinessCard, JobCard, OpportunityCard and OfferCard presentation components.
- `docs/master/SOKONI-STATUS.md` — updated with this task's completion and evidence.
- No Engine source files changed.
- No DBK source files changed.
- No backend/search/database/marketplace authority added.

## Next Recommended Single Sokoni Task
Visual/runtime verification of the Discovery Experience Shell against the synchronized repository state, including responsive UX and adapter-boundary checks. Do not begin Engine or marketplace implementation from this status.

## Evidence
- Existing Sokoni UX adapter: `src/sokoni/SokoniDiscoveryAdapter.ts`.
- Shell commit: `a3f76c61e6e39684fb00213008509c46804fadee`.
- Reusable card component commit: `c0f30bc557f351b1a8aef403be04aa1b1c8ee6ed`.
- GitHub combined status queried for shell commit; no status entries were returned at verification time.
- Repository scripts available for verification are `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` from `package.json`. Remote repository tooling in this session did not provide a local execution environment, so no test/typecheck/lint/build pass is claimed.
