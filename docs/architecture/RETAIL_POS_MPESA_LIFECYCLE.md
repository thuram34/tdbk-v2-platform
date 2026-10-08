# Retail POS → M-Pesa End-to-End Operation

## Status
**IMPLEMENTED — RELEASE-GATED**

## Canonical flow
1. Cashier/owner executes a completed POS sale.
2. Sale transaction atomically persists sale + stock decrement + `pos.sale.completed.v1`.
3. Payment command validates tenant, branch, RBAC, sale state and `capability_payments`.
4. A durable `payment_intent` is created for the sale before provider execution.
5. TDBK calls the authoritative M-Pesa bridge for STK Push.
6. STK acceptance creates durable PENDING financial state; it is **not** treated as paid.
7. Safaricom callback is correlated to the durable transaction and idempotency boundary.
8. Successful callback posts the financial transaction and emits `payment.confirmed.v1`.
9. POS payment handler reconciles the provider transaction against the payment intent and sale amount.
10. The sale becomes `PAID`; the payment intent becomes `CONFIRMED`.
11. The receipt service creates an authoritative receipt and `receipt.created.v1` outbox record.
12. Duplicate event delivery is idempotent.

## Failure semantics
- Provider failure → payment intent `FAILED`; sale remains completed but unpaid.
- Provider accepted / local persistence uncertain → `RECONCILIATION_REQUIRED`.
- Unposted or amount-mismatched financial state can never mark the sale paid.
- Payment confirmation cannot cross tenant or branch boundaries.

## Vertical boundary
This workflow belongs to **Retail / Hardware / General Commerce**. It is not a school workflow.

## Proof
Regression coverage includes:
- confirmed payment → PAID sale + CONFIRMED intent + one receipt;
- duplicate confirmation delivery;
- unposted financial state cannot produce PAID.

CI evidence is still required before closure.
