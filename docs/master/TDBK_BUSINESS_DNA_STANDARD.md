# TDBK Business DNA Standard — v1.0.0

**Status:** Canonical domain specification; staged adoption required  
**Date:** 2026-11-15

## 1. Purpose

Business DNA is the versioned, structured and auditable operating model of one business organisation. It is more than a profile form and must not become an untyped catch-all document. The platform uses DNA to configure workspace behavior, terminology, branch topology, capability recommendations, role defaults, workflow parameters, integrations and experience.

Current code seed: `src/blueprint/types.ts` defines `BusinessIdentity`, `BranchTopology`, and a compact `BusinessDNA` with scale, operational preferences, enabled capability IDs and growth stage. This standard expands the target model without asserting that all domains are already implemented.

## 2. Identity and ownership rules

- Every business has one immutable platform business identifier under the canonical identity contract.
- A business may have legal and trading names, multiple sites and multiple operating units.
- A portfolio owner may manage multiple businesses; each business remains isolated.
- Blueprint identity and version are explicit and immutable on each DNA revision.
- Do not treat a branch ID, portfolio ID, user ID or workspace ID as interchangeable with the business ID.
- Do not resolve the current `dbkId` / `tenantId` discrepancy through a blind rename. Establish one canonical domain identifier and a documented mapping to storage/auth claims.

## 3. DNA domains

| ID | Domain | Required information groups | Key validation / governance |
|---|---|---|---|
| DNA-01 | Identity & legal | Business ID, legal/trading name, registration type/number, KRA PIN where applicable, ownership/contact authority | Verify provenance; protect sensitive identifiers; legal fields may be incomplete during draft onboarding |
| DNA-02 | Industry & business model | Industry, subsector, archetype, revenue model, customer segments, operating model | Archetype must resolve to a published blueprint version |
| DNA-03 | Products & services | Catalogue, variants, units, service packages, SKU, pricing rules, tax category, media | Dynamic records; effective dates; currency; no hardcoded product/price values |
| DNA-04 | Organisation & people | Portfolio, organisation, departments, teams, employees, managers, job functions | Membership separate from user authentication; employment status and scope |
| DNA-05 | Geography & branches | Country, county, town, physical/digital sites, branch codes, HQ, warehouses, remote sites | Stable IDs; branch scope and timezone; one HQ unless blueprint explicitly supports otherwise |
| DNA-06 | Customers & counterparties | Customers, guardians/patients where applicable, suppliers, distributors, partners, creditors/debtors | Domain-specific identity and consent; avoid unnecessary sensitive data |
| DNA-07 | Operations & processes | Processes, opening hours, service calendars, operating cycles, approvals, fulfilment/service policies | State machines and authority rules are explicit and testable |
| DNA-08 | Finance & commercial rules | Base currency, tax configuration, accounts, credit limits, payment terms, deposits, discounts, price lists | Monetary precision; effective dating; approval; immutable transaction snapshots |
| DNA-09 | Inventory & assets | Stock locations, warehouses, units, batches, expiry, serial/IMEI, equipment, assets, reorder policies | Quantity/unit invariants; traceability; movement ledger |
| DNA-10 | Compliance & documents | Applicable obligations, licences, statutory documents, retention, consent and document templates | Jurisdiction and sector specific; versioned rules; evidence and expiry |
| DNA-11 | Channels & communications | WhatsApp, SMS, email, web, mobile, customer contact preferences, notification policies | Consent, provider status, template/version and delivery evidence |
| DNA-12 | Technology & integrations | Devices, networks, APIs, provider accounts, webhooks, credentials references, storage | Secrets never stored in plain DNA; store secret references and health status |
| DNA-13 | Security & permissions | Roles, permission sets, branch scopes, approval thresholds, separation of duties | Least privilege; deny by default; server-side enforcement |
| DNA-14 | Automation & AI | Triggers, schedules, agent policies, autonomy level, allowed tools, escalation rules | Explicit scope, approval boundary, kill switch, audit and rollback |
| DNA-15 | Analytics & growth | KPIs, targets, reporting periods, growth stage, forecast assumptions | Distinguish measured facts from estimates and targets |
| DNA-16 | Experience & preferences | Terminology, locale, language, theme, navigation preferences, dashboards, accessibility | Preferences cannot override security, compliance or financial invariants |

