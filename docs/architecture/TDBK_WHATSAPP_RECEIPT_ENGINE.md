# TDBK WhatsApp Receipt & Customer Notification Engine

**Status:** Implementation specification and integration work package  
**Canonical repository:** `thuram34/tdbk-v2-platform`  
**Branch:** `feat/whatsapp-receipt-engine`  
**Scope:** Shared, tenant-aware receipt delivery for every TDBK industry partition.

## 1. Product decision

Build one platform notification capability, not one WhatsApp implementation per industry.

The first release is **WhatsApp receipt summary + branded PDF receipt**, with the same receipt available in the tenant portal. The engine is reusable by Pride Industries, Chemist Pro, School Pro, Hardware Pro, Logistics and future partitions.

WhatsApp is a delivery channel, not the receipt ledger. The authoritative receipt remains a durable TDBK business record and must remain accessible if WhatsApp is unavailable.

## 2. Existing source foundations inspected

The following files already exist on the repository's `main` branch:

- `src/orchestration/bridge/adapters/whatsappBridge.ts`: Meta Cloud API transport, tenant-scoped connector lookup, secret references, template/text sending, outbound idempotency guard, webhook challenge and HMAC verification primitives.
- `src/persistence/firestore/repositories/receiptRepository.ts`: tenant-scoped receipt persistence and atomic receipt-created outbox write with identity checks.
- `src/orchestration/events/eventBus.ts`: payment, receipt, document and notification event contracts.
- `src/business/sales/saleTransactionService.ts`: tenant/branch-authorized sale transaction and sale-completed outbox event.
- `src/orchestration/tests/phase3TestRunner.ts`: bridge/workflow test harness.
- `docs/engineering/TDBK_IMPLEMENTATION_LEDGER.md`: current evidence ledger.

These foundations do **not** prove that the complete receipt-to-WhatsApp delivery path is wired or production-ready. The current engineering ledger explicitly records WhatsApp Cloud API as not verified live and calls out provider credentials, webhook, template, delivery, opt-in and tenant-isolation evidence as outstanding.

## 3. Non-negotiable business and security invariants

1. **No false payment confirmation.** A finalized payment receipt is issued only after the authoritative payment/ledger workflow confirms and posts the payment. Pending, failed or unverified callbacks cannot generate a paid receipt.
2. **Credit is not cash.** A credit sale may generate an invoice or sale acknowledgement, but must not be labelled PAID or produce a paid receipt.
3. **Receipt persistence precedes delivery.** Persist the authoritative receipt and its outbox event durably before any external WhatsApp call.
4. **Delivery failure never reverses a transaction.** Printer, PDF delivery, WhatsApp or network failures cannot undo a committed sale/payment.
5. **Tenant isolation is server-enforced.** Resolve tenant, branch, receipt, branding, connector and recipient from authenticated/authoritative server context. Never trust a browser-supplied tenant ID or receipt ownership assertion.
6. **Customer choice.** WhatsApp is optional. Store explicit channel preference and consent evidence; provide portal, print, email or SMS alternatives where configured. Respect opt-out.
7. **Provider secrets stay server-side.** Use existing connector secret references/Secret Manager resolution; never expose tokens or app secrets to the browser or logs.
8. **No duplicate sends on retries.** Use stable tenant-scoped delivery identity and durable outbox state. Where provider-side idempotency is unavailable, an ambiguous provider timeout must enter reconciliation rather than blind resend.
9. **A receipt is immutable once issued.** Corrections use a reversal/credit-note/replacement lifecycle with links to the original, not silent mutation.
10. **Privacy by default.** Message body contains only a concise summary. PDF access uses an opaque, expiring, revocable, tenant-bound link or an approved attachment flow; do not expose predictable Firestore paths or public bucket objects.

## 4. Canonical event and workflow

### Payment-confirmed receipt

```text
Authoritative payment callback / cash confirmation
  -> validate provider callback and transaction identity
  -> reconcile and post ledger entry
  -> mark invoice/payment as confirmed
  -> create immutable tenant-scoped receipt
  -> atomically write receipt.created.v1 to durable outbox
  -> receipt document renderer creates branded PDF
  -> notification policy evaluates customer preference + consent
  -> enqueue WhatsApp delivery using approved template
  -> WhatsApp Cloud API accepts message (wamid)
  -> persist provider reference and ACCEPTED status
  -> delivery webhook updates SENT / DELIVERED / READ / FAILED
  -> portal timeline and tenant reporting project current state
```

