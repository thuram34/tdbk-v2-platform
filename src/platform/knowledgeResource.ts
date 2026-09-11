export interface TdbkResource {
  id: string;
  ownerId: string;
  tenantId: string;
  visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  permissions: string[];
  type: 'DOCUMENT' | 'IMAGE' | 'DIAGRAM' | 'INTERACTIVE_OBJECT' | 'LESSON' | 'FORMULA' | 'VIDEO' | 'INFOGRAPHIC';
  name: string;
  url?: string;
  semanticMeaning: string;
  relationships: Array<{ relationshipType: string; targetId: string }>;
  lifecycleStatus: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  createdAt: string;
  metadata: Record<string, any>; // Used by domains (e.g. grade, strand, learningArea)
}

export class TdbkKnowledgeResourceLayer {
  private static instance: TdbkKnowledgeResourceLayer;
  private resources: Map<string, TdbkResource> = new Map();

  private constructor() {
    this.seedDefaultResources();
  }

  public static getInstance(): TdbkKnowledgeResourceLayer {
    if (!TdbkKnowledgeResourceLayer.instance) {
      TdbkKnowledgeResourceLayer.instance = new TdbkKnowledgeResourceLayer();
    }
    return TdbkKnowledgeResourceLayer.instance;
  }

  private seedDefaultResources() {
    const defaultAssets: TdbkResource[] = [
      {
        id: 'res_fraction_pizza',
        ownerId: 'sys_tdbk',
        tenantId: 'all',
        visibility: 'PUBLIC',
        permissions: ['read:*'],
        type: 'INTERACTIVE_OBJECT',
        name: 'Fraction Pizza Visualizer',
        semanticMeaning: 'Interactive representation of divided circular segments representing fraction denominators',
        relationships: [],
        lifecycleStatus: 'APPROVED',
        createdAt: new Date().toISOString(),
        metadata: {
          sector: 'EDUCATION',
          grade: 'Grade 5',
          learningArea: 'Mathematics',
          strand: 'Fractions',
          experienceType: 'BUILD',
        },
      },
      {
        id: 'res_photosynthesis_diagram',
        ownerId: 'sys_tdbk',
        tenantId: 'all',
        visibility: 'PUBLIC',
        permissions: ['read:*'],
        type: 'DIAGRAM',
        name: 'Photosynthesis Cycle Chart',
        semanticMeaning: 'Flow process diagram showing Light energy, CO2, and H2O converting to Sugar and O2',
        relationships: [],
        lifecycleStatus: 'APPROVED',
        createdAt: new Date().toISOString(),
        metadata: {
          sector: 'EDUCATION',
          grade: 'Grade 5',
          learningArea: 'Science',
          strand: 'Plants',
          subStrand: 'Photosynthesis',
          experienceType: 'PROCESS',
        },
      },
      {
        id: 'res_odd_even_sorter',
        ownerId: 'sys_tdbk',
        tenantId: 'all',
        visibility: 'PUBLIC',
        permissions: ['read:*'],
        type: 'INTERACTIVE_OBJECT',
        name: 'Odd and Even Sorting Buckets',
        semanticMeaning: 'Drag and drop containers to classify integer objects based on modulo 2 outcome',
        relationships: [],
        lifecycleStatus: 'APPROVED',
        createdAt: new Date().toISOString(),
        metadata: {
          sector: 'EDUCATION',
          grade: 'Grade 5',
          learningArea: 'Mathematics',
          strand: 'Numbers',
          subStrand: 'Odd & Even',
          experienceType: 'SORT',
        },
      },
    ];

    defaultAssets.forEach((r) => this.resources.set(r.id, r));
  }

  public registerResource(resource: TdbkResource): void {
    this.resources.set(resource.id, resource);
  }

  public getResource(id: string): TdbkResource | undefined {
    return this.resources.get(id);
  }

  public listResourcesByContext(tenantId: string, filter?: Record<string, any>): TdbkResource[] {
    let list = Array.from(this.resources.values());
    
    // Filter by tenant scope (allow public or same-tenant)
    list = list.filter((r) => r.visibility === 'PUBLIC' || r.tenantId === tenantId);

    if (filter) {
      list = list.filter((r) => {
        return Object.entries(filter).every(([key, value]) => {
          if (r.metadata[key] !== undefined) {
            return r.metadata[key] === value;
          }
          return (r as any)[key] === value;
        });
      });
    }

    return list;
  }
}

export const tdbkKnowledgeResource = TdbkKnowledgeResourceLayer.getInstance();
