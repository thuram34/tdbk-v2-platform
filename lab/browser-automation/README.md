# TDBK LAB — Browser Automation Engine v1.0

TDBK-owned Playwright/Chromium execution worker for controlled browser testing. The worker is separate from the main web application; the existing TDBK Security Context, RBAC, Master Authority and Flow Orchestrator remain the control plane.

## Hybrid topology

- **Local lab:** run the worker on a developer workstation, bound to `127.0.0.1`, for local development and test targets.
- **Cloud worker:** build the supplied Playwright container and deploy it as a private service. Set `HOST=0.0.0.0`; do not make it public.
- **TDBK API:** set `TDBK_BROWSER_LAB_URL` and `TDBK_BROWSER_LAB_TOKEN` on the TDBK API service. For a remote worker, connect over a private network/VPN or authenticated service mesh; do not expose the worker to the public internet.

The TDBK API routes below submit through the existing durable Agent Runtime, Authority Policy and Flow Orchestrator. They enforce tenant authority and the existing `workflow:execute` permission. Click/fill actions additionally require `allowInteractions: true` and a TDBK/tenant administrator role.

## Local start

```bash
cd lab/browser-automation
cp .env.example .env
# Replace the token and set LAB_ALLOWED_HOSTS to the exact TDBK test hostname(s).
npm install
npx playwright install chromium
npm run dev
```

Health: `GET http://127.0.0.1:8787/health`

## TDBK API

All calls require the user's existing Firebase/JWT bearer token.

Submit a read-only test:
```http
POST /api/lab/browser/jobs
Authorization: Bearer <TDBK-user-token>
Content-Type: application/json

{
  "tenantId": "your-tenant-id",
  "url": "https://tdbk.example.com",
  "steps": [
    { "type": "inspect" },
    { "type": "assertText", "text": "TDBK" },
    { "type": "screenshot" }
  ]
}
```

Poll: `GET /api/lab/browser/jobs/:jobId?tenantId=your-tenant-id`

Read screenshot evidence: `GET /api/lab/browser/jobs/:jobId/evidence/:stepIndex?tenantId=your-tenant-id`

Supported task steps:
- `navigate` — navigate to another allowlisted URL
- `inspect` — capture page title and visible body text
- `assertText` — assert that expected text is present
- `screenshot` — capture PNG evidence
- `click` and `fill` — interactive steps; require elevated authorization and explicit `allowInteractions: true`. Submit, checkout, payment, delete, publish and other high-impact controls are blocked; password, OTP, token, PIN and financial credential fields are blocked until a credential vault exists.

The agent execution record stores the task plan and job acceptance result. Worker retries use the agent instruction ID as an idempotency key, preventing duplicate browser jobs after an interrupted response. Job state and screenshot bytes remain in-memory in this v1.0 worker.

Direct worker endpoints (private network only):
- `POST /v1/jobs`, `GET /v1/jobs/:jobId`, `GET /v1/jobs/:jobId/evidence/:stepIndex`
- Session endpoints remain available for controlled manual sessions; sessions must be created with `allowInteractions: true` before click/fill calls are accepted.

## Limits and security

- Exact hostname allowlist; no wildcard entries or IP-literal destinations.
- DNS preflight rejects private, loopback, link-local and reserved address ranges.
- Context-level Playwright routing and blocked service workers provide an additional request boundary.
- Configure cloud egress/firewall policy to deny private, metadata and unapproved destinations. Browser routing is defense in depth, not a substitute for network egress controls, particularly across redirect chains.
- 20 steps/job, 5 concurrent jobs, 5 concurrent manual sessions, 32 KB request payload, 4 MB screenshot evidence.
- Each job receives a fresh browser context; contexts are closed after completion.
- Worker job/evidence retention is in-memory and bounded to the latest 100 jobs. This v1.0 slice is not yet a durable audit store; TDBK records the authenticated submission/flow, while durable job/evidence persistence is a follow-on. Until that exists, keep a cloud lab worker at a single instance (no scale-out); a restart loses active jobs and evidence.
- No arbitrary JavaScript evaluation, shell access, file upload/download, password vault, payment execution, publishing or destructive actions.

## Tests

```bash
npm test
npm run typecheck
```

The automated suite exercises policy validation, tenant/task payload validation, authorization gates, job execution, status polling and screenshot evidence using an injected fake browser. CI also installs Chromium and runs a real headless browser smoke test against an in-memory page; it does not yet test a live TDBK hostname.
