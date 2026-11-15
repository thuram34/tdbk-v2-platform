# TDBK Commercial Price Book and Digital Asset Registry

## Commercial price book

The price book is the source of truth for published subscription plan prices. Prices are never embedded in UI components or subscription checkout requests.

### Storage model

- Current pointer: `/system/commerce/priceBooks/global`
- Immutable snapshots: `/system/commerce/priceBooks/global/versions/{versionId}`
- Each publication increments the version using an optimistic transaction.
- A stale publisher receives HTTP 409 and must reload the current version.
- Published snapshots are not edited in place.

Each plan stores:
- Stable `planId`, display name and description
- Existing platform `SubscriptionTier`
- `amountMinor` integer and ISO currency code
- Billing interval: MONTHLY, ANNUAL or NONE
- Configurable feature list and active flag

All prices use integer minor currency units. KES 2,500.00 is represented as 250000. Tax calculation is intentionally separate and must use the tenant's configured tax policy; no VAT rate is assumed by this module.

### API

- `GET /api/price-book/:tenantId` — authenticated tenant reads the current published snapshot.
- `POST /api/price-book/publish` — TDBK master publishes a complete new snapshot. Body includes `expectedVersion` and `plans`.

Example publication body (illustrative only; not a recommended price):
```json
{
  "expectedVersion": 0,
  "plans": [{
    "planId": "growth-monthly",
    "name": "Growth Monthly",
    "description": "Example plan",
    "tier": "GROWTH",
    "amountMinor": 250000,
    "currency": "KES",
    "interval": "MONTHLY",
    "features": ["pos", "inventory"],
    "active": true
  }]
}
```

## Subscription checkout

- `POST /api/subscriptions/:dbkId/from-plan` creates a pending subscription from an active plan in the current published price book.
- The request must include `planId` and `priceBookVersion`; callers cannot submit their own amount.
- The subscription stores `planId`, `priceBookVersion`, `amountMinor`, currency, tier and interval as an immutable commercial snapshot.
- A tenant cannot create another subscription while one is active or awaiting payment.
- `POST /api/subscriptions/:dbkId/:subscriptionId/pay` initiates M-Pesa STK Push using the persisted subscription amount. The current M-Pesa checkout path accepts whole-KES amounts only.

### Payment activation invariant

The intended event path is:

1. Create pending subscription from a published plan.
2. Initiate STK Push and persist the provider checkout reference.
3. Obtain authoritative provider confirmation.
4. Post the financial transaction and ledger entries atomically with a durable outbox event.
5. Consume `payment.confirmed.v1` idempotently.
6. Activate the matching subscription and project the purchased capability tier.

Production M-Pesa callback processing is currently fail-closed because Safaricom STK callbacks do not provide a cryptographic signature that this adapter can independently validate. Provider-side transaction query and reconciliation must be implemented and tested before enabling production subscription activation. Development callback simulation is not proof of live payment.

## Digital asset registry

The registry records evidence-backed claims about software, domains, content, equipment, property interests, contracts and receivables. It is not a title adjudicator, custodian, valuation oracle or token issuance service.

- Tenant documents live under `/tenants/{tenantId}/digitalAssets/{assetId}`.
- Ownership events and valuations are append-only subcollections.
- Branch-owned assets are restricted to their branch; tenant-wide assets remain visible to authorized branches.
- Valuations are explicitly estimates.
- Ownership transfers use expected-owner checks and idempotent event identifiers.
- No asset is tokenized or made transferable by this registry.

## Release gates

Do not merge or deploy until:
- TypeScript typecheck passes.
- ESLint passes.
- Price book and asset registry tests pass.
- Full Vitest suite passes.
- Vite/server production build passes.
- CI and Vercel checks are green.
- Live Daraja query/callback reconciliation has been verified in Safaricom sandbox and production configuration reviewed.
