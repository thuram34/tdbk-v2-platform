import { firestoreClient } from '../../persistence/firestore/firestoreClient';

export type PublicPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'SUSPENDED';

export interface DbkPublicPublication {
  dbkId: string;
  status: PublicPublicationStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  updatedAt: string;
  reason?: string;
  version: number;
}

export class PublicPublicationRepository {
  private static instance: PublicPublicationRepository;
  private constructor() {}

  public static getInstance(): PublicPublicationRepository {
    return (this.instance ??= new PublicPublicationRepository());
  }

  private path(dbkId: string): string {
    return `/tenants/${dbkId}/publicPublication/organization`;
  }

  public async get(dbkId: string): Promise<DbkPublicPublication | null> {
    return firestoreClient.get<DbkPublicPublication>(this.path(dbkId));
  }

  public async save(publication: DbkPublicPublication): Promise<void> {
    await firestoreClient.set(this.path(publication.dbkId), publication as unknown as Record<string, unknown>);
  }
}

export const publicPublicationRepository = PublicPublicationRepository.getInstance();
