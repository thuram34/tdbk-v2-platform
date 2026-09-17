import { TdbkContext } from './contextEngine';
import { tdbkKnowledgeResource, TdbkResource } from './knowledgeResource';
import { CanvasObject } from './interactiveExperienceRuntime';

export interface IntelligenceRecommendation {
  id: string;
  type: 'EXPERIENCE' | 'RESOURCE' | 'ACTION' | 'INSIGHT';
  title: string;
  description: string;
  confidence: number;
  payload: {
    experienceType?: 'BUILD' | 'PROCESS' | 'SORT' | 'POS_CHECKOUT' | 'CLINICAL_TRIAGE';
    resources?: TdbkResource[];
    suggestedObjects?: CanvasObject[];
    suggestedActions?: string[];
  };
}

export class TdbkProactiveIntelligenceEngine {
  private static instance: TdbkProactiveIntelligenceEngine;

  private constructor() {}

  public static getInstance(): TdbkProactiveIntelligenceEngine {
    if (!TdbkProactiveIntelligenceEngine.instance) {
      TdbkProactiveIntelligenceEngine.instance = new TdbkProactiveIntelligenceEngine();
    }
    return TdbkProactiveIntelligenceEngine.instance;
  }

  public analyzeAndPropose(context: TdbkContext): IntelligenceRecommendation[] {
    const recommendations: IntelligenceRecommendation[] = [];

    const { intent } = context.why;
    const tenantId = context.where.tenantId;
    const domainMetadata = context.what.domainMetadata || {};

    // 1. EDUCATION vertical logic
    if (intent === 'TEACH') {
      const { grade, learningArea, strand, subStrand } = domainMetadata;

      if (strand === 'Fractions') {
        const matchingResources = tdbkKnowledgeResource.listResourcesByContext(tenantId, {
          grade,
          learningArea,
          strand,
        });

        recommendations.push({
          id: 'rec_fraction_build',
          type: 'EXPERIENCE',
          title: 'Activate Fraction Pizza BUILD Experience',
          description: 'Based on your Grade 5 Mathematics curriculum focus, TDBK recommends loading the interactive visualizer.',
          confidence: 0.98,
          payload: {
            experienceType: 'BUILD',
            resources: matchingResources,
            suggestedObjects: [
              {
                id: 'pizza_main',
                type: 'PIZZA_SLICE',
                label: '1/2 Segment',
                x: 100,
                y: 80,
                width: 140,
                height: 140,
                rotation: 0,
                zIndex: 1,
                isLocked: false,
                visualProperties: { backgroundColor: '#f43f5e', color: '#fff' },
                semanticMeaning: 'One half segment of a circular fraction unit',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: true, value: 0.5 },
                state: { slices: 2, activeSlices: 1 },
              },
              {
                id: 'pizza_quarter_1',
                type: 'PIZZA_SLICE',
                label: '1/4 Segment',
                x: 280,
                y: 60,
                width: 100,
                height: 100,
                rotation: 45,
                zIndex: 2,
                isLocked: false,
                visualProperties: { backgroundColor: '#3b82f6', color: '#fff' },
                semanticMeaning: 'One quarter segment of a circular fraction unit',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: true, value: 0.25 },
                state: { slices: 4, activeSlices: 1 },
              },
              {
                id: 'pizza_quarter_2',
                type: 'PIZZA_SLICE',
                label: '1/4 Segment',
                x: 280,
                y: 180,
                width: 100,
                height: 100,
                rotation: 135,
                zIndex: 3,
                isLocked: false,
                visualProperties: { backgroundColor: '#10b981', color: '#fff' },
                semanticMeaning: 'One quarter segment of a circular fraction unit',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: true, value: 0.25 },
                state: { slices: 4, activeSlices: 1 },
              },
            ],
            suggestedActions: [
              'Deploy circular visualizer',
              'Initialize Fraction sum helper: 1/2 + 1/4 + 1/4 = 1',
            ],
          },
        });
      } else if (strand === 'Plants' || subStrand === 'Photosynthesis') {
        const matchingResources = tdbkKnowledgeResource.listResourcesByContext(tenantId, {
          grade,
          learningArea,
          subStrand,
        });

        recommendations.push({
          id: 'rec_photosynthesis_process',
          type: 'EXPERIENCE',
          title: 'Activate Photosynthesis PROCESS Flow',
          description: 'Science Curriculum focus detected. Load the visual chemical & solar energy flow mapper.',
          confidence: 0.95,
          payload: {
            experienceType: 'PROCESS',
            resources: matchingResources,
            suggestedObjects: [
              {
                id: 'node_sunlight',
                type: 'DIAGRAM_NODE',
                label: '☀️ Light Energy',
                x: 60,
                y: 60,
                width: 110,
                height: 50,
                rotation: 0,
                zIndex: 1,
                isLocked: false,
                visualProperties: { backgroundColor: '#fbbf24', color: '#1e293b', borderRadius: '8px' },
                semanticMeaning: 'Sunlight triggering chlorophyll excitation in Grade 5 Science syllabus',
                relationships: ['node_chlorophyll'],
                behaviour: { isDraggable: true, isResizable: false, value: 'LIGHT' },
                state: { energy: 100 },
              },
              {
                id: 'node_h2o',
                type: 'DIAGRAM_NODE',
                label: '💧 Water (H₂O)',
                x: 60,
                y: 160,
                width: 110,
                height: 50,
                rotation: 0,
                zIndex: 2,
                isLocked: false,
                visualProperties: { backgroundColor: '#3b82f6', color: '#fff', borderRadius: '8px' },
                semanticMeaning: 'Water input absorbed through root capillary transport',
                relationships: ['node_chlorophyll'],
                behaviour: { isDraggable: true, isResizable: false, value: 'H2O' },
                state: {},
              },
              {
                id: 'node_co2',
                type: 'DIAGRAM_NODE',
                label: '💨 Carbon Dioxide',
                x: 60,
                y: 260,
                width: 130,
                height: 50,
                rotation: 0,
                zIndex: 3,
                isLocked: false,
                visualProperties: { backgroundColor: '#64748b', color: '#fff', borderRadius: '8px' },
                semanticMeaning: 'CO2 from environment taken in via leaf stomata pores',
                relationships: ['node_chlorophyll'],
                behaviour: { isDraggable: true, isResizable: false, value: 'CO2' },
                state: {},
              },
              {
                id: 'node_chlorophyll',
                type: 'DIAGRAM_NODE',
                label: '🍃 Chloroplast Center',
                x: 260,
                y: 160,
                width: 150,
                height: 70,
                rotation: 0,
                zIndex: 4,
                isLocked: true,
                visualProperties: { backgroundColor: '#15803d', color: '#fff', borderRadius: '12px' },
                semanticMeaning: 'The leaf organelle where reaction conversion transforms inputs into sugars and oxygen',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: false },
                state: { satisfied: false },
              },
            ],
            suggestedActions: [
              'Generate chloroplast diagram',
              'Trigger reaction equation: H₂O + CO₂ → Sugar + O₂',
            ],
          },
        });
      } else if (subStrand === 'Odd & Even') {
        const matchingResources = tdbkKnowledgeResource.listResourcesByContext(tenantId, {
          subStrand,
        });

        recommendations.push({
          id: 'rec_odd_even_sort',
          type: 'EXPERIENCE',
          title: 'Activate Odd & Even SORT Blocks',
          description: 'Based on your odd/even syllabus, load sorting bins and dynamic integer cards.',
          confidence: 0.94,
          payload: {
            experienceType: 'SORT',
            resources: matchingResources,
            suggestedObjects: [
              {
                id: 'bucket_odd',
                type: 'BUCKET',
                label: '🗳️ ODD Numbers Bin',
                x: 100,
                y: 250,
                width: 160,
                height: 100,
                rotation: 0,
                zIndex: 1,
                isLocked: true,
                visualProperties: { backgroundColor: '#3b82f6', color: '#fff' },
                semanticMeaning: 'Bucket for numbers not divisible by 2 with remainder 1',
                relationships: [],
                behaviour: { isDraggable: false, isResizable: false, isSortable: true, value: 'ODD' },
                state: { itemsIn: [] },
              },
              {
                id: 'bucket_even',
                type: 'BUCKET',
                label: '🗳️ EVEN Numbers Bin',
                x: 340,
                y: 250,
                width: 160,
                height: 100,
                rotation: 0,
                zIndex: 2,
                isLocked: true,
                visualProperties: { backgroundColor: '#10b981', color: '#fff' },
                semanticMeaning: 'Bucket for numbers divisible by 2 with remainder 0',
                relationships: [],
                behaviour: { isDraggable: false, isResizable: false, isSortable: true, value: 'EVEN' },
                state: { itemsIn: [] },
              },
              {
                id: 'card_7',
                type: 'NUMBER_CARD',
                label: '7',
                x: 80,
                y: 80,
                width: 60,
                height: 60,
                rotation: -5,
                zIndex: 3,
                isLocked: false,
                visualProperties: { backgroundColor: '#1e293b', borderColor: '#475569' },
                semanticMeaning: 'Odd integer number card',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: false, value: 7, targetBucketId: 'bucket_odd' },
                state: {},
              },
              {
                id: 'card_12',
                type: 'NUMBER_CARD',
                label: '12',
                x: 200,
                y: 70,
                width: 60,
                height: 60,
                rotation: 12,
                zIndex: 4,
                isLocked: false,
                visualProperties: { backgroundColor: '#1e293b', borderColor: '#475569' },
                semanticMeaning: 'Even integer number card',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: false, value: 12, targetBucketId: 'bucket_even' },
                state: {},
              },
              {
                id: 'card_15',
                type: 'NUMBER_CARD',
                label: '15',
                x: 320,
                y: 90,
                width: 60,
                height: 60,
                rotation: -8,
                zIndex: 5,
                isLocked: false,
                visualProperties: { backgroundColor: '#1e293b', borderColor: '#475569' },
                semanticMeaning: 'Odd integer number card',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: false, value: 15, targetBucketId: 'bucket_odd' },
                state: {},
              },
              {
                id: 'card_24',
                type: 'NUMBER_CARD',
                label: '24',
                x: 440,
                y: 80,
                width: 60,
                height: 60,
                rotation: 4,
                zIndex: 6,
                isLocked: false,
                visualProperties: { backgroundColor: '#1e293b', borderColor: '#475569' },
                semanticMeaning: 'Even integer number card',
                relationships: [],
                behaviour: { isDraggable: true, isResizable: false, value: 24, targetBucketId: 'bucket_even' },
                state: {},
              },
            ],
            suggestedActions: [
              'Perform modulo operation checks (n % 2)',
              'Evaluate numerical inequality relations (e.g. 7 < 12)',
            ],
          },
        });
      }
    }

    // 2. Fallback / General Proactive Actions
    if (recommendations.length === 0) {
      recommendations.push({
        id: 'rec_generic_browse',
        type: 'INSIGHT',
        title: 'Select Active Teaching Objectives',
        description: 'TDBK is ready. Select a CBC Grade, Learning Area, and Strand to instantly prepare your digital lesson experience.',
        confidence: 0.9,
        payload: {
          suggestedActions: ['Open curriculum guide', 'Deploy blank digital teaching surface'],
        },
      });
    }

    return recommendations;
  }
}

export const tdbkProactiveIntelligence = TdbkProactiveIntelligenceEngine.getInstance();
