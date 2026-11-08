import { Router, Request, Response } from 'express';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { globalIncomeService } from './globalIncomeService';
import { Opportunity, OpportunityStage } from './types';
import { ApplicationStatus } from './applicationTypes';

export const globalIncomeRouter = Router();

async function contextFor(req: Request) {
  return securityContextFactory.createSecurityContext({
    authHeader: req.headers.authorization,
    targetTenantId: typeof req.body?.tenantId === 'string' ? req.body.tenantId : (req.query.tenantId as string),
    targetBranchId: typeof req.body?.branchId === 'string' ? req.body.branchId : (req.query.branchId as string),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}
function fail(res: Response, error: unknown) {
  if (error instanceof KernelError) return res.status(error.statusCode).json(error.toJSON());
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
}

globalIncomeRouter.get('/opportunities', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || (req.query.tenantId as string);
    if (!tenantId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.listOpportunities(ctx, tenantId) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/opportunities', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const item = req.body?.opportunity as Opportunity;
    if (!item || typeof item.opportunityId !== 'string' || typeof item.ownerId !== 'string' || typeof item.deduplicationKey !== 'string') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A complete opportunity record is required.' } });
    }
    return res.status(201).json({ status: 'SUCCESS', data: await globalIncomeService.createOpportunity(ctx, item) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/opportunities/:id/verify', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || String(req.body?.tenantId || '');
    if (!tenantId || !req.body?.evidence) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId and evidence are required.' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.verifyOpportunity(ctx, tenantId, req.params.id, req.body.evidence) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/opportunities/:id/score', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || String(req.body?.tenantId || '');
    if (!tenantId || !req.body?.dimensions) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId and scoring dimensions are required.' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.scoreOpportunityRecord(ctx, tenantId, req.params.id, req.body.dimensions, req.body.hardExclusionReasons || []) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/opportunities/:id/transition', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || String(req.body?.tenantId || '');
    const stage = req.body?.stage as OpportunityStage;
    if (!tenantId || typeof stage !== 'string') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId and stage are required.' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.transitionOpportunity(ctx, tenantId, req.params.id, stage) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.get('/applications', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || (req.query.tenantId as string);
    if (!tenantId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.listApplications(ctx, tenantId) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/applications', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const input = req.body?.application;
    if (!input || typeof input.applicationId !== 'string' || typeof input.opportunityId !== 'string') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'applicationId and opportunityId are required.' } });
    }
    return res.status(201).json({ status: 'SUCCESS', data: await globalIncomeService.createApplication(ctx, input) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/applications/:id/transition', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || String(req.body?.tenantId || '');
    const status = req.body?.status as ApplicationStatus;
    if (!tenantId || typeof status !== 'string') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId and status are required.' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.transitionApplication(ctx, tenantId, req.params.id, status, req.body?.evidenceUrls) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.get('/approvals', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || (req.query.tenantId as string);
    if (!tenantId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId is required' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.listApprovals(ctx, tenantId) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/approvals', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const input = req.body?.approval;
    if (!input || typeof input.approvalId !== 'string' || typeof input.action !== 'string' || typeof input.targetId !== 'string') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'approvalId, action and targetId are required.' } });
    }
    return res.status(201).json({ status: 'SUCCESS', data: await globalIncomeService.createApproval(ctx, input) });
  } catch (error) { return fail(res, error); }
});

globalIncomeRouter.post('/approvals/:id/decision', async (req, res) => {
  try {
    const ctx = await contextFor(req);
    const tenantId = ctx.principal.tenantId || String(req.body?.tenantId || '');
    const decision = req.body?.decision;
    if (!tenantId || !['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'tenantId and a valid decision are required.' } });
    return res.json({ status: 'SUCCESS', data: await globalIncomeService.decideApproval(ctx, tenantId, req.params.id, decision, req.body?.note ?? null) });
  } catch (error) { return fail(res, error); }
});
