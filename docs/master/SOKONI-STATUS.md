# SOKONI STATUS

## Last Updated
2026-10-07

## Current Phase
Authoritative Discovery Integration — TDBK Publication + Sokoni Ownership Hardening

## Current Objective
Keep Sokoni independently authoritative while consuming explicitly published TDBK organizations through the governed public discovery contract, enforce participant ownership, and close the remaining commercial/payment boundary without fabricating payment or trust state.

## Completed
- Discovery Experience Shell remains complete and closed.
- Entity Detail Experience remains complete and closed.
- Discovery Context Experience remains complete and closed.
- Visual/runtime verification remains recorded; completed UX slices were not reopened as redesign work.
- Sokoni participant registration is now participation-first rather than business-first, with multi-select orientations such as buy, sell, offer a service, seek work/opportunities, offer transport, offer delivery, promote, join a community and create a community.
- A participant can hold multiple orientations simultaneously; participantKind remains a compatibility/presentation classification while orientations is the extensible participation declaration.
- Participant persistence is now explicitly Sokoni-owned through the `sokoniParticipants` Firestore collection.
- Participant public projection now also carries extensible participation orientations and contextual orientation selections alongside identity, category, description, area-level location, public contacts, reusable media references, product/service listings, publication state, Sokoni commercial state and the non-authoritative TDBK relationship boundary.
- Public discovery reads persisted ACTIVE Sokoni participants and filters them by the selected discovery area.
- TDBK published organizations are now a governed second discovery source through the public organization projection; Sokoni does not become a second DBK master.
- Participant detail presentation now distinguishes authoritative Sokoni state from demo/reference Engine state.
- Participant media is persisted in Firebase Storage under the owner-scoped Sokoni namespace and referenced from participant/listing records so the same uploaded asset can be reused without duplicate uploads.
- Authenticated participant owner read/update/delete operations now exist with owner-bound Firestore/Storage rules.
- Product/service catalogue entries persist with reusable participant media references.
- Publication state is independent from commercial payment state: paid listings remain DRAFT until an authoritative payment confirmation exists.
- Sokoni commercial options are configuration data, not permanent subscription/domain logic.
- Initial configured commercial offerings remain KSh 100 and KSh 500 only; no additional pricing tiers were invented.
- Firestore and Storage security boundaries were explicitly added for Sokoni participant/public media access.
- TDBK relationship is persisted as `NOT_ENROLLED`; Sokoni does not fabricate TDBK enrollment or DBK state.
- Failed media persistence is now cleaned up on upload or participant-document failure on a best-effort basis.

## In Progress
- Sokoni payment initiation/confirmation is implemented through the guarded system payment service identity and M-Pesa bridge; production provider configuration remains a release gate.
- Paid offering activation remains server-authoritative: payment-required participants stay DRAFT until provider confirmation.
- Natural-language relevance/matching remains deterministic sector inference + area filtering; a full relevance/matching contract remains future work.

## Verified
- Sokoni registration writes a persistent participant record instead of a UI-only draft when Firebase is configured and the configured security rules are deployed.
- Public discovery reads only records with `publicationStatus: ACTIVE`.
- Discovery can filter persisted participants by exact selected area without claiming proximity, routing, coverage or availability.
- Participant media is stored once and reused through media IDs in catalogue entries.
- Failed Storage/Firestore participant persistence does not intentionally leave uploaded media behind; cleanup is best-effort.
- Product/service listings contain only name, description and media references; no stock, price, delivery or transaction truth is created.
- Commercial payment state is separate from participant publication state.
- TDBK relationship remains `NOT_ENROLLED` and no DBK, Business DNA, entitlement or Engine workflow is created.
- Existing TDBK subscription/payment authority was not reused.
- Existing Sokoni presentation shell remains the experience boundary; persisted participants are presented separately from demo technician/reference content.
- Firestore rules retain the existing tenant rules and add an explicit Sokoni public participant boundary before the deny-all catch-all.
- Storage rules restrict writes to authenticated image uploads under the Sokoni participant media namespace and allow public reads for public presentation media.

