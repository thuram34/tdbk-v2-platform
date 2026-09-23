# SOKONI STATUS

## Last Updated
2026-09-23

## Current Phase
Authoritative Participant, Persistence & Location-Aware Discovery Foundation

## Current Objective
Turn Sokoni registration into a real Sokoni-owned participant/presence foundation while preserving public discovery independence from TDBK and keeping DBK/Engine authority outside Sokoni.

## Completed
- Discovery Experience Shell remains complete and closed.
- Entity Detail Experience remains complete and closed.
- Discovery Context Experience remains complete and closed.
- Visual/runtime verification remains recorded; completed UX slices were not reopened as redesign work.
- Sokoni participant registration now supports businesses, individuals, service providers, sellers, transport providers, boda operators, tuk-tuk operators, technicians, organizations and other local participants.
- Participant persistence is now explicitly Sokoni-owned through the `sokoniParticipants` Firestore collection.
- Participant public projection includes identity, category, description, area-level location, public contacts, reusable media references, product/service listings, publication state, Sokoni commercial state and a non-authoritative TDBK relationship boundary.
- Public discovery now reads persisted ACTIVE Sokoni participants and filters them by the selected discovery area.
- Participant detail presentation now distinguishes authoritative Sokoni state from demo/reference Engine state.
- Participant media is persisted in Firebase Storage under the Sokoni namespace and referenced from participant/listing records so the same uploaded asset can be reused without duplicate uploads.
- Product/service catalogue entries persist with reusable participant media references.
- Publication state is independent from commercial payment state: a participant can be publicly ACTIVE while a selected paid Sokoni offering remains PAYMENT_REQUIRED.
- Sokoni commercial options are configuration data, not permanent subscription/domain logic.
- Initial configured commercial offerings remain KSh 100 and KSh 500 only; no additional pricing tiers were invented.
- Firestore and Storage security boundaries were explicitly added for Sokoni participant/public media access.
- TDBK relationship is persisted as `NOT_ENROLLED`; Sokoni does not fabricate TDBK enrollment or DBK state.

## In Progress
- Authenticated owner management/editing of an existing participant is not implemented in this task.
- Real Sokoni payment initiation/confirmation remains unimplemented.
- Paid offering activation remains separate from participant publication until a Sokoni payment authority exists.
- Natural-language relevance/matching remains on the existing demo/Engine boundary; persisted discovery currently uses the selected area as its authoritative Sokoni filter.

## Verified
- Sokoni registration writes a persistent participant record instead of a UI-only draft when Firebase is configured and the configured security rules are deployed.
- Public discovery reads only records with `publicationStatus: ACTIVE`.
- Discovery can filter persisted participants by exact selected area without claiming proximity, routing, coverage or availability.
- Participant media is stored once and reused through media IDs in catalogue entries.
- Product/service listings contain only name, description and media references; no stock, price, delivery or transaction truth is created.
- Commercial payment state is separate from participant publication state.
- TDBK relationship remains `NOT_ENROLLED` and no DBK, Business DNA, entitlement or Engine workflow is created.
- Existing TDBK subscription/payment authority was not reused.
- Existing Sokoni presentation shell remains the experience boundary; persisted participants are presented separately from demo technician/reference content.
- Firestore rules retain the existing tenant rules and add an explicit Sokoni public participant boundary before the deny-all catch-all.
- Storage rules restrict writes to authenticated image uploads under the Sokoni participant media namespace and allow public reads for public presentation media.

## Engine Contracts Consumed
- None new.
- Existing Sokoni presentation adapter remains a demo/future Engine boundary.
- No TDBK public business, provider, product, service, payment, publication, matching or enrollment contract was assumed.

## Engine Contracts Intentionally NOT Assumed
- TDBK Business/DBK creation.
- Business DNA creation.
- Engine identity/tenant authority for Sokoni participants.
- Public Engine search/relevance/matching.
- Engine availability/coverage.
- Discovery → request.
- Request → quote/approval.
- TDBK payment/subscription authority for Sokoni commercial offerings.
- TDBK entitlement activation.

## Sokoni Authority
The authoritative Sokoni participant boundary is:

`/sokoniParticipants/{participantId}`

It is owned by Sokoni and is not a DBK or Engine business master. Its public lifecycle currently supports `DRAFT | READY | ACTIVE`, with registration creating an `ACTIVE` public participant only after required public fields have been supplied and the persistence operation succeeds.

The public participant projection contains:
- participant kind
- public name
- category
- description
- Kenya/county/area location
- public contacts
- reusable media references
- product/service listings
- publication status
- Sokoni commercial offering/state
- TDBK relationship boundary
- timestamps

No private owner identity is exposed in the public participant document.

