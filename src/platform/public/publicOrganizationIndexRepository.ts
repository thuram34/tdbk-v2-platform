import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { PublicOrganizationProjection } from './publicOrganizationProjection';

export interface PublicOrganizationIndexEntry extends PublicOrganizationProjection {
  indexedAt: string;
  publicationVersion: number;
}

export class PublicOrganizationIndexRepository {
  private static instance: PublicOrganizationIndexRepository;
  private constructor() {}
  public static getInstance(): PublicOrganizationIndexRepository {
    return (this.instance ??= new PublicOrganizationIndexRepository());
  }

  private path(dbkId: string): string {
    return `/system/publicOrganizations/${dbkId}`;
  }

  public async get(dbkId: string): Promise<PublicOrganizationIndexEntry | null> {
    return firestoreClient.get<PublicOrganizationIndexEntry>(this.path(dbkId));
  }

  public async upsert(entry: PublicOrganizationIndexEntry): Promise<void> {
    await firestoreClient.set(this.path(entry.dbkId), entry as unknown as Record<string, unknown>);
  }

  public async remove(dbkId: string): Promise<void> {
    await firestoreClient.delete(this.path(dbkId));
  }

  public async list(): Promise<PublicOrganizationIndexEntry[]> {
    return firestoreClient.listCollection<PublicOrganizationIndexEntry>('/system/publicOrganizations');
  }
}

export const publicOrganizationIndexRepository = PublicOrganizationIndexRepository.getInstance();
