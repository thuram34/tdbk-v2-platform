export interface CbcStrand {
  id: string;
  name: string;
  subStrands: string[];
  learningObjectives: string[];
  pedagogicalStrategies: string[];
  assessmentCriteria: string[];
}

export interface LearningArea {
  id: string;
  name: string;
  strands: CbcStrand[];
}

export interface EducationCurriculum {
  grade: string;
  learningAreas: LearningArea[];
}

export const CBC_GRADE_5_CURRICULUM: EducationCurriculum = {
  grade: 'Grade 5',
  learningAreas: [
    {
      id: 'math_g5',
      name: 'Mathematics',
      strands: [
        {
          id: 'fractions_g5',
          name: 'Fractions',
          subStrands: ['Equivalent Fractions', 'Addition of Fractions', 'Subtraction of Fractions'],
          learningObjectives: [
            'Recognize and write equivalent fractions using circular concrete visualizers.',
            'Perform correct mathematical additions on fractional segments.',
            'Demonstrate fraction totals adding up to whole integers visually.',
          ],
          pedagogicalStrategies: [
            'Hands-on BUILD active learning using interactive segmented pizza charts.',
            'Direct peer discussion of fractional sizes and equal parts.',
          ],
          assessmentCriteria: [
            'Correct segment counting and identification.',
            'Accurate synthesis of 1/2 and 1/4 components.',
          ],
        },
        {
          id: 'numbers_g5',
          name: 'Numbers',
          subStrands: ['Odd & Even', 'Divisibility Test', 'Prime Numbers'],
          learningObjectives: [
            'Correctly identify odd and even integers up to 100.',
            'Group integers into appropriate bins using divisibility criteria.',
          ],
          pedagogicalStrategies: [
            'Interactive SORT experiences placing floating numeric cards into specific baskets.',
            'Mathematical proof using division/remainders.',
          ],
          assessmentCriteria: [
            'Classification accuracy during sorting trials.',
            'Identifying modulo remainder principles.',
          ],
        },
      ],
    },
    {
      id: 'science_g5',
      name: 'Science & Technology',
      strands: [
        {
          id: 'plants_g5',
          name: 'Plants',
          subStrands: ['Photosynthesis', 'Fungi', 'Mosses'],
          learningObjectives: [
            'Explain the process of photosynthesis using visual inputs (light, water, carbon dioxide).',
            'Define chlorophyll as the reaction center in chloroplasts.',
          ],
          pedagogicalStrategies: [
            'Interactive PROCESS diagram showing connection links from environment inputs to output sugars.',
            'Step-by-step assembly of chemical equations.',
          ],
          assessmentCriteria: [
            'Correct flow path alignment from leaf inputs to outputs.',
            'Defining light energy as a critical conversion trigger.',
          ],
        },
      ],
    },
  ],
};

export class EducationDomainService {
  private static instance: EducationDomainService;

  private constructor() {}

  public static getInstance(): EducationDomainService {
    if (!EducationDomainService.instance) {
      EducationDomainService.instance = new EducationDomainService();
    }
    return EducationDomainService.instance;
  }

  public getCurriculum(): EducationCurriculum {
    return CBC_GRADE_5_CURRICULUM;
  }

  public getLearningArea(id: string): LearningArea | undefined {
    return CBC_GRADE_5_CURRICULUM.learningAreas.find((la) => la.id === id);
  }

  public getStrand(learningAreaId: string, strandId: string): CbcStrand | undefined {
    const la = this.getLearningArea(learningAreaId);
    return la?.strands.find((s) => s.id === strandId);
  }
}

export const educationDomain = EducationDomainService.getInstance();