## Location / Discovery Model
- Location is first-class Sokoni participant data at AREA precision.
- Current registration areas remain Mombasa, Nyali, Bamburi and Likoni.
- Public discovery queries ACTIVE participants and applies the selected area filter client-side after a bounded public read.
- The current foundation intentionally does not implement geospatial proximity, routing, coverage, real-time availability or provider matching.
- Changing the discovery area does not require TDBK enrollment.
- No search index has been created.

## Media Persistence
- Firebase Storage is now exposed through the existing client Firebase initialization boundary.
- Sokoni media path: `sokoni/participants/{participantId}/{mediaId}.{extension}`.
- A participant photo is uploaded once and stored as a reusable `SokoniMediaRef`.
- Catalogue entries reference existing media IDs rather than creating duplicate files.
- Upload failure is surfaced to the registration UI; the UI does not claim success before the Storage and Firestore operations complete.
- Media deletion/owner-management is intentionally not invented in this task.

## Catalogue / Listings
- Sokoni persists `PRODUCT` and `SERVICE` listings.
- Listing fields are name, description and reusable media IDs.
- No stock, price, delivery, payment, availability, order, transaction or workflow state is stored.
- Listings are part of the Sokoni participant public projection and remain independent from TDBK capability authority.

## Commercial Boundary
- Commercial offerings live in `src/sokoni/sokoniCommercialConfig.ts`.
- Current configured offerings are KSh 100 and KSh 500 only.
- These are configuration records, not TDBK subscriptions or entitlements.
- Selecting an offering records `PAYMENT_REQUIRED` on the Sokoni participant.
- Participant publication is intentionally separate from payment so payment does not become synonymous with participant existence.
- No successful payment is fabricated.
- No TDBK subscription route is reused.

## Publication Lifecycle
The Sokoni participant model supports:
- `DRAFT`
- `READY`
- `ACTIVE`

The current registration path creates `ACTIVE` public presence once the Sokoni persistence operation succeeds. Commercial payment state is independent:
- `NONE`
- `PAYMENT_REQUIRED`
- `PAYMENT_PENDING`
- `PAYMENT_CONFIRMED`
- `PAYMENT_FAILED`

No payment confirmation is generated by Sokoni.

## TDBK Boundary
- New participants are persisted as `NOT_ENROLLED`.
- Sokoni does not create a DBK, Business DNA, tenant, capability or Engine enrollment state.
- A future TDBK adoption flow can consume compatible Sokoni participant information only through an approved contract.
- `ENROLLED` is retained as a future type boundary but is never fabricated by the current registration flow.

## Non-TDBK Discovery Behavior
- Public discovery is independent of TDBK.
- Customers can discover ACTIVE Sokoni participants without TDBK enrollment.
- Participant registration itself uses Firebase Authentication for write authorization; this is not TDBK enrollment or DBK creation.
- Public participant reads do not require a TDBK account.

## Blocking Issues
- Firebase Anonymous Authentication must be enabled for the current no-friction participant registration write path.
- `firestore.rules`, `storage.rules` and `firebase.json` must be deployed to the Firebase project before production persistence is considered operational.
- Owner management/editing and participant ownership transfer require a dedicated Sokoni contract; they are not invented here.
- Sokoni-specific payment initiation and authoritative confirmation remain missing.
- Paid commercial offering activation remains blocked on the payment contract.
- Natural-language discovery relevance/matching remains a future contract boundary; the current persisted discovery foundation is area-based.

## MASTER REVIEW REQUIRED
- Confirm long-term ownership of the Sokoni participant namespace and future migration/adoption contract into TDBK.
- Confirm owner-management/authentication model for persistent Sokoni participants.
- Confirm Sokoni payment authority and commercial offering lifecycle.
- Confirm future public discovery/relevance/matching contract and whether bounded Firestore reads remain sufficient as scale grows.
- Confirm media retention/deletion lifecycle and future cross-surface asset reuse policy.
- Confirm future participant → TDBK adoption input contract.

## DBK Dependencies
- None added.
- No DBK source files were modified.
- Sokoni participant records are not DBK records.
- Future TDBK adoption remains an Engine/DBK responsibility.

## Discovery Journeys Verified
- Public customer: Sokoni → selected area → natural-language discovery → persisted participant presentation → participant detail → product/service information.
- Empty location: selected area → no ACTIVE persisted participants → honest empty state; no fabricated business is inserted.
- Participant: registration → public profile → photos → product/service listings → optional commercial offering → persistence → ACTIVE Sokoni public presence.
- TDBK: Sokoni participant → NOT_ENROLLED boundary → no DBK fabricated.

## UX Decisions
- Sokoni remains discovery-first and independent of TDBK maturity.
- Participant registration is broader than conventional business registration.
- Area is a discovery dimension, not a claim of physical proximity or service coverage.
- Persisted Sokoni data is visually separated from demo/reference Engine data.
- Participant photos are first-class reusable assets.
- Catalogue items reuse participant media references instead of duplicate uploads.
- Commercial selection is optional and configurable; payment state does not create or define participant existence.
- Public participant pages do not invent price, stock, ratings, reviews, availability, coverage or transaction state.

