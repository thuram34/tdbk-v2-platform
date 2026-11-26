# TDBK LAB — Browser Automation Engine

An independently deployable Playwright/Chromium worker for TDBK-owned browser sessions. It is deliberately separate from the customer-facing application and reuses TDBK's existing agent and workflow layers as the future control plane.

## Local start

```bash
cd lab/browser-automation
cp .env.example .env
# Set LAB_API_TOKEN to a long random value and LAB_ALLOWED_HOSTS to exact hostnames.
npm install
npx playwright install chromium
npm run dev
```

The worker binds to `127.0.0.1` by default. Do not expose it publicly without a strong bearer token, TLS termination, network restrictions, and an explicit host allowlist.

## API

All endpoints except `GET /health` require `Authorization: Bearer <LAB_API_TOKEN>`.

- `POST /v1/sessions` — create an isolated browser context; optional JSON `{"url":"https://allowed.example"}`
- `POST /v1/sessions/:id/navigate` — `{"url":"https://allowed.example/path"}`
- `POST /v1/sessions/:id/click` — `{"selector":"button[type=submit]"}`
- `POST /v1/sessions/:id/fill` — `{"selector":"input[name=email]","value":"..."}`
- `POST /v1/sessions/:id/screenshot` — returns PNG as base64
- `DELETE /v1/sessions/:id/close` — close and dispose of the context

## Safety boundary

The worker enforces exact hostname allowlisting, blocks localhost/private IP literals, rejects non-HTTP(S) schemes, requires a bearer token for all control actions, limits request bodies and field sizes, and uses isolated browser contexts. It does not expose arbitrary JavaScript evaluation, shell execution, file upload/download, credential storage, payment submission, or destructive actions. Those require a separate audited approval layer before implementation.

## Current scope and next integration

This is the first execution-worker slice, not yet an autonomous agent or production deployment. Next: connect authenticated jobs from the existing TDBK agent runtime/FlowOrchestrator, persist run metadata and evidence, add job-level authority checks and human approval gates, and build the LAB control panel.
