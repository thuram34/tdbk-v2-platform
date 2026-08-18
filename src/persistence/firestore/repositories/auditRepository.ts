/**
 * TDBK V2 — SECURITY AUDIT REPOSITORY
 * Firestore Path: /tenants/{tenantId}/security_audits/{auditId}
 * 
 * Rules:
 * - Append-only server authority.
 * - Client direct write forbidden.
 * - Tenant-scoped query isolation.
 */

import { IAuditRepository } from '../../types';
import { AuditEvent } from '../../../kernel/types';
import { firestoreClient } from '../firestoreClient';

export class AuditRepository implements IAuditRepository {
  private static instance: AuditRepository;

  private constructor() {}

  public static getInstance(): AuditRepository {
    if (!AuditRepository.instance) {
      AuditRepository.instance = new AuditRepository();
    }
    return AuditRepository.instance;
  }

  public async appendAudit(tenantId: string | null, auditId: string, event: AuditEvent): Promise<void> {
    const scopeTenantId = tenantId || 'system';
    const path = `/tenants/${scopeTenantId}/security_audits/${auditId}`;
    await firestoreClient.set(path, event as unknown as Record<string, unknown>);
  }

  public async listAudits(tenantId?: string | null, limit: number = 100): Promise<AuditEvent[]> {
    if (tenantId) {
      const audits = await firestoreClient.listCollection<AuditEvent>(
        `/tenants/${tenantId}/security_audits`
      );
      return audits.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
    }

    // Platform-wide / master audit scan
    const allDbks = await firestoreClient.listCollection<{ dbkId: string }>('/tenants');
    const allTenantIds = ['system', ...allDbks.map((d) => d.dbkId).filter(Boolean)];

    const aggregated: AuditEvent[] = [];
    for (const tId of allTenantIds) {
      const audits = await firestoreClient.listCollection<AuditEvent>(`/tenants/${tId}/security_audits`);
      aggregated.push(...audits);
    }

    return aggregated.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }
}

export const auditRepository = AuditRepository.getInstance();
