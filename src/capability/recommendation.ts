import { SecurityContext } from '../kernel/types';
import { businessDnaManager } from '../blueprint/dnaManager';
import { capabilityRegistry } from './registry';
import { dbkCapabilityManager } from './dbkCapabilityManager';

export interface CapabilityRecommendation {
  capabilityId: string;
  name: string;
  category: string;
  reason: string;
  score: number;
}

export interface RecommendationSurface {
  dbkId: string;
  recommendations: CapabilityRecommendation[];
  generatedAt: string;
}

const KEYWORDS: Record<string, string[]> = {
  SALES: ['sell', 'sales', 'shop', 'store', 'customer'],
  POS: ['shop', 'store', 'retail', 'counter', 'pos'],
  INVENTORY: ['stock', 'inventory', 'products', 'goods', 'hardware', 'store'],
  FINANCE: ['finance', 'money', 'accounts', 'accounting', 'cash'],
  M_PESA: ['mpesa', 'm-pesa', 'mobile money', 'payments', 'payment'],
  STAFF: ['staff', 'employees', 'workers', 'team'],
  PAYROLL: ['payroll', 'salary', 'salaries', 'wages'],
  COMMUNICATION: ['communication', 'customers', 'messages', 'whatsapp'],
  TRANSPORT: ['transport', 'vehicle', 'vehicles', 'school bus'],
  FLEET: ['fleet', 'vehicle', 'vehicles'],
  SCHOOL: ['school', 'students', 'teachers', 'parents', 'education'],
  HEALTHCARE: ['clinic', 'hospital', 'patients', 'healthcare'],
  BEAUTY: ['salon', 'spa', 'beauty', 'barber'],
  HOTEL: ['hotel', 'rooms', 'hospitality', 'restaurant'],
};

export class CapabilityRecommendationEngine {
  public async recommendForDbk(
    securityContext: SecurityContext,
    dbkId: string
  ): Promise<RecommendationSurface> {
    const dna = await businessDnaManager.getPersistentBusinessDna(securityContext, dbkId);
    const records = await dbkCapabilityManager.hydratePersistentCapabilities(securityContext, dbkId);
    const enabled = new Set(records.filter((r) => r.state === 'ENABLED' || r.state === 'CONFIGURED').map((r) => r.capabilityId));
    const text = [
      dna.identity.businessName,
      dna.identity.businessType,
      dna.identity.industry,
      dna.businessContextNarrative || '',
    ].join(' ').toLowerCase();

    const recommendations = capabilityRegistry.getAllCapabilities()
      .filter((cap) => cap.lifecycleStatus === 'AVAILABLE' && !enabled.has(cap.capabilityId))
      .filter((cap) =>
        (cap.supportedBlueprints as string[]).includes('ALL') ||
        (cap.supportedBlueprints as string[]).includes(dna.identity.businessType) ||
        (cap.supportedBlueprints as string[]).includes(dna.identity.industry)
      )
      .map((cap) => {
        const words = KEYWORDS[cap.category] || [];
        const matches = words.filter((word) => text.includes(word));
        const directMatches = matches.length;
        const blueprintMatch =
          (cap.supportedBlueprints as string[]).includes(dna.identity.businessType) ||
          (cap.supportedBlueprints as string[]).includes(dna.identity.industry);
        const score = Math.min(100, (blueprintMatch ? 30 : 0) + directMatches * 20);
        return {
          cap,
          score,
          reason: directMatches
            ? `Business Context mentions ${matches.slice(0, 3).join(', ')}.`
            : `Compatible with the ${dna.identity.industry} business profile.`,
        };
      })
      .filter((item) => item.score > 30)
      .sort((a, b) => b.score - a.score || a.cap.name.localeCompare(b.cap.name))
      .slice(0, 8)
      .map((item) => ({
        capabilityId: item.cap.capabilityId,
        name: item.cap.name,
        category: item.cap.category,
        reason: item.reason,
        score: item.score,
      }));

    return { dbkId, recommendations, generatedAt: new Date().toISOString() };
  }
}

export const capabilityRecommendationEngine = new CapabilityRecommendationEngine();
