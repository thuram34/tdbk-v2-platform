import { OpportunityScore, OpportunityScoreDimensions } from './types';

export const OPPORTUNITY_SCORE_WEIGHTS = {
  skillsMatch: 25,
  credibility: 20,
  selectionProbability: 20,
  netValue: 15,
  timeToIncome: 10,
  applicationFriction: 10,
} as const;

export interface ScoreOpportunityInput {
  dimensions: OpportunityScoreDimensions;
  hardExclusionReasons?: string[];
  scoredAt?: string;
}

function assertDimensionRange(dimensions: OpportunityScoreDimensions): void {
  for (const [name, value] of Object.entries(dimensions)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError(`Score dimension '${name}' must be a finite number from 0 to 100.`);
    }
  }
}

export function scoreOpportunity(input: ScoreOpportunityInput): OpportunityScore {
  assertDimensionRange(input.dimensions);

  const hardExclusionReasons = (input.hardExclusionReasons || [])
    .map((reason) => reason.trim())
    .filter(Boolean);

  if (hardExclusionReasons.length > 0) {
    return {
      total: 0,
      eligible: false,
      hardExclusionReasons,
      dimensions: { ...input.dimensions },
      scoredAt: input.scoredAt || new Date().toISOString(),
    };
  }

  const weightedTotal =
    (input.dimensions.skillsMatch * OPPORTUNITY_SCORE_WEIGHTS.skillsMatch
      + input.dimensions.credibility * OPPORTUNITY_SCORE_WEIGHTS.credibility
      + input.dimensions.selectionProbability * OPPORTUNITY_SCORE_WEIGHTS.selectionProbability
      + input.dimensions.netValue * OPPORTUNITY_SCORE_WEIGHTS.netValue
      + input.dimensions.timeToIncome * OPPORTUNITY_SCORE_WEIGHTS.timeToIncome
      + input.dimensions.applicationFriction * OPPORTUNITY_SCORE_WEIGHTS.applicationFriction) / 100;

  return {
    total: Math.round(weightedTotal * 100) / 100,
    eligible: true,
    hardExclusionReasons: [],
    dimensions: { ...input.dimensions },
    scoredAt: input.scoredAt || new Date().toISOString(),
  };
}
