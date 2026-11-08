# TDBK V2 — Engineering Implementation Ledger

**Mandate:** ALL scope; execute in existing repositories and integrations.  
**Ledger baseline:** 2026-11-09  
**TDBK repository:** `thuram34/tdbk-v2-platform`  
**Rule:** Catalogue metadata is not proof of production implementation. A capability is complete only when its runtime path, tenant/role authorization, persistence, validation, auditability, failure/retry behavior, tests, UI journey and deployment evidence are verified as applicable.

## 1. Executive baseline

The source catalogue contains **83 capability records**: 10 labelled IMPLEMENTED, 28 labelled DEFINED, and 45 labelled SPECIFIED. These are source declarations, not audited production completion counts.

Audit classification used in this ledger:
- **Candidate implementation** — catalogue says IMPLEMENTED; must still be tied to source modules, API/runtime path, tests and deployed evidence.
- **Not verified end-to-end** — catalogue says DEFINED or SPECIFIED; do not represent as shipped functionality until evidence is attached.
- **External-provider blocked** — provider credentials, certification, UAT, callback authentication or live account verification are absent; never infer readiness from adapter code or CI.

## 2. Capability-by-capability register

| # | Capability ID | Capability | Domain | Catalogue declaration | Engineering audit verdict |
|---:|---|---|---|---|---|
| 1 | `core_identity` | Business Identity Primitives | CORE | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 2 | `core_organization` | Tenant Governance & RBAC | CORE | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 3 | `branch_multi_hq` | Multi-Branch & HQ Management | BRANCHES | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 4 | `finance_ledger_core` | Authoritative Financial Ledger | FINANCE | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 5 | `accounting_reports` | Financial Statements & Tax Reporting | ACCOUNTING | DEFINED | Not verified as an end-to-end runtime capability |
| 6 | `customer_directory` | Customer & Client Registry | CUSTOMERS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 7 | `crm_contacts` | Advanced CRM & Pipeline Tracking | CRM | SPECIFIED | Not verified as an end-to-end runtime capability |
| 8 | `supplier_registry` | Supplier & Vendor Directory | SUPPLIERS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 9 | `inventory_foundation` | Stock & Product Catalog | INVENTORY | SPECIFIED | Not verified as an end-to-end runtime capability |
| 10 | `sales_counter` | Over-the-Counter Sales & Invoicing | SALES | SPECIFIED | Not verified as an end-to-end runtime capability |
| 11 | `pos_register` | Point of Sale (POS) Cashier Register | POS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 12 | `purchase_orders` | Purchase Orders & Receiving | PURCHASING | SPECIFIED | Not verified as an end-to-end runtime capability |
| 13 | `supplier_invoices` | Supplier Invoices & Accounts Payable | PURCHASING | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 14 | `staff_foundation` | Employee Directory & Roles | STAFF | SPECIFIED | Not verified as an end-to-end runtime capability |
| 15 | `payroll_pro` | Statutory Kenyan Payroll & Payslips | PAYROLL | DEFINED | Not verified as an end-to-end runtime capability |
| 16 | `mpesa_bridge` | M-Pesa Daraja Payment Bridge | M_PESA | SPECIFIED | Not verified as an end-to-end runtime capability |
| 17 | `etims_compliance` | KRA eTIMS Tax Invoicing Bridge | ETIMS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 18 | `whatsapp_automation` | WhatsApp Business Messaging | WHATSAPP | SPECIFIED | Not verified as an end-to-end runtime capability |
| 19 | `email_dispatch` | Corporate Email Dispatch | EMAIL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 20 | `school_academics` | Student Admission & Academic Records | SCHOOL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 21 | `school_fee_structure` | Fee Structure & Invoicing | SCHOOL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 22 | `school_transport` | School Bus & Transport Tracking | SCHOOL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 23 | `school_hostel` | Boarding & Hostel Allocation | SCHOOL | DEFINED | Not verified as an end-to-end runtime capability |
| 24 | `logistics_dispatch` | Cargo Waybill & Consignment Dispatch | LOGISTICS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 25 | `fleet_tracking` | Fleet Maintenance & Driver Assignment | FLEET | DEFINED | Not verified as an end-to-end runtime capability |
| 26 | `healthcare_triage` | Patient Triage & Visit Management | HEALTHCARE | DEFINED | Not verified as an end-to-end runtime capability |
| 27 | `hotel_reservations` | Room Reservation & Check-In | HOTEL | DEFINED | Not verified as an end-to-end runtime capability |
| 28 | `ai_business_insights` | TDBK AI Financial & Operational Insights | AI | DEFINED | Not verified as an end-to-end runtime capability |
| 29 | `student_records` | Student Profiles & Bio-Data | SCHOOL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 30 | `fee_management` | Fee Ledger & Invoicing | SCHOOL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 31 | `mpesa_reconciliation` | M-Pesa Fee Collection Bridge | FINANCE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 32 | `cbc_grading` | CBC & Academic Assessment | SCHOOL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 33 | `smart_classroom` | TDBK Smart Classroom Interactive Surface | SCHOOL | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 34 | `parent_portal` | Parent Communication & SMS | COMMUNICATION | DEFINED | Not verified as an end-to-end runtime capability |
| 35 | `transport_tracking` | School Bus & Transport | OPERATIONS | DEFINED | Not verified as an end-to-end runtime capability |
| 36 | `hostel_management` | Boarding & Hostel Allocation | OPERATIONS | DEFINED | Not verified as an end-to-end runtime capability |
| 37 | `library_sys` | Library & Textbook Tracking | OPERATIONS | DEFINED | Not verified as an end-to-end runtime capability |
| 38 | `counter_pos` | Hardware POS Counter | SALES | SPECIFIED | Not verified as an end-to-end runtime capability |
| 39 | `stock_control` | Yard & Store Stock Management | INVENTORY | SPECIFIED | Not verified as an end-to-end runtime capability |
| 40 | `quotations` | Contractor Quotations & Proformas | SALES | SPECIFIED | Not verified as an end-to-end runtime capability |
| 41 | `mpesa_till` | M-Pesa Till & Paybill Integration | FINANCE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 42 | `etims_tax` | eTIMS KRA Tax Invoicing | FINANCE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 43 | `supplier_purchase` | Supplier LPO & Stock Intake | PURCHASING | DEFINED | Not verified as an end-to-end runtime capability |
| 44 | `serial_tracking` | Tool & Equipment Serial Tracking | INVENTORY | DEFINED | Not verified as an end-to-end runtime capability |
| 45 | `barcode_pos` | Barcode Retail POS Terminal | POS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 46 | `sku_inventory` | SKU Stock Control | INVENTORY | SPECIFIED | Not verified as an end-to-end runtime capability |
| 47 | `till_reconciliation` | Till Shift & Cashier Audit | FINANCE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 48 | `expiry_alerts` | FMCG Expiry Date Tracking | INVENTORY | DEFINED | Not verified as an end-to-end runtime capability |
| 49 | `warranty_pos` | Electronics Sales & Warranty POS | SALES | SPECIFIED | Not verified as an end-to-end runtime capability |
| 50 | `imei_serial_tracking` | IMEI & Serial Number Engine | INVENTORY | SPECIFIED | Not verified as an end-to-end runtime capability |
| 51 | `repair_job_cards` | Repair Workshop Job Cards | OPERATIONS | DEFINED | Not verified as an end-to-end runtime capability |
| 52 | `installment_tracking` | Lipa Mdogo Mdogo / Layby Tracker | FINANCE | DEFINED | Not verified as an end-to-end runtime capability |
| 53 | `waybill_booking` | Waybill & Cargo Booking | LOGISTICS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 54 | `pod_tracking` | Proof of Delivery (POD) Engine | LOGISTICS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 55 | `driver_assignment` | Fleet & Driver Dispatch | LOGISTICS | SPECIFIED | Not verified as an end-to-end runtime capability |
| 56 | `cargo_manifest` | Truck Cargo Manifest Generator | LOGISTICS | DEFINED | Not verified as an end-to-end runtime capability |
| 57 | `fuel_mileage_logs` | Vehicle Fuel & Mileage Tracker | FLEET | DEFINED | Not verified as an end-to-end runtime capability |
| 58 | `corporate_billing` | Corporate Account Monthly Invoicing | FINANCE | DEFINED | Not verified as an end-to-end runtime capability |
| 59 | `patient_queue` | Patient Registration & Queueing | HEALTHCARE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 60 | `emr_consultation` | Consultation & EMR | HEALTHCARE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 61 | `pharmacy_dispensing` | Pharmacy & Drug Stock | HEALTHCARE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 62 | `medical_billing` | Medical Billing & SHA | HEALTHCARE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 63 | `vitals_triage` | Nurse Triage Vitals Log | HEALTHCARE | DEFINED | Not verified as an end-to-end runtime capability |
| 64 | `e_prescriptions` | E-Prescription Generator | HEALTHCARE | DEFINED | Not verified as an end-to-end runtime capability |
| 65 | `sha_insurance` | SHA / Insurance Claim Tracking | HEALTHCARE | DEFINED | Not verified as an end-to-end runtime capability |
| 66 | `room_reservations` | Room Reservations & Booking Grid | HOTEL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 67 | `checkin_checkout` | Guest Check-In / Out | HOTEL | SPECIFIED | Not verified as an end-to-end runtime capability |
| 68 | `guest_folio_billing` | Guest Folios & Billing | FINANCE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 69 | `housekeeping_status` | Housekeeping Room Status | HOTEL | DEFINED | Not verified as an end-to-end runtime capability |
| 70 | `room_folio_pos` | Bar & Restaurant Room Posting POS | HOTEL | DEFINED | Not verified as an end-to-end runtime capability |
| 71 | `salon_pos` | Beauty Service Checkout | BEAUTY | SPECIFIED | Not verified as an end-to-end runtime capability |
| 72 | `stylist_commission` | Stylist Commissions | FINANCE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 73 | `appointment_booking` | Client Appointments | BEAUTY | SPECIFIED | Not verified as an end-to-end runtime capability |
| 74 | `salon_product_inventory` | Salon Usage & Retail Stock | INVENTORY | DEFINED | Not verified as an end-to-end runtime capability |
| 75 | `case_management` | Client Case & Matter Manager | PROFESSIONAL_SERVICES | SPECIFIED | Not verified as an end-to-end runtime capability |
| 76 | `fee_note_invoicing` | Fee Note & Professional Billing | FINANCE | SPECIFIED | Not verified as an end-to-end runtime capability |
| 77 | `time_billing` | Time Sheet & Hourly Billing | PROFESSIONAL_SERVICES | DEFINED | Not verified as an end-to-end runtime capability |
| 78 | `retainer_ledger` | Client Retainer Deposit Ledger | FINANCE | DEFINED | Not verified as an end-to-end runtime capability |
| 79 | `doc_management` | Client Document Repository | DOCUMENTS | DEFINED | Not verified as an end-to-end runtime capability |
| 80 | `doc_ingestion_core` | Authoritative Document Ingestion & Storage Vault | DOCUMENTS | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 81 | `smart_doc_extraction` | Smart Document Classification & Structured Extraction | DOCUMENTS | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 82 | `ai_assistant_core` | DBK AI Copilot & Business Assistant | AI | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |
| 83 | `ai_invoice_reconciliation` | AI Automated Invoice & Payment Reconciliation | AI | IMPLEMENTED | Candidate implementation; capability-specific acceptance evidence still required |

