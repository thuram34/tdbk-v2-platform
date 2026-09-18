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