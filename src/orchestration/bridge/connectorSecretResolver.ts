import { GoogleAuth } from 'google-auth-library';
import type { ConnectorSecretReference } from '../../persistence/types';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

export async function resolveConnectorSecret(reference: ConnectorSecretReference): Promise<string> {
  if (reference.provider === 'CLOUD_RUN_ENV') {
    const value = process.env[reference.name];
    if (!value) throw new Error(`Connector secret environment variable '${reference.name}' is not configured.`);
    return value;
  }

  if (reference.provider !== 'GCP_SECRET_MANAGER') {
    throw new Error(`Unsupported connector secret provider '${reference.provider}'.`);
  }

  const name = reference.name.includes('/versions/')
    ? reference.name
    : `${reference.name}/versions/latest`;

  const client = await auth.getClient();
  const response = await client.request<{ payload?: { data?: string } }>({
    url: `https://secretmanager.googleapis.com/v1/${name}:access`,
    method: 'GET',
  });

  const encoded = response.data.payload?.data;
  if (!encoded) throw new Error(`Secret '${reference.name}' has no accessible payload.`);
  return Buffer.from(encoded, 'base64').toString('utf8');
}
