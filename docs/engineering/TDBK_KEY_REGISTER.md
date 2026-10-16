# TDBK Credential & Control-Key Register

**Audit date:** 2026-10-16  
**Purpose:** Inventory the credential names, configuration locations, ownership/control points, and verification gaps found in the connected TDBK repositories.  
**Security rule:** This register deliberately contains no credential values, tokens, private keys, passwords, or secret payloads.

## Executive status

- **Credential inventory: PARTIAL.** Repository configuration files were inspected. GitHub Actions secret values, cloud secret stores, Firebase/GCP IAM, deployment settings, and payment-provider dashboards were not accessible through the available read-only repository tools.
- **Do not treat an environment-variable name or example file as proof that a live credential exists or works.**
- **P0 security finding:** `TUMOS/TDBK-EDU` has Firestore rules that allow unauthenticated reads and writes under `/institutions/{tenantId}/**`. The repository is public. Treat the corresponding database as unsafe until the deployed rules are inspected and corrected. This audit did not change those rules or verify which Firebase project is deployed.
- **Configuration exposure finding:** `TUMOS/Master-TDBK` and `TUMOS/TDBK-EDU` contain Firebase browser/app configuration files in their repositories. Firebase web API keys are normally client identifiers, not privileged server secrets; they still require appropriate API restrictions, authentication, and strict database/storage rules. No key values are reproduced here.
- **Release status:** TDBK V2 release-control PR #542 has a failed CI run. Typecheck fails on existing code errors, so this PR must not be described as passing or production-ready.

## Repository inventory

| Repository | Visibility | Configuration observed | Status / action |
|---|---|---|---|
| `thuram34/tdbk-v2-platform` | Private | `.env.example`, `firebase-blueprint.json`, `firebase.json`, Firestore and Storage rules, Cloud Build and Docker configuration | Environment variable names inventoried below. Actual GitHub secrets, deployed project, IAM and live secret values not verified. |
| `TUMOS/Master-TDBK` | Private | `.env.example`, `firebase-applet-config.json`, `firebase-blueprint.json`, Firestore rules, `gcp/` directory | Browser Firebase config is committed. Confirm API restrictions and deployed security rules; inventory actual secrets in the authorized console. |
| `TUMOS/TDBK-EDU` | Public | `.env.example`, `firebase-applet-config.json`, Firestore rules, `security_spec.md` | **P0: Firestore rules currently permit all reads/writes under institution paths.** Secure and test before using real student or institution data. |
| `TUMOS/TDBK-MASTER` | Public | Minimal README only | Appears to be a stub from the root listing. No operational credential configuration identified in the inspected files; this does not prove none exists elsewhere. |

## Environment variable names found

### `thuram34/tdbk-v2-platform/.env.example`

| Variable | Purpose | Verification status |
|---|---|---|
| `GEMINI_API_KEY` | Gemini/AI provider credential | Live value and secret-store location **not verified** |
| `APP_URL` | Application base URL | Live value **not verified** |
| `GOOGLE_CLOUD_PROJECT` | GCP project selector | Live value / deployed target **not verified** |
| `FIRESTORE_DATABASE_ID` | Firestore database selector | Live value / deployed target **not verified** |
| `SEED_DEMO_DBKS` | Demo-tenant seeding configuration | Value and production safety **not verified** |
| `VITE_FIREBASE_API_KEY` | Firebase browser configuration | Live runtime value **not verified**; browser API keys are not server authorization |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Live runtime value **not verified** |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project selector | Live runtime value **not verified** |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket | Live runtime value **not verified** |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging configuration | Live runtime value **not verified** |
| `VITE_FIREBASE_APP_ID` | Firebase browser app identifier | Live runtime value **not verified** |

### `TUMOS/Master-TDBK/.env.example`

