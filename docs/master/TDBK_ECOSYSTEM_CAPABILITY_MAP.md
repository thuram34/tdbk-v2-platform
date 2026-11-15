# TDBK Ecosystem & Capability Map — v1.0.0

**Status:** Portfolio architecture map; repository and deployment evidence required per product  
**Date:** 2026-11-15

## 1. Platform composition

The ecosystem is one governed platform with multiple product experiences. Reuse shared contracts and services; do not force every product into one repository or erase domain-specific controls.

| Platform area | Responsibility | Primary data authority |
|---|---|---|
| Identity & Kernel | Accounts, business isolation, authorisation, audit | Identity provider + platform policy |
| Business DNA & Blueprint | Business configuration and archetype contracts | Business DNA repositories / blueprint registry |
| Capability Engine | Registry, dependencies, entitlement and activation | Capability registry + subscription policy |
| Runtime | Domain commands and authoritative business state | Domain repositories |
| Workflow & Events | Durable process coordination, outbox and events | Workflow/event persistence |
| Connectors | Provider communication and reconciliation | Provider plus internal reconciliation ledger |
| Experience & UI | Navigation, cards, forms, dashboards and commands | Derived projections; never transaction authority |
| Commercial | Plans, billing, usage and managed services | Subscription/billing ledger |
| Support & Operations | Tickets, SLAs, service health and incident response | Support/operations system |
| Sokoni | Merchant/product/service discovery and commerce | Marketplace catalogue/order domain |

## 2. Product mapping

| Product / initiative | Archetype(s) | Shared capability domains | Domain-specific boundary / key risk |
|---|---|---|---|
| TDBK V2 platform | Platform control plane | Identity, DNA, blueprints, capabilities, runtime, workflow, connectors, experience, billing | Shared contracts must remain industry-neutral at kernel level |
| Digital Bridge Kenya | Managed services and customer acquisition | CRM, subscriptions, connectivity, support, onboarding | Market brand and service delivery, not a second ERP |
| Sokoni | Marketplace, merchant and service discovery | Catalogue, merchant identity, search, orders, payments, logistics, messaging | Listing card must resolve to real merchant/detail/order/booking flows |
| TDBK School Pro | School / education | People, enrolment, fees, payments, communication, documents, reporting | Academic terms, guardian relationships, assessment and student-data safeguards |
| Chemist Pro / TRAIL Pharmacy | Pharmacy / retail healthcare | Catalogue, inventory, POS, suppliers, payments, finance, compliance | Regulated product, dispensing, batch/expiry and pharmacy permissions |
| Ugatuzi Hospital Management | Hospital / clinic | Patient identity, appointments, queue, clinical records, billing, pharmacy, labs | Clinical data segregation, audit, role boundaries and clinical safety |
| AquaFlow / Pride Industries | Water and manufacturing / distribution | Configurable catalogue, variants, POS, inventory, procurement, delivery, finance, WhatsApp | Product sizes/prices/variants must be dynamic; stock reservation and fulfilment lifecycle |
| DRIP DISTRICT POS | Retail / POS | Sales, inventory, payments, receipts, offline sync, reports | Reuse tested transaction engine; offline conflict and payment consistency |
| TDBK Support | Cross-product support | Knowledge, tickets, SLA, customer success, health, feedback | Tenant-scoped support access; explicit escalation and data disclosure controls |
| Autonomous Operations | Internal platform operations | Monitoring, research, workflow assistance, agent tasks | Read-only by default; durable tasks, allowlists, policy approvals and audit |

## 3. Reusable capability domains

- Core identity, organisation, memberships, roles and branch scope
- Business discovery, DNA, blueprint registry and workspace provisioning
- Customer, supplier and counterparty records
- Product/service catalogue and pricing
- Sales, quotations, invoicing, POS and receipts
- Inventory, procurement, stock movement, batches and serial tracking
- Finance, ledger, payments, reconciliation and reporting
- HR, workforce and approvals
- Documents and records
- Communications and notification preferences
- Compliance and sector-specific controls
- Analytics, dashboards and reporting
- Workflow, events and automation
- AI assistance and document intelligence
- Marketplace, merchant, orders, bookings and fulfilment
- Support, SLA and customer success
- Connectivity, device and network management

A capability can be shared only when its domain invariants genuinely match. Similar-looking features may require distinct capability contracts for school fees, clinical billing, retail sales and pharmacy dispensing.

## 4. Product integration contract

Every product integration must publish:
- Product ID, owner, repository, branch and release/version
- Business archetypes and blueprint versions supported
- Shared capability IDs and versions consumed
- Domain entities owned and data classification
- APIs, events and authentication model
- Tenant/business/branch identity mapping
- Migration and coexistence strategy
- Deployment URL/environment and secret ownership
- Test suite and latest verified result
- Operational owner, support path, monitoring and rollback

Do not allow two products to independently own the same authoritative transaction for the same business. Define a system of record per domain.

## 5. Marketplace card contract

A Sokoni card is a navigational gateway, not a static mock. At minimum:
- Stable listing and merchant IDs
- Category and listing type (product, business, service, wholesale, logistics, offer)
- Dynamic title, description, images, price/currency where applicable
- Variant and unit references
- Availability/stock or service availability
- Merchant identity and trust status
- Delivery, collection or service-area rules
- Call-to-action mapped to a real detail/order/booking/quotation flow
- Permission, analytics and audit behavior

Do not hardcode product names, images, variants, stock, prices, merchant details or availability in UI components.

## 6. First integration sequence

1. TDBK V2 owns canonical identity, DNA, blueprint and capability contracts.
2. Select one representative commerce deployment (Pride Industries/AquaFlow or DRIP POS) and map it end-to-end.
3. Select one school workflow and one pharmacy workflow to test archetype extension boundaries.
4. Define product APIs/events and data ownership before code migration.
5. Reuse capability contracts only after verifying domain invariants and acceptance evidence.
6. Add product-level deployment, support and security evidence to the portfolio register.