### Cash and non-payment flows

Cash transactions may be marked paid only after the cashier's authorized cash-tender workflow commits the cash ledger entry. Credit sales produce an invoice/credit acknowledgement and must not be represented as a paid receipt. Pending M-Pesa STK requests produce a payment-pending message only if explicitly enabled; never a receipt marked paid.

## 5. Shared contracts

### Receipt record

Minimum fields:

- `receiptId`, `tenantId`, `branchId`, `transactionId`, `invoiceId` (when applicable)
- `receiptNumber`, `issuedAt`, `currency`, `subtotal`, `tax`, `total`
- `paymentStatus`, `paymentMethod`, `providerReference` (when applicable)
- `customerId`, normalized customer phone and delivery preference reference
- immutable line snapshots: description, SKU/service code, quantity, unit price, discounts and line total
- tenant branding snapshot and document version
- PDF document reference/checksum, not a public storage URL

Do not hardcode products, sizes, variants, prices, tax rules, logos, or tenant contact details. Resolve these from the tenant's authoritative catalogue and configuration at transaction time, then snapshot the values onto the receipt.

### Delivery record

Use a distinct durable record per receipt/channel/recipient:

- `deliveryId`, `tenantId`, `receiptId`, `channel`, `recipientRef`
- `status`: QUEUED | PROCESSING | ACCEPTED | SENT | DELIVERED | READ | RETRY_WAIT | FAILED | RECONCILIATION_REQUIRED | CANCELLED
- `attemptCount`, `nextAttemptAt`, `leaseUntil`, `lastErrorCode`
- `provider`, `providerMessageId`, `templateName`, `templateVersion`
- `consentEvidenceId`, `createdAt`, `updatedAt`, `correlationId`

Suggested stable identity: `receipt:{receiptId}:whatsapp:{normalizedRecipient}:v1`, namespaced by tenant in persistence.

### WhatsApp template

Create and obtain Meta approval for a utility template (example name: `tdbk_transaction_receipt_v1`). Suggested body:

```text
Hello {{1}}, your receipt {{2}} from {{3}} is ready.
Total: {{4}} {{5}}
View your secure receipt: {{6}}
Thank you.
```

Template name, language, parameter ordering and approved content must be stored in tenant/platform configuration and validated against the approved Meta template. Do not assume approval or send free-form business-initiated text outside the applicable customer-service window.

## 6. Worker and retry policy

- Consume the durable Firestore outbox using a worker/Cloud Tasks or Pub/Sub delivery mechanism; never hold a POS request open while Meta is called.
- Claim work with a transactionally persisted lease and attempt counter.
- Retry transient network errors, rate limits and provider 5xx responses with exponential backoff and jitter, bounded by a configured maximum.
- Treat invalid recipient, revoked consent, rejected template and invalid credentials as non-retryable until configuration/user action changes.
- On timeout after request transmission without a conclusive provider response, mark RECONCILIATION_REQUIRED. Do not blindly resend.
- Persist every attempt and provider response classification without storing access tokens or unnecessary personal data.
- Keep a dead-letter/review queue and expose safe retry controls to authorized tenant administrators.
- A worker crash must not lose a committed receipt or its pending notification.

## 7. Webhook and delivery reconciliation

- GET webhook challenge must validate the configured verify token.
- POST webhook must verify `X-Hub-Signature-256` against the exact raw request body using the Meta app secret before processing.
- Resolve the WABA/phone-number-to-tenant mapping from trusted connector configuration. Do not trust tenant IDs in webhook payloads.
- Persist webhook event IDs/provider message IDs idempotently; handle duplicate and out-of-order status events.
- Update delivery status monotonically where possible; retain the complete provider event history.
- Validate webhook replay handling and reject forged or unmapped provider callbacks.
- The current adapter has challenge/HMAC primitives; production routing, account mapping and callback evidence still require explicit tests and deployment verification.

## 8. Tenant control panel

Provide tenant-level configuration with platform defaults and explicit overrides:

