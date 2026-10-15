# Chemist Pro — M-Pesa integration

## Current implementation boundary

The UI must call the trusted TDBK API through `src/payments/mpesaClient.ts`.
The browser must never contain Daraja consumer keys, consumer secrets, passkeys, or
callback credentials. The client currently defines the safe API contract; this
does **not** mean the API routes or callback processing are deployed yet.

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

The server must load the persisted sale and calculate its payable balance itself. It
must not trust a browser-provided amount as authoritative. It must persist a
unique payment attempt before calling Daraja and return a pending state with the
provider checkout reference. A retry must not silently issue a second STK Push.

### Check payment status

`GET /api/chemist/payments/:paymentId`

Returns only server-authoritative status. The client must never mark a sale paid
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

## Daraja setup needed before live testing

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
