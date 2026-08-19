/**
 * TDBK V2 EXPERIENCE PROJECTION SERVICE
 * Architectural Layer: LAYER 7 — PLATFORM CONTROL & DBK LIFECYCLE
 * Generates lightweight, server-authoritative projections for stateless frontend/client surfaces.
 */

import { DbkExperienceProjection } from '../types';
import { SecurityContext } from '../../kernel/types';
import { workspaceManager } from '../workspace/workspaceManager';
import { BlueprintValidator } from '../../blueprint/validator';
import { masterAuthority } from '../../kernel/master/masterAuthority';

export class ExperienceProjectionService {
  private static instance: ExperienceProjectionService;

  private constructor() {}

  public static getInstance(): ExperienceProjectionService {
    if (!ExperienceProjectionService.instance) {
      ExperienceProjectionService.instance = new ExperienceProjectionService();
    }
    return ExperienceProjectionService.instance;
  }

  /**
   * Projects authoritative DBK state for a stateless client/UI session.
   */
  public async getExperienceProjection(context: SecurityContext, dbkId: string): Promise<DbkExperienceProjection> {
    // 1. Assert tenant boundaries
    if (!masterAuthority.isMasterAdmin(context.principal)) {
      BlueprintValidator.assertTenantAccess(context, dbkId, 'getExperienceProjection');
    }

    // 2. Compile authoritative workspace state
    const workspace = await workspaceManager.compileWorkspaceState(context, dbkId);

    // 3. Project clean projection
    return {
      dbkId: workspace.dbkId,
      displayName: workspace.displayName,
      sector: workspace.sector,
      status: workspace.status,
      subscriptionTier: workspace.subscriptionTier,
      workspaceVersion: workspace.workspaceVersion,
      branches: workspace.activeBranches.map((b) => ({
        branchId: b.branchId,
        name: b.name,
        isHeadquarters: b.isHeadquarters,
      })),
      capabilities: {
        enabled: workspace.enabledCapabilities,
        discoverable: workspace.discoverableCapabilities,
      },
      terminology: workspace.terminology,
      permissions: context.principal.roles,
      serverAuthoritativeTimestamp: new Date().toISOString(),
    };
  }
}

export const experienceProjection = ExperienceProjectionService.getInstance();
