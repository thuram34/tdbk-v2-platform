/**
 * TDBK V2 CONFIGURATION & SECRETS MANAGER
 * Architectural Layer: LAYER 1 — KERNEL
 */

export interface PublicConfig {
  appName: string;
  environment: string;
  apiVersion: string;
  tenantIsolationMode: 'STRICT_HIERARCHICAL';
}

export interface PrivateSecrets {
  geminiApiKey?: string;
  firebaseServiceAccount?: string;
  masterAuthSecret?: string;
  mpesaPasskey?: string;
}

class ConfigurationManager {
  private publicConfig: PublicConfig = {
    appName: 'TDBK V2 Platform Architecture Engine',
    environment: process.env.NODE_ENV || 'development',
    apiVersion: '2.0.0-phase0',
    tenantIsolationMode: 'STRICT_HIERARCHICAL',
  };

  public getPublicConfig(): PublicConfig {
    return { ...this.publicConfig };
  }

  /**
   * Accesses private secrets on the server-side.
   * Throws if executed in browser window scope to prevent key leakage.
   */
  public getPrivateSecrets(): PrivateSecrets {
    if (typeof window !== 'undefined') {
      throw new Error('SECURITY VIOLATION: Private secrets cannot be accessed in browser context!');
    }

    const masterAuthSecret = process.env.MASTER_AUTH_SECRET;

    if (process.env.NODE_ENV === 'production' && !masterAuthSecret) {
      throw new Error('FATAL: MASTER_AUTH_SECRET is required in production.');
    }

    return {
      geminiApiKey: process.env.GEMINI_API_KEY,
      firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
      masterAuthSecret,
      mpesaPasskey: process.env.MPESA_PASSKEY,
    };
  }
}

export const configManager = new ConfigurationManager();
