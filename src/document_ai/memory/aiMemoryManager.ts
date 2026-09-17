/**
 * TDBK V2 — AI CONVERSATION & CONTEXT MEMORY MANAGER
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION & AI ASSISTANCE
 * 
 * Rules:
 * - Tenant-isolated and principal-scoped conversation memory.
 * - Zero cross-tenant context leaks or shared memory buffers.
 * - Enforces branch scope on document context retrieval.
 */

import { AiConversation, AiConversationMessage } from '../types';
import { SecurityContext } from '../../kernel/types';
import { tenantIsolation } from '../../kernel/tenancy/tenantIsolation';
import { documentStore } from '../storage/documentStore';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { aiConversationRepository } from '../../persistence/firestore/repositories/aiConversationRepository';


export class AiMemoryManager {
  private static instance: AiMemoryManager;

  // Primary memory store: tenantId -> Map<conversationId, AiConversation>
  private conversations: Map<string, Map<string, AiConversation>> = new Map();

  private constructor() {}

  public static getInstance(): AiMemoryManager {
    if (!AiMemoryManager.instance) {
      AiMemoryManager.instance = new AiMemoryManager();
    }
    return AiMemoryManager.instance;
  }

  public getOrCreateConversation(
    ctx: SecurityContext,
    tenantId: string,
    branchId: string,
    conversationId?: string
  ): AiConversation {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    if (!this.conversations.has(tenantId)) {
      this.conversations.set(tenantId, new Map());
    }

    const tenantConvs = this.conversations.get(tenantId)!;
    const convId = conversationId || `conv_${ctx.principal.id}_${branchId}`;

    let conv = tenantConvs.get(convId);
    if (!conv) {
      conv = {
        conversationId: convId,
        tenantId,
        branchId,
        principalId: ctx.principal.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      tenantConvs.set(convId, conv);
    }

    return conv;
  }

  public addMessage(
    ctx: SecurityContext,
    tenantId: string,
    conversationId: string,
    message: Omit<AiConversationMessage, 'id' | 'timestamp'>
  ): AiConversationMessage {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const conv = this.getOrCreateConversation(ctx, tenantId, ctx.principal.branchId || 'HQ', conversationId);

    const fullMessage: AiConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...message,
    };

    conv.messages.push(fullMessage);
    conv.updatedAt = new Date().toISOString();

    return fullMessage;
  }

  public assembleTenantContext(
    ctx: SecurityContext,
    tenantId: string,
    branchId: string,
    includeDocIds?: string[]
  ): { contextPrompt: string; accessibleDocsCount: number } {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);

    const docs = documentStore.listDocuments(ctx, tenantId, branchId);
    const accessible = includeDocIds 
      ? docs.filter(d => includeDocIds.includes(d.documentId))
      : docs.slice(0, 10);

    const docSummaries = accessible.map(d => {
      return `[Doc ID: ${d.documentId} | Type: ${d.documentType} | File: ${d.fileName} | Status: ${d.status} | Classification: ${d.classification?.type || 'unknown'} (conf: ${d.classification?.confidence || 0})]`;
    }).join('\n');

    const contextPrompt = `
=== TENANT ISOLATION CONTEXT ===
Tenant ID: ${tenantId}
Branch ID: ${branchId}
Accessible Documents:
${docSummaries || 'No recent documents found.'}
================================
`;

    return {
      contextPrompt,
      accessibleDocsCount: accessible.length,
    };
  }

  /** Authoritative production conversation read from Firestore. */
  public async getPersistentConversation(ctx: SecurityContext, tenantId: string, branchId: string, conversationId?: string): Promise<AiConversation> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const convId = conversationId || `conv_${ctx.principal.id}_${branchId}`;
    const metadata = await aiConversationRepository.getConversationMetadata(tenantId, convId);
    if (metadata && metadata.branchId !== branchId && !ctx.principal.isMaster) {
      throw new KernelError('AUTHORIZATION_DENIED' as any, 'Conversation branch access denied', 403, ctx.requestId);
    }
    if (metadata && metadata.principalId !== ctx.principal.id && !ctx.principal.isMaster) {
      throw new KernelError('AUTHORIZATION_DENIED' as any, 'Conversation access denied', 403, ctx.requestId);
    }
    const messages = await aiConversationRepository.listMessages(tenantId, convId);
    if (metadata) {
      return { ...metadata, tenantId, messages, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as AiConversation;
    }
    const now = new Date().toISOString();
    const conversation: AiConversation = { conversationId: convId, tenantId, branchId, principalId: ctx.principal.id, createdAt: now, updatedAt: now, messages };
    await aiConversationRepository.saveConversationMetadata(tenantId, convId, { conversationId: convId, branchId, principalId: ctx.principal.id });
    return conversation;
  }

  /** Persist a message before returning it; production callers should use this path. */
  public async addPersistentMessage(ctx: SecurityContext, tenantId: string, branchId: string, conversationId: string, message: Omit<AiConversationMessage, 'id' | 'timestamp'>): Promise<AiConversationMessage> {
    tenantIsolation.assertTenantIsolation(ctx.principal, tenantId);
    const conversation = await this.getPersistentConversation(ctx, tenantId, branchId, conversationId);
    if (conversation.principalId !== ctx.principal.id && !ctx.principal.isMaster) {
      throw new KernelError('AUTHORIZATION_DENIED' as any, 'Conversation access denied', 403, ctx.requestId);
    }
    const fullMessage: AiConversationMessage = { id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, timestamp: new Date().toISOString(), ...message };
    await aiConversationRepository.saveMessage(tenantId, conversationId, fullMessage.id, fullMessage);
    return fullMessage;
  }

  public clearTenantMemory(tenantId: string): void {
    this.conversations.delete(tenantId);
  }
}

export const aiMemoryManager = AiMemoryManager.getInstance();
