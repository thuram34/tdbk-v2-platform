/**
 * TDBK V2 — BUSINESS DNA REPOSITORY
 * Firestore Path: /tenants/{tenantId}/configuration/business_dna
 */

import { IBusinessDnaRepository } from '../../types';
import { BusinessDNA } from '../../../blueprint/types';
import { firestoreClient } from '../firestoreClient';

export class BusinessDnaRepository implements IBusinessDnaRepository {
  private static instance: BusinessDnaRepository;

  private constructor() {}

  public static getInstance(): BusinessDnaRepository {
    if (!BusinessDnaRepository.instance) {
      BusinessDnaRepository.instance = new BusinessDnaRepository();
    }
    return BusinessDnaRepository.instance;
  }

  private getPath(tenantId: string): string {
    return `/tenants/${tenantId}/configuration/business_dna`;
  }

  public async saveDna(tenantId: string, dna: BusinessDNA): Promise<void> {
    await firestoreClient.set(this.getPath(tenantId), dna as unknown as Record<string, unknown>);
  }

  public async getDna(tenantId: string): Promise<BusinessDNA | null> {
    return await firestoreClient.get<BusinessDNA>(this.getPath(tenantId));
  }

  public async hasDna(tenantId: string): Promise<boolean> {
    const dna = await this.getDna(tenantId);
    return dna !== null;
  }

  public async deleteDna(tenantId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId));
  }
}

export const businessDnaRepository = BusinessDnaRepository.getInstance();
