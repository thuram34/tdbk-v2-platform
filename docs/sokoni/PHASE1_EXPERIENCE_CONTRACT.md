# Sokoni Phase 1 — Experience Contract

**Domain owner:** Sokoni Experience Layer  
**Architectural authority:** TDBK Engine  
**Status:** Phase 1 contract recorded; implementation intentionally blocked where Engine contracts are unresolved.  
**Repository baseline inspected:** `main` at `7e4f9d2863106851ca86a673b59831fbca7d7f8a`  

## 1. Purpose

Sokoni is the public discovery, marketplace, and opportunity experience. It consumes authoritative TDBK Engine/DBK truth; it does not become a second operating system.

The governing flow is:

`NEED → DISCOVER → UNDERSTAND → MATCH → SELECT → ACT → TRANSACT → COMPLETE`

Sokoni owns presentation and user interaction. The Engine owns authoritative identity, tenancy, business/provider/product/service truth, capabilities, workflows, transactions, payments, receipts, events, security, audit, and other operational state.

## 2. Repository audit — existing authority found

The repository was inspected before defining this contract. The following existing mechanisms are relevant and must not be duplicated:

### 2.1 Experience projection already exists

`src/platform/projection/experienceProjection.ts` provides a server-authoritative `DbkExperienceProjection` for a DBK. It is tenant-aware, compiles workspace state, and exposes DBK identity, branches, capabilities, terminology, and permissions. This is an internal/DBK experience projection, not a public Sokoni marketplace projection.

### 2.2 Capability discovery already exists

`src/capability/discovery.ts` contains `DiscoveryEngineService`. It evaluates Blueprint compatibility, DBK capability records, entitlement, dependencies, lifecycle state, and discoverability. Its subject is **capability activation/discovery for a DBK**, not public discovery of businesses, products, services, providers, jobs, or offers.

This distinction is architectural:

- `DiscoveryEngineService` = DBK capability discovery/activation.
- Sokoni discovery = public discovery of authoritative entities/opportunities.

Sokoni must not rename, fork, or repurpose the existing capability discovery engine into a marketplace search engine.

### 2.3 DBK experience resolver already exists

`src/experience/experienceResolver.ts` resolves tenant-scoped DBK experience, builds navigation/dashboard state, consumes capability discovery, and dispatches existing DBK commands. It also routes `EXECUTE_SALE` to the existing `saleTransactionService`.

Sokoni must reuse authoritative transaction/workflow services where their contracts support a public request; it must not create a parallel sale/request/payment path.

### 2.4 Existing public gateway is not Sokoni

`src/public/PublicGateway.tsx` is an existing public UI surface for the platform/business-entry experience. It is not evidence of a Sokoni public discovery/search contract. Sokoni should not overwrite it or assume it already provides marketplace discovery authority.

### 2.5 Existing financial transaction authority must remain authoritative

`src/business/sales/saleTransactionService.ts` is already present and is invoked by the DBK experience resolver for `EXECUTE_SALE`. Sokoni must not implement its own payment, sale, ledger, or receipt authority.

## 3. Status vocabulary

- **EXISTS** — repository contains an authoritative capability whose contract matches the requirement.
- **PARTIAL** — repository contains related authority, but not a verified Sokoni-facing contract.
- **MISSING** — no verified authoritative contract was found for the required Sokoni behavior.
- **MASTER REVIEW REQUIRED** — another domain, principally the TDBK Engine, must define/confirm the contract before Sokoni implements against it.

A UI mock is never treated as proof that a backend contract exists.

## 4. Experience dependency matrix

