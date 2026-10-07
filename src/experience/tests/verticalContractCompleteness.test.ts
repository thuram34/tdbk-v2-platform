import { describe, expect, it } from 'vitest';
import { INITIAL_BLUEPRINT_CATALOG } from '../../blueprint/catalog';
import { SPECIALIZED_VIEW_CATALOG } from '../registry/specializedViewCatalog';
import { VERTICAL_WORKFLOW_CATALOG } from '../vertical/workflowCatalog';

describe('vertical contract completeness', () => {
  it('every blueprint-declared capability has a specialized view and workflow contract', () => {
    const blueprintCapabilities = Array.from(new Set(
      INITIAL_BLUEPRINT_CATALOG.flatMap((blueprint) =>
        blueprint.supportedCapabilities.map((capability) => capability.id),
      ),
    ));
    const specializedViews = new Set(SPECIALIZED_VIEW_CATALOG.map((view) => view.capabilityId));
    const workflows = new Set(VERTICAL_WORKFLOW_CATALOG.map((workflow) => workflow.capabilityId));

    expect(blueprintCapabilities.filter((id) => !specializedViews.has(id))).toEqual([]);
    expect(blueprintCapabilities.filter((id) => !workflows.has(id))).toEqual([]);
  });

  it('has no duplicate authoritative view or workflow contracts', () => {
    const viewIds = SPECIALIZED_VIEW_CATALOG.map((view) => view.capabilityId);
    const workflowIds = VERTICAL_WORKFLOW_CATALOG.map((workflow) => workflow.capabilityId);

    expect(new Set(viewIds).size).toBe(viewIds.length);
    expect(new Set(workflowIds).size).toBe(workflowIds.length);
  });
});
