export interface LabStatusResponse {
  status: 'SUCCESS';
  checkedAt: string;
  platform: {
    environment: string;
    nodeVersion: string;
    health: unknown;
  };
  browserWorker: {
    status: 'NOT_CONFIGURED' | 'ONLINE' | 'UNREACHABLE';
    details: {
      version?: string;
      browser?: string;
      activeJobs?: number;
      activeSessions?: number;
      allowlistConfigured?: boolean;
    };
  };
  capabilities: Record<string, 'AVAILABLE' | 'IMPLEMENTED' | 'PLANNED'>;
}

export async function getLabStatus(idToken: string): Promise<LabStatusResponse> {
  const response = await fetch('/api/lab/status', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + idToken },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || 'LAB status request failed (' + response.status + ').');
  }
  return data as LabStatusResponse;
}
