import * as crypto from 'crypto';

const TEST_SECRET = 'tdbk_test_signature_secret_key';

export function signTestToken(payload: any): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', TEST_SECRET).update(`${header}.${b64Payload}`).digest('base64url');
    return `${header}.${b64Payload}.${signature}`;
}

export function verifyTestToken(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error("Invalid token format");
    const header = parts[0];
    const payload = parts[1];
    const signature = parts[2];
    
    const expectedSig = crypto.createHmac('sha256', TEST_SECRET).update(`${header}.${payload}`).digest('base64url');
    if (signature !== expectedSig) {
        throw new Error("Invalid signature");
    }
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