## 3. Cross-repository product inventory

| Repository | Role in ecosystem | Evidence observed | Required disposition |
|---|---|---|---|
| `thuram34/tdbk-v2-platform` | Multi-tenant kernel, capability/entitlement engine, bridge orchestration, experience and business workflows | 83-entry capability catalogue; 9 sector blueprints previously inventoried; CI pipeline includes typecheck, lint, capability gate, flow gate, tests, build and Docker validation | Canonical platform. Complete capability runtime proof and sector acceptance. |
| `thuram34/my-home-electronics` | Electronics retail application | Latest visible commit 2026-10-16; README.md path not found through repository contents API | Inspect repository root, source, deployment and integration state; map reusable electronics workflows into TDBK without destructive migration. |
| `thuram34/ugatuzi-hospital-management-system` | Hospital operations system | README documents patients, appointments, triage, encounters, admissions, lab, pharmacy, procurement, billing, M-Pesa and SHA boundaries; README explicitly describes mock M-Pesa frontend and SHA development adapter | Audit every claimed workflow and security boundary; distinguish live provider paths from mocks; determine integration versus standalone deployment. |
| `thuram34/Sajid-intergrayed` | Separate business application | Latest visible commit 2026-09-24 includes password migration/strength and authenticated audit actor changes; README.md path not found | Inspect source, deployment and business purpose; map relevant shared platform capabilities. |
| `thuram34/chemist-pro` | Pharmacy POS application | README confirms tenant-scoped product/sales API, cash POS, stock movement audit and initial batch/expiry metadata; explicitly lists subscription, M-Pesa, FEFO/returns/receiving, production deployment and eTIMS blockers | Keep isolated Firebase project; complete pharmacy-grade lot/FEFO, Daraja lifecycle, subscription and deployment gates before live trade. |
| `thuram34/TRAIL-PHARMACY` | Separate pharmacy operating application | README describes Firestore, auth, FEFO, M-Pesa and eTIMS readiness; claims require code-level proof; recent commits include PWA/service-worker work | Reconcile overlapping pharmacy products, verify code and deployment, remove unsupported compliance claims, decide canonical role without deleting either product. |
| `thuram34/Aquaflow` | Water-business operating platform | Latest visible commit 2026-11-08 adds staff workspace authentication and database fields; README.md path not found | Continue implementation from existing branch; audit orders, deliveries, routes, stock, invoicing, payments, customer ledger, staff permissions and deployment. |

