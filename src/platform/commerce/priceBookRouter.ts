/** TDBK V2 — commercial price book HTTP boundary. */
import { Router, Request, Response } from 'express';
import { securityContextFactory } from '../../kernel/context/contextFactory';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { priceBookService } from './priceBookService';

export const priceBookRouter = Router();

const contextFor = (req: Request) => securityContextFactory.createSecurityContext({
  authHeader: req.headers.authorization,
  targetTenantId: req.params.tenantId || req.body?.tenantId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

function sendError(res: Response, error: unknown) {
  if (error instanceof KernelError) return res.status(error.statusCode).json(error.toJSON());
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Price book operation failed.' } });
}

priceBookRouter.get('/:tenantId', async (req, res) => {
  try {
    const context = await contextFor(req);
    if (context.tenantContext?.tenantId !== req.params.tenantId) {
      return res.status(403).json({ error: { code: 'TENANT_ISOLATION_ERROR', message: 'Tenant context mismatch.' } });
    }
    const priceBook = await priceBookService.getPublished(context);
    return res.json({ status: 'SUCCESS', priceBook });
  } catch (error) { return sendError(res, error); }
});

priceBookRouter.post('/publish', async (req, res) => {
  try {
    const context = await contextFor(req);
    const priceBook = await priceBookService.publish(context, req.body);
    return res.status(201).json({ status: 'SUCCESS', priceBook });
  } catch (error) { return sendError(res, error); }
});
