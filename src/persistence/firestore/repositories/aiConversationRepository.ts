/**
 * TDBK V2 — AI CONVERSATION REPOSITORY
 * Firestore Path: /tenants/{tenantId}/ai_conversations/{conversationId}/messages/{messageId}
 */

import { IAiConversationRepository } from '../../types';
import { AiConversationMessage } from '../../../document_ai/types';
import { firestoreClient } from '../firestoreClient';

export class AiConversationRepository implements IAiConversationRepository {
  private static instance: AiConversationRepository;

  private constructor() {}

  public static getInstance(): AiConversationRepository {
    if (!AiConversationRepository.instance) {
      AiConversationRepository.instance = new AiConversationRepository();
    }
    return AiConversationRepository.instance;
  }

  public async saveMessage(
    tenantId: string,
    conversationId: string,
    messageId: string,
    message: AiConversationMessage
  ): Promise<void> {
    const path = `/tenants/${tenantId}/ai_conversations/${conversationId}/messages/${messageId}`;
    await firestoreClient.set(path, message as unknown as Record<string, unknown>);
  }

  public async listMessages(
    tenantId: string,
    conversationId: string
  ): Promise<AiConversationMessage[]> {
    const collectionPath = `/tenants/${tenantId}/ai_conversations/${conversationId}/messages`;
    return await firestoreClient.listCollection<AiConversationMessage>(collectionPath);
  }

  public async getConversationMetadata(
    tenantId: string,
    conversationId: string
  ): Promise<{ conversationId: string; branchId: string; principalId: string } | null> {
    const path = `/tenants/${tenantId}/ai_conversations/${conversationId}`;
    return await firestoreClient.get<{ conversationId: string; branchId: string; principalId: string }>(path);
  }

  public async saveConversationMetadata(
    tenantId: string,
    conversationId: string,
    meta: { conversationId: string; branchId: string; principalId: string }
  ): Promise<void> {
    const path = `/tenants/${tenantId}/ai_conversations/${conversationId}`;
    await firestoreClient.set(path, meta as unknown as Record<string, unknown>);
  }
}

export const aiConversationRepository = AiConversationRepository.getInstance();
