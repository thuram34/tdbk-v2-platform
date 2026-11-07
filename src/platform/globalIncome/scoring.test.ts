import { describe, expect, it } from 'vitest';
import { scoreOpportunity } from './scoring';

describe('scoreOpportunity', () => {
  it('applies the agreed 25/20/20/15/10/10 weighting', () => {
    const result = scoreOpportunity({
      dimensions: {
        skillsMatch: 100,
        credibility: 100,
        selectionProbability: 100,
        netValue: 100,
        timeToIncome: 100,
        applicationFriction: 100,
      },
      scoredAt: '2026-11-07T00:00:00.000Z',
    });

    expect(result.total).toBe(100);
    expect(result.eligible).toBe(true);
  });

  it('returns the weighted score for mixed dimensions', () => {
    const result = scoreOpportunity({
      dimensions: {
        skillsMatch: 80,
        credibility: 60,
        selectionProbability: 50,
        netValue: 70,
        timeToIncome: 40,
        applicationFriction: 90,
      },
    });

    expect(result.total).toBe(65);
  });

  it('hard-excludes an opportunity before qualification', () => {
    const result = scoreOpportunity({
      dimensions: {
        skillsMatch: 100,
        credibility: 100,
        selectionProbability: 100,
        netValue: 100,
        timeToIncome: 100,
        applicationFriction: 100,
      },
      hardExclusionReasons: ['Requires an upfront registration fee'],
    });

    expect(result.total).toBe(0);
    expect(result.eligible).toBe(false);
    expect(result.hardExclusionReasons).toEqual(['Requires an upfront registration fee']);
  });

  it('rejects out-of-range or non-finite dimension values', () => {
    expect(() => scoreOpportunity({
      dimensions: {
        skillsMatch: 101,
        credibility: 50,
        selectionProbability: 50,
        netValue: 50,
        timeToIncome: 50,
        applicationFriction: 50,
      },
    })).toThrow(RangeError);
  });
});