## 4. Required metadata on each domain record

Each persisted domain record should carry or inherit:
- `schemaVersion`
- `revision` or monotonically increasing version
- `businessId` (mapped to current canonical identity)
- `domainId`
- `status` (DRAFT, ACTIVE, ARCHIVED where appropriate)
- `createdAt`, `updatedAt`
- `createdBy`, `updatedBy`
- `source` / provenance (USER, IMPORT, PROVIDER, AI_PROPOSAL, SYSTEM)
- `effectiveFrom` / `effectiveTo` when time-sensitive
- sensitivity / retention classification where relevant

Do not add every field to the root BusinessDNA interface as optional `unknown`. Use typed domain contracts and validated schemas, then compose them through a versioned aggregate or domain repositories.

## 5. Data authority classes

| Class | Examples | Rule |
|---|---|---|
| Identity | Business ID, legal registration, branch IDs | Controlled mutation, audited |
| Configuration | Currency, branch topology, workflow thresholds | Versioned, validated, effective-dated |
| Operational master data | Product catalogue, customer and supplier records | Domain-owned repository and lifecycle |
| Transactional facts | Sale, payment, receipt, stock movement | Immutable or corrected through explicit reversal/amendment |
| Preferences | Theme, dashboard arrangement, preferred language | User-editable; cannot override policy |
| Recommendations | Suggested capability, inferred business category | Advisory until accepted |
| Secrets | Provider keys, tokens, passwords | Secret manager / secure credential vault; never plain DNA |
| Derived projections | Dashboards, compiled workspace, analytics | Rebuildable; never replace authoritative records |

## 6. Discovery and completion lifecycle

`UNSTARTED → DISCOVERING → DRAFT → VALIDATING → READY_FOR_REVIEW → APPROVED → ACTIVE`

A discovery assistant may infer a proposed value, but must label it as inferred and capture confidence/provenance. Required legal, financial, clinical or security fields need authoritative user/provider evidence. Incomplete DNA must not provision capabilities whose prerequisites are unmet.

## 7. Blueprint binding

Every DNA instance must reference:
- `blueprintId`
- `blueprintVersion`
- `archetypeId`
- `schemaVersion`
- capability selection / configuration revision

A blueprint defines allowed structures and defaults. DNA stores the business-specific choices. Do not copy blueprint defaults into DNA without recording that they are inherited or accepted. A later blueprint release must not silently rewrite active business configuration.

## 8. Kenya-first configuration

Initial locale defaults may include:
- Country: KE
- Currency: KES
- Timezone: Africa/Nairobi
- Kenyan county and administrative geography
- KRA tax/eTIMS configuration where applicable
- M-Pesa payment channel where enabled
- WhatsApp, SMS and email channels where consented and configured

Defaults must be selected by country and blueprint, configurable by authorised administrators and versioned. Never assume all Kenyan businesses are VAT registered or that all transactions use one tax rate.

## 9. Firestore and identity migration rule

Current repository evidence includes:
- `BusinessIdentity.dbkId` and `BusinessDNA.dbkId` in `src/blueprint/types.ts`
- `BusinessDnaRepository` methods taking `tenantId`
- repository path `/tenants/{tenantId}/configuration/business_dna`

This is a contract ambiguity, not permission to rename fields. Before changing storage:
1. Inventory all reads/writes, auth claims, rules, indexes, provisioning and API payloads.
2. Identify the authoritative business identifier and existing persisted data shape.
3. Define canonical domain terminology and a compatibility mapping.
4. Write migration/backfill and rollback plans.
5. Add cross-business and cross-branch negative tests.
6. Deploy compatible readers before writers if a phased migration is needed.
7. Remove legacy mapping only after telemetry proves no active dependency.

## 10. Acceptance criteria

- DNA validates against a versioned schema.
- Unknown fields and invalid enum values are handled deliberately.
- Domain-level authorization is enforced server-side.
- Business data is isolated from other businesses and branches.
- Sensitive values have provenance, access and retention controls.
- Secrets are references, never raw values.
- DNA revisions are auditable and recoverable.
- Blueprint upgrades do not silently overwrite business choices.
- UI can show completion, missing prerequisites and review status.
- Tests cover create, read, update, invalid data, concurrent updates, migration, rollback and cross-tenant access.
