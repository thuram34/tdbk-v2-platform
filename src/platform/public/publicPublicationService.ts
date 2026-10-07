import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { dbkRegistry } from '../dbkRegistry';
import { dbkRegistryRepository } from '../../persistence/firestore/repositories/dbkRegistryRepository';
import { PublicOrganizationProjection, evaluatePublicOrganizationEligibility, projectPublicOrganization } from './publicOrganizationProjection';
import { publicPublicationRepository, DbkPublicPublication, PublicPublicationStatus } from './publicPublicationRepository';

export class PublicPublicationService {
  private static instance: PublicPublicationService;
  private constructor() {}

  public static getInstance(): PublicPublicationService {
    return (this.instance ??= new PublicPublicationService());
  }

  private async assertPublicationAuthority(context: SecurityContext, dbkId: string): Promise<void> {
    await masterAuthority.assertTenantAuthority(context, dbkId, 'MANAGE_PUBLIC_PUBLICATION', context.requestId);
    const principal = context.principal;
    if (
      !masterAuthority.isMasterAdmin(principal) &&
      !masterAuthority.isBusinessOwner(principal) &&
      !masterAuthority.isOwnerOperator(principal) &&
      !principal.roles.some((role) => ['TENANT_ADMIN', 'DBK_ADMIN'].includes(role))
    ) {
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        'Public publication requires owner or tenant administration authority.',
        403,
        context.requestId,
      );
    }
  }

  public async getPublication(dbkId: string): Promise<DbkPublicPublication> {
    const existing = await publicPublicationRepository.get(dbkId);
    if (existing) return existing;
    return {
      dbkId,
      status: 'DRAFT',
      publishedAt: null,
      publishedBy: null,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  public async setPublication(
    context: SecurityContext,
    dbkId: string,
    requestedStatus: PublicPublicationStatus,
    reason?: string,
  ): Promise<DbkPublicPublication> {
    await this.assertPublicationAuthority(context, dbkId);
    const dbk = await dbkRegistry.getDbkInternal(dbkId);
    if (!dbk) throw new KernelError('NOT_FOUND', `DBK '${dbkId}' not found`, 404, context.requestId);

    const existing = await this.getPublication(dbkId);
    if (requestedStatus === 'PUBLISHED') {
      const eligibility = evaluatePublicOrganizationEligibility(dbk.status);
      if (eligibility !== 'ELIGIBLE') {
        throw new KernelError(
          'VALIDATION_ERROR',
          `DBK '${dbkId}' is not eligible for public publication while lifecycle status is '${dbk.status}'.`,
          409,
          context.requestId,
        );
      }
      if (!dbk.displayName.trim()) {
        throw new KernelError('VALIDATION_ERROR', 'A public display name is required before publication.', 400, context.requestId);
      }
    }

    const now = new Date().toISOString();
    const publication: DbkPublicPublication = {
      dbkId,
      status: requestedStatus,
      publishedAt: requestedStatus === 'PUBLISHED' ? existing.publishedAt || now : null,
      publishedBy: requestedStatus === 'PUBLISHED' ? existing.publishedBy || context.principal.id : null,
      updatedAt: now,
      reason,
      version: existing.version + 1,
    };

    await publicPublicationRepository.save(publication);
    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      `DBK_PUBLIC_PUBLICATION_${requestedStatus}`,
      `dbk:${dbkId}`,
      'ALLOWED',
      {
        tenantId: dbkId,
        requestId: context.requestId,
        details: {
          previousStatus: existing.status,
          newStatus: requestedStatus,
          reason,
          version: publication.version,
        },
      },
    );
    return publication;
  }

  public async getPublishedOrganization(dbkId: string): Promise<PublicOrganizationProjection | null> {
    const dbk = await dbkRegistry.getDbkInternal(dbkId);
    if (!dbk) return null;
    const publication = await publicPublicationRepository.get(dbkId);
    if (!publication || publication.status !== 'PUBLISHED') return null;
    if (evaluatePublicOrganizationEligibility(dbk.status) !== 'ELIGIBLE') return null;
    return projectPublicOrganization(dbk);
  }

  public async listPublishedOrganizations(filters?: { area?: string; sector?: string }): Promise<PublicOrganizationProjection[]> {
    const dbks = await dbkRegistryRepository.listAllDbks();
    const results: PublicOrganizationProjection[] = [];
    for (const dbk of dbks) {
      if (!dbk.dbkId) continue;
      const publication = await publicPublicationRepository.get(dbk.dbkId);
      if (!publication || publication.status !== 'PUBLISHED') continue;
      if (evaluatePublicOrganizationEligibility(dbk.status) !== 'ELIGIBLE') continue;
      const projection = projectPublicOrganization(dbk);
      if (filters?.sector && projection.sector !== filters.sector) continue;
      if (filters?.area) {
        const normalizedArea = filters.area.trim().toLowerCase();
        const hasArea = projection.branches.some((branch) =>
          [branch.location?.county, branch.location?.town, branch.location?.address]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedArea)),
        );
        if (!hasArea) continue;
      }
      results.push(projection);
    }
    return results;
  }
}

export const publicPublicationService = PublicPublicationService.getInstance();
