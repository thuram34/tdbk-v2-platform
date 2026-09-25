/**
 * Sokoni commercial offerings are configuration, not subscription/domain logic.
 * These are the initial configured options carried forward from the prior UX
 * slice. They do not represent TDBK subscriptions or entitlements.
 */
export interface SokoniCommercialOffering {
  code: string;
  name: string;
  description: string;
  currency: 'KES';
  amount: number;
  enabled: boolean;
  requiresPayment: boolean;
}

export const SOKONI_COMMERCIAL_OFFERINGS: SokoniCommercialOffering[] = [
  {
    code: 'SOKONI_PRESENCE_100',
    name: 'Sokoni presence',
    description: 'Configured Sokoni public-presence offering.',
    currency: 'KES',
    amount: 100,
    enabled: true,
    requiresPayment: true,
  },
  {
    code: 'SOKONI_PRESENCE_500',
    name: 'Sokoni presence plus',
    description: 'Configured Sokoni public-presence offering.',
    currency: 'KES',
    amount: 500,
    enabled: true,
    requiresPayment: true,
  },
];

export function getSokoniCommercialOffering(code: string | null | undefined): SokoniCommercialOffering | null {
  if (!code) return null;
  return SOKONI_COMMERCIAL_OFFERINGS.find((offering) => offering.enabled && offering.code === code) ?? null;
}
