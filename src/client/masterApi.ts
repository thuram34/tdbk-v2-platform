export interface MasterVerificationResult {
  isMaster: boolean;
  principal?: {
    id: string;
    email?: string;
    isMaster: boolean;
    roles: string[];
    permissions: string[];
  };
}

export async function verifyMasterAuthority(
  idToken: string,
): Promise<MasterVerificationResult> {
  const response = await fetch('/api/master/verify', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    return {
      isMaster: false,
    };
  }

  const data = await response.json();

  return {
    isMaster: data.status === 'SUCCESS' &&
      data.principal?.isMaster === true,
    principal: data.principal,
  };
}

export async function bootstrapMaster(
  idToken: string,
): Promise<void> {
  const response = await fetch(
    '/api/kernel/identity/bootstrap-master',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Bootstrap failed with status ${response.status}`,
    );
  }
}
