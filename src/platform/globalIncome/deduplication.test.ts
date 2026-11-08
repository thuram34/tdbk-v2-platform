import { describe, expect, it } from 'vitest';
import { buildOpportunityDeduplicationKey, normalizeSourceUrl } from './deduplication';

describe('opportunity deduplication', () => {
  it('removes tracking parameters and fragments from source URLs', () => {
    expect(normalizeSourceUrl('https://Example.com/jobs/123/?utm_source=mail&ref=abc#apply'))
      .toBe('https://example.com/jobs/123');
  });

  it('creates the same key for equivalent source URLs and normalized labels', () => {
    const first = buildOpportunityDeduplicationKey({
      employerOrClient: 'Example Ltd',
      roleOrProject: 'React Developer',
      sourceUrl: 'https://example.com/jobs/123?utm_campaign=november',
    });
    const second = buildOpportunityDeduplicationKey({
      employerOrClient: ' example ltd ',
      roleOrProject: '  REACT   DEVELOPER ',
      sourceUrl: 'https://EXAMPLE.com/jobs/123',
    });

    expect(first).toBe(second);
  });

  it('keeps different source listings distinct', () => {
    const first = buildOpportunityDeduplicationKey({
      employerOrClient: 'Example Ltd',
      roleOrProject: 'React Developer',
      sourceUrl: 'https://example.com/jobs/123',
    });
    const second = buildOpportunityDeduplicationKey({
      employerOrClient: 'Example Ltd',
      roleOrProject: 'React Developer',
      sourceUrl: 'https://example.com/jobs/456',
    });

    expect(first).not.toBe(second);
  });

  it('rejects non-HTTP source URLs', () => {
    expect(() => normalizeSourceUrl('javascript:alert(1)')).toThrow(TypeError);
  });
});
