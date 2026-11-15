/** TDBK V2 — authenticated digital asset registry HTTP boundary. */
import { Router, Request, Response } from 'express';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { digitalAssetRegistryService } from './digitalAssetRegistryService';

export const digitalAssetRouter = Router();

async function contextFor(req: Request) {
  return securityContextFactory.createSecurityContext({
    authHeader: req.headers.authorization,
    targetTenantId: req.params.tenantId,
    targetBranchId: req.body?.branchId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

function sendError(res: Response, error: unknown) {
  if (error instanceof KernelError) return res.status(error.statusCode).json(error.toJSON());
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Digital asset operation failed.',
    },
  });
}

digitalAssetRouter.get('/:tenantId', async (req, res) => {
  try {
    const context = await contextFor(req);
    const assets = await digitalAssetRegistryService.listAssets(context, req.params.tenantId);
    return res.json({ status: 'SUCCESS', assets });
  } catch (error) { return sendError(res, error); }
});

digitalAssetRouter.get('/:tenantId/:assetId', async (req, res) => {
  try {
    const context = await contextFor(req);
    const asset = await digitalAssetRegistryService.getAsset(context, req.params.tenantId, req.params.assetId);
    if (!asset) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Digital asset not found.' } });
    return res.json({ status: 'SUCCESS', asset });
  } catch (error) { return sendError(res, error); }
});

digitalAssetRouter.post('/:tenantId', async (req, res) => {
  try {
    const context = await contextFor(req);
    const result = await digitalAssetRegistryService.registerAsset(context, req.params.tenantId, req.body);
    return res.status(result.idempotent ? 200 : 201).json({ status: 'SUCCESS', ...result });
  } catch (error) { return sendError(res, error); }
});

digitalAssetRouter.post('/:tenantId/:assetId/ownership', async (req, res) => {
  try {
    const context = await contextFor(req);
    const asset = await digitalAssetRegistryService.recordOwnershipChange(
      context, req.params.tenantId, req.params.assetId, req.body,
    );
    return res.json({ status: 'SUCCESS', asset });
  } catch (error) { return sendError(res, error); }
});

digitalAssetRouter.post('/:tenantId/:assetId/valuations', async (req, res) => {
  try {
    const context = await contextFor(req);
    const asset = await digitalAssetRegistryService.recordValuation(
      context, req.params.tenantId, req.params.assetId, req.body,
    );
    return res.status(201).json({ status: 'SUCCESS', asset });
  } catch (error) { return sendError(res, error); }
});
