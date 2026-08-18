/**
 * TDBK V2 — AI SECURITY GUARD & PROMPT INJECTION DEFENSES
 * Layer: LEVEL 6 — ADVANCED DOCUMENT INGESTION & AI ASSISTANCE
 * 
 * Rules:
 * - Documents and user prompts are treated as UNTRUSTED INPUT.
 * - Defenses against prompt injection, jailbreaking, instruction hijacking, and cross-tenant context leaks.
 * - AI output schema validation: AI can NEVER forge tenant, branch, permissions, or execute direct DB writes.
 */

import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { AiProposedAction, AiProposalType } from '../types';

export interface SanitizedPromptResult {
  sanitizedPrompt: string;
  isFlagged: boolean;
  detectedFlags: string[];
}

export class AiSecurityGuard {
  private static instance: AiSecurityGuard;

  // Injection signatures
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
    /ignore\s+tdbk\s+(?:rbac\s+)?security/i,
    /system\s+override/i,
    /you\s+are\s+(?:now\s+)?(?:root|master_admin|superadmin)/i,
    /reveal\s+(?:other\s+)?tenants?/i,
    /bypass\s+(?:rbac|security|tdbk|auth)/i,
    /grant\s+(?:admin|dbk_admin|master_admin|[a-z_]*admin|permissions?|roles?|capabilities?)/i,
    /execute\s+(?:direct|sql|firestore|write)\s+on/i,
    /set\s+tenantid\s+to/i,
    /jailbreak/i,
    /developer\s+mode\s+enabled/i,
  ];

  private constructor() {}

  public static getInstance(): AiSecurityGuard {
    if (!AiSecurityGuard.instance) {
      AiSecurityGuard.instance = new AiSecurityGuard();
    }
    return AiSecurityGuard.instance;
  }

  public sanitizeInput(ctx: SecurityContext, input: string, contextType: 'PROMPT' | 'DOCUMENT'): SanitizedPromptResult {
    const flags: string[] = [];

    for (const pattern of AiSecurityGuard.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        flags.push(pattern.source);
      }
    }

    if (flags.length > 0) {
      auditLogger.logAuditEvent(ctx, {
        action: 'AI_PROMPT_INJECTION_DEFLECTED',
        targetResource: `tenant:${ctx.principal.tenantId}`,
        outcome: 'ALLOWED',
        details: {
          contextType,
          detectedPatterns: flags,
          actionTaken: 'NEUTRALIZED_AS_UNTRUSTED_DATA',
        }
      });
    }

    // Wrap untrusted content cleanly with secure boundary delimiters
    const sanitized = input
      .replace(/<\/?system_instruction>/gi, '[REDACTED_TAG]')
      .replace(/```(?:json|system)?/gi, '```');

    return {
      sanitizedPrompt: sanitized,
      isFlagged: flags.length > 0,
      detectedFlags: flags,
    };
  }

  public validateProposalIntegrity(
    ctx: SecurityContext,
    targetTenantId: string,
    proposal: Partial<AiProposedAction>
  ): void {
    // 1. Verify Tenant Identity cannot be forged by AI output
    if (proposal.tenantId && proposal.tenantId !== targetTenantId) {
      auditLogger.logAuditEvent(ctx, {
        action: 'AI_FORGED_TENANT_REJECTED',
        targetResource: `tenant:${targetTenantId}`,
        outcome: 'DENIED',
        details: { attemptedTenantId: proposal.tenantId, actualTenantId: targetTenantId }
      });
      throw new KernelError(
        'SECURITY_VIOLATION' as any,
        `AI proposed tenantId (${proposal.tenantId}) does not match authenticated context (${targetTenantId})`,
        403,
        ctx.requestId
      );
    }

    // 2. Allowed Proposal Types
    const allowedProposalTypes: AiProposalType[] = [
      'PROPOSE_CREATE_INVOICE',
      'PROPOSE_RECORD_PAYMENT',
      'PROPOSE_ADMIT_STUDENT',
      'PROPOSE_BOOK_WAYBILL',
      'PROPOSE_CREATE_PATIENT_RECORD',
      'PROPOSE_RECONCILE_TRANSACTION',
      'PROPOSE_UPDATE_INVENTORY',
      'PROPOSE_GENERAL_ENTRY',
    ];

    if (!proposal.proposalType || !allowedProposalTypes.includes(proposal.proposalType)) {
      throw new KernelError(
        'VALIDATION_ERROR',
        `AI proposed unsupported action type: ${proposal.proposalType}`,
        400,
        ctx.requestId
      );
    }

    // 3. Forbid AI from creating privileged mutations (permissions, roles, capabilities, ledger tampering)
    const payloadStr = JSON.stringify(proposal.suggestedPayload || {}).toLowerCase();
    if (
      payloadStr.includes('grant_role') ||
      payloadStr.includes('is_master') ||
      payloadStr.includes('bypass_audit') ||
      payloadStr.includes('direct_db_write')
    ) {
      auditLogger.logAuditEvent(ctx, {
        action: 'AI_PRIVILEGED_MUTATION_REJECTED',
        targetResource: `tenant:${targetTenantId}`,
        outcome: 'DENIED',
        details: { payload: proposal.suggestedPayload }
      });
      throw new KernelError(
        'FORBIDDEN_OPERATION' as any,
        'AI proposal contains forbidden privileged payload keys',
        403,
        ctx.requestId
      );
    }
  }
}

export const aiSecurityGuard = AiSecurityGuard.getInstance();
