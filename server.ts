import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { healthMonitoring } from './src/kernel/observability/health';
import { securityContextFactory } from './src/kernel/context/contextFactory';
import { rbacEngine } from './src/kernel/authorization/rbacEngine';
import { masterAuthority } from './src/kernel/master/masterAuthority';
import { tenantIsolation } from './src/kernel/tenancy/tenantIsolation';
import { branchAuthority } from './src/kernel/branch/branchAuthority';
import { auditLogger } from './src/kernel/audit/auditLogger';
import { tdbkIdentityService } from './src/kernel/identity/tdbkIdentityService';
import { phase0TestRunner } from './src/kernel/tests/phase0TestRunner';
import { KernelError, AuthorizationError } from './src/kernel/errors/kernelErrors';
import { blueprintRegistry } from './src/blueprint/registry';
import { businessDnaManager } from './src/blueprint/dnaManager';
import { blueprintCompiler } from './src/blueprint/compiler';
import { Phase1TestRunner } from './src/blueprint/tests/phase1TestRunner';
import { capabilityRegistry } from './src/capability/registry';
import { discoveryEngine } from './src/capability/discovery';
import { activationEvaluator } from './src/capability/evaluator';
import { capabilityRecommendationEngine } from './src/capability/recommendation';
import { dbkCapabilityManager } from './src/capability/dbkCapabilityManager';
import { entitlementEngine } from './src/capability/entitlement';
import { Phase2TestRunner } from './src/capability/tests/phase2TestRunner';
import { Phase3TestRunner } from './src/orchestration/tests/phase3TestRunner';
import { runPhase4TestSuite } from './src/platform/tests/phase4TestRunner';
import { runDbkProvisioningTestSuite } from './src/platform/tests/dbkProvisioningTestRunner';
import { provisioningService } from './src/platform/provisioning/provisioningService';
import { dbkRegistry } from './src/platform/dbkRegistry';
import { dbkLifecycleManager } from './src/platform/lifecycle/lifecycleManager';
import { experienceProjection } from './src/platform/projection/experienceProjection';
import { seedDemoDbks } from './src/platform/seeder';
import { runPhase5TestSuite } from './src/experience/tests/phase5TestRunner';
import { experienceResolver } from './src/experience/experienceResolver';
import { entityEngine } from './src/experience/entity/entityEngine';
import { runPhase6TestSuite } from './src/document_ai/tests/phase6TestRunner';
import { documentIngestionService } from './src/document_ai/ingestion/documentIngestionService';
import { documentStore } from './src/document_ai/storage/documentStore';
import { documentLifecycleManager } from './src/document_ai/lifecycle/documentLifecycleManager';
import { documentClassifier } from './src/document_ai/extraction/documentClassifier';
import { documentExtractor } from './src/document_ai/extraction/documentExtractor';
import { aiProvider } from './src/document_ai/ai/aiProvider';
import { aiSecurityGuard } from './src/document_ai/ai/aiSecurityGuard';
import { aiCommandBoundary } from './src/document_ai/ai/aiCommandBoundary';
import { aiMemoryManager } from './src/document_ai/memory/aiMemoryManager';
import { roleBasedCoherenceEngine } from './src/coherence/roleBasedCoherenceEngine';
import { contributionDispatcher } from './src/coherence/contributionDispatcher';
import { capabilityAccessStore } from './src/coherence/approvalWorkflow';
import { multiSurfaceRenderer } from './src/coherence/multiSurfaceRenderer';
import { runCoherenceTestSuite } from './src/coherence/tests/coherenceTestRunner';
import { SurfaceType } from './src/coherence/types';
import { eventBus } from './src/orchestration/events/eventBus';
import { pubSubConsumer } from './src/orchestration/events/pubsubConsumer';
import { subscriptionRouter } from './src/platform/subscription/subscriptionRouter';
import { tdbkAgentRuntime } from './src/platform/agent/agentRuntime';
import { agentExecutionRepository } from './src/persistence/firestore/repositories/agentExecutionRepository';