## 4. Provider and integration ledger

| Integration | Current code-level finding | Current safe status | Required engineering evidence |
|---|---|---|---|
| Safaricom M-Pesa / Daraja in TDBK | STK_PUSH is the only advertised registry operation. Adapter query/reconciliation branches return HTTP 501. | Partial; not production-certified | Real Daraja credentials and shortcode; authenticated callback contract; authoritative STK query; C2B validation; idempotent posting; reversals/refunds; settlement reconciliation; sandbox and production evidence. |
| KRA eTIMS VSCU in TDBK | Adapter contains 21 operations; registry was aligned to expose those operations. Callback authentication is deliberately fail-closed until authoritative KRA contract is implemented. | Adapter/contract work present; external certification not established | KRA-issued credentials/device registration; authoritative API/version contract; secure transport and callback/authentication contract; invoice lifecycle tests; fiscal receipt verification; production certification. |
| WhatsApp Cloud API | Adapter/bootstrap exists; live provider account/configuration not proven | Not verified live | Meta app/business verification, webhook challenge/signature validation, template approval, delivery receipts, opt-in and tenant isolation tests. |
| Email/SMS/Bank | Adapter boundaries exist in code search; provider availability and production configuration not proven | Not verified live | Provider credentials, authenticated callbacks, delivery/settlement verification, retry and idempotency tests. |
| Ugatuzi M-Pesa / SHA | README says M-Pesa defaults to mock adapter and SHA uses deterministic development adapter | Development boundary only | Provider onboarding, credentials, UAT and signed production evidence. |
| Chemist Pro M-Pesa/eTIMS | README explicitly lists these as incomplete | Not implemented/verified for production | Implement and test full lifecycle before live pharmacy use. |
| TRAIL-PHARMACY M-Pesa/eTIMS | README makes compliance/readiness claims; no source audit yet | Unverified claim | Verify actual adapter, server trust boundary, callback auth, reconciliation and KRA evidence. |

