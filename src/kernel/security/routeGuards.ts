import { NextFunction, Request, Response } from 'express';
import { securityContextFactory } from '../context/contextFactory';
import { masterAuthority } from '../master/masterAuthority';
import { tenantIsolation } from '../tenancy/tenantIsolation';

declare global {
  namespace Express {
    interface Request {
      securityContext?: any;
    }
  }
}

function getTenantIdFromRequest(req: Request): string | undefined {
  return (
    (req.params?.tenantId as string | undefined) ??
    (req.params?.dbkId as string | undefined) ??
    (req.query?.tenantId as string | undefined) ??
    (req.body?.tenantId as string | undefined)
  );
}

function getBranchIdFromRequest(req: Request): string | undefined {
  return (
    (req.params?.branchId as string | undefined) ??
    (req.query?.branchId as string | undefined) ??
    (req.body?.branchId as string | undefined)
  );
}

export async function attachSecurityContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = typeof req.headers.authorization === 'string'
      ? req.headers.authorization
      : undefined;

    const tenantId = getTenantIdFromRequest(req);
    const branchId = getBranchIdFromRequest(req);

    const context = await securityContextFactory.createSecurityContext({
      authHeader,
      targetTenantId: tenantId,
      targetBranchId: branchId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req.headers['x-request-id'] as string | undefined) ?? undefined,
      correlationId: (req.headers['x-correlation-id'] as string | undefined) ?? undefined,
    });

    req.securityContext = context;

    if (tenantId) {
      tenantIsolation.validateTenantBoundary(
        context.principal,
        tenantId,
        context.requestId,
      );
    }

    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    res.status(401).json({
      error: { code: 'AUTHENTICATION_FAILED', message },
    });
  }
}

export function requireTenantScope(action: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = getTenantIdFromRequest(req);
      if (!tenantId) {
        return res.status(400).json({
          error: { code: 'TENANT_REQUIRED', message: 'tenantId is required' },
        });
      }

      const context = req.securityContext;
      if (!context) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Security context missing' },
        });
      }

      await masterAuthority.assertTenantAuthority(
        context.principal,
        tenantId,
        action,
        context.requestId,
      );

      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tenant access denied';
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message },
      });
    }
  };
}

export function requireOwnerOrMaster(action: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      const context = req.securityContext;
      if (!context) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Security context missing' },
        });
      }

      masterAuthority.assertOwnerOrMasterAuthority(
        context.principal,
        action,
        context.requestId,
      );
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Owner/master authority required';
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message },
      });
    }
  };
}

export function requireMasterOnly(action: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      const context = req.securityContext;
      if (!context) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Security context missing' },
        });
      }

      masterAuthority.assertMasterAuthority(
        context.principal,
        action,
        context.requestId,
      );
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Master authority required';
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message },
      });
    }
  };
}