- `GEMINI_API_KEY`
- `APP_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

All live values, secret-store locations, ownership, rotation dates and deployment usage remain **unverified**.

### `TUMOS/TDBK-EDU/.env.example`

- `GEMINI_API_KEY`
- `APP_URL`

This project also has a committed `firebase-applet-config.json`; the environment example alone is therefore not a complete map of its runtime configuration.

## Key register by control plane

| Control plane | Required keys / control points | Current audit status | Required proof |
|---|---|---|---|
| GitHub source control | Owner/admin identity, least-privilege app/token, branch protection, required status checks, protected environments | Repository connection works; secret APIs and all admin controls were not inspected | Confirm owner/admin recovery, require CI checks, prevent direct pushes, rotate any over-scoped tokens |
| CI/CD | GitHub Actions secrets/variables, environment approvals, deployment identity | Workflow file inspected; live secret inventory not available | List names (never values) in GitHub settings, identify environment and consumer, least-privilege scopes |
| Firebase client | Project ID, app ID, auth domain, browser API key, bucket, sender ID | Names/config files found in repositories; runtime/deployed mapping not proven | Map each app to its exact Firebase project; restrict API key usage where supported |
| Firebase / GCP server | Service identity, workload identity, IAM roles, project/database IDs, secret manager bindings | Not verified in cloud console | Prefer workload identity over downloaded service-account keys; document IAM owner and rotation/revocation procedure |
| Firestore / Storage | Deployed rules, tenant/branch authorization claims, indexes, backup/restore access | V2 rules are in repo; deployed state not verified. TDBK-EDU rule file has an explicit allow-all path | Emulator tests for unauthenticated, cross-tenant, cross-branch and unauthorized writes; compare deployed rules to reviewed commit |
| AI provider | Gemini API key or equivalent provider credentials | Variable names found; active credentials and quotas not verified | Store server-side, restrict usage, budget/usage alerts, rotate if exposed |
| Payments | M-Pesa Daraja consumer key/secret, passkey, shortcode, callback verification material; other gateway secrets | Not verified in the inspected root config files or provider consoles | Confirm sandbox/production separation, callback signature/authentication, idempotency and unknown-outcome reconciliation |
| KRA eTIMS | Provider credentials/device or integration identity, environment and signing materials as applicable | Not verified | Confirm official onboarding, secure secret storage, invoice submission/reconciliation tests |
| Communications | WhatsApp Cloud API token, app secret, phone-number/business IDs, webhook verification token; SMS/email provider credentials | Not verified | Least privilege, webhook verification, rotation and delivery/retry monitoring |
| Network / infrastructure | VPS/cloud access, WireGuard private keys, router admin credentials, DNS registrar and TLS control | Not verified in repositories | Maintain private offline recovery record; rotate shared/default credentials; test revocation and recovery |
| Data recovery | Backup credentials, Firestore export location, encryption keys, restore operator | Not verified | Demonstrate a timed restore into an isolated environment and verify transaction/data integrity |

## Priority actions

1. **P0 — Secure TDBK-EDU Firestore rules.** Replace the permissive institution-path rule with authenticated tenant-scoped authorization; add emulator tests for anonymous access and cross-tenant access. Verify the actual deployed project and rules before claiming remediation.
2. **P0 — Establish authoritative secret inventory.** In GitHub repository Settings → Secrets and variables, record only each secret/variable *name*, scope (repository/environment/organization), consumers, owner, last rotation date, and status. Never paste secret values into this file or chat.
3. **P0 — Verify cloud identity and data boundaries.** Map each repository to its Firebase/GCP project, database, storage bucket, IAM service identity, and deployed rules. Check least privilege and whether any service-account private key has been committed historically.
4. **P1 — Verify provider integrations.** Record sandbox/production status, webhook/callback verification, idempotency strategy, and rotation owner for M-Pesa, eTIMS, WhatsApp, SMS/email, and AI services.
5. **P1 — Recovery and rotation drill.** Test revocation/replacement of one non-production credential and a database restore without interrupting live clients.
6. **P1 — Repair CI baseline.** PR #542's CI currently fails at typecheck before lint/tests/build can run. Resolve the reported TypeScript errors and rerun the full workflow before merge.

## Handling rules

- Never commit real secrets to Git, issues, pull requests, logs, or documentation.
- Treat any credential found in a public commit as exposed until investigated; deleting the latest copy does not remove it from Git history.
- Rotate privileged secrets when exposure is confirmed or cannot be ruled out.
- Firebase browser configuration is not equivalent to authorization. Security must be enforced by rules, IAM, authentication, and server-side checks.
- This register is an evidence-backed inventory of inspected repository configuration, **not** a complete live-cloud audit or certification.