## 5. Security, reliability and release gates

1. **Tenant isolation:** prove every read/write/query is tenant-scoped; negative tests for cross-tenant and cross-branch access.
2. **Identity/RBAC:** canonical claims, least-privilege service principals, route-by-route authorization inventory, role-negative tests.
3. **Financial truth:** provider acceptance is not settlement; only authoritative status/reconciliation can post financial transactions. Test duplicate callbacks, replay, amount mismatch, wrong shortcode, timeout, reversal and uncertain outcomes.
4. **Provider security:** no caller-supplied signature string as authentication; fail closed until provider-specific cryptographic/authenticated contracts are configured.
5. **Data integrity:** immutable financial records, idempotency, audit trails, transactional outbox, retries and recovery.
6. **Sector acceptance:** complete workflows tested using realistic but synthetic tenant fixtures; verify hardware, school, healthcare, pharmacy, retail, logistics, hospitality, beauty, professional services and water operations.
7. **Deployment:** CI success, preview readiness, production build/image, configured secrets, live health checks, smoke tests, rollback plan and evidence of deployed commit. CI or preview alone is not production deployment.
8. **Commercial operation:** tenant onboarding, pricing/entitlements, payment activation, support/admin controls, monitoring and customer-ready journeys.

## 6. Work already merged during this execution

