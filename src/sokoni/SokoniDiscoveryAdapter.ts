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


type PublicOrganization = {
  dbkId: string;
  displayName: string;
  sector: string;
  branches: Array<{ branchId: string; name: string; location?: { county?: string; town?: string; address?: string } }>;
};

const SECTOR_TERMS: Record<string, string[]> = {
  EDUCATION: ['school', 'academy', 'college', 'education', 'student', 'teacher', 'class'],
  HARDWARE: ['hardware', 'cement', 'building materials', 'tools', 'printer', 'computer', 'cctv', 'networking'],
  RETAIL: ['shop', 'mart', 'store', 'retail', 'supermarket', 'goods', 'products'],
  ELECTRONICS: ['electronics', 'phone', 'laptop', 'computer', 'repair', 'device'],
  LOGISTICS: ['delivery', 'cargo', 'logistics', 'transport', 'courier', 'waybill', 'truck'],
  HEALTHCARE: ['hospital', 'clinic', 'medical', 'doctor', 'pharmacy', 'health'],
  HOSPITALITY: ['hotel', 'lodge', 'resort', 'restaurant', 'hospitality', 'guest'],
  BEAUTY: ['salon', 'spa', 'barber', 'beauty', 'stylist'],
  PROFESSIONAL_SERVICES: ['lawyer', 'legal', 'accounting', 'consulting', 'professional', 'agency'],
  MANUFACTURING: ['manufacturing', 'factory', 'production', 'plant', 'industrial'],
  CONSTRUCTION: ['construction', 'contractor', 'building', 'civil', 'project'],
  COMMUNITY: ['community', 'ngo', 'foundation', 'charity', 'organization'],
};

function inferSector(need: string): string | undefined {
  const normalized = need.toLowerCase();
  return Object.entries(SECTOR_TERMS).find(([, terms]) => terms.some((term) => normalized.includes(term)))?.[0];
}

function sectorServices(sector: string): string[] {
  switch (sector) {
    case 'EDUCATION': return ['School operations', 'Student services', 'Academic administration'];
    case 'HARDWARE': return ['Hardware supply', 'Technical support', 'Installation services'];
    case 'RETAIL': return ['Retail sales', 'Products & supplies', 'Customer service'];
    case 'ELECTRONICS': return ['Electronics', 'Device support', 'Repair services'];
    case 'LOGISTICS': return ['Transport & logistics', 'Delivery', 'Cargo handling'];
    case 'HEALTHCARE': return ['Healthcare services', 'Appointments', 'Patient care'];
    case 'HOSPITALITY': return ['Accommodation', 'Guest services', 'Hospitality'];
    case 'BEAUTY': return ['Beauty services', 'Appointments', 'Personal care'];
    case 'PROFESSIONAL_SERVICES': return ['Professional services', 'Consulting', 'Client services'];
    case 'MANUFACTURING': return ['Manufacturing', 'Production', 'Industrial supply'];
    case 'CONSTRUCTION': return ['Construction', 'Projects', 'Site services'];
    case 'COMMUNITY': return ['Community programs', 'Projects', 'Community services'];
    default: return ['Business services'];
  }
}

function locationLabel(branches: PublicOrganization['branches']): string | undefined {
  const branch = branches.find((item) => item.location?.town || item.location?.county) || branches[0];
  if (!branch) return undefined;
  return [branch.location?.town, branch.location?.county].filter(Boolean).join(', ') || branch.name;
}

export const tdbkPublicDiscoveryAdapter: SokoniPublicDiscoveryAdapter = {
  async discover(input) {
    const query = new URLSearchParams();
    if (input.location?.label) query.set('area', input.location.label);
    const sector = inferSector(input.need);
    if (sector) query.set('sector', sector);

    const baseUrl =
      typeof window !== 'undefined' && (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TDBK_PUBLIC_API_BASE_URL
        ? (import.meta as ImportMeta & { env?: Record<string, string> }).env!.VITE_TDBK_PUBLIC_API_BASE_URL
        : '';

    const response = await fetch(`${baseUrl}/api/public/organizations?${query.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`TDBK public discovery failed with HTTP ${response.status}`);
    const payload = await response.json() as { organizations: PublicOrganization[] };

    const providers = payload.organizations.map((organization) => ({
      id: `tdbk:${organization.dbkId}`,
      displayName: organization.displayName,
      summary: `Published TDBK organization in ${organization.sector.replaceAll('_', ' ').toLowerCase()}.`,
      services: sectorServices(organization.sector),
      coverageLabel: locationLabel(organization.branches),
      stage: 'AUTHORITATIVE' as const,
    }));

    return {
      intent: {
        rawNeed: input.need,
        interpretedNeed: input.need.trim(),
        category: sector ? sector.replaceAll('_', ' ') : 'Local businesses',
      },
      location: input.location,
      providers,
      stage: 'AUTHORITATIVE',
      sourceLabel: 'TDBK published organization directory',
    };
  },
};