- Enable/disable automatic WhatsApp receipt delivery.
- Business display name, logo, contacts, address, receipt numbering and document theme.
- Default channel and language; English, Kiswahili or both where approved templates exist.
- Consent capture/source, timestamp, policy version and opt-out status.
- Receipt format: WhatsApp summary + PDF link (initial default), PDF attachment where supported, or message-only.
- Payment trigger policy: confirmed payment only for paid receipts; separate invoice/credit acknowledgement.
- Approved template and version, phone-number connection, delivery health and test-send controls.
- Retry/DLQ visibility, delivery metrics and audit history.

Platform Super Admin manages capability availability, provider onboarding and global policy. Tenant admins manage only their own branding, preferences and authorized connector settings. Tenant users must not be able to alter provider secrets or bypass consent/payment policy.

## 9. API surface (target)

Use the repository's established authenticated command/API conventions. Proposed operations:

- `POST /api/receipts/:receiptId/deliveries` — request a permitted delivery; server checks tenant ownership, status, consent and idempotency.
- `GET /api/receipts/:receiptId` — retrieve authorized receipt projection.
- `GET /api/receipts/:receiptId/deliveries` — inspect authorized delivery status.
- `POST /api/integrations/whatsapp/webhook` — Meta callback endpoint with raw-body signature verification.
- `GET /api/integrations/whatsapp/webhook` — Meta verification challenge.
- `POST /api/admin/notifications/:deliveryId/retry` — authorized retry after policy checks.

These are target contracts, not claims that routes currently exist. Reuse existing route registration, SecurityContext, RBAC, capability checks and connector boundaries; do not create a parallel authentication system.

## 10. Acceptance gates

| Gate | Required evidence | Pass condition |
|---|---|---|
| A. Receipt correctness | Payment/cash/credit integration tests | Paid receipt only after posted confirmation; credit never labelled paid |
| B. Atomic persistence | Firestore transaction tests | Receipt + receipt-created outbox commit together; duplicate event creates no duplicate receipt |
| C. Tenant security | Cross-tenant negative tests | Cannot read, render or deliver another tenant's receipt |
| D. Consent | Opt-in/opt-out tests | No WhatsApp dispatch without valid consent and customer-selected WhatsApp preference |
| E. PDF | Renderer/storage tests | Correct tenant branding, immutable line/tax/total snapshot, secure access and checksum |
| F. Queue recovery | Crash, lease-expiry, retry and DLQ tests | No lost jobs; no duplicate provider sends; ambiguous timeout reconciled |
| G. Meta transport | Sandbox test WABA and approved template | Real provider wamid captured; provider rejection classified correctly |
| H. Webhook | Signature, forged callback, duplicate/out-of-order tests | Authentic callback updates the correct tenant delivery only |
| I. UI | Cashier + tenant-admin + customer journey | Cashier can see queued/sent status; admin can configure and troubleshoot; customer can retrieve receipt |
| J. Production | Secret Manager, deployed revision, dated smoke evidence | Provider account, webhook, templates, worker, storage and monitoring verified on deployed commit |

## 11. Implementation sequence

1. Trace and test the existing payment-to-receipt path; align the POS sale outbox with authoritative payment and receipt creation without weakening payment rules.
2. Add/complete immutable receipt document rendering and secure tenant-bound storage.
3. Add durable notification delivery records, transactional outbox consumer, lease/retry/DLQ and idempotent reconciliation.
4. Connect the worker to the existing WhatsApp bridge using approved utility templates.
5. Complete tenant mapping, webhook signature verification and delivery status reconciliation.
6. Add tenant settings, consent/preferences, admin visibility and customer receipt retrieval.
7. Run typecheck, lint, focused tests, full tests and build; fix failures before merge.
8. Perform Meta sandbox end-to-end tests; production enablement remains blocked until verified provider credentials, approved template, webhook, deployment and consent evidence exist.

## 12. Explicit non-goals for the first release

- No broadcast marketing or unsolicited group messaging.
- No assumption that WhatsApp delivery is guaranteed.
- No sending paid receipts for pending, failed or unverified payments.
- No client-side PDF generation as the authoritative receipt.
- No direct writes from the browser to receipt or delivery status.
- No hardcoded tenant branding, product catalogue, prices, tax or message templates.
- No automatic production activation based solely on code merge.

## 13. Completion reporting

Report each gate as **PASS**, **FAIL** or **BLOCKED**, with source/test/deployment evidence. Keep code implementation, provider sandbox verification and production activation as separate statuses. Never describe the engine as live until the production gate is evidenced.
