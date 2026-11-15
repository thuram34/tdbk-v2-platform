# TDBK NEXUS — Dec 10 Million-First Operating Plan

**Programme:** TDBK Autonomous Cloud Economy  
**Execution deadline:** 2026-12-10  
**Near-term financial objective:** KSh 1,000,000 in collected, cleared business cash by the deadline  
**Architecture baseline:** Existing TDBK V2 platform and the 2031 Master Operating Logic  
**Status:** Execution plan; targets are not forecasts or guarantees.

## 1. Mission and priority rule

Build TDBK into a cloud-native, AI-operated, human-governed digital economic enterprise while prioritising legitimate, collectible revenue before 2026-12-10.

The Dec 10 cash objective outranks non-revenue-critical platform expansion. Do not delay sales, client delivery, invoicing or collections to build speculative tokenisation, a new cryptocurrency, a new cloud platform, or duplicate existing TDBK capabilities.

The long-term operating model remains:
- Shared TDBK control plane and tenant-safe business runtime.
- Reusable industry applications and managed services.
- Durable workflow/outbox execution and specialist AI agents.
- Commercial lifecycle, payment reconciliation and accounting controls.
- Asset/IP register, governance and eventual compliant digital-asset infrastructure.

## 2. Financial objective and measurement

Target: KSh 1,000,000 collected and cleared by 2026-12-10.

Track separately:
1. Contracted value — signed/accepted work, not cash.
2. Invoiced value — valid invoices issued, not cash.
3. Receivables — amounts due, not cash.
4. Collected cash — funds confirmed in the business account/payment settlement.
5. Net contribution — collected cash less direct delivery costs, refunds, taxes due and other obligations.

Only item 4 counts toward the KSh 1,000,000 target. Do not count proposals, verbal promises, pending M-Pesa STK requests, unverified callbacks, unpaid invoices, speculative asset appreciation, token prices, or gross sales that are not settled.

As of 2026-11-14, 26 calendar days remain to 2026-12-10. The straight-line average is approximately KSh 38,462 collected per calendar day. This is a pacing reference, not a forecast.

## 3. Revenue-first portfolio

Prioritise work that can be sold, delivered and collected within the deadline.

### A. Existing client delivery and collections
- Review every active client engagement, accepted scope, delivery status, outstanding acceptance items, invoice and balance.
- Close deliverable gaps that block client acceptance or payment.
- Issue accurate milestone/final invoices and request payment against agreed terms.
- Do not claim production readiness until live configuration, backups, security, payment and acceptance checks are evidenced.
- Do not assume any balance is due without checking the signed/accepted commercial record and payments received.

### B. Productised implementation offers
Sell a narrow, repeatable package with written scope, timeline, exclusions and payment milestones:
- SME Digital Operations Starter: POS/catalogue, inventory, sales records, customer records and basic reporting.
- Business Cloud Setup: domain, hosting, business email/WhatsApp integration planning, backups and support.
- Automation Sprint: one measurable workflow, integration and handover.
- Website/commerce launch: defined pages, lead capture, catalogue/order flow and analytics.

Use deposits before work begins and milestone payments tied to acceptance. Price each engagement from scope and delivery cost; never promise integrations or regulatory compliance that have not been tested.

### C. Managed recurring services
Offer monthly support, hosting administration, backup monitoring, updates, user support and reporting. Collect first month or agreed setup fee upfront. Keep service-level commitments realistic.

### D. International contract acquisition
Pursue narrowly matched freelance/agency work where the portfolio demonstrates capability. Prioritise funded, clearly scoped work with credible clients and platform-compliant payment. Do not buy additional lead credits unless the expected opportunity economics and available cash justify it. No job or contract win is guaranteed.

### E. Partnerships and referrals
Offer referral fees only under written terms and after customer payment is collected. Approach accountants, hardware suppliers, ICT resellers, business associations and sector consultants with a specific offer and delivery capacity.

## 4. Illustrative collection mix — planning scenario only

A possible composition of the KSh 1,000,000 target (not booked revenue and not a forecast):
- 3 implementation engagements averaging KSh 150,000 collected = KSh 450,000.
- 5 smaller digital/automation projects averaging KSh 50,000 collected = KSh 250,000.
- Managed service/setup collections from 10 customers averaging KSh 15,000 = KSh 150,000.
- Existing verified client milestones/receivables collected = KSh 150,000.

Total = KSh 1,000,000.

Replace these assumptions with actual pipeline evidence immediately. Avoid double counting the same client across categories. If this mix is not supported by current qualified opportunities, revise the mix rather than presenting it as achievable by assertion.

## 5. Daily operating cadence

Every operating day:
1. Review cash collected, bank/M-Pesa settlement evidence and remaining target.
2. Review qualified opportunities, next action, decision maker, budget, deadline and probability evidence.
3. Contact high-intent prospects and follow up on open proposals.
4. Deliver the highest-value client milestone that unlocks acceptance or payment.
5. Issue invoices and collection reminders only where contractually due.
6. Update CRM/pipeline and cash ledger.
7. Report blockers, delivery capacity and tomorrow's top three revenue actions.

