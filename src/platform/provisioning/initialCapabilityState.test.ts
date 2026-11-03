import { describe, expect, it } from 'vitest';
import { resolveInitialCapabilityState } from './initialCapabilityState';

describe('resolveInitialCapabilityState', () => {
  it('enables only entitled default capabilities that require no configuration', () => {
    expect(resolveInitialCapabilityState(true, true, false)).toEqual({
      state: 'ENABLED',
      isConfigured: true,
    });
  });

  it('keeps entitled non-default capabilities inactive until selected', () => {
    expect(resolveInitialCapabilityState(true, false, false)).toEqual({
      state: 'ENTITLED',
      isConfigured: true,
    });
  });

  it('does not mark a configuration-required default capability configured', () => {
    expect(resolveInitialCapabilityState(true, true, true)).toEqual({
      state: 'ENTITLED',
      isConfigured: false,
    });
  });

  it('keeps configuration-required non-default capabilities gated', () => {
    expect(resolveInitialCapabilityState(true, false, true)).toEqual({
      state: 'ENTITLED',
      isConfigured: false,
    });
  });

  it('does not activate capabilities above the DBK subscription tier', () => {
    expect(resolveInitialCapabilityState(false, true, false)).toEqual({
      state: 'DISCOVERABLE',
      isConfigured: true,
    });
  });
});