| Sokoni surface/action | Engine dependency | Repository finding | Status | Gate |
|---|---|---|---|---|
| Home | Public discovery projection | Existing DBK experience projection is not a public marketplace projection | PARTIAL | MASTER REVIEW REQUIRED — GAP-01/GAP-05/GAP-20 |
| Natural-language intent | Intent/AI → discovery contract | AI/instruction infrastructure exists, but no verified public discovery intent contract | PARTIAL | MASTER REVIEW REQUIRED — GAP-05/GAP-18 |
| Search | Public search contract | No verified public marketplace search contract found | MISSING | MASTER REVIEW REQUIRED — GAP-06 |
| Discovery results | Public discovery + relevance | Existing capability discovery is DBK capability activation, not public entity discovery | MISSING | MASTER REVIEW REQUIRED — GAP-05/GAP-18 |
| Location-aware discovery | Location/privacy/discovery contract | Branch/location authority exists, but no verified public discovery/location contract | PARTIAL | MASTER REVIEW REQUIRED — GAP-07/GAP-19 |
| Business profile | Public business projection | DBK/business authority exists, but public projection contract is not verified | PARTIAL | MASTER REVIEW REQUIRED — GAP-01 |
| Product profile | Public product projection | Product/business transaction infrastructure exists, but public product projection is not verified | MISSING | MASTER REVIEW REQUIRED — GAP-02 |
| Service profile | Public service projection | Capability/service authority exists, but public service projection is not verified | MISSING | MASTER REVIEW REQUIRED — GAP-03 |
| Provider profile | Public provider projection | No verified public provider projection found | MISSING | MASTER REVIEW REQUIRED — GAP-04 |
| Provider coverage | Provider coverage authority | Branch/location data exists; provider service coverage contract not verified | MISSING | MASTER REVIEW REQUIRED — GAP-08 |
| Provider availability | Availability authority | No verified generic public provider availability contract found | MISSING | MASTER REVIEW REQUIRED — GAP-09 |
| Discovery → request | Public request initiation contract | No verified Sokoni-facing request contract found | MISSING | MASTER REVIEW REQUIRED — GAP-10 |
| Request → quote/approval | Quote/approval workflow contract | No verified generic Sokoni-facing contract found | MISSING | MASTER REVIEW REQUIRED — GAP-11 |
| Payment | Existing transaction/payment/financial authority | Existing sale transaction service exists | EXISTS for existing sale path | Reuse; confirm public handoff with Master |
| Receipt | Existing financial/receipt authority | Financial/receipt foundations exist in Engine | EXISTS at foundation level | Reuse; no Sokoni receipt authority |
| Jobs | Jobs domain | No verified Jobs domain contract found | MISSING | MASTER REVIEW REQUIRED — GAP-14 |
| Opportunities | Opportunities domain | No verified Opportunities domain contract found | MISSING | MASTER REVIEW REQUIRED — GAP-15 |
| Offers/promotions | Public offer domain | No verified public offers/promotions contract found | MISSING | MASTER REVIEW REQUIRED — GAP-16 |
| Public trust | Public trust projection | No verified public trust projection found | MISSING | MASTER REVIEW REQUIRED — GAP-17 |
| Public publishing | Business/provider publication contract | DBK authority exists, but public Sokoni publication contract is not verified | MISSING | MASTER REVIEW REQUIRED — GAP-12/GAP-13 |
| L7 Sokoni projection/API | Public experience contract | Existing L7 experience projection is DBK-scoped; Sokoni public contract is not verified | PARTIAL | MASTER REVIEW REQUIRED — GAP-20 |

## 5. Screen/action contract

### Public

#### Home
- **Intent:** start with a need.
- **Sokoni owns:** search entry, discovery navigation, category presentation, location UX.
- **Consumes:** public discovery projection.
- **Must not decide:** entity authority, eligibility, price truth, availability truth.
- **Gate:** GAP-01/GAP-05/GAP-20.

#### Search
- **Intent:** find by natural language or keywords.
- **Sokoni owns:** input, suggestions, filters, result presentation.
- **Consumes:** authoritative search result contract.
- **Must not decide:** search index truth or authoritative ranking/relevance.
- **Gate:** GAP-06.

#### Intent interpretation
- **Intent:** express a need without knowing the platform taxonomy.
- **Sokoni owns:** conversational input and correction UX.
- **Consumes:** authoritative intent/discovery response.
- **Must not decide:** provider eligibility or workflow consequence.
- **Gate:** GAP-05/GAP-18.

