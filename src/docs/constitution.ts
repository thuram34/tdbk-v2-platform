export const TDBK_V2_CONSTITUTION = `# 1. TDBK V2 CONSTITUTION

**Document ID:** \`TDBK_V2_CONSTITUTION\`  
**Version:** 2.0.0-POINT0  
**Status:** AUTHORITATIVE & BINDING  
**Effective Date:** August 13, 2026  

---

## PREAMBLE & CORE TENETS

Thuram Digital Bridge Kenya (TDBK V2) is a **multi-tenant SME platform authority**, NOT a collection of fragmented vertical applications. The platform enables provisioned business operating environments (**DBKs**) for Kenyan enterprises across diverse sectors (education, retail, hardware, healthcare, logistics, hospitality, professional services, agriculture, and manufacturing) without duplicating core business logic or inventing separate monolithic codebases.

---

## THE ARTICLES OF TDBK V2

### ARTICLE I: PLATFORM VS. DBK SEPARATION
1. **TDBK MASTER** is the supreme platform authority responsible for provisioning, security, entitlements, cross-tenant isolation, and global observability.
2. **DBK (Digital Bridge Kenya)** is a client's isolated operating environment. Every DBK possesses its own business identity, Business DNA, active Blueprint, user directory, state store, and enabled capabilities.
3. No DBK shall ever inspect, mutate, or reference the runtime state or data of another DBK.

### ARTICLE II: NINE-LAYER CANONICAL ARCHITECTURE
All code, models, and workflows must strictly belong to exactly one of the 9 defined layers:
- **Level 1 — Kernel:** Industry-neutral primitives (Identity, Tenant Context, AuthZ, State Primitives, Audit, Security).
- **Level 2 — Platform Services:** Reusable core engines (Tenant Mgmt, Billing, Entitlements, Event Bus, Document Mgmt, Notifications).
- **Level 3 — Blueprint / Business DNA:** Domain models defining operational worlds & client context.
- **Level 4 — Capabilities / Modules:** Discoverable business capabilities grouped by domain.
- **Level 5 — DBK Runtime:** Authoritative live business execution state engine.
- **Level 6 — Workflows / Events / Bridges:** Async state transitions and external system integration bridges (M-Pesa, eTIMS, WhatsApp, Banks).
- **Level 7 — Experience Services:** Protocol-agnostic projection layer (Web, Mobile, WhatsApp, API).
- **Level 8 — UI Engine / Design System:** Contextual UI generation rules based on SHA/Afyangu navigation principles.
- **Level 9 — User Interface:** Responsive, entity-centric presentation surface.

### ARTICLE III: STATEFUL BUSINESS, STATELESS EXPERIENCE
1. The TDBK Runtime and persistent database layer constitute the **sole authoritative source of financial and business truth**.
2. User interfaces, AI Studio sessions, Gemini conversations, WhatsApp messaging windows, and web caches are **stateless experience projections**.
3. Closing a browser window, disconnecting WhatsApp, or resetting an AI session must NEVER compromise, corrupt, or lose business state.

### ARTICLE IV: DISCOVERABLE ≠ ENABLED
1. A DBK can only discover capabilities supported by its assigned **Blueprint**.
2. A supported capability can only be activated if backed by a valid **Subscription & Entitlement** granted by TDBK Master.
3. Unsubscribing or disabling a capability gracefully revokes access without destroying historical audit trails or persistent data.

### ARTICLE V: PAPERLESS BY DEFAULT & SEAMLESS PROPAGATION
1. All business transactions (invoices, payments, receipts, approvals, requisitions, inventory movements, student records) are digital-first.
2. Business actions propagate automatically through event-driven workflows. Manual duplicate data entry across modules is strictly forbidden.

### ARTICLE VI: THE BRIDGE PRINCIPLE
1. External services (M-Pesa, KRA eTIMS, WhatsApp Business API, Bank APIs, SMS gateways) are **Bridges**.
2. Bridges are asynchronous, fault-tolerant, and decoupled from the core Kernel.
3. System components must NEVER block user interactions awaiting synchronous response from external Bridges. Callbacks, webhooks, and retry queues guarantee eventual state consistency.

### ARTICLE VII: SHA / AFYANGU INTERACTION MODEL
1. The UI layout adapts dynamically based on:  
   \`BUSINESS IDENTITY → VERTICAL → ACTIVE ENTITY → HORIZONTAL CONTEXTUAL NAVIGATION → WORKFLOW → ACTION → VISIBLE STATE\`
2. UI shall avoid generic monolithic sidebars listing every possible system option. Navigation must be contextual to the active entity (e.g. Student, Item, Patient, Invoice).

### ARTICLE VIII: FINANCIAL TRUTH & NON-TAMPERING
1. Financial calculations, tax compliance (eTIMS), and ledger balances are computed exclusively on the server runtime.
2. Client-side math, local overrides, or AI-generated summaries shall NEVER serve as financial sources of truth.
3. All financial movements generate immutable audit logs.

### ARTICLE IX: LEGACY CODE IS REFERENCE ONLY
1. Legacy TDBK codebases are classified as R&D research reference material.
2. Legacy code shall never be blindly copied or directly imported into TDBK V2.

### ARTICLE X: STRICT SCOPE DISCIPLINE
1. No implementation phase shall begin without explicit Point 0 approval and documented architectural specifications.
2. Unsolicited features, mock shortcuts, or temporary bypasses are strictly banned in production code.
`;
