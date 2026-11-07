import { AcquisitionChannel, OpportunityKind } from './types';

export type ApplicationStatus =
  | 'DRAFT'
  | 'READY'
  | 'AWAITING_APPROVAL'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'INTERVIEW'
  | 'ASSESSMENT'
  | 'OFFER'
  | 'WON'
  | 'LOST'
  | 'WITHDRAWN';

export interface ApplicationRecord {
  applicationId: string;
  tenantId: string;
  opportunityId: string;
  channel: AcquisitionChannel;
  kind: OpportunityKind;
  status: ApplicationStatus;
  submittedAt: string | null;
  externalReference: string | null;
  evidenceUrls: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