## Architecture Concerns
- The Sokoni participant collection must not evolve into a hidden TDBK/DBK master.
- The participant namespace must remain clearly Sokoni-owned until any future TDBK adoption contract is approved.
- Firestore/Storage rules are part of the persistence boundary and must be deployed together with the application configuration.
- The current public read is intentionally bounded and area-filtered; scaling to full-text relevance or geospatial discovery requires an explicit architecture decision rather than a silent index.
- Anonymous Firebase authentication is a write authorization mechanism for the current registration path, not a TDBK identity/enrollment mechanism.

## Files / Areas Changed
- `src/client/firebase.ts` — added Firestore and Storage client initialization alongside existing Firebase Auth.
- `src/sokoni/sokoniCommercialConfig.ts` — configurable Sokoni commercial offerings.
- `src/sokoni/persistence/sokoniParticipantPersistence.ts` — Sokoni participant/media/catalogue persistence and public discovery reads.
- `src/sokoni/SokoniBusinessRegistration.tsx` — converted the previous UX-only registration into a real persistence flow and expanded participant types/reusable media selection.
- `src/sokoni/SokoniExperience.tsx` — consumes persisted ACTIVE Sokoni participants by selected area and presents participant detail separately from demo/reference data.
- `src/sokoni/sokoniCommercialConfig.test.ts` — commercial configuration contract test.
- `firestore.rules` — explicit Sokoni participant security boundary.
- `storage.rules` — explicit Sokoni public media security boundary.
- `firebase.json` — Firebase rules deployment configuration.
- `docs/master/SOKONI-STATUS.md` — durable status and architecture record.
- No TDBK Engine source files changed.
- No DBK source files changed.

## Verification
- GitHub branch inspection: PASS.
- Current Sokoni status inspection before implementation: PASS.
- Existing Sokoni registration, discovery adapter and presentation components inspected: PASS.
- Existing Firebase Auth, Firestore persistence abstractions and Firebase Storage usage inspected: PASS.
- Existing TDBK subscription/payment authority inspected and intentionally not reused: PASS.
- Existing Engine/DBK boundaries inspected; no Engine/DBK source was changed: PASS.
- `npm test`: NOT RUN — connected GitHub environment does not provide local command execution.
- `npm run typecheck`: NOT RUN — connected GitHub environment does not provide local command execution.
- `npm run lint`: NOT RUN — connected GitHub environment does not provide local command execution.
- `npm run build`: NOT RUN — connected GitHub environment does not provide local command execution.
- Browser/device runtime: NOT RUN — no browser executor is available in the connected GitHub environment.
- GitHub combined status for the final commit: pending/no local execution claim.
- No test/build/runtime pass is claimed.

## Deliberately NOT Implemented
- TDBK enrollment.
- DBK creation.
- Business DNA.
- Engine workflow/request/quote/approval/payment/receipt authority.
- TDBK subscription reuse.
- Search index.
- Full-text relevance/matching engine.
- Geospatial proximity/routing/coverage.
- Availability authority.
- Participant owner-management/editing contract.
- Payment initiation or successful-payment simulation.
- Ratings/reviews/trust fabrication.

## Remaining Work
- Deploy Firebase rules/configuration and verify the real project environment.
- Verify Anonymous Authentication is enabled for the registration path.
- Add the approved Sokoni owner-management contract in a separate task.
- Add the approved Sokoni payment contract in a separate task.
- Expand discovery relevance only after the relevant Sokoni/Engine contract is approved.
- Define future Sokoni → TDBK adoption input contract.

## Next Recommended Single Sokoni Task
Production verification of the persisted participant registration and public discovery path against the configured Firebase project, including rules deployment and real mobile/browser verification. Do not begin owner management or payment integration in that verification task.

## Evidence
- Previous Sokoni verification state: `9651b402c270e44c40a6af97d5b77e32cba659c2`.
- Previous paid business presence documentation: `ae5b5f00cb6621efa98c32182f85c76ff6d06165`.
- Commercial configuration commit: `0c1ed49454c073e3ee8ebd0954d963da77a05c26`.
- Firebase client boundary commit: `a9a8e3de93292fc9259c750daf37064e0cae7126`.
- Participant persistence fix commit: `c89dc035350df31c226a042bef2af495aaa622c7`.
- Firestore rules commit: `be4ca2759df462a06348dff1ea05cb0c7a594940`.
- Storage/rules deployment commit: `ad426bbf80102990db3db6a9668f1b7f54e04b`.
- Registration persistence UI commit: `0f7281bc9aad716cb76c9b1342fcef4826d0550a`.
- Persisted discovery UI commit: `636555023f999056b1578c3f6375afc2830cd5cb`.
- Commercial configuration test commit: `945f314148d6e162401c8907b1ef7b86b0599698`.
