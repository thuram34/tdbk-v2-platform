import { describe, it, expect, beforeEach } from 'vitest';
import { firebaseIdentityManager } from '../identity/firebaseIdentityManager';

describe('FirebaseIdentityManager Initialization', () => {
  beforeEach(() => {
    // Keep the initialization test deterministic and independent of external
    // Firebase credentials/network availability in CI.
    firebaseIdentityManager._setAdminForTesting({
      auth: () => ({
        getUser: async () => {
          throw new Error('USER_NOT_FOUND');
        },
      }),
    });
  });

  it('should be able to initialize using the modular SDK auth path', async () => {
    await expect(firebaseIdentityManager.getUserByUid('test-uid-123')).rejects.toThrow('Firebase user with UID');
  });
});
