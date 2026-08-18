import { TDBK_V2_CONSTITUTION } from './constitution';
import { TDBK_V2_ARCHITECTURE, TDBK_V2_LAYER_MAP } from './architecture';
import { TDBK_V2_DATA_MODEL, TDBK_V2_SECURITY_MODEL, TDBK_V2_TENANCY_MODEL, TDBK_V2_MASTER_DBK_MODEL } from './data_and_security';
import { TDBK_V2_BLUEPRINT_SPEC, TDBK_V2_BUSINESS_DNA_SPEC, TDBK_V2_CAPABILITY_SPEC, TDBK_V2_ENTITLEMENT_SPEC } from './blueprint_dna_capability';
import { TDBK_V2_RUNTIME_SPEC, TDBK_V2_STATE_MODEL, TDBK_V2_WORKFLOW_EVENT_SPEC } from './runtime_state_workflow';
import { TDBK_V2_BRIDGE_SPEC, TDBK_V2_EXPERIENCE_SPEC, TDBK_V2_UI_SYSTEM_SPEC, TDBK_V2_AI_ARCHITECTURE } from './bridge_experience_ui';
import { TDBK_V2_OBSERVABILITY_SPEC, TDBK_V2_TESTING_STRATEGY, TDBK_V2_DEPLOYMENT_STRATEGY, TDBK_V2_PHASE_PLAN, TDBK_V2_DEFINITION_OF_DONE } from './ops_governance_plans';
import { TDBK_V2_VALIDATION_REPORT } from './validation_report';

export interface DocItem {
  id: string;
  num: number;
  title: string;
  category: 'CONSTITUTION' | 'ARCHITECTURE & LAYERS' | 'DATA & SECURITY' | 'BLUEPRINT & CAPABILITIES' | 'RUNTIME & WORKFLOW' | 'BRIDGES & UI' | 'GOVERNANCE & OPS' | 'VALIDATION REPORT';
  content: string;
}

export const ALL_TDBK_V2_DOCS: DocItem[] = [
  { id: 'constitution', num: 1, title: '1. TDBK V2 Constitution', category: 'CONSTITUTION', content: TDBK_V2_CONSTITUTION },
  { id: 'architecture', num: 2, title: '2. TDBK V2 System Architecture', category: 'ARCHITECTURE & LAYERS', content: TDBK_V2_ARCHITECTURE },
  { id: 'layer-map', num: 3, title: '3. TDBK V2 Layer Map (9 Levels)', category: 'ARCHITECTURE & LAYERS', content: TDBK_V2_LAYER_MAP },
  { id: 'data-model', num: 4, title: '4. Data Model Specification', category: 'DATA & SECURITY', content: TDBK_V2_DATA_MODEL },
  { id: 'security-model', num: 5, title: '5. Security Model (RBAC/ABAC/PBAC)', category: 'DATA & SECURITY', content: TDBK_V2_SECURITY_MODEL },
  { id: 'tenancy-model', num: 6, title: '6. Tenancy & Isolation Model', category: 'DATA & SECURITY', content: TDBK_V2_TENANCY_MODEL },
  { id: 'master-dbk-model', num: 7, title: '7. Master -> DBK Provisioning Model', category: 'DATA & SECURITY', content: TDBK_V2_MASTER_DBK_MODEL },
  { id: 'blueprint-spec', num: 8, title: '8. Blueprint Specification', category: 'BLUEPRINT & CAPABILITIES', content: TDBK_V2_BLUEPRINT_SPEC },
  { id: 'business-dna-spec', num: 9, title: '9. Business DNA Specification', category: 'BLUEPRINT & CAPABILITIES', content: TDBK_V2_BUSINESS_DNA_SPEC },
  { id: 'capability-spec', num: 10, title: '10. Capability Model (Discoverable ≠ Enabled)', category: 'BLUEPRINT & CAPABILITIES', content: TDBK_V2_CAPABILITY_SPEC },
  { id: 'entitlement-spec', num: 11, title: '11. Entitlement Specification', category: 'BLUEPRINT & CAPABILITIES', content: TDBK_V2_ENTITLEMENT_SPEC },
  { id: 'runtime-spec', num: 12, title: '12. DBK Runtime Specification', category: 'RUNTIME & WORKFLOW', content: TDBK_V2_RUNTIME_SPEC },
  { id: 'state-model', num: 13, title: '13. State Model (Stateful Business, Stateless Experience)', category: 'RUNTIME & WORKFLOW', content: TDBK_V2_STATE_MODEL },
  { id: 'workflow-event-spec', num: 14, title: '14. Workflow & Event Bus Specification', category: 'RUNTIME & WORKFLOW', content: TDBK_V2_WORKFLOW_EVENT_SPEC },
  { id: 'bridge-spec', num: 15, title: '15. Bridge Specification (M-Pesa, eTIMS, WhatsApp)', category: 'BRIDGES & UI', content: TDBK_V2_BRIDGE_SPEC },
  { id: 'experience-spec', num: 16, title: '16. Experience Layer Specification', category: 'BRIDGES & UI', content: TDBK_V2_EXPERIENCE_SPEC },
  { id: 'ui-system-spec', num: 17, title: '17. SHA/Afyangu UI System Specification', category: 'BRIDGES & UI', content: TDBK_V2_UI_SYSTEM_SPEC },
  { id: 'ai-architecture', num: 18, title: '18. AI Architecture Specification', category: 'BRIDGES & UI', content: TDBK_V2_AI_ARCHITECTURE },
  { id: 'observability-spec', num: 19, title: '19. Observability Specification', category: 'GOVERNANCE & OPS', content: TDBK_V2_OBSERVABILITY_SPEC },
  { id: 'testing-strategy', num: 20, title: '20. Testing Strategy', category: 'GOVERNANCE & OPS', content: TDBK_V2_TESTING_STRATEGY },
  { id: 'deployment-strategy', num: 21, title: '21. Deployment Strategy', category: 'GOVERNANCE & OPS', content: TDBK_V2_DEPLOYMENT_STRATEGY },
  { id: 'phase-plan', num: 22, title: '22. Phase Roadmap Plan', category: 'GOVERNANCE & OPS', content: TDBK_V2_PHASE_PLAN },
  { id: 'definition-of-done', num: 23, title: '23. Definition of Done (12 Criteria)', category: 'GOVERNANCE & OPS', content: TDBK_V2_DEFINITION_OF_DONE },
  { id: 'validation-report', num: 24, title: 'Point 0 Architectural Validation & Gate Report', category: 'VALIDATION REPORT', content: TDBK_V2_VALIDATION_REPORT },
];
