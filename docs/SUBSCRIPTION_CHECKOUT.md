# DBK Subscription Checkout

## Registration flow

1. Registration provisions the DBK with the `FREE` runtime tier.
2. The requested tier is recorded as registration metadata; it is not an entitlement.
3. For a paid tier, the authenticated owner can initiate checkout through `POST /api/subscriptions/:dbkId/checkout` with `{ "tier": "FOUNDATION|GROWTH|PRO|ENTERPRISE", "phoneNumber": "2547XXXXXXXX", "interval": "MONTHLY" }`.
4. The API resolves the price from server-side configuration, creates a pending subscription, and initiates an M-Pesa STK push.
5. The existing `payment.confirmed.v1` event handler activates the subscription and updates the DBK tier after the payment confirmation event is delivered.

## Required server configuration

Configure each applicable price in whole KES using Cloud Run environment configuration or Secret Manager:

- `TDBK_TIER_PRICE_KES_FOUNDATION`
- `TDBK_TIER_PRICE_KES_GROWTH`
- `TDBK_TIER_PRICE_KES_PRO`
- `TDBK_TIER_PRICE_KES_ENTERPRISE`

Values must be positive integers. If a selected tier has no valid server-side price, checkout returns `503 TIER_PRICE_NOT_CONFIGURED` and does not initiate a payment. No commercial prices are hard-coded by this feature.

## Operational requirements and release gate

- Configure the correct commercial prices before offering paid checkout to customers.
- Configure and verify the M-Pesa bridge credentials and callback delivery in the target environment.
- Confirm that the M-Pesa bridge's normalized provider reference matches the `checkoutRequestId` in the payment-confirmed event.
- Run repository CI and an end-to-end test against the configured M-Pesa sandbox before production release.
- A payment initiation response is not payment confirmation. Paid entitlements must only be enabled by the authoritative confirmation path.
- Ambiguous STK transport failures remain pending to avoid duplicate charges; reconcile against provider truth before allowing a retry.