Daily report fields:
- Opening collected total.
- New cleared collections.
- Refunds/reversals.
- Net collected total.
- Remaining gap to KSh 1,000,000.
- Invoices issued and due.
- Qualified pipeline (reported separately from cash).
- Proposals sent / decisions due.
- Client delivery blockers.
- Next actions with owner and due date.

## 6. TDBK NEXUS architecture — reuse before build

The existing `docs/master/TDBK_2031_MASTER_OPERATING_LOGIC.md` is the strategic baseline. This plan does not replace it.

Existing TDBK V2 source-level capabilities identified in the repository include tenant/DBK registry, provisioning, lifecycle, capability entitlements, subscription routes, identity/authority, workflow orchestration, durable runtime, event/outbox patterns and connector boundaries. Their presence in source does not prove production readiness.

Immediate architecture work should be limited to revenue-critical gaps:
- Commercial lifecycle: lead → qualified opportunity → proposal → accepted scope → invoice/subscription → verified payment → onboarding → support → renewal.
- One authoritative customer/opportunity record and one cash/receivables view.
- Reuse existing subscription, workflow, event and audit services where validated.
- Close only verified blockers in payment reconciliation, billing, entitlement and customer onboarding.
- Build read-only management projections from authoritative records.
- Keep agent tools least-privilege and tenant-scoped.

Do not create a second identity system, second workflow engine, second ledger, duplicate CRM or duplicate tenant registry.

## 7. AI workforce rollout

Start with assistive and reversible work:
- Revenue agent: prospect research, qualification drafts, proposal preparation and follow-up reminders.
- Delivery agent: backlog triage, acceptance checklist and release notes.
- Finance intelligence agent: invoice/receivable summaries and reconciliation exceptions.
- Operations agent: daily report, task routing and incident summaries.
- Quality/security reviewer: change review, test evidence and release gate checks.

AI outputs are proposals, not authoritative facts. Agents may update low-risk internal task state within permission boundaries. Human approval is required for external commitments, pricing exceptions, payment initiation, bank transfers, credit, refunds, destructive changes, production releases and legal/regulatory representations. Never let an agent fabricate payment confirmation or independently move funds.

## 8. Engineering and release rules

- Inspect existing repository implementation before editing.
- Work on short-lived branches and reviewed pull requests.
- Never commit credentials, tokens, customer secrets or production data.
- Preserve tenant isolation, branch authority, immutable audit records and durable workflow semantics.
- For payment operations, use verified provider evidence, idempotency and UNKNOWN/reconciliation handling. Never blindly replay an ambiguous non-idempotent external side effect.
- Run available tests, typecheck, lint and build; report any check that could not be executed.
- No deployment or production readiness claim without actual deployment and end-to-end evidence.
- Avoid architecture work that cannot contribute to near-term sales, delivery reliability, collection or risk reduction before Dec 10.

## 9. Existing portfolio and commercial focus

Candidate assets to assess for revenue readiness (not presumed production-ready):
- TDBK V2 platform: shared kernel and multi-tenant operating platform.
- AquaFlow / Pride Industries: water-business operations deployment; confirm current scope, outstanding acceptance items, payments and hosting status.
- Drip District POS: retail POS product; confirm current deployed state and support requirements.
- Chemist Pro / TRAIL-PHARMACY: pharmacy software; do not market as live pharmacy-grade production until its documented subscription, M-Pesa, FEFO, deployment and regulatory blockers are verified.
- Ugatuzi Hospital Management System: healthcare workflow platform; do not represent mock or unverified integrations as live SHA/M-Pesa connectivity.

Select the fastest safe-to-sell products based on real readiness, customer demand, delivery effort and payment likelihood.

## 10. Decision gates

Founder approval required for:
- Pricing exceptions and discounts beyond approved bands.
- Contractual scope, guarantees, service levels and refunds.
- New recurring obligations or vendor spend.
- External messages that make legal, security, clinical, financial or regulatory claims.
- Production deployment and irreversible data migrations.
- Any investment, token, custody, lending or regulated financial activity.

No token launch or speculative trading is part of the Dec 10 cash plan.

## 11. Definition of success by Dec 10

The financial objective is achieved only when KSh 1,000,000 of net cleared business collections attributable to the target period is evidenced and reconciled.

Separately report:
- Total collected cash.
- Direct costs and obligations.
- Net contribution.
- Contracted pipeline remaining.
- Active paying customers and recurring revenue.
- Verified product deployment status.
- Security, support and compliance exceptions.

If the cash target is missed, report the actual result without reclassifying pipeline, asset valuations or unpaid invoices as cash.

## 12. First execution sequence

1. Reconcile current client engagements, balances and acceptance blockers.
2. Build one verified prospect and opportunity pipeline.
3. Finalise three fixed-scope offers with price floors and payment milestones.
4. Begin direct sales and referral outreach immediately.
5. Deliver and invoice existing accepted work.
6. Use TDBK NEXUS engineering only to remove proven revenue, delivery, collection or operational-control blockers.
7. Review the cash scorecard every day until 2026-12-10.
