import { describe, expect, it } from 'vitest';
import {
  EMPTY_SOKONI_ORIENTATION_CONTEXT,
  SOKONI_ORIENTATION_OPTIONS,
  SOKONI_SERVICE_OPTIONS,
} from './sokoniParticipationConfig';

describe('Sokoni participation configuration', () => {
  it('keeps the orientation vocabulary extensible and multi-selectable', () => {
    const codes = SOKONI_ORIENTATION_OPTIONS.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(['BUY', 'SELL', 'OFFER_SERVICE', 'SEEK_WORK', 'JOIN_COMMUNITY']));
  });

  it('provides contextual service choices without making them the participant universe', () => {
    expect(SOKONI_SERVICE_OPTIONS).toContain('Computer technician');
    expect(EMPTY_SOKONI_ORIENTATION_CONTEXT.communityMode).toBeNull();
    expect(EMPTY_SOKONI_ORIENTATION_CONTEXT.serviceTypes).toEqual([]);
  });
});
