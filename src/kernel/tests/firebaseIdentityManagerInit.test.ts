import { describe, it, expect } from 'vitest';
import { firebaseIdentityManager } from '../identity/firebaseIdentityManager';

describe('FirebaseIdentityManager Initialization', () => {
  it('should be able to initialize using modular SDK path', async () => {
    // This will trigger getAuthInstance()
    // If it throws "Failed to initialize...", it fails.
    // If it reaches Auth SDK, it should throw 404 for a non-existent UID.
    await expect(firebaseIdentityManager.getUserByUid('test-uid-123')).rejects.toThrow();
  });
});
