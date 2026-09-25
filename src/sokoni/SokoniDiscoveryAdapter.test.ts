import { describe, expect, it } from 'vitest';
import { demoSokoniDiscoveryAdapter, technicianDemoResult } from './SokoniDiscoveryAdapter';

describe('Sokoni discovery UX adapter boundary', () => {
  it('returns an explicitly non-authoritative technician preview', async () => {
    const result = await demoSokoniDiscoveryAdapter.discover({
      need: 'My computer is slow.',
      location: { label: 'Mombasa', consented: false },
    });

    expect(result.stage).toBe('DEMO');
    expect(result.sourceLabel).toContain('Engine discovery contract not connected');
    expect(result.intent.interpretedNeed).toBe('Computer troubleshooting');
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].stage).toBe('DEMO');
  });

  it('does not expose pricing, live availability, or verification as demo truth', () => {
    const provider = technicianDemoResult.providers[0];

    expect(provider).not.toHaveProperty('price');
    expect(provider).not.toHaveProperty('verified');
    expect(provider.availabilityLabel).toBeUndefined();
    expect(provider.trustLabel).toBeUndefined();
  });
});
