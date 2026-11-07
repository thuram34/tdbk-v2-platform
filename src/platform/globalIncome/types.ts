/** Global Income Engine — platform-level acquisition domain contracts. */

export const ACQUISITION_CHANNELS = [
  'upwork',
  'freelancer_com',
  'peopleperhour',
  'contra',
  'fiverr',
  'remote_job_board',
  'direct_b2b',
  'referral',
  'other',
] as const;

export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

export type OpportunityKind = 'EMPLOYMENT' | 'FREELANCE' | 'DIRECT_B2B' | 'REFERRAL';

export type OpportunityStage =
  | 'DISCOVERED'
  | 'VERIFIED'
  | 'QUALIFIED'
  | 'PREPARED'
  | 'AWAITING_APPROVAL'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'INTERVIEW'
  | 'ASSESSMENT'
  | 'OFFER'
  | 'WON'
  | 'LOST'
  | 'WITHDRAWN'
  | 'EXCLUDED';

export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';

export interface OpportunityEvidence {
  evidenceType: string;
  sourceUrl: string;
  observedAt: string;
  summary: string;
  confidence: number;
}

export interface OpportunityScoreDimensions {
  skillsMatch: number;
  credibility: number;
  selectionProbability: number;
  netValue: number;
  timeToIncome: number;
  applicationFriction: number;
}

export interface OpportunityScore {
  total: number;
  eligible: boolean;
  hardExclusionReasons: string[];
  dimensions: OpportunityScoreDimensions;
  scoredAt: string;
}

export interface OpportunityIdentity {
  employerOrClient: string;
  roleOrProject: string;
  sourceUrl: string;
}

export interface Opportunity {
  opportunityId: string;
  ownerId: string;
  kind: OpportunityKind;
  channel: AcquisitionChannel;
  stage: OpportunityStage;
  verificationStatus: VerificationStatus;
  identity: OpportunityIdentity;
  deduplicationKey: string;
  title: string;
  descriptionSnapshot: string;
  geography: string | null;
  compensationAmount: number | null;
  compensationCurrency: string | null;
  compensationPeriod: 'HOURLY' | 'FIXED' | 'MONTHLY' | 'ANNUAL' | 'UNSPECIFIED';
  applicationCostAmount: number | null;
  applicationCostCurrency: string | null;
  evidence: OpportunityEvidence[];
  hardExclusionReasons: string[];
  score: OpportunityScore | null;
  nextAction: string | null;
  discoveredAt: string;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ConnectorStatus = 'UNCONFIGURED' | 'CONFIGURED' | 'DISABLED' | 'ERROR';

export interface ConnectorHealth {
  provider: string;
  status: ConnectorStatus;
  scopes: string[];
  checkedAt: string | null;
  lastErrorCode: string | null;
}

export type ApprovalAction =
  | 'SUBMIT_PAID_APPLICATION'
  | 'CONFIRM_UPWORK_PROPOSAL'
  | 'SEND_DIRECT_OUTREACH'
  | 'PUBLISH_GIG'
  | 'CHANGE_PROFILE'
  | 'WRITE_CRM'
  | 'ACCEPT_OFFER'
  | 'ACCEPT_CONTRACT'
  | 'SIGN_LEGAL_DOCUMENT'
  | 'DISCLOSE_SENSITIVE_INFORMATION'
  | 'PURCHASE_CREDITS'
  | 'BOOST_PROFILE';

export interface ApprovalRequest {
  approvalId: string;
  ownerId: string;
  action: ApprovalAction;
  targetId: string;
  summary: string;
  termsOrCost: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}
