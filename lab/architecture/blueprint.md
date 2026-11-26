# TDBK LAB — Architecture Blueprint

**Status:** Foundation architecture  
**Initial scope:** TDBK V2 repository  
**Deployment posture:** Local-first, hybrid, self-hostable  
**Commercial constraint:** No paid development-platform subscriptions

## 1. System boundary

TDBK LAB is an engineering control plane and a set of isolated execution workers. It is not a replacement for the TDBK business platform and must not become a second identity, tenant, workflow or agent system.

The existing TDBK platform remains authoritative for:
- Principal identity and authentication.
- Tenant/DBK boundaries and role-based authorization.
- Master Authority and approval policy.
- Agent Runtime, action execution and audit.
- Flow orchestration and business workflow state.

LAB contributes engineering capabilities:
- Project and environment registry.
- Build/test job definitions and execution.
- Browser, API, data and security test workers.
- Evidence and artifact collection.
- Release verification and operational health.
- Optional local AI model inference through a provider adapter.

## 2. Logical topology

~~~text
                 TDBK LAB CONTROL PLANE
       (existing TDBK identity, RBAC, Agent Runtime)
                           |
             Project Registry + Job API
                           |
                 Policy / Approval Gate
                           |
            Job Queue + Execution Coordinator
                           |
       +-------------------+-------------------+
       |                   |                   |
  Local Worker       Private Worker       CI Worker
  workstation        TDBK-owned host      public-repo CI
       |                   |                   |
  Build / Test       Browser / API         Typecheck /
  Data fixtures      Security checks       Lint / Build
       |                   |                   |
       +-------------------+-------------------+
                           |
                  Evidence / Artifacts
                           |
              Results + Audit + Health
~~~

The diagram is logical, not a claim that all services are already deployed. v1 starts with the registry and existing browser worker. Durable job orchestration and artifact persistence are subsequent milestones.

## 3. Project isolation

Every project record must identify:
- Stable project ID and canonical repository.
- Default branch and technology/runtime.
- Local setup and verification commands.
- Named environments: local, test/staging and production where applicable.
- Data classification and allowed worker capabilities.
- Deployment adapter and health-check contract.
- Owner, runbook and recovery procedure.

Workers receive a scoped job envelope, not unrestricted access to the host. A worker must not inherit another project's environment variables, credentials, filesystem or production access.

## 4. Environment model

| Environment | Purpose | Default permissions |
|---|---|---|
| Local | Developer iteration | Disposable data; local secrets |
| Test | Automated CI and integration | Synthetic data; no production credentials |
| Staging | Pre-release verification | Explicitly allowlisted services and test accounts |
| Production | Customer operations | Read-only health by default; change operations require approval |

No production database dump should be copied into local or test environments by default. Use synthetic or anonymised fixtures.

## 5. Zero-subscription tool policy

Preferred building blocks:
- **Source control:** retain the existing Git repository; Git is open source. Do not create a second Git hosting system unless there is a clear operational need.
- **Local CI reproduction:** shell scripts and act where compatible. Existing public GitHub Actions remain a convenient free CI path for this public repository; the workflow must remain runnable locally where practical.
- **Containers:** Docker Engine or Podman; Compose-compatible manifests.
- **Browser QA:** Playwright and Chromium.
- **Unit/integration tests:** existing Vitest and Node test runner.
- **API tests:** curl/httpie and an open-source API test runner when needed.
- **Load tests:** k6 or another self-hosted open-source runner.
- **Observability:** OpenTelemetry, Prometheus, Grafana and Loki as optional self-hosted components.
- **Local AI:** Ollama or llama.cpp behind an adapter; no model provider is mandatory for core LAB operation.

These are candidate components, not a mandate to install every service. Add a dependency only when a real workflow needs it and document its CPU, RAM, disk and licence requirements.

## 6. Security controls

- Bind local workers to loopback unless explicitly deployed behind a private network.
- Authenticate every control-plane request using the existing TDBK identity model.
- Authorize every project and environment separately.
- Use short-lived, scoped job tokens for workers.
- Never place secrets in source control, logs, screenshots or job output.
- Deny arbitrary shell, arbitrary code evaluation and unrestricted filesystem access from browser tasks.
- Apply outbound network allowlists and private/metadata IP blocking at the network boundary.
- Require approval for production deploys, migrations, destructive changes, financial actions and public publishing.
- Record actor, tenant/project, job, approval, worker, timestamps, result and evidence references.
- Separate test credentials from production credentials.

## 7. Job lifecycle contract

A future common job API should use the same lifecycle across build, test, browser and release jobs:

QUEUED -> AUTHORIZED -> RUNNING -> VERIFYING -> SUCCEEDED | FAILED | CANCELLED

Every job should include:
- jobId, projectId, environment, requestedBy, correlationId.
- A declared capability and bounded input payload.
- An idempotency key.
- Timeout, resource limits and cancellation policy.
- Structured logs and evidence references.
- Explicit completion verification; acceptance is not completion.

The browser worker's current in-memory job store is a v1 limitation. Do not scale it horizontally until durable state and evidence storage are implemented.

## 8. Release gate

A release is eligible only when:
1. The source revision is known and immutable.
2. Dependency installation is reproducible from the lockfile.
3. Typecheck, lint and relevant tests pass.
4. Production build succeeds.
5. Security and tenant-isolation gates pass.
6. Deployment target and rollback path are declared.
7. Post-deploy health checks pass.
8. Evidence is attached to the release record.

A green build alone does not prove production readiness.

## 9. Milestones

### M0 — Foundation
- Registry and validator.
- Browser worker already present in this branch.
- CI checks for LAB configuration.
- Architecture and cost policy.

### M1 — Workbench
- Authenticated LAB landing page.
- Project list and project detail.
- Environment/health visibility.
- Runbook and verification command launcher.
- No arbitrary remote shell from the browser.

### M2 — Execution
- Durable job store and queue.
- Worker registration/heartbeat.
- Build and test workers.
- Artifact store with retention policy.
- Job cancellation, timeout and retry semantics.

### M3 — Quality and security
- API contract tests.
- Browser end-to-end suites.
- Accessibility and performance checks.
- Dependency/secret scanning.
- Tenant and permission boundary suites.

### M4 — Release and operations
- Deployment adapters.
- Human approval gates.
- Smoke tests, health checks and rollback.
- Self-hosted logs, metrics and traces.
- Backup/restore drills.

### M5 — AI engineering
- Existing Agent Runtime as the only agent orchestration layer.
- Local model provider adapter.
- Plan -> propose diff -> test -> review -> approval -> merge/release.
- No autonomous production mutation without explicit policy and approval.

## 10. Definition of done

A capability is complete only when its code, tests, security boundary, local run instructions, failure behaviour and evidence are present. A diagram, dashboard mock-up or successful job submission is not completion.