#### Location
- **Intent:** make discovery locally relevant.
- **Sokoni owns:** permission/consent UX, manual location selection, visible location context.
- **Consumes:** authorized location-aware discovery contract.
- **Must not decide:** private location access or provider coverage.
- **Gate:** GAP-07/GAP-19.

#### Results
- **Intent:** compare relevant possibilities.
- **Sokoni owns:** cards, filters, sorting UI, action affordances.
- **Consumes:** authoritative public result set.
- **Must not decide:** result eligibility, factual availability, authoritative price.
- **Gate:** GAP-05/GAP-06/GAP-18.

#### Product
- **Intent:** understand/buy a product.
- **Sokoni owns:** product presentation and action initiation.
- **Consumes:** public product projection.
- **Must not decide:** product identity, inventory, price, seller ownership.
- **Gate:** GAP-02.

#### Service
- **Intent:** understand/hire a service.
- **Sokoni owns:** service explanation, provider choices, request UX.
- **Consumes:** public service projection.
- **Must not decide:** authoritative capability/service existence.
- **Gate:** GAP-03.

#### Provider
- **Intent:** decide whether a provider can help.
- **Sokoni owns:** provider presentation and action.
- **Consumes:** public provider, coverage, availability, trust projections.
- **Must not decide:** provider identity, verification, capability, coverage, availability.
- **Gate:** GAP-04/GAP-08/GAP-09/GAP-17.

#### Business
- **Intent:** understand an organization.
- **Sokoni owns:** public business presentation and transition to DBK/public business experience.
- **Consumes:** public business projection and canonical DBK identity.
- **Must not decide:** business identity or access rights.
- **Gate:** GAP-01/GAP-20.

#### Job / Opportunity / Offer
- **Intent:** discover and act on an opportunity.
- **Sokoni owns:** presentation, filters, detail UX, action initiation.
- **Consumes:** authoritative domain projections.
- **Must not decide:** eligibility, status, publisher authority, application outcome, offer validity.
- **Gate:** GAP-14/GAP-15/GAP-16.

### Authenticated

#### My Sokoni
Aggregates Engine-backed requests, purchases, service activity, applications, saved discovery references, and account preferences. Sokoni may own presentation preferences and saved references where authorized, but never clones authoritative entities or transaction state.

#### Requests
Displays Engine-authoritative request/workflow state. Sokoni does not own lifecycle transitions.

#### Purchases
Displays Engine-authoritative sale/payment/receipt state. Sokoni does not own financial truth.

#### Services
Displays customer service lifecycle from Engine authority. Sokoni does not own completion state.

#### Saved
Sokoni may persist user-owned discovery references/preferences if the platform provides an appropriate persistence contract. Saved items reference authoritative entities; they do not copy them into a Sokoni master database.

#### Applications
Depends on the Engine Jobs/Opportunities/Application domain. Until that contract exists, do not implement an independent application database.

### Provider/seller

#### My Sokoni Business
Provider-facing experience may configure or preview public presence only through Engine-authorized DBK/provider publication contracts.

#### Products / Services
Sokoni may provide publication/discovery UX once authoritative Engine publication contracts exist. It must not create a parallel product/service master.

#### Availability
Sokoni may present/manage availability only through an authoritative availability contract. It must not invent availability state.

#### Requests
Sokoni may present incoming customer requests and authorized actions once the Engine exposes a provider-facing request contract.

#### Public Presence
Sokoni may preview the public projection. Publication eligibility and canonical content remain Engine/DBK authority.

## 6. First vertical slice — technician

The reference journey is:

`"My computer is slow."`

→ intent interpretation  
→ computer troubleshooting/service candidates  
→ authorized location  
→ relevant provider projection  
→ provider profile  
→ Request Service  
→ Engine authoritative request  
→ provider response  
→ quote where supported  
→ customer approval  
→ payment through Engine authority  
→ authoritative receipt  
→ completion  
→ Sokoni status presentation

### Boundary rule

Sokoni must never create an authoritative `sokoniRequest`, `sokoniOrder`, `sokoniPayment`, `sokoniReceipt`, provider master, product master, or marketplace transaction database.

