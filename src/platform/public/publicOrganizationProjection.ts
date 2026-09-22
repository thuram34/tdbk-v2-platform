/**
 * TDBK V2 PUBLIC ORGANIZATION PROJECTION
 * Architectural Layer: LAYER 7 — EXPERIENCE SERVICES
 *
 * This module exposes only a public-safe projection of existing authoritative
 * DBK identity/branch state. It does not create publication persistence,
 * discovery storage, provider/product/service masters, or business truth.
 */

import { DbkIdentity, DbkLifecycleStatus } from '../types';

export type PublicOrganizationEligibility =
  | 'ELIGIBLE'
  | 'SUSPENDED'
  | 'INELIGIBLE';

export interface PublicOrganizationBranch {
  branchId: string;
  name: string;
  type: DbkIdentity['branchTopology'][number]['type'];
  location?: {
    county?: string;
    town?: string;
    address?: string;
  };
  isHeadquarters: boolean;
}

/**
 * Public-safe organization projection.
 *
 * Deliberately excludes legal name, subscription, master owner, lifecycle
 * history, configuration metadata, and internal capability state.
 */
export interface PublicOrganizationProjection {
  dbkId: string;
  displayName: string;
  sector: DbkIdentity['sector'];
  branches: PublicOrganizationBranch[];
  stateVersion: {
    configurationVersion: number;
    updatedAt: string;
  };
  eligibility: PublicOrganizationEligibility;
}

/**
 * Derives public eligibility only from already-authoritative DBK lifecycle
 * state. This is NOT publication authority and must not be treated as a
 * persisted published/unpublished state.
 */
export function evaluatePublicOrganizationEligibility(
  status: DbkLifecycleStatus,
): PublicOrganizationEligibility {
  switch (status) {
    case 'ACTIVE':
      return 'ELIGIBLE';
    case 'SUSPENDED':
      return 'SUSPENDED';
    case 'PROVISIONING':
    case 'PROVISIONING_FAILED':
    case 'ARCHIVED':
      return 'INELIGIBLE';
  }
}

/**
 * Projects authoritative DBK identity into the minimum public-safe
 * organization representation justified by the current Engine contracts.
 */
export function projectPublicOrganization(
  dbk: DbkIdentity,
): PublicOrganizationProjection {
  return {
    dbkId: dbk.dbkId,
    displayName: dbk.displayName,
    sector: dbk.sector,
    branches: dbk.branchTopology
      .filter((branch) => branch.status === 'ACTIVE')
      .map((branch) => ({
        branchId: branch.branchId,
        name: branch.name,
        type: branch.type,
        location: branch.location
          ? {
              county: branch.location.county,
              town: branch.location.town,
              address: branch.location.address,
            }
          : undefined,
        isHeadquarters: branch.isHeadquarters,
      })),
    stateVersion: {
      configurationVersion: dbk.configurationVersion,
      updatedAt: dbk.updatedAt,
    },
    eligibility: evaluatePublicOrganizationEligibility(dbk.status),
  };
}
