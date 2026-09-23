# SOKONI STATUS

## Last Updated
2026-09-23

## Current Phase
Paid Business Presence + TDBK-ready Registration

## Current Objective
Enable Sokoni to present an independent business-presence registration and commercial entry experience without making public discovery dependent on TDBK maturity or creating TDBK/DBK authority inside Sokoni.

## Completed
- Discovery Experience Shell remains complete and closed.
- Entity Detail Experience remains complete and closed.
- Discovery Context Experience remains complete and closed.
- Visual/runtime verification remains recorded with no feature reopen.
- Added a Sokoni business-presence registration experience accessible directly from the public Sokoni surface.
- Added a four-step business-first flow: Business details → Public presence → Photos & catalogue → Sokoni presence/payment boundary.
- Added explicit KSh 100 and KSh 500 Sokoni presence choices only; no additional pricing tiers were introduced.
- Added portable registration-draft fields for business identity, category, description, area, public contacts, photos, catalogue and Sokoni presence amount.
- Added explicit `NOT_ENROLLED` TDBK adoption boundary to the registration draft.
- Added local photo preview UX without claiming media upload or publication.
- Added local product/service catalogue drafting without creating product/service master records.
- Added public-discovery copy stating that customers do not need TDBK enrollment, a Sokoni business account or payment to discover businesses.
- Added a payment boundary that distinguishes `PAYMENT_REQUIRED` from `PAYMENT_INTEGRATION_REQUIRED` and never claims payment success.
- Explicitly avoided reusing the existing TDBK subscription payment authority for the independent Sokoni fee.

## In Progress
- No Sokoni business persistence/publication authority is implemented.
- No Sokoni payment integration is implemented.
- No Sokoni media persistence/upload contract is implemented.
- No catalogue master authority is implemented.

## Verified
- The new registration flow is UI/draft state only and does not create a DBK, TDBK tenant, entitlement, payment transaction, workflow record or publication record.
- Public discovery remains conceptually open to non-TDBK businesses.
- The registration UI explicitly distinguishes Sokoni paid presence from TDBK enrollment/subscription/activation.
- Only the specified KSh 100 and KSh 500 commercial options are presented.
- No price, availability, rating, review, trust, coverage or transaction claims are fabricated for catalogue items.
- Photo selection uses local browser previews only; no upload success is claimed.
- The business information shape is portable and includes an explicit future TDBK adoption status of `NOT_ENROLLED` without creating DBK state.
- Existing TDBK payment authority was inspected and intentionally not consumed because its contract is for TDBK subscriptions, not Sokoni presence.
- App routing exposes the registration experience from the public Sokoni surface without requiring TDBK authentication.

## Engine Contracts Consumed
- None new.
- Existing Sokoni presentation contracts remain unchanged.
- No Engine public business-registration, publication, media, catalogue or Sokoni-payment contract was assumed.

## Engine Contracts Intentionally NOT Assumed
- Sokoni business master/publication authority.
- Public business projection/read contract.
- Public product/service master or projection.
- Public media asset authority.
- Sokoni paid-presence entitlement authority.
- Sokoni payment transaction authority.
- Public search/discovery authority.
- TDBK enrollment/adoption contract.

## DBK Dependencies
- None added.
- TDBK/DBK remains outside Sokoni registration authority.
- A future TDBK onboarding flow may consume compatible Sokoni registration input only after an approved Engine contract exists.

## Blocking Issues
- A real registered/public Sokoni business record requires a Sokoni-owned persistence/publication contract that is not currently present.
- Real photo/catalogue persistence requires an approved Sokoni media/catalogue storage contract or existing reusable media abstraction.
- Real payment requires a Sokoni-specific payment initiation/confirmation contract; the existing TDBK subscription payment authority must not be repurposed.
- Publishing a paid presence must remain blocked until authoritative payment confirmation and publication state exist.

## MASTER REVIEW REQUIRED
- Exact authoritative ownership and persistence model for Sokoni businesses.
- Public business publication/read contract.
- Sokoni payment contract and relationship to the existing TDBK financial authority.
- Sokoni media asset lifecycle/reuse contract.
- Sokoni catalogue/product/service ownership and projection boundary.
- Future Sokoni → TDBK adoption input contract.

