import { tdbkKnowledgeResource, TdbkResource } from './knowledgeResource';

export interface VisualGenerationResult {
  assetId: string;
  source: 'REUSED' | 'DYNAMICALLY_GENERATED';
  type: 'IMAGE' | 'DIAGRAM' | 'INFOGRAPHIC' | 'ANIMATION';
  svgMarkup?: string;
  title: string;
  description: string;
}

export class TdbkVisualCreationEngine {
  private static instance: TdbkVisualCreationEngine;

  private constructor() {}

  public static getInstance(): TdbkVisualCreationEngine {
    if (!TdbkVisualCreationEngine.instance) {
      TdbkVisualCreationEngine.instance = new TdbkVisualCreationEngine();
    }
    return TdbkVisualCreationEngine.instance;
  }

  public resolveVisual(
    tenantId: string,
    prompt: string,
    requirement: { grade?: string; learningArea?: string; strand?: string }
  ): VisualGenerationResult {
    // 1. Search for existing approved resources matching requirements
    const matched = tdbkKnowledgeResource.listResourcesByContext(tenantId, {
      ...requirement,
      lifecycleStatus: 'APPROVED',
    });

    if (matched.length > 0) {
      const asset = matched[0];
      return {
        assetId: asset.id,
        source: 'REUSED',
        type: asset.type === 'DIAGRAM' ? 'DIAGRAM' : 'INFOGRAPHIC',
        title: asset.name,
        description: asset.semanticMeaning,
        svgMarkup: this.getPreseededSvg(asset.id),
      };
    }

    // 2. Otherwise, generate dynamically on demand
    const dynamicId = `dyn_asset_${Math.random().toString(36).substr(2, 6)}`;
    return {
      assetId: dynamicId,
      source: 'DYNAMICALLY_GENERATED',
      type: prompt.toLowerCase().includes('diagram') ? 'DIAGRAM' : 'INFOGRAPHIC',
      title: `Generated: ${prompt}`,
      description: `Procedurally generated TDBK platform visualization for: ${prompt}`,
      svgMarkup: this.generateProceduralSvg(prompt),
    };
  }

  private getPreseededSvg(id: string): string {
    if (id === 'res_photosynthesis_diagram') {
      return `<svg viewBox="0 0 400 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1e1e1e" rx="8"/>
        <text x="20" y="30" fill="#4ade80" font-weight="bold" font-size="14">Photosynthesis Cycle Diagram</text>
        <line x1="120" y1="100" x2="280" y2="100" stroke="#a3a3a3" stroke-width="2" marker-end="url(#arrow)" />
        <text x="40" y="90" fill="#fbbf24" font-weight="bold">Light + H2O + CO2</text>
        <text x="290" y="90" fill="#4ade80" font-weight="bold">Sugar + O2</text>
        <circle cx="200" cy="100" r="15" fill="#15803d" />
        <text x="194" y="104" fill="#fff" font-weight="bold" font-size="10">Chlorophyll</text>
      </svg>`;
    }
    return '';
  }

  private generateProceduralSvg(prompt: string): string {
    return `<svg viewBox="0 0 400 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111" rx="8" stroke="#333" stroke-width="2"/>
      <text x="20" y="30" fill="#818cf8" font-weight="bold" font-size="14">TDBK Platform Dynamic Visualizer</text>
      <text x="20" y="60" fill="#999" font-size="12">Rendered from: "${prompt}"</text>
      <rect x="50" y="90" width="100" height="60" fill="#1e293b" stroke="#818cf8" stroke-width="2" rx="4"/>
      <text x="75" y="125" fill="#fff" font-weight="bold" font-size="12">INPUT</text>
      <line x1="160" y1="120" x2="240" y2="120" stroke="#818cf8" stroke-width="3" />
      <rect x="250" y="90" width="100" height="60" fill="#1e293b" stroke="#34d399" stroke-width="2" rx="4"/>
      <text x="270" y="125" fill="#fff" font-weight="bold" font-size="12">OUTPUT</text>
    </svg>`;
  }
}

export const tdbkVisualCreation = TdbkVisualCreationEngine.getInstance();
