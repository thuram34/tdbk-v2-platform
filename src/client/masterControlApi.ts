import type {
  DbkIdentity,
  DbkExperienceProjection,
} from '../platform/types';

import type { SubscriptionTier } from '../capability/types';

export interface ProvisionDbkRequest {
  dbkId: string;
  legalName: string;
  displayName: string;
  blueprintId: string;
  subscriptionTier: SubscriptionTier;
  primaryBranchName: string;
  secondaryBranches: Array<{
    branchId: string;
    name: string;
    type: string;
  }>;
}

interface ApiResponse<T> {
  status: string;
  result?: T;
  dbks?: DbkIdentity[];
  projection?: DbkExperienceProjection;
  dbk?: DbkIdentity;
  error?: {
    code?: string;
    message?: string;
  };
}

async function request<T>(
  path: string,
  idToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

export async function listDbks(
  idToken: string,
): Promise<DbkIdentity[]> {
  const data = await request<ApiResponse<never>>(
    '/api/platform/dbks',
    idToken,
  );

  return data.dbks || [];
}

export async function getExperienceProjection(
  idToken: string,
  dbkId: string,
): Promise<DbkExperienceProjection> {
  const data = await request<ApiResponse<never>>(
    `/api/platform/projection/${encodeURIComponent(dbkId)}`,
    idToken,
  );

  if (!data.projection) {
    throw new Error('Experience projection was not returned.');
  }

  return data.projection;
}

export async function provisionDbk(
  idToken: string,
  payload: ProvisionDbkRequest,
): Promise<any> {
  const data = await request<ApiResponse<any>>(
    '/api/platform/provision',
    idToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return data.result;
}

async function lifecycleAction(
  idToken: string,
  dbkId: string,
  action: 'suspend' | 'reactivate' | 'archive' | 'restore',
  reason: string,
): Promise<DbkIdentity> {
  const data = await request<ApiResponse<never>>(
    `/api/platform/dbks/${encodeURIComponent(dbkId)}/${action}`,
    idToken,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );

  if (!data.dbk) {
    throw new Error(`Lifecycle action '${action}' returned no DBK.`);
  }

  return data.dbk;
}

export const suspendDbk = (
  idToken: string,
  dbkId: string,
  reason: string,
) => lifecycleAction(idToken, dbkId, 'suspend', reason);

export const reactivateDbk = (
  idToken: string,
  dbkId: string,
  reason: string,
) => lifecycleAction(idToken, dbkId, 'reactivate', reason);

export const archiveDbk = (
  idToken: string,
  dbkId: string,
  reason: string,
) => lifecycleAction(idToken, dbkId, 'archive', reason);

export const restoreDbk = (
  idToken: string,
  dbkId: string,
  reason: string,
) => lifecycleAction(idToken, dbkId, 'restore', reason);