## Discovery Journeys Verified
- Public customer journey remains independent of enrollment: public Sokoni → discovery → business/entity presentation.
- Business journey now has a visible entry point: Sokoni → List your business → business details → public presence → photos/catalogue → Sokoni amount → payment boundary.
- The journey stops at payment integration because no Sokoni payment authority exists.
- No business is marked paid, active, published or TDBK-enrolled by UI interaction alone.

## UX Decisions
- Sokoni is positioned as an independent discovery/customer platform, not as a TDBK prerequisite.
- Paid presence is explicitly a Sokoni service and never described as TDBK subscription, activation or entitlement.
- Registration is business-first and avoids TDBK compliance concepts.
- Public contacts and catalogue information are collected only as customer-facing information.
- Photo selection is first-class UX but clearly labeled as local preview until an approved media persistence contract exists.
- Catalogue drafting supports products and services without creating authoritative master records.
- `NOT_ENROLLED` is the only TDBK adoption state represented by the registration draft; `ENROLLED` is never fabricated.
- Future TDBK adoption should consume compatible registration input rather than force unnecessary re-entry, while TDBK remains authoritative for DBK/Business DNA creation.

## Architecture Concerns
- The registration draft must not evolve into a hidden Sokoni master database without an explicit ownership decision.
- The payment boundary must never be wired to TDBK subscription endpoints merely because those endpoints already exist.
- Local image object URLs are temporary presentation state and must not be mistaken for durable media references.
- Public publication must not be inferred from payment button interaction.
- Sokoni must remain usable for businesses that never enroll in TDBK.

## Files / Areas Changed
- `src/sokoni/SokoniBusinessRegistration.tsx` — new UI-only business registration, catalogue/photo draft and Sokoni payment boundary.
- `src/App.tsx` — exposes the registration flow from the public Sokoni surface and preserves the existing Sokoni entry flow.
- `docs/master/SOKONI-STATUS.md` — recorded the commercial/business-presence slice, boundaries, blockers and verification.
- No Engine source files changed.
- No DBK source files changed.

## Verification
- Repository/branch/status inspection: PASS.
- Existing Sokoni implementation and prior status inspected before changes: PASS.
- Existing TDBK business/DBK onboarding surface inspected: PASS.
- Existing TDBK subscription payment route inspected and explicitly not reused: PASS.
- Diff inspection from prior Sokoni verification commit: PASS; only `src/App.tsx`, `src/sokoni/SokoniBusinessRegistration.tsx`, and this status document were changed for this task.
- `npm test`: NOT RUN — connected GitHub environment has no local command execution.
- `npm run typecheck`: NOT RUN — connected GitHub environment has no local command execution.
- `npm run lint`: NOT RUN — connected GitHub environment has no local command execution.
- `npm run build`: NOT RUN — connected GitHub environment has no local command execution.
- Browser/device runtime: NOT RUN — no browser executor is available in the connected GitHub environment.
- No test/build/runtime pass is claimed.

## Non-TDBK Discovery Behavior
- Public discovery remains open conceptually to non-TDBK businesses.
- Registration does not require TDBK authentication.
- No TDBK enrollment state is created by Sokoni registration.

## TDBK-Enrolled Behavior
- No enrollment is implemented in this task.
- The draft records `NOT_ENROLLED` only.
- Future TDBK adoption remains an Engine/DBK onboarding responsibility.

## Remaining Work
- Establish Sokoni business persistence/publication authority.
- Establish reusable media asset persistence.
- Establish catalogue persistence/projection authority.
- Establish Sokoni payment initiation and authoritative confirmation.
- Connect paid confirmation to publication without creating TDBK entitlement state.
- Define the future Sokoni registration → TDBK onboarding input contract.

## Next Recommended Single Sokoni Task
Define and implement the approved Sokoni business draft persistence/publication boundary only after the ownership and payment/media contracts above are resolved. Do not add a parallel Engine business authority.

## Evidence
- Previous verification commit: `9651b402c270e44c40a6af97d5b77e32cba659c2`.
- Registration UI commit: `58d9f267c066abe552c7e47f93b6d7bfd88d99ab`.
- Sokoni routing commit: `bb63e50b2012a846f4873d46b76e048c8e1a0dda`.
- Compare from previous verification state: ahead by 2 commits; changed files were `src/sokoni/SokoniBusinessRegistration.tsx` and `src/App.tsx`.
