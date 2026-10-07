import { describe, expect, it, vi } from 'vitest';
import { dispatchExperienceCommand } from '../experienceCommandClient';

describe('frontend -> experience command transport contract', () => {
  it('sends authenticated tenant/branch context and returns only an authoritative success response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'SUCCESS',
          commandResponse: {
            success: true,
            commandType: 'EXECUTE_VERTICAL_OPERATION',
            targetDbkId: 'dbk_test',
            result: {
              recordId: 'record_001',
              status: 'COMPLETED',
            },
            serverTimestamp: '2026-10-07T18:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await dispatchExperienceCommand({
      getIdToken: vi.fn().mockResolvedValue('test-token'),
      dbkId: 'dbk_test',
      branchId: 'branch_hq',
      commandType: 'EXECUTE_VERTICAL_OPERATION',
      payload: {
        capabilityId: 'student_records',
        operation: 'COMPLETE_RECORD',
        recordId: 'record_001',
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/experience/command',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          commandType: 'EXECUTE_VERTICAL_OPERATION',
          targetDbkId: 'dbk_test',
          payload: {
            capabilityId: 'student_records',
            operation: 'COMPLETE_RECORD',
            recordId: 'record_001',
            branchId: 'branch_hq',
          },
        }),
      }),
    );
    expect(result.commandResponse.result?.status).toBe('COMPLETED');
  });

  it('rejects a non-2xx backend response instead of treating it as a successful command', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ERROR',
          error: { code: 'AUTHORIZATION_ERROR', message: 'Not authorized.' },
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      dispatchExperienceCommand({
        getIdToken: vi.fn().mockResolvedValue('test-token'),
        dbkId: 'dbk_test',
        branchId: 'branch_hq',
        commandType: 'EXECUTE_VERTICAL_OPERATION',
        payload: {},
        fetchImpl,
      }),
    ).rejects.toThrow('Not authorized.');
  });

  it('rejects a 200 response whose commandResponse says the operation failed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'SUCCESS',
          commandResponse: {
            success: false,
            commandType: 'EXECUTE_VERTICAL_OPERATION',
            targetDbkId: 'dbk_test',
            error: { code: 'CONFLICT', message: 'Cannot complete from state PENDING.' },
            serverTimestamp: '2026-10-07T18:00:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      dispatchExperienceCommand({
        getIdToken: vi.fn().mockResolvedValue('test-token'),
        dbkId: 'dbk_test',
        branchId: 'branch_hq',
        commandType: 'EXECUTE_VERTICAL_OPERATION',
        payload: {},
        fetchImpl,
      }),
    ).rejects.toThrow('Cannot complete from state PENDING.');
  });

  it('rejects a malformed success response with no command response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      dispatchExperienceCommand({
        getIdToken: vi.fn().mockResolvedValue('test-token'),
        dbkId: 'dbk_test',
        commandType: 'EXECUTE_VERTICAL_OPERATION',
        payload: {},
        fetchImpl,
      }),
    ).rejects.toThrow('The server returned no command response.');
  });
});
