export type SokoniDiscoveryStage =
  | 'DEMO'
  | 'AUTHORITATIVE_PENDING'
  | 'AUTHORITATIVE';

export interface SokoniLocationContext {
  label: string;
  consented: boolean;
}

export interface SokoniDiscoveryIntent {
  rawNeed: string;
  interpretedNeed: string;
  category: string;
}

export interface SokoniProviderPreview {
  id: string;
  displayName: string;
  summary: string;
  services: string[];
  coverageLabel?: string;
  availabilityLabel?: string;
  trustLabel?: string;
  stage: SokoniDiscoveryStage;
}

export interface SokoniDiscoveryResult {
  intent: SokoniDiscoveryIntent;
  location: SokoniLocationContext | null;
  providers: SokoniProviderPreview[];
  stage: SokoniDiscoveryStage;
  sourceLabel: string;
}

/**
 * Future Engine boundary.
 *
 * This interface deliberately describes the experience contract only. It does
 * not define transport, persistence, search indexes, provider master records,
 * or matching rules. The Engine owns those decisions.
 */
export interface SokoniPublicDiscoveryAdapter {
  discover(input: {
    need: string;
    location: SokoniLocationContext | null;
  }): Promise<SokoniDiscoveryResult>;
}

/**
 * UX-only reference data for the technician vertical slice.
 *
 * This is explicitly non-authoritative and must never be presented as a live
 * provider, availability, pricing, verification, or request state.
 */
export const technicianDemoResult: SokoniDiscoveryResult = {
  intent: {
    rawNeed: 'My computer is slow.',
    interpretedNeed: 'Computer troubleshooting',
    category: 'Computer & IT Support',
  },
  location: {
    label: 'Mombasa',
    consented: false,
  },
  providers: [
    {
      id: 'demo-technician-reference',
      displayName: 'Technician provider — reference preview',
      summary: 'Reference presentation for the founder technician journey.',
      services: [
        'Computer repair',
        'Computer troubleshooting',
        'Printer repair',
        'CCTV installation & repair',
        'Networking & Wi-Fi support',
      ],
      stage: 'DEMO',
    },
  ],
  stage: 'DEMO',
  sourceLabel: 'UX prototype — Engine discovery contract not connected',
};

export const demoSokoniDiscoveryAdapter: SokoniPublicDiscoveryAdapter = {
  async discover() {
    return technicianDemoResult;
  },
};
