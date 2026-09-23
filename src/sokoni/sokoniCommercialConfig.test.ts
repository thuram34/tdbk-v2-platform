import { describe, expect, it } from 'vitest';
import { getSokoniCommercialOffering, SOKONI_COMMERCIAL_OFFERINGS } from './sokoniCommercialConfig';

describe('Sokoni commercial configuration', () => {
  it('keeps commercial options in configuration rather than payment logic', () => {
    expect(SOKONI_COMMERCIAL_OFFERINGS.map((item) => item.amount)).toEqual([100, 500]);
    expect(SOKONI_COMMERCIAL_OFFERINGS.every((item) => item.currency === 'KES')).toBe(true);
    expect(SOKONI_COMMERCIAL_OFFERINGS.every((item) => item.requiresPayment)).toBe(true);
  });

  it('returns only configured enabled offerings', () => {
    expect(getSokoniCommercialOffering('SOKONI_PRESENCE_100')?.amount).toBe(100);
    expect(getSokoniCommercialOffering('SOKONI_PRESENCE_500')?.amount).toBe(500);
    expect(getSokoniCommercialOffering('NOT_A_REAL_OFFER')).toBeNull();
  });
});
