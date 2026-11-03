import { CapabilityLifecycleState } from '../../capability/types';

export interface InitialCapabilityState {
  state: CapabilityLifecycleState;
  isConfigured: boolean;
}

/**
 * Resolves the safe initial state for a capability during DBK provisioning.
 * Blueprint selection grants scope, not proof of configuration or activation.
 */
export function resolveInitialCapabilityState(
  isEntitled: boolean,
  isDefaultInBlueprint: boolean,
  requiresConfiguration: boolean,
): InitialCapabilityState {
  if (!isEntitled) {
    return { state: 'DISCOVERABLE', isConfigured: !requiresConfiguration };
  }

  if (isDefaultInBlueprint && !requiresConfiguration) {
    return { state: 'ENABLED', isConfigured: true };
  }

  return {
    state: 'ENTITLED',
    isConfigured: !requiresConfiguration,
  };
}
