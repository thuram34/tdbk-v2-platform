# Global Income Engine — Integration and Operations

## Current implementation boundary

The Global Income Engine is a TDBK V2 module, not a second application or database. Its API is mounted at `/api/global-income`; authenticated requests are resolved through the existing TDBK security context and tenant boundary. Records are persisted in Firestore under the canonical `/tenants/{tenantId}/global_income_*` namespace.

The control panel is available from the owner portfolio when at least one DBK is active. It currently supports manual opportunity capture, pipeline visibility, application ledger visibility, and approval decisions. It does not claim that a platform application was submitted merely because an internal record was created.

## API surface

- `GET/POST /opportunities`
- `POST /opportunities/:id/transition`
- `GET/POST /applications`
- `POST /applications/:id/transition`
- `GET/POST /approvals`
- `POST /approvals/:id/decision`

All routes require a valid TDBK bearer token. Tenant ID is resolved from the authenticated principal or explicitly supplied and checked against TDBK tenant authorization. Approval decisions additionally require an owner or tenant-administrator role.

## Execution policy

- Discovery, normalization, deduplication, scoring and evidence capture may run automatically once their provider adapters are configured.
- Free submissions may be automated only when the provider's official workflow permits unattended submission and no item-level confirmation is required.
- Upwork proposal confirmation, paid Connects/credits/boosts, paid applications, direct B2B outreach, CRM writes, profile edits, contracts, legal commitments and sensitive declarations remain approval-gated.
- The approval record is a control-plane authorization, not proof that an external provider accepted or completed the action. External response evidence must be stored separately.
- Employment application records are intentionally separate from HubSpot revenue Deals. A job application must never be counted as booked revenue.

## Connector deployment checklist

ChatGPT's connected Gmail and HubSpot accounts do not provision credentials to the deployed TDBK server. Each server-side connector needs its own OAuth client, redirect URI, minimum scopes, encrypted refresh-token storage, rotation/revocation handling, health checks and audit trail.

1. Configure Google OAuth for Gmail read/draft/send scopes only as approved; keep sending disabled until an explicit operational policy is enabled.
2. Configure HubSpot OAuth for contacts/companies/deals read and write scopes. Preserve the existing Sales Pipeline and custom acquisition properties.
3. Use official platform workflows for Upwork and other marketplaces. Do not scrape behind login, bypass Connects, automate CAPTCHA/OTP, or use unofficial API access.
4. Store secrets in Google Secret Manager and only persist secret references in Firestore. Never place tokens in client bundles, logs, audit details or source control.
5. Add provider-specific webhook verification, retry/idempotency keys and a dead-letter/reconciliation process before enabling writes.
6. Run sandbox tests and verify least-privilege scopes before production enablement.

## Verification and release

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. The repository CI workflow runs these gates and validates the Docker image. Do not merge or deploy until the checks pass and external connector credentials have been configured in the target environment.
