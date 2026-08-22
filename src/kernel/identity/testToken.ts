/**
 * TDBK V2 TEST TOKEN UTILITY
 *
 * Browser-safe test-token minting for development/test UI flows.
 * Production authentication verification remains exclusively in tokenVerifier.ts.
 */

import type { DecodedToken } from './tokenVerifier';

function base64Encode(str: string): string {
  if (typeof btoa !== 'undefined') {
    const bytes = new TextEncoder().encode(str);
    let binary = '';

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }

  throw new Error('Base64 encode unavailable');
}

export function mintTestToken(payload: DecodedToken): string {
  if (
    typeof process !== 'undefined' &&
    process.env?.NODE_ENV === 'production'
  ) {
    throw new Error(
      'FATAL: mintTestToken cannot be used in a production environment.'
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const defaultToken: DecodedToken = {
    iat: now,
    exp: now + 3600,
    ...payload,
  };

  return base64Encode(JSON.stringify(defaultToken));
}