- PR #610 — tenant-admin authorization reads canonical `roles[]` claim.
- PR #611 — CircleCI 2.1 verification configuration restored.
- PR #638 — Cloud Build image project substitution corrected.
- PR #639 — autonomous CI failure tracking deduplicated.
- PR #640 — unauthenticated eTIMS callback path fails closed; merged as `f16d05fcf6a1719c3c6d6136b4d70f34d7588c5e`.
- PR #641 — eTIMS registry aligned to adapter operations and M-Pesa limited to implemented STK_PUSH; merged as `a1b243c8d11fdafa13d37e42348d7824884102f6`.

PR #640 and #641 each passed the complete GitHub verification job: TypeScript typecheck, lint, capability gate, flow gate, test suite, production build and Docker image validation. Their Vercel preview comments reported Ready. These facts do not establish live KRA/Daraja certification or production rollout.

## 7. Open engineering work and rules of execution

- Reconcile every open TDBK pull request against current main; merge only focused, current, passing changes. Recover unique work from divergent PRs by cherry-pick/reimplementation, not wholesale merge.
- Finish the Global Income Engine branch only after real provider boundaries, credential configuration, evidence capture and approval workflows are tested.
- Audit and complete the Experience Studio branch; do not confuse a draft branch with deployed capability.
- Build the missing hardware operating runtime (SKU/catalogue, stock ledger, GRN/LPO, POS, quotations, serial/warranty, till reconciliation) against the existing TDBK kernel.
- Expand school operations beyond the Grade 5 CBC seed model: admissions, student records, classes, attendance, timetable, assessments, fee ledger, parent communication, transport, hostel and library.
- Reconcile the standalone sector repositories and avoid duplicate competing implementations.
- For each capability, update this ledger with source paths, test names/results, PR/commit, preview and production evidence. Do not downgrade a blocker by editing catalogue metadata.

## 8. Definition of done

A capability moves to **VERIFIED** only when:
- its source path and public/runtime entry point are identified;
- positive and negative authorization tests pass;
- persistence and audit behavior are verified;
- business invariants and failure/recovery paths are tested;
- the complete user journey is exercised;
- the deployed artifact and live smoke test are tied to a commit SHA;
- external provider certification is attached where applicable.

**Current overall release status: NOT DECLARED COMPLETE.** This ledger is the working register and must be updated as engineering evidence is produced.


## 9. Runtime evidence addendum — 2026-11-09

The following source-level runtime paths were inspected after the initial register was committed. These are stronger than catalogue declarations, but they do not independently prove complete sector workflows or production operation.

