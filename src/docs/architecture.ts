export const TDBK_V2_ARCHITECTURE = `# 2. TDBK V2 SYSTEM ARCHITECTURE SPECIFICATION

**Document ID:** \`TDBK_V2_ARCHITECTURE\`  
**Version:** 2.0.0-POINT0  

---

## 1. ARCHITECTURAL OVERVIEW

TDBK V2 is an event-driven, multi-tenant platform designed to host customized business operating environments (**DBKs**) for Kenyan SMEs and institutions. The architecture decouples **Platform Authority (TDBK Master)** from **Tenant Execution (DBK Runtime)** and separates **Business Logic** from **Presentation Surfaces**.

\`\`\`
+-----------------------------------------------------------------------+
|                          TDBK MASTER AUTHORITY                        |
|   (Provisioning Engine, Global Billing, Entitlements, Security Policy) |
+-----------------------------------------------------------------------+
                                   |
                                   v  Provision / Enforce
+-----------------------------------------------------------------------+
|                             TDBK PLATFORM                             |
|    +-------------------------------------------------------------+    |
|    |                      BLUEPRINT CATALOG                      |    |
|    |  (School, Hardware, Retail, Healthcare, Logistics, etc.)   |    |
|    +-------------------------------------------------------------+    |
|                                  |                                    |
|                                  v  Instantiates                      |
|    +-------------------------------------------------------------+    |
|    |                        BUSINESS DNA                         |    |
|    |    (Tenant Context, Branch Graph, Specific Config & Health)  |    |
|    +-------------------------------------------------------------+    |
|                                  |                                    |
|                                  v  Discovers & Filters               |
|    +-------------------------------------------------------------+    |
|    |                     CAPABILITY REGISTRY                     |    |
|    |     (Core Modules, Feature Flags, Domain Workflows)         |    |
|    +-------------------------------------------------------------+    |
|                                  |                                    |
|                                  v  Gated by Entitlements             |
|    +-------------------------------------------------------------+    |
|    |                    TENANT DBK RUNTIME                       |    |
|    |   (Authoritative State Engine, Ledger, Workflows, Audit)    |    |
|    +-------------------------------------------------------------+    |
|                                  |                                    |
|                                  v  Emits Events & Connects           |
|    +-------------------------------------------------------------+    |
|    |                 WORKFLOW / EVENT / BRIDGES                   |    |
|    |      (M-Pesa, eTIMS, WhatsApp, SMS, Banks, Async Queues)     |    |
|    +-------------------------------------------------------------+    |
|                                  |                                    |
|                                  v  Projects to                       |
|    +-------------------------------------------------------------+    |
|    |                 EXPERIENCE / SHA-AFYANGU UI                  |    |
|    | (Entity-Centric Tabs, Contextual Nav, Responsive Surfaces)  |    |
|    +-------------------------------------------------------------+    |
+-----------------------------------------------------------------------+
\`\`\`

---

## 2. HIGH-LEVEL PIPELINE DATAFLOW

1. **Provisioning Flow:**  
   \`.Master.TenantRequest -> BlueprintSelection -> EntitlementAssignment -> ProvisioningEngine -> DBKInstanceCreated\`

2. **Runtime Execution Flow:**  
   \`UserAction -> ExperienceProjection -> ContextualAuthCheck -> DBKRuntimeCommand -> StateTransition -> EventBus.Publish -> BridgeWorker -> ExternalReceipt/Callback -> RuntimeReconciliation\`

3. **Bridge Async Flow:**  
   \`M-Pesa Payment -> Webhook Bridge -> Signature Verify -> Publish PaymentReceivedEvent -> DBK Ledger Worker -> Update Invoice & Balance -> Trigger Receipt Workflow -> Send WhatsApp/SMS Bridge\`
`;

export const TDBK_V2_LAYER_MAP = `# 3. TDBK V2 AUTHORITATIVE LAYER MAP

**Document ID:** \`TDBK_V2_LAYER_MAP\`  
**Version:** 2.0.0-POINT0  

---

## THE 9 AUTHORITATIVE LAYERS

| Level | Layer Name | Core Primary Responsibilities | Strict Non-Responsibilities | Allowed Downstream Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | **Kernel** | Platform primitives, Tenant isolation context, AuthZ engine, Crypto, Base Audit, Health checks. | NO industry rules, NO business calculations, NO UI code. | None (Root Layer) |
| **L2** | **Platform Services** | Tenant management, Master billing, Entitlements gateway, Document store, System notifications, File storage. | NO vertical business workflows, NO sector terminology. | L1 |
| **L3** | **Blueprint / Business DNA** | Sector operational definitions (Schools, Hardware, Clinics), Tenant DNA context, Branch topology. | NO direct execution engine, NO hardcoded entity logic. | L1, L2 |
| **L4** | **Capabilities / Modules** | Domain capability declarations, capability schemas, feature flags, API contract registries. | NO entitlement state storage, NO persistent database connections. | L1, L2, L3 |
| **L5** | **DBK Runtime** | Authoritative business state machine, financial ledger, transaction execution, state persistence. | NO UI rendering, NO direct HTTP calls to 3rd party APIs. | L1, L2, L3, L4 |
| **L6** | **Workflows / Events / Bridges** | Asynchronous event bus, state machine orchestration, external API bridges (M-Pesa, eTIMS, WhatsApp). | NO synchronous UI waiting, NO client-side execution. | L1, L2, L3, L4, L5 |
| **L7** | **Experience Services** | Contextual state projection, API gateway for client platforms, protocol adapters (GraphQL/REST/WS). | NO business rule enforcement (defers to L5). | L1, L2, L3, L4, L5, L6 |
| **L8** | **UI Engine / Design System** | SHA/Afyangu contextual layout generator, design tokens, entity card schemas, theme resolution. | NO state storage, NO business logic. | L1, L3, L4, L7 |
| **L9** | **User Interface** | Web, Mobile, PWA, WhatsApp bot renderers, user input capture, micro-interactions. | NO direct database access, NO client-side calculation authority. | L8 |

---

## STRICT LAYER BOUNDARY RULES

1. **Dependency Inversion:** Higher layers call down to lower layers; lower layers NEVER import from higher layers.
2. **Event Isolation:** Lower layers communicate upward strictly via asynchronous events over the Level 6 Event Bus.
3. **Bypass Prohibition:** Level 9 (UI) can NEVER skip Level 7/5 and call Level 1 or Level 6 directly.
`;