## Engine Contracts Consumed
- None new.
- The old demo provider adapter is no longer the primary TDBK discovery source; TDBK discovery now uses the governed public organization API.
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

`/system/sokoni/participants/{participantId}`

It is owned by Sokoni and is not a DBK or Engine business master. Its public lifecycle currently supports `DRAFT | READY | ACTIVE`, with registration creating an `ACTIVE` public participant only after required public fields have been supplied and the persistence operation succeeds.

The public participant projection contains:
- participant kind (compatibility/presentation classification)
- extensible participation orientations
- contextual orientation selections
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
- Failed uploads or participant writes trigger best-effort cleanup of already-uploaded media.
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
- Payment initiation uses a dedicated system payment service identity and the configured M-Pesa merchant tenant.
- Payment confirmation is provider-backed and idempotent; a confirmed payment activates the participant.
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
- Owner management is now persisted and owner-scoped; anonymous Firebase identity remains a temporary onboarding identity and should be linked to a permanent account for cross-device ownership.
- Sokoni payment initiation and authoritative confirmation are implemented; production merchant configuration, callback/reconciliation hardening and live provider certification remain release gates.
- Natural-language discovery relevance/matching remains a future contract boundary; the current persisted discovery foundation is area-based.

## MASTER REVIEW REQUIRED
- Confirm long-term ownership of the Sokoni participant namespace and future migration/adoption contract into TDBK.
- Confirm permanent-account upgrade/linking model for persistent Sokoni participants.
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
- `src/sokoni/SokoniBusinessRegistration.tsx` — changed registration from business-first to orientation-first participation with conditional follow-up context.
- `src/sokoni/sokoniParticipationConfig.ts` — extensible orientation and contextual option vocabulary.
- `src/sokoni/sokoniParticipationConfig.test.ts` — orientation configuration contract test.
- `src/sokoni/persistence/sokoniParticipantPersistence.ts` — persisted multi-orientation participant fields and expanded participant-kind compatibility values.
- `src/sokoni/SokoniExperience.tsx` — consumes persisted ACTIVE Sokoni participants by selected area and now presents participant orientations separately from the compatibility participant kind.
- `src/sokoni/sokoniCommercialConfig.test.ts` — commercial configuration contract test.
- `firestore.rules` — explicit Sokoni participant security boundary.
- `storage.rules` — explicit Sokoni public media security boundary.
- `firebase.json` — Firebase rules deployment configuration.
- `docs/master/SOKONI-STATUS.md` — durable status and architecture record.
- No TDBK Engine source files changed.
- No DBK source files changed.

## Verification
- GitHub branch inspection: PASS.
- Participation-first registration architecture inspection: PASS.
- Existing participant persistence boundary reused; no second participant master created: PASS.
- Existing Engine/DBK boundaries preserved: PASS.
- Current Sokoni status inspection before implementation: PASS.
- Existing Sokoni registration, discovery adapter and presentation components inspected: PASS.
- Existing Firebase Auth, Firestore persistence abstractions and Firebase Storage usage inspected: PASS.
- Existing TDBK subscription/payment authority inspected and intentionally not reused: PASS.
- Existing Engine/DBK boundaries inspected; no Engine/DBK source was changed: PASS.
- Diff inspection from `ae5b5f00cb6621efa98c32182f85c76ff6d06165`: PASS; changed files are limited to Sokoni/client Firebase/rules/status files listed above.
- `npm test`: NOT RUN — connected GitHub environment does not provide local command execution.
- `npm run typecheck`: NOT RUN — connected GitHub environment does not provide local command execution.
- `npm run lint`: NOT RUN — connected GitHub environment does not provide local command execution.
- `npm run build`: NOT RUN — connected GitHub environment does not provide local command execution.
- Browser/device runtime: NOT RUN — no browser executor is available in the connected GitHub environment.
- GitHub workflow runs for final commit: none reported.
- GitHub combined status for final commit: no status checks reported.
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
- Payment success simulation outside test runtime.
- Ratings/reviews/trust fabrication.

