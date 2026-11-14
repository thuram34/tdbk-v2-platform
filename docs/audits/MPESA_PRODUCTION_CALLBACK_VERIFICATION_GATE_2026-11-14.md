# M-Pesa production callback verification gate — 2026-11-14

## Decision

Production M-Pesa STK callbacks are not accepted as financial evidence until TDBK can independently verify the provider outcome. Safaricom's STK callback payload does not provide a cryptographic signature contract implemented by this adapter. A caller-supplied `signature`, timestamp, checkout reference, tenant ID, or correlation ID is not proof that Safaricom originated the request.

The adapter therefore fails closed in `NODE_ENV=production`. It rejects the callback before tenant financial state, ledger entries, callback idempotency claims, or payment-confirmed outbox events can be mutated.

Non-production callback simulation remains available for deterministic tests. It must not be represented as live provider certification.

## Why this is necessary

- The current callback handler's durable correlation, amount check, tenant scoping and idempotency checks are necessary but do not authenticate the HTTP sender.
- An attacker who learns or guesses a checkout reference must not be able to post a payment by submitting a forged success callback.
- The financial ledger correctly treats `PENDING` and `RECONCILIATION_REQUIRED` as non-posted states. This gate preserves that invariant.

## Release impact

- Live M-Pesa STK initiation can be configured independently, but a successful live payment must not be treated as settled by an unauthenticated callback.
- The current M-Pesa adapter does not yet implement Safaricom Transaction Status Query or a provider-authenticated asynchronous query-result ingress.
- Do not enable customer-facing live payment acceptance until the provider query/reconciliation path is implemented, tested against Safaricom sandbox, and deployed with tenant-safe provider-reference resolution.
- Do not invent an application signature header or trust callback metadata as provider authentication.

## Required follow-up

1. Implement the Daraja Transaction Status request with tenant-scoped secret resolution and provider response normalization.
2. Implement the provider's asynchronous status-result callback contract and a safe mapping from provider reference to the authoritative tenant and pending transaction. The callback must not accept a tenant selector from the request body.
3. On provider-confirmed success, verify checkout reference, amount, currency and original transaction identity, then call the existing atomic financial reconciliation/ledger boundary.
4. On confirmed failure, transition only the matching pending/reconciliation-required transaction to failed.
5. Treat timeouts, malformed responses, mismatched identities and unresolved outcomes as `RECONCILIATION_REQUIRED`; never blindly replay STK Push.
6. Add integration tests for forged callback, cross-tenant reference, duplicate callback, success, failure, timeout, mismatched amount, and process restart.
7. Complete sandbox/UAT using the actual tenant Daraja app and callback URL before production certification.

## Verification evidence

This change adds a unit test proving that a plausible caller-supplied signature cannot authenticate a production callback and that a pending transaction remains unposted with zero ledger entries.

The GitHub Actions run for each resulting commit remains the source of truth for typecheck, lint, tests, production build and Docker validation. Passing CI does not replace Safaricom sandbox/UAT evidence.
