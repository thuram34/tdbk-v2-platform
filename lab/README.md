# TDBK LAB — Sovereign Engineering Environment

TDBK LAB is the shared engineering environment for building, testing, securing, releasing and operating every TDBK-owned product.

It is not a browser automation product. Browser automation is one capability inside the LAB.

## Non-negotiable principles

1. **No paid development-platform dependency.** Prefer self-hosted and open-source tools. Do not introduce paid SaaS for source control, CI, testing, observability or developer workspaces.
2. **Local-first, hybrid execution.** A developer workstation is the default lab. Trusted workers may run on TDBK-controlled hardware or a private server.
3. **One project registry.** Every product is registered with its repository, owner, environments, verification commands and operational runbook.
4. **Reuse the TDBK kernel.** Identity, tenant authority, RBAC, agent runtime, workflow orchestration and audit remain the control plane. LAB must not create competing versions.
5. **Evidence before status.** A build is not "passed" unless its command and result are recorded. A deployment is not "live" until a health check verifies it.
6. **Safe by default.** Production access, secrets, destructive operations, financial actions and public releases require explicit policy and approval.
7. **Portable by design.** Workloads must be reproducible with documented commands and standard container formats. Avoid platform-specific lock-in.
8. **Cost transparency.** Open-source software does not mean zero operating cost. Hardware, power, connectivity, domains, SMS, payment rails and optional cloud capacity may still cost money.

## LAB capability map

| Capability | Responsibility | Initial implementation direction |
|---|---|---|
| Project registry | Canonical inventory of products and repositories | Versioned JSON registry |
| Developer workspace | Reproducible local environments | Git + Node/Bun + Docker/Podman |
| Build and CI | Repeatable checks and release gates | Existing GitHub Actions for this public repository; local runner/act for offline reproduction |
| Test laboratory | Unit, integration, API, browser and load tests | Existing Vitest + Playwright; add API/load tooling by need |
| Browser automation | Browser QA and approved web workflows | lab/browser-automation |
| Data laboratory | Disposable fixtures, migrations, backup/restore tests | Isolated local test data; never production copies by default |
| Security laboratory | Dependency, secret, permission and tenant-boundary checks | Local scanners and policy tests |
| Artifact store | Screenshots, logs, test reports and build outputs | Local filesystem first; self-hosted object storage when required |
| Observability | Logs, metrics, traces and health | OpenTelemetry-compatible, self-hosted stack as an optional profile |
| AI engineering agents | Planning, code changes, test repair and review assistance | Existing TDBK Agent Runtime; local-model adapter is optional |
| Release operations | Deploy, verify, rollback and incident evidence | Environment adapters with human approval gates |

## Repository layout

~~~text
lab/
  README.md
  architecture/
    blueprint.md
  registry/
    projects.json
    validate.mjs
    validate.test.mjs
  browser-automation/
    ... isolated Playwright worker
~~~

## First registered project

The initial project is tdbk-v2-platform. Other products are onboarded only after their canonical repositories and deployment ownership are verified. This prevents duplicate or guessed project records.

## Validate the registry

Requires only Node.js; no package installation:

~~~bash
node lab/registry/validate.mjs
node --test lab/registry/validate.test.mjs
~~~

## Delivery sequence

- **Foundation:** architecture, registry, validation, existing browser worker and CI evidence.
- **Workbench:** LAB dashboard, project onboarding, runbook and environment visibility.
- **Execution:** isolated build/test jobs, persistent job history and artifact capture.
- **Quality and security:** API, UI, accessibility, dependency, secret and tenant-isolation test packs.
- **Operations:** self-hosted observability, backup/restore, release approvals and rollback.
- **AI engineering:** governed agents using the existing TDBK runtime and selectable local inference.

Do not build all capabilities as one large service. Each capability is a replaceable module behind a small, documented contract.