## Participation-First Registration Slice
- Registration begins with **“What brings you to Sokoni?”** rather than assuming the participant is a business.
- Multiple orientations can be selected in one registration.
- Relevant follow-up questions are conditional: service choices appear for service providers; transport choices appear for transport; work/opportunity choices appear for job seekers; community direction appears for community participation.
- The contextual option lists are configuration vocabulary, not a closed Sokoni universe. “Other” paths remain available where appropriate.
- The persisted participant keeps orientations separately from the compatibility participantKind classification so one person can be buyer + seller + technician + community member without changing identity records.
- Existing participants without the new orientation fields remain readable; discovery presentation falls back honestly when orientation data is absent.
- Discovery cards and participant detail now show persisted orientations when available.
- No Engine, DBK, payment, transaction, matching or availability authority was added.

## Remaining Work
- Deploy Firebase rules/configuration and verify the real project environment.
- Verify Anonymous Authentication is enabled for the registration path.
- Verify the owner-management path against deployed Firebase rules.
- Add the approved Sokoni payment contract in a separate task.
- Expand discovery relevance only after the relevant Sokoni/Engine contract is approved.
- Define future Sokoni → TDBK adoption input contract.

## Next Recommended Single Sokoni Task
Complete production certification of the Sokoni payment authority, then wire provider callback/reconciliation into the Sokoni payment intent boundary. Paid offerings remain non-public until live merchant configuration and provider verification pass.

## Evidence
- Participation orientation configuration commit: `bd5453a0c5e7201f37322fd43076edce8ae980d6`.
- Participant orientation persistence commit: `c84bc69d97ee557ad63b509c0b0f49e5f4aa191b`.
- Participant kind compatibility commit: `513c5a22c64c35ef24e7fa50f2cf356bd58be8ce`.
- Participation-first registration commit: `884529ad4f5425017ee7c6c7c3db2bd7987f722a`.
- Participant orientation presentation commit: `a3e7be995e30e90682e94912a4d18104222241cc`.
- Participation configuration test commit: `8ffc57e0e0a5e17d5df8402ac0460a0eba2a229d`.
- Orientation context cleanup commit: `86617a0ef36067f00fb8dd02ac5011230caa2560`.
- Final import/type cleanup commits: `97afaedf9adf25a82c8970df7f06eb7c7c60168b2`, `46d865e6a05186f3be1df31b61dc879b89aaedb2`.
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
- Media failure cleanup hardening commit: `d486a6b040dc478c814c244eaca43b22bfc8d469`.
- Status commit: this file update.


## Payment Authority Slice — 2026-10-07
- Canonical participant path: `/system/sokoni/participants/{participantId}`.
- Canonical payment-intent path: `/system/sokoni/paymentIntents/{intentId}`.
- Client persistence and Firestore rules now use the same valid nested Firestore namespace.
- Sokoni payment execution no longer impersonates the requesting user's tenant principal. It invokes the M-Pesa bridge through the dedicated `TDBK_SYSTEM_SOKONI_PAYMENT` service identity.
- The bridge rejects system-payment execution unless that explicit service role is present.
- Paid participants transition `PAYMENT_REQUIRED → PAYMENT_PENDING → PAYMENT_CONFIRMED`, with public publication remaining DRAFT until confirmation.
- Confirmation is idempotent: a terminal CONFIRMED intent is returned without issuing another provider query.
- Provider confirmation is audited.
- Tests cover pending activation, foreign-owner rejection, provider confirmation, and repeated confirmation.
- Live M-Pesa merchant configuration, provider callback/reconciliation linkage, Firebase rule deployment, and CI/runtime execution remain release gates.
