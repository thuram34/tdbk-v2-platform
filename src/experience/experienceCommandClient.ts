import type { ExperienceCommandResponse } from './types';

export interface ExperienceCommandTransportOptions {
  getIdToken: () => Promise<string | null>;
  dbkId: string;
  branchId?: string;
  commandType: string;
  payload: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}

export interface ExperienceCommandTransportResult {
  status: string;
  commandResponse: ExperienceCommandResponse;
}

export async function dispatchExperienceCommand(
  options: ExperienceCommandTransportOptions,
): Promise<ExperienceCommandTransportResult> {
  const {
    getIdToken,
    dbkId,
    branchId,
    commandType,
    payload,
    fetchImpl = fetch,
  } = options;

  if (!dbkId) {
    throw new Error('A target DBK is required for an experience command.');
  }

  const idToken = await getIdToken();
  if (!idToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetchImpl('/api/experience/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      commandType,
      targetDbkId: dbkId,
      payload: {
        ...payload,
        ...(branchId ? { branchId } : {}),
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || data.commandResponse?.error?.message || 'The action could not be completed.');
  }

  const commandResponse = data.commandResponse as ExperienceCommandResponse | undefined;
  if (!commandResponse) {
    throw new Error('The server returned no command response.');
  }

  if (commandResponse.success !== true) {
    throw new Error(commandResponse.error?.message || 'The action could not be completed.');
  }

  return {
    status: String(data.status || 'SUCCESS'),
    commandResponse,
  };
}
