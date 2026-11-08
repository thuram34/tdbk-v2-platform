import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import type { ExperienceCustomization } from './types';

export class ExperienceCustomizationRepository {
  private static instance: ExperienceCustomizationRepository;
  private constructor() {}
  public static getInstance(): ExperienceCustomizationRepository {
    if (!ExperienceCustomizationRepository.instance) {
      ExperienceCustomizationRepository.instance = new ExperienceCustomizationRepository();
    }
    return ExperienceCustomizationRepository.instance;
  }

  private path(dbkId: string): string {
    return `/tenants/${dbkId}/configuration/experience_customization`;
  }

  public async get(dbkId: string): Promise<ExperienceCustomization | null> {
    return firestoreClient.get<ExperienceCustomization>(this.path(dbkId));
  }

  public async save(
    dbkId: string,
    value: ExperienceCustomization,
    expectedVersion: number,
  ): Promise<ExperienceCustomization> {
    return firestoreClient.runTransaction(async (transaction) => {
      const path = this.path(dbkId);
      const existing = await transaction.get<ExperienceCustomization>(path);
      const currentVersion = existing?.version || 0;
      if (currentVersion !== expectedVersion) {
        throw new Error(`CONFIGURATION_CONFLICT: Expected version ${expectedVersion}, current version is ${currentVersion}.`);
      }
      const saved = { ...value, dbkId, version: currentVersion + 1 };
      await transaction.set(path, saved);
      return saved;
    });
  }
}

export const experienceCustomizationRepository = ExperienceCustomizationRepository.getInstance();