| Capability / domain | Runtime evidence inspected | Verified boundary | Remaining acceptance work |
|---|---|---|---|
| `sales_counter` | `src/business/sales/saleTransactionService.ts`; `src/business/sales/saleTransactionService.test.ts` | Authenticated branch-scoped sale command; RBAC and capability gate; transactional stock decrement; sale/outbox transaction; deterministic sale ID idempotency | Verify full payment lifecycle, returns/voids, discounts/approvals, tax/eTIMS posting, shift controls and deployed journey. |
| `stock_control` | `src/business/sales/saleTransactionService.ts`; `src/experience/entity/entityEngine.ts`; `src/experience/registry/viewRegistry.ts` | Stock entity is used by the transactional sale path and has a workspace view/seed data | No complete stock command service for all adjustments/transfers/counts/receiving was evidenced in this inspection; implement and test append-only movement ledger, reservations, reorder and multi-branch transfers. |
| `supplier_invoices` | `src/business/procurement/supplierInvoiceService.ts` | Tenant/branch-scoped invoice submission, RBAC, capability gate, transaction, duplicate suppression, PO/GRN reference checks, match/dispute state and outbox event | Verify PO/GRN creation and quantity/price line matching, approval/payment lifecycle, ledger posting, supplier statements and negative tests. |
| `student_records` | `src/experience/entity/entityEngine.ts`; `src/coherence/contributionDispatcher.ts`; `src/experience/registry/viewRegistry.ts` | Student entity seed/persistence and contribution flow references exist | Complete admission, guardian consent/identity, class promotion, transfers, attendance linkage, data privacy and school-year lifecycle. |
| `fee_management` | `src/coherence/contributionDispatcher.ts`; `src/experience/registry/viewRegistry.ts` | Fee-related contribution record and workspace navigation exist | Build authoritative fee structures, student obligations, receipts, arrears/credit notes, reconciliation, approval and audit lifecycle. |
| `smart_classroom` | `src/components/classroom/SmartClassroomView.tsx` | A classroom experience component exists | Verify tenant isolation, lesson/session persistence, teacher/student roles, attendance/content workflows and accessibility in a live journey. |

### Provider adapter facts confirmed from current main source

- `src/orchestration/bridge/registry.ts` advertises M-Pesa `STK_PUSH` only. Its side-effect flags explicitly say provider idempotency and provider reconciliation are false.
- `src/orchestration/bridge/adapters/etimsBridge.ts` uses tenant-scoped connector configuration, Secret Manager references and the VSCU operation mapping. It does not claim provider idempotency or provider reconciliation.
- The registry now exposes 21 eTIMS operations after PR #641. This is an adapter contract inventory, not proof that every KRA endpoint is accepted by the live taxpayer device.
- eTIMS callback verification is intentionally disabled after PR #640 until a genuine KRA callback authentication contract is available.
- The bridge registry marks email, SMS and generic bank as MOCK and all bridge health defaults as UNAVAILABLE. Do not expose these as live integrations.

### Additional merged engineering

- PR #612 merged as `2a9c96e285cdddb7338ab681567d7107ff721f66`: Global Income Engine foundation. Its GitHub CI run 42527682553 passed all 11 verification steps, including Docker image validation. Its Vercel preview comment reported Ready. The merged scope is a tenant-scoped opportunity/application/approval foundation and control panel; provider discovery, app-level Gmail/HubSpot OAuth and marketplace submission remain unconfigured and are not represented as live automation.

### Current PR disposition

- #612 merged after its full verification run.
- #640 and #641 merged after full verification runs.
- #625 Experience Studio remains draft: its branch has a Vercel preview that reported Ready, but a later Vercel deployment attempt was blocked by the account's daily deployment limit. It also explicitly excludes workflow resume across devices, conditional branches, SLA timers, notifications/escalation and arbitrary screen layouts. Do not merge until current-base CI and deployment evidence are re-established.
- #609, #608, #605, #598, #593, #567, #542, #537, #390, #291, #229, #225, #222, #224, #161, #131 and #6 remain open and require individual diff reconciliation. Their presence is not evidence of implementation in main.
