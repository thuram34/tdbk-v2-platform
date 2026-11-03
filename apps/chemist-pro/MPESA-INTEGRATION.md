# Chemist Pro — M-Pesa integration

## Current implementation boundary

The UI must call the trusted TDBK API through `src/payments/mpesaClient.ts`.
The browser must never contain Daraja consumer keys, consumer secrets, passkeys, or
callback credentials. The trusted TDBK server now has guarded STK-initiation, status,
and callback routes. These routes are **not yet sufficient for live checkout** because
Chemist Pro's current UI still creates demo sales in localStorage and does not create
authoritative `chemistSales` records in Firestore.

Configure the client with `VITE_TDBK_API_BASE_URL` pointing to the HTTPS TDBK API.

## Required trusted API

### Start STK Push

`POST /api/chemist/payments/mpesa/stk-push`

Requires a valid Firebase/TDBK ID token and tenant/branch authorization. Request:
```json
{
  "tenantId": "tenant-id",
  "branchId": "branch-id",
  "saleId": "sale-id",
  "phoneNumber": "2547XXXXXXXX",
  "amountKes": 250
}
```

The implemented server route loads `/tenants/{tenantId}/chemistSales/{saleId}`, checks
its tenant and branch, and calculates the amount from `totalMinor`. It ignores the
browser's amount for financial authority. It persists a payment attempt and opaque
callback token before calling the existing TDBK M-Pesa bridge. A sale must currently
already exist with `saleId`, `tenantId`, `branchId`, `totalMinor`, `status: OPEN`, and
`paymentStatus`; no production UI sale writer has been connected yet. A pending or
ambiguous attempt must be checked/reconciled rather than blindly replayed.

### Check payment status

`GET /api/chemist/payments/:paymentId`

The implemented route requires an authenticated token and authorized tenant/branch context,
and returns only server-authoritative status. The client must never mark a sale paid
because the STK request was accepted, the customer says they paid, or a timeout
occurred.

## Required callback and settlement behavior

- Expose an HTTPS Daraja callback route on the trusted server.
- Correlate callbacks by the stored CheckoutRequestID and tenant/payment attempt.
- Parse ResultCode and CallbackMetadata defensively; persist the M-Pesa receipt,
  paid amount, payer phone, and provider timestamps when present.
- Make callback processing idempotent. Repeated callbacks must not duplicate receipts,
  ledger entries, or stock deductions.
- Confirm the callback amount matches the outstanding sale balance before marking
  the payment paid. Mismatches and unknown references go to reconciliation.
- A sale is not paid until the trusted server has processed the successful provider
  result. Initiation remains PENDING.
- Do not expose consumer credentials or passkeys to the frontend or logs.
- Do not blindly replay ambiguous provider requests; reconcile them first.

## Current blockers before live testing\n\n1. Migrate product and sale operations off browser localStorage into server-authoritative Firestore routes. The current UI still labels itself a prototype.\n2. Ensure sale creation decrements/reserves stock atomically and records line items, batch/expiry allocations, cashier, branch and totals.\n3. Exercise callback success/failure, duplicate callback, token expiry, wrong amount, unknown checkout reference, and provider-accepted/local-write-failed paths against a test Firestore driver and Daraja sandbox.\n4. Review the callback trust boundary and operational logs before production enablement. Live payments are additionally blocked unless `TDBK_ALLOW_LIVE_MPESA=true` and `TDBK_PUBLIC_API_BASE_URL` is a public HTTPS URL.\n\n## Daraja setup needed before live testing

The chemist owner must have the correct Safaricom Daraja app/environment, shortcode
(PayBill or Till according to the merchant setup), consumer key/secret, passkey,
and a publicly reachable HTTPS callback URL. Store secrets in the server's secret
manager/environment—not in Vite variables. Use Safaricom sandbox credentials for
sandbox testing, then switch to approved production credentials after end-to-end tests.

## Release gate

Do not enable live M-Pesa checkout until the trusted API routes, callback, durable
payment storage, tenant authorization, idempotency, reconciliation, and tests are
implemented and deployed. Test success, user cancellation, wrong PIN, timeout,
duplicate callback, amount mismatch, and provider-accepted/local-write-failed cases.