async function startServer() {
  // Explicit bootstrap boundary: Seed demo DBKs only in development, preview, or explicit flag
  if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DBKS === 'true') {
    await seedDemoDbks();
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 8080;

  app.use(express.json());

  pubSubConsumer.register(app);

  // Commercial subscription boundary: authentication is established by the router.
  app.use('/api/subscriptions', subscriptionRouter);

  // -------------------------------------------------------------
  // HEALTH & READINESS ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/health', async (req: Request, res: Response) => {
    res.json(healthMonitoring.getLiveStatus());
  });

  app.get('/api/health/live', async (req: Request, res: Response) => {
    res.json(healthMonitoring.getLiveStatus());
  });

  app.get('/api/health/ready', async (_req: Request, res: Response) => {
    const status = await healthMonitoring.getReadyStatus();
    res.status(status.status === 'HEALTHY' ? 200 : 503).json(status);
  });

  // -------------------------------------------------------------
  // KERNEL SECURITY CONTEXT & AUTHORIZATION ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/kernel/context', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const targetTenantId = req.query.tenantId as string;
      const targetBranchId = req.query.branchId as string;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId,
        targetBranchId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ status: 'SUCCESS', securityContext: context });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/kernel/authorize', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { action, resource, tenantId, branchId, requiredRole, requiredPermission } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: tenantId,
        targetBranchId: branchId,
        ipAddress: req.ip,
      });

      const result = await rbacEngine.authorizeAsync(context.principal, action, resource, {
        tenantId,
        branchId,
        requiredRole,
        requiredPermission,
        requestId: context.requestId,
      });

      res.json({ status: 'SUCCESS', result });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  // -------------------------------------------------------------
  // TDBK COMMAND AGENT
  // Authenticated instruction entry point. The agent may inspect and
  // diagnose within the caller's security context; mutation-capable
  // actions remain explicitly authorization-gated by the agent policy.
  // -------------------------------------------------------------
  app.post('/api/agent/command', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: req.body?.tenantId,
        targetBranchId: req.body?.branchId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const text = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
      if (!text) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'instruction is required' },
        });
      }

      const result = await tdbkAgentRuntime.run({
        instructionId: context.requestId,
        text,
        context,
        requestedAuthority: req.body?.requestedAuthority,
      });

      return res.json({ status: 'SUCCESS', result });
    } catch (err) {
      if (err instanceof KernelError) {
        return res.status(err.statusCode).json(err.toJSON());
      }
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: (err as Error).message },
      });
    }
  });

  app.get('/api/agent/executions', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const tenantId = req.query.tenantId as string;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: tenantId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const effectiveTenantId = context.tenantContext?.tenantId || context.principal.tenantId;
      if (!effectiveTenantId) {
        return res.status(400).json({
          error: { code: 'TENANT_REQUIRED', message: 'tenantId is required for execution history.' },
        });
      }
      tenantIsolation.assertTenantIsolation(context.principal, effectiveTenantId, 'READ_AGENT_EXECUTIONS', context.requestId);
      const executions = await agentExecutionRepository.list(effectiveTenantId);
      return res.json({ status: 'SUCCESS', executions });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to read agent execution history' } });
    }
  });

  // -------------------------------------------------------------
  // TDBK CONNECTOR CONFIGURATION PLANE
  // Configuration accepts only non-secret parameters and secret references.
  // Raw secret material is rejected by the configuration service.
  // -------------------------------------------------------------
  app.post('/api/connectors/configure', async (req: Request, res: Response) => {
    try {
      const context = await securityContextFactory.createSecurityContext({
        authHeader: req.headers.authorization,
        targetTenantId: req.body?.tenantId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const { connectorConfigurationService } = await import('./src/platform/connectors/connectorConfigurationService');
      const result = await connectorConfigurationService.configure(context, req.body);
      return res.status(result.created ? 201 : 200).json({ status: 'SUCCESS', ...result });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
    }
  });

  app.get('/api/connectors/:tenantId', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader: req.headers.authorization,
        targetTenantId: tenantId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const { connectorConfigurationService } = await import('./src/platform/connectors/connectorConfigurationService');
      const connections = await connectorConfigurationService.list(context, tenantId);
      return res.json({ status: 'SUCCESS', connections });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
    }
  });

  app.get('/api/connectors/:tenantId/:bridgeId', async (req: Request, res: Response) => {
    try {
      const { tenantId, bridgeId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader: req.headers.authorization,
        targetTenantId: tenantId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const { connectorConfigurationService } = await import('./src/platform/connectors/connectorConfigurationService');
      const connection = await connectorConfigurationService.get(context, tenantId, bridgeId);
      if (!connection) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Connector connection not found' } });
      return res.json({ status: 'SUCCESS', connection });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
    }
  });

  // -------------------------------------------------------------
  // MASTER & TENANT VERIFICATION ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/master/verify', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({ authHeader, ipAddress: req.ip });
      masterAuthority.assertMasterAuthority(context.principal, 'VERIFY_MASTER', context.requestId);
      res.json({ status: 'SUCCESS', message: 'TDBK MASTER authority verified', principal: context.principal });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/tenant/verify/:tenantId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const tenantId = req.params.tenantId;
      const context = await securityContextFactory.createSecurityContext({ authHeader, targetTenantId: tenantId, ipAddress: req.ip });
      const tenantCtx = tenantIsolation.assertTenantIsolation(context.principal, tenantId, 'VERIFY_TENANT', context.requestId);
      res.json({ status: 'SUCCESS', tenantContext: tenantCtx, principal: context.principal });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/audit/logs', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const tenantId = req.query.tenantId as string;
      if (!tenantId) {
        return res.status(400).json({ error: { code: 'TENANT_REQUIRED', message: 'tenantId is required' } });
      }
      const context = await securityContextFactory.createSecurityContext({
        authHeader, targetTenantId: tenantId, ipAddress: req.ip,
      });
      tenantIsolation.assertTenantIsolation(context.principal, tenantId, 'READ_AUDIT_LOGS', context.requestId);
      const events = await (await import('./src/persistence/firestore/repositories/auditRepository')).auditRepository.listAudits(tenantId, 50);
      return res.json({ status: 'SUCCESS', events });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to read audit logs' } });
    }
  });

  // -------------------------------------------------------------
  // IDENTITY & CLAIMS MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/kernel/identity/provision', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: req.body.tenantId,
        targetBranchId: req.body.branchId,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.provisionTdbkIdentity(context, req.body);
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/kernel/identity/promote-owner', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.promoteToBusinessOwner(context, req.body);
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/kernel/identity/promote-operator', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { targetUid, tenantId, email } = req.body;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: tenantId,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.promoteToOwnerOperator(context, targetUid, tenantId, email);
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/kernel/identity/grant-master', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { targetUid, email } = req.body;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.grantMasterAdmin(context, targetUid, email);
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  /**
   * FIRST-TIME CLIENT ONBOARDING
   *
   * Authenticated Firebase users can initialize only their own
   * first TDBK Business Owner identity.
   */
  app.post('/api/kernel/identity/initialize-owner', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const identity =
        await tdbkIdentityService.initializeOwnerIdentity(
          context
        );

      res.json({
        status: 'SUCCESS',
        identity,
      });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else if (err instanceof AuthorizationError) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: err.message,
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: (err as Error).message,
          },
        });
      }
    }
  });

  app.post('/api/kernel/identity/promote-business-owner', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { targetUid, email, displayName } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.promoteToBusinessOwner(context, {
        targetUid,
        email,
        displayName,
      });

      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else if (err instanceof AuthorizationError) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: err.message,
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: (err as Error).message,
          },
        });
      }
    }
  });

  app.post('/api/kernel/identity/role', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: req.body.tenantId,
        targetBranchId: req.body.branchId,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.assignTenantRole(context, req.body);
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/kernel/identity/revoke', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: req.body.tenantId,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.revokeRole(context, req.body);
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/kernel/identity/bootstrap-master', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.bootstrapProductionMaster(context);
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else if (err instanceof AuthorizationError) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/kernel/identity/:uid', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const identity = await tdbkIdentityService.getIdentity(context, req.params.uid);
      if (!identity) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Identity '${req.params.uid}' not found` } });
      }
      res.json({ status: 'SUCCESS', identity });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/kernel/identity', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const tenantId = req.query.tenantId as string;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: tenantId,
        ipAddress: req.ip,
      });

      const identities = await tdbkIdentityService.listIdentities(context, tenantId);
      res.json({ status: 'SUCCESS', identities });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  // Test runner APIs remain registered for local developer tooling, but are
  // centrally blocked unless explicitly enabled outside production.
  // This guard covers every /api/test/* route, including future test runners.
  app.use('/api/test', (req: Request, res: Response, next) => {
    const enabled = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_API === 'true';
    if (!enabled) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    }
    return next();
  });

  app.post('/api/test/phase0', async (req: Request, res: Response) => {
    const testSummary = await phase0TestRunner.runAllTests();
    res.json({ status: 'SUCCESS', summary: testSummary });
  });

  // -------------------------------------------------------------
  // PHASE 1: BLUEPRINT & BUSINESS DNA ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/blueprints', async (req: Request, res: Response) => {
    res.json({ status: 'SUCCESS', blueprints: blueprintRegistry.getAllBlueprints() });
  });

  app.get('/api/blueprints/:id', async (req: Request, res: Response) => {
    const version = req.query.version as string;
    const blueprint = blueprintRegistry.getBlueprint(req.params.id, version);
    if (!blueprint) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Blueprint '${req.params.id}' not found` } });
      return;
    }
    res.json({ status: 'SUCCESS', blueprint });
  });

  app.patch('/api/dna/:dbkId/business-context', async (req: Request, res: Response) => {
    try {
      const { dbkId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader: req.headers.authorization,
        targetTenantId: dbkId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const dna = await businessDnaManager.updateBusinessContextNarrative(
        context,
        dbkId,
        typeof req.body?.narrative === 'string' ? req.body.narrative : ''
      );
      return res.json({ status: 'SUCCESS', dna });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to update Business Context narrative' } });
    }
  });

  app.get('/api/dna/:dbkId/recommendations', async (req: Request, res: Response) => {
    try {
      const { dbkId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader: req.headers.authorization,
        targetTenantId: dbkId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      const recommendations = await capabilityRecommendationEngine.recommendForDbk(context, dbkId);
      return res.json({ status: 'SUCCESS', ...recommendations });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to generate capability recommendations' } });
    }
  });

  app.get('/api/dna/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: req.params.dbkId,
        ipAddress: req.ip,
      });
      const dna = await businessDnaManager.getPersistentBusinessDna(context, req.params.dbkId);
      res.json({ status: 'SUCCESS', dna });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/dna/bind', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, businessName, blueprintId, blueprintVersion, branchTopology } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const dna = await businessDnaManager.bindBlueprintToDbkPersistent(
        context,
        dbkId,
        businessName,
        blueprintId,
        blueprintVersion,
        branchTopology
      );

      res.json({ status: 'SUCCESS', dna });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/blueprint/compile', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const workspace = await blueprintCompiler.compilePersistentWorkspace(context, dbkId);
      res.json({ status: 'SUCCESS', workspace });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/test/phase1', async (req: Request, res: Response) => {
    const summary = await Phase1TestRunner.runAllTests();
    res.json({ status: 'SUCCESS', summary });
  });

  // -------------------------------------------------------------
  // PHASE 2: CAPABILITY & ENTITLEMENT ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/capability/catalog', async (req: Request, res: Response) => {
    res.json({ status: 'SUCCESS', capabilities: capabilityRegistry.getAllCapabilities() });
  });

  app.get('/api/capability/discover/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: req.params.dbkId,
        ipAddress: req.ip,
      });

      const surface = await discoveryEngine.discoverPersistentCapabilitiesForDbk(context, req.params.dbkId);
      res.json({ status: 'SUCCESS', discoverySurface: surface });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/capability/enable', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, capabilityId } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const dna = await businessDnaManager.getPersistentBusinessDna(context, dbkId);
      const decision = await activationEvaluator.evaluatePersistentActivation(context, dbkId, capabilityId, dna);
      if (!decision.allowed) {
        res.status(403).json({ status: 'DENIED', decision });
        return;
      }

      const cap = capabilityRegistry.getCapability(capabilityId);
      if (!cap) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Capability '${capabilityId}' not found` } });
      }
      await dbkCapabilityManager.hydratePersistentCapability(context, dbkId, capabilityId);
      const record = await dbkCapabilityManager.persistCapabilityRecord(
        context,
        dbkCapabilityManager.enableCapability(
          context,
          dbkId,
          capabilityId,
          'ENTITLED',
          cap.configurationSchema.requiresConfiguration
        )
      );

      res.json({ status: 'SUCCESS', decision, record });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/capability/configure', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, capabilityId, configData } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      await dbkCapabilityManager.hydratePersistentCapability(context, dbkId, capabilityId);
      const record = await dbkCapabilityManager.persistCapabilityRecord(
        context,
        dbkCapabilityManager.configureCapability(context, dbkId, capabilityId, configData)
      );
      res.json({ status: 'SUCCESS', record });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/capability/disable', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, capabilityId } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      await dbkCapabilityManager.hydratePersistentCapability(context, dbkId, capabilityId);
      const record = await dbkCapabilityManager.persistCapabilityRecord(
        context,
        dbkCapabilityManager.disableCapability(context, dbkId, capabilityId)
      );
      res.json({ status: 'SUCCESS', record });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/capability/tier', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, tier } = req.body;
      if (!dbkId || !tier) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'dbkId and tier are required' } });
      }

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });
      tenantIsolation.assertTenantIsolation(
        context.principal,
        dbkId,
        'CHANGE_SUBSCRIPTION_TIER',
        context.requestId,
      );

      const validTiers = ['FREE', 'FOUNDATION', 'GROWTH', 'PRO', 'ENTERPRISE'] as const;
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid subscription tier' } });
      }

      const dbk = await dbkRegistry.getDbk(context, dbkId);
      if (!dbk) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'DBK not found' } });
      }

      dbk.subscriptionTier = tier;
      await dbkRegistry.saveDbk(context, dbk);
      entitlementEngine.setDbkSubscriptionTier(dbkId, tier);
      res.json({ status: 'SUCCESS', dbkId, currentTier: tier });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to change subscription tier' } });
    }
  });

  app.post('/api/test/phase2', async (req: Request, res: Response) => {
    const summary = await Phase2TestRunner.runAllTests();
    res.json({ status: 'SUCCESS', summary });
  });

  // -------------------------------------------------------------
  // PHASE 3: WORKFLOW ENGINE, EVENT BUS & BRIDGES ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/test/phase3', async (req: Request, res: Response) => {
    const summary = await Phase3TestRunner.runAllTests();
    res.json({ status: 'SUCCESS', summary });
  });

  // -------------------------------------------------------------
  // PHASE 4: PLATFORM CONTROL & DBK PROVISIONING ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/test/phase4', async (req: Request, res: Response) => {
    const summary = await runPhase4TestSuite();
    res.json({ status: 'SUCCESS', summary });
  });

  app.post('/api/test/dbk-provisioning', async (req: Request, res: Response) => {
    const summary = await runDbkProvisioningTestSuite();
    res.json({ status: 'SUCCESS', summary });
  });

  app.post('/api/platform/provision', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const result = await provisioningService.provisionDbk(context, req.body);
      res.json({ status: 'SUCCESS', result });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  // -------------------------------------------------------------
  // DBK LIFECYCLE CONTROL — TDBK MASTER AUTHORITY
  // -------------------------------------------------------------

  app.post('/api/platform/dbks/:dbkId/suspend', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const reason = req.body?.reason || 'Suspension requested via platform API';
      const dbk = await dbkLifecycleManager.suspendDbk(context, dbkId, reason);

      res.json({ status: 'SUCCESS', dbk });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: (err as Error).message,
          },
        });
      }
    }
  });

  app.post('/api/platform/dbks/:dbkId/reactivate', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const reason = req.body?.reason || 'Reactivation requested via platform API';
      const dbk = await dbkLifecycleManager.reactivateDbk(context, dbkId, reason);

      res.json({ status: 'SUCCESS', dbk });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: (err as Error).message,
          },
        });
      }
    }
  });

  app.post('/api/platform/dbks/:dbkId/archive', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const reason = req.body?.reason || 'Archive requested via platform API';
      const dbk = await dbkLifecycleManager.archiveDbk(context, dbkId, reason);

      res.json({ status: 'SUCCESS', dbk });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: (err as Error).message,
          },
        });
      }
    }
  });

  app.post('/api/platform/dbks/:dbkId/restore', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const reason = req.body?.reason || 'Restore requested via platform API';
      const dbk = await dbkLifecycleManager.restoreDbk(context, dbkId, reason);

      res.json({ status: 'SUCCESS', dbk });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: (err as Error).message,
          },
        });
      }
    }
  });

  app.get('/api/platform/dbks', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      const dbks = await dbkRegistry.listAllDbks(context);
      res.json({ status: 'SUCCESS', dbks });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/platform/projection/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const projection = await experienceProjection.getExperienceProjection(context, dbkId);
      res.json({ status: 'SUCCESS', projection });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  // -------------------------------------------------------------
  // PHASE 5: EXPERIENCE LAYER & DYNAMIC VIEW RESOLVER ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/test/phase5', async (req: Request, res: Response) => {
    const summary = await runPhase5TestSuite();
    res.json({ status: 'SUCCESS', summary });
  });

  app.get('/api/experience/resolve/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const targetBranchId = req.query.branchId as string;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        targetBranchId,
        ipAddress: req.ip,
      });

      const resolved = await experienceResolver.resolveExperience(context, dbkId);
      res.json({ status: 'SUCCESS', resolved });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/experience/command', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { commandType, targetDbkId, payload } = req.body;
      const targetBranchId = (payload && payload.branchId) as string;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: targetDbkId,
        targetBranchId,
        ipAddress: req.ip,
      });

      const commandResponse = await experienceResolver.dispatchCommand(context, {
        commandType,
        targetDbkId,
        payload,
      });

      res.json({ status: 'SUCCESS', commandResponse });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/experience/entities/:dbkId/:capabilityId', async (req: Request, res: Response) => {
    try {
      const { dbkId, capabilityId } = req.params;
      const authHeader = req.headers.authorization;
      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        targetBranchId: req.query.branchId as string | undefined,
        ipAddress: req.ip,
      });
      tenantIsolation.assertTenantIsolation(
        context.principal,
        dbkId,
        'READ_ENTITY_RECORDS',
        context.requestId,
      );
      const records = await entityEngine.listPersistentRecords(
        context,
        dbkId,
        capabilityId,
        req.query.branchId as string | undefined,
      );
      res.json({ status: 'SUCCESS', records });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to read entity records' } });
    }
  });

  // -------------------------------------------------------------
  // ROLE-BASED COHERENCE ENGINE (RBCE) ENDPOINTS
  // CORE: ONE BUSINESS. ONE SHARED REALITY. DIFFERENT ROLES. DIFFERENT EXPERIENCES.
  // -------------------------------------------------------------
  app.post('/api/test/coherence', async (req: Request, res: Response) => {
    const summary = await runCoherenceTestSuite();
    res.json({ status: 'SUCCESS', summary });
  });

  app.get('/api/coherence/resolve/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const targetSpaceId = req.query.spaceId as string | undefined;
      const activeRoleOverride = req.query.roleOverride as string | undefined;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const resolution = await roleBasedCoherenceEngine.resolveCoherentExperience(context, dbkId, {
        targetSpaceId,
        activeRoleOverride,
      });

      res.json({ status: 'SUCCESS', resolution });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/coherence/spaces/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const spaces = await roleBasedCoherenceEngine.getPersistentUserSpaces(context.principal.id, dbkId);
      res.json({ status: 'SUCCESS', spaces });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/coherence/contribute', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { tenantId, spaceId, contributionType, data, roleTitle } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: tenantId,
        ipAddress: req.ip,
      });

      const outcome = await contributionDispatcher.dispatchContribution(
        context,
        {
          contributionType,
          tenantId,
          spaceId,
          data,
        },
        roleTitle
      );

      res.json({ status: 'SUCCESS', outcome });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/coherence/requests', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { tenantId, spaceId, capabilityId, capabilityName, justification } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: tenantId,
        ipAddress: req.ip,
      });

      const request = await capabilityAccessStore.createPersistentRequest(context, {
        tenantId,
        spaceId,
        requesterId: context.principal.id,
        requesterName: context.principal.id,
        requesterRole: context.principal.roles[0] || 'STAFF',
        capabilityId,
        capabilityName,
        justification,
      });

      res.json({ status: 'SUCCESS', request });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/coherence/requests/:requestId/approve', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { requestId } = req.params;
      const { reviewNotes, tenantId } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      if (!tenantId) return res.status(400).json({ error: { code: 'TENANT_REQUIRED', message: 'tenantId is required' } });
      const approved = await capabilityAccessStore.approvePersistentRequest(context, requestId, tenantId, context.principal.id, reviewNotes);
      res.json({ status: 'SUCCESS', request: approved });
    } catch (err) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
    }
  });

  app.post('/api/coherence/requests/:requestId/reject', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { requestId } = req.params;
      const { reason, tenantId } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        ipAddress: req.ip,
      });

      if (!tenantId) return res.status(400).json({ error: { code: 'TENANT_REQUIRED', message: 'tenantId is required' } });
      const rejected = await capabilityAccessStore.rejectPersistentRequest(context, requestId, tenantId, context.principal.id, reason);
      res.json({ status: 'SUCCESS', request: rejected });
    } catch (err) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
    }
  });

  app.get('/api/coherence/display/:spaceId/:surfaceType', async (req: Request, res: Response) => {
    try {
      const { spaceId, surfaceType } = req.params;
      const tenantId = req.query.tenantId as string | undefined;
      const { title, sourceEvent, message, details } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: { code: 'TENANT_REQUIRED', message: 'tenantId is required' } });
      }

      const context = await securityContextFactory.createSecurityContext({
        authHeader: req.headers.authorization,
        targetTenantId: tenantId,
        ipAddress: req.ip,
      });

      tenantIsolation.assertTenantIsolation(
        context.principal,
        tenantId,
        'RENDER_SPACE_DISPLAY',
        context.requestId,
      );

      if (!masterAuthority.isMasterAdmin(context.principal)) {
        const memberships = await roleBasedCoherenceEngine.getPersistentUserSpaces(context.principal.id, tenantId);
        const hasSpaceAccess = memberships.some((item) => item.space.spaceId === spaceId);
        if (!hasSpaceAccess) {
          throw new AuthorizationError(
            'User is not authorized to render the requested display space',
            context.requestId,
          );
        }
      }

      const rendered = multiSurfaceRenderer.renderToSurface(surfaceType as SurfaceType, spaceId, {
        title: (title as string) || 'Digital Screen Notice',
        sourceEvent: (sourceEvent as string) || 'display.broadcast.v1',
        primaryMessage: (message as string) || 'Active Business Operation Nominal',
        secondaryDetails: details as string | undefined,
      });

      res.json({ status: 'SUCCESS', rendered });
    } catch (err) {
      if (err instanceof KernelError) return res.status(err.statusCode).json(err.toJSON());
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to render display' } });
    }
  });

  // -------------------------------------------------------------
  // PHASE 6: ADVANCED DOCUMENT INGESTION & AI BOUNDARY ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/test/phase6', async (req: Request, res: Response) => {
    const summary = await runPhase6TestSuite();
    res.json({ status: 'SUCCESS', summary });
  });

  app.post('/api/documents/upload', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { tenantId, branchId, fileName, mimeType, fileBufferBase64, textContent, source } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: tenantId,
        targetBranchId: branchId,
        ipAddress: req.ip,
      });

      const doc = await documentIngestionService.ingestDocument(context, {
        tenantId,
        branchId,
        fileName,
        mimeType,
        fileBufferBase64,
        textContent,
        source,
      });

      res.json({ status: 'SUCCESS', document: doc });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/documents/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const branchId = req.query.branchId as string;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        targetBranchId: branchId,
        ipAddress: req.ip,
      });

      const docs = await documentStore.listPersistentDocuments(context, dbkId, branchId);
      res.json({ status: 'SUCCESS', documents: docs });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/documents/:dbkId/:documentId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, documentId } = req.params;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const doc = await documentStore.getPersistentDocument(context, dbkId, documentId);
      if (!doc) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
      }
      res.json({ status: 'SUCCESS', document: doc });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/documents/:dbkId/:documentId/process', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, documentId } = req.params;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const doc = await documentStore.getPersistentDocument(context, dbkId, documentId);
      if (!doc) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
      }

      // Transition to PROCESSING
      await documentLifecycleManager.transitionPersistentStatus(context, dbkId, documentId, 'PROCESSING');

      const raw = (await documentStore.getRawContent(context, doc)) || doc.contentSnippet || '';
      const classification = documentClassifier.classifyDocument(raw, doc.fileName);
      const extraction = documentExtractor.extractStructuredData(raw, classification.type);

      const targetStatus = extraction.requiresReview ? 'REVIEW_REQUIRED' : 'EXTRACTED';

      const updated = await documentLifecycleManager.recordPersistentProcessingSnapshot(context, dbkId, documentId, {
        provider: 'tdbk-hybrid-engine',
        model: 'gemini-2.5-flash',
        classification,
        extractedFields: extraction.extractedFields,
        confidenceAverage: extraction.confidenceAverage,
        durationMs: 120,
        status: targetStatus,
        notes: extraction.requiresReview ? 'Low confidence flags detected, human review queued' : 'Extraction complete',
      });

      // Auto-generate proposal if review is ready
      if (classification.type === 'invoice') {
        const amt = extraction.extractedFields.totalAmount?.value || 0;
        const ref = extraction.extractedFields.referenceNumber?.value || 'INV-TEMP';
        await aiCommandBoundary.createPersistentProposal(context, {
          tenantId: dbkId,
          branchId: doc.branchId,
          documentId,
          proposalType: 'PROPOSE_CREATE_INVOICE',
          suggestedPayload: { invoiceNumber: ref, amount: amt, branchId: doc.branchId },
          confidence: extraction.confidenceAverage,
          summary: `Register invoice ${ref} for KES ${amt}`,
        });
      }

      res.json({ status: 'SUCCESS', document: updated, extraction });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.delete('/api/documents/:dbkId/:documentId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, documentId } = req.params;
      const reason = (req.body && req.body.reason) || 'Manual deletion request';

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      await documentStore.deletePersistentDocument(context, dbkId, documentId, reason);
      res.json({ status: 'SUCCESS', message: 'Document removed or archived per policy' });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/ai/proposals/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const status = req.query.status as any;
      const branchId = req.query.branchId as string | undefined;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const proposals = await aiCommandBoundary.listPersistentProposals(context, dbkId, status, branchId);
      res.json({ status: 'SUCCESS', proposals });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/ai/proposals/:dbkId/:proposalId/approve', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, proposalId } = req.params;
      const { adjustedPayload } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const result = await aiCommandBoundary.approveProposal(context, dbkId, proposalId, adjustedPayload);
      res.json({ status: 'SUCCESS', ...result });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/ai/proposals/:dbkId/:proposalId/reject', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId, proposalId } = req.params;
      const { reason } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        ipAddress: req.ip,
      });

      const result = await aiCommandBoundary.rejectProposal(context, dbkId, proposalId, reason || 'Rejected by reviewer');
      res.json({ status: 'SUCCESS', proposal: result });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.get('/api/ai/conversation/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const branchId = (req.query.branchId as string) || 'HQ';

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        targetBranchId: branchId,
        ipAddress: req.ip,
      });

      const conv = await aiMemoryManager.getPersistentConversation(context, dbkId, branchId);
      res.json({ status: 'SUCCESS', conversation: conv });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  app.post('/api/ai/conversation/:dbkId', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const { dbkId } = req.params;
      const { message, branchId } = req.body;

      const context = await securityContextFactory.createSecurityContext({
        authHeader,
        targetTenantId: dbkId,
        targetBranchId: branchId,
        ipAddress: req.ip,
      });

      // 1. Sanitize user prompt for prompt injection
      const sanitized = aiSecurityGuard.sanitizeInput(context, message, 'PROMPT');

      // 2. Add user message to conversation
      await aiMemoryManager.addPersistentMessage(context, dbkId, branchId || 'HQ', `conv_${context.principal.id}_${branchId || 'HQ'}`, {
        sender: 'USER',
        text: message,
        untrustedWarning: sanitized.isFlagged,
      });

      // 3. Assemble tenant context
      const tenantContext = aiMemoryManager.assembleTenantContext(context, dbkId, branchId || 'HQ');

      // 4. Generate AI response
      const aiResponse = await aiProvider.generateText({
        tenantId: dbkId,
        branchId: branchId || 'HQ',
        principalId: context.principal.id,
        task: 'ASSISTANT_QUERY',
        prompt: sanitized.sanitizedPrompt,
        untrustedDocumentContent: tenantContext.contextPrompt,
        correlationId: context.correlationId,
      });

      // 5. Add AI assistant message
      const assistantMsg = await aiMemoryManager.addPersistentMessage(context, dbkId, branchId || 'HQ', `conv_${context.principal.id}_${branchId || 'HQ'}`, {
        sender: 'AI_ASSISTANT',
        text: aiResponse.data || 'I am your TDBK Assistant. How can I help you today?',
      });

      res.json({ status: 'SUCCESS', message: assistantMsg, isFlagged: sanitized.isFlagged });
    } catch (err) {
      if (err instanceof KernelError) {
        res.status(err.statusCode).json(err.toJSON());
      } else {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error).message } });
      }
    }
  });

  // -------------------------------------------------------------
  // VITE DEV / PRODUCTION MIDDLEWARE
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TDBK_V2_KERNEL] Express Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