Conceptually:

`SOKONI → Engine request contract → ENGINE authoritative request/workflow → SOKONI status`

For payment:

`SOKONI → existing Engine transaction/payment authority → financial truth → SOKONI status`

## 7. DBK ↔ Sokoni contract

The intended cross-surface flow is:

`DBK publishes/operates → Engine holds truth → Sokoni discovers/presents → customer acts → Engine governs consequence → DBK operates resulting work → Sokoni displays permitted customer state`

A business created or operated through DBK becomes discoverable only through an authoritative publication/projection contract. Sokoni must not copy DBK master records.

## 8. Explicit non-duplication rules

Sokoni must never create a second authority for:

- identity
- tenants/DBKs
- businesses
- providers
- products
- services/capabilities
- Business DNA
- RBAC/AuthZ
- payments
- ledger/financial truth
- receipts
- workflow state
- event authority
- audit authority
- notifications
- AI authority
- orders/requests/transactions

Existing Engine services are to be consumed, not mirrored.

## 9. MASTER REVIEW REQUIRED queue

The following are architectural dependencies outside the Sokoni domain and must be resolved by the Master TDBK Engine conversation before dependent implementation:

1. **GAP-20 — Sokoni-facing L7 projection/API contract**
2. **GAP-05 — Public discovery contract**
3. **GAP-06 — Public search contract**
4. **GAP-01 — Public business projection**
5. **GAP-04 — Public provider projection**
6. **GAP-03 — Public service projection**
7. **GAP-02 — Public product projection**
8. **GAP-07 — Location-aware discovery contract**
9. **GAP-18 — Discovery relevance/matching contract**
10. **GAP-10 — Discovery → request contract**
11. **GAP-11 — Request → quote/approval contract**
12. **GAP-08 — Provider coverage model**
13. **GAP-09 — Provider availability model**
14. **GAP-12 — Public business publishing**
15. **GAP-13 — Provider/seller discovery onboarding**
16. **GAP-17 — Public trust projection**
17. **GAP-19 — Public location/privacy boundary**
18. **GAP-14 — Jobs domain**
19. **GAP-15 — Opportunities domain**
20. **GAP-16 — Public offers/promotions domain**

## 10. Implementation gate

Until the relevant Engine contract is confirmed:

- UI can be designed around explicit interface boundaries.
- UI can use mock/static presentation only for visual work.
- No mock should be promoted into an authoritative backend implementation.
- No new marketplace collection/database should be created.
- No search index should be created by Sokoni.
- No duplicate provider/product/service records should be created.
- No independent request/order/payment/workflow path should be introduced.

When a Master contract is approved, Sokoni implementation should bind to that contract rather than redefine it.

## 11. Handoff

The next specialist can safely continue from this file.

**Sokoni owns:** public discovery/action UX.  
**TDBK Engine owns:** operating logic and shared truth.  
**DBK owns:** organization-facing operation.  

Any requirement that crosses those boundaries must be explicitly routed to the owning domain and marked `MASTER REVIEW REQUIRED` until an authoritative contract is verified.


## 12. Grand Operation Update — 2026-10-07

The following previously missing/partial boundaries are now authoritative:
- GAP-01 public business projection: TDBK public-safe organization projection + explicit publication authority.
- GAP-20 Sokoni-facing L7 projection/API: Sokoni now consumes the governed TDBK public organization API.
- Participant ownership: authenticated owner UID is persisted and enforced in Firestore/Storage rules.
- Owner lifecycle: owner read/update/delete operations exist for Sokoni participants.
- Paid participant publication: paid offerings remain DRAFT until authoritative payment confirmation; client-side payment-state escalation is blocked by rules.

Still intentionally unresolved:
- Sokoni payment initiation/confirmation.
- Full relevance/matching/search index.
- Provider coverage and real availability.
- Discovery → request → quote/approval.
- Jobs/opportunities/offers/trust contracts.
- Cross-device permanent identity upgrade for anonymous participant onboarding.
