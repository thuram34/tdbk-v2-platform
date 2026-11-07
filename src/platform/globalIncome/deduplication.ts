import { createHash } from 'node:crypto';
import { OpportunityIdentity } from './types';

const TRACKING_PARAMETER = /^(utm_.+|ref|referrer|source|campaign|tracking|fbclid|gclid)$/i;

function normalizeLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function normalizeSourceUrl(sourceUrl: string): string {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new TypeError('Opportunity source URL must be an absolute URL.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('Opportunity source URL must use HTTP or HTTPS.');
  }

  url.hash = '';
  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMETER.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hostname = url.hostname.toLocaleLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';

  return url.toString();
}

export function buildOpportunityDeduplicationKey(identity: OpportunityIdentity): string {
  const canonicalIdentity = [
    normalizeLabel(identity.employerOrClient),
    normalizeLabel(identity.roleOrProject),
    normalizeSourceUrl(identity.sourceUrl),
  ].join('\n');

  return createHash('sha256').update(canonicalIdentity, 'utf8').digest('hex');
}
