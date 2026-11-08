# TDBK V2 — Experience Studio

## Purpose

Experience Studio lets an authorized tenant administrator configure the workspace experience without changing platform code. It is part of TDBK V2 and uses the existing DBK tenant boundary, capability registry, RBAC engine, experience resolver and Firestore persistence layer.

This is not a client-specific application and does not introduce a second tenant model.

## Tenant-scoped persistence

Workspace configuration is stored at:

`/tenants/{dbkId}/configuration/experience_customization`

The document contains a versioned configuration:
- `menuItems`: capability, questionnaire or workflow destinations; labels, icon names, category, order, visibility and optional role/permission visibility.
- `buttons`: registered navigation, questionnaire or workflow actions; label, visual variant and optional role/permission visibility.
- `questionnaires`: target capability, title, description, submit label, typed fields, required flags and select options.
- `workflows`: ordered steps, step descriptions, assigned roles and optional questionnaire references.

Writes use an expected configuration version and a Firestore transaction. A stale editor receives a conflict instead of overwriting a newer configuration.

## Menu and action execution

Menu destinations are limited to:
- `CAPABILITY`: open an enabled capability registered in the TDBK capability registry.
- `QUESTIONNAIRE`: open a tenant-defined questionnaire.
- `WORKFLOW`: open a tenant-defined workflow.

Action buttons are limited to:
- `NAVIGATE_CAPABILITY`
- `OPEN_QUESTIONNAIRE`
- `START_WORKFLOW`

Configuration never contains executable JavaScript. Buttons reference allowlisted action types and validated targets. Runtime navigation is rechecked against current capability entitlements, roles and permissions.

## Questionnaire execution

Questionnaire field types:
- Text and long text
- Number
- Date
- Single select and multi-select
- Checkbox

The server validates the submitted field keys, required values, types and allowed option values. Accepted submissions are stored through the existing entity engine under the selected tenant and target capability, and produce an audit event.

A questionnaire is not a separate database or unscoped form service; its records use the existing tenant-owned entity model.

## Workflow execution

A workflow is an ordered sequence of steps. A step may:
- Display instructions.
- Require a named role.
- Require a linked questionnaire.

Starting a workflow creates a tenant-scoped run at:

`/tenants/{dbkId}/workflow_runs/{runId}`

The run stores the workflow and linked questionnaire definitions as snapshots, plus the configuration version. This prevents an administrator editing a workflow from silently changing an already-started run.

Step transitions use a Firestore transaction and expected current step index. Questionnaire submissions linked to a workflow are validated against the run snapshot, recorded through the entity engine, then advance the run. Completed steps, run status and audit events are persisted.

## Authorization

- All API calls create the existing server-side security context.
- Tenant access is checked by `masterAuthority.assertTenantAuthority`.
- Configuration writes additionally require a platform/portfolio authority, business owner, tenant administrator or an explicit customization permission.
- Capability targets are checked against current tenant enablement and the existing RBAC engine.
- Questionnaire submissions are authorized again by the entity engine.
- Workflow step assignment is checked server-side.
- Hiding a menu item or button is presentation only; it is never treated as an authorization boundary.

## Current UI

The workspace receives an Experience Studio navigation entry for authorized administrators. The studio provides:
- Framework overview showing the active sector blueprint, workspace, subscription, branches, terminology and capability catalogue. Framework selection remains part of tenant provisioning; Experience Studio customizes the active framework.
- Menu designer with capability, questionnaire and workflow destinations.
- Custom action button designer with target type and visual variant.
- Questionnaire builder with typed fields and preview.
- Structured workflow builder with ordered steps, instructions, role assignment and questionnaire references.
- Workspace preview and versioned save.

Configured action buttons appear in the workspace header. Questionnaire and workflow destinations can be added to the workspace menu.

## Deliberate boundaries / next extensions

- Resume/list active workflow runs across devices.
- Conditional workflow branches, SLA timers, notifications and approval escalation.
- Screen layout builder for arbitrary cards, sections and data tables.
- Button placement per dashboard/capability screen.
- Fine-grained role/permission editor in Experience Studio.
- Framework-level starter templates that prepopulate menu, questionnaire and workflow configuration.
- Visual form rules and conditional field visibility.

These extensions should continue using the existing blueprint/capability model and tenant-scoped persistence; they must not introduce arbitrary code execution or bypass server-side authorization.
