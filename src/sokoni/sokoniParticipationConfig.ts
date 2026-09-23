/**
 * Sokoni participation configuration.
 *
 * This is an experience vocabulary, not a closed universe of Sokoni activity.
 * New orientations and context options can be added without changing the
 * participant persistence authority or creating a new business master.
 */
export type SokoniOrientationCode =
  | 'BUY'
  | 'SELL'
  | 'OFFER_SERVICE'
  | 'SEEK_WORK'
  | 'OFFER_TRANSPORT'
  | 'OFFER_DELIVERY'
  | 'PROMOTE'
  | 'JOIN_COMMUNITY'
  | 'CREATE_COMMUNITY';

export interface SokoniOrientationOption {
  code: SokoniOrientationCode;
  label: string;
  description: string;
}

export const SOKONI_ORIENTATION_OPTIONS: SokoniOrientationOption[] = [
  { code: 'BUY', label: 'I want to buy / find something', description: 'Find products, sellers, services or useful local information.' },
  { code: 'SELL', label: 'I want to sell something', description: 'Present something you have for people looking around your area.' },
  { code: 'OFFER_SERVICE', label: 'I offer a service', description: 'Let people discover what you can do for them.' },
  { code: 'SEEK_WORK', label: 'I am looking for work / opportunities', description: 'Show what you are looking for or what opportunities interest you.' },
  { code: 'OFFER_TRANSPORT', label: 'I offer transport', description: 'Present a transport service such as boda or tuk-tuk.' },
  { code: 'OFFER_DELIVERY', label: 'I offer delivery', description: 'Present delivery or local movement services.' },
  { code: 'PROMOTE', label: 'I want to promote something', description: 'Present a service, product, project, event or other legitimate local activity.' },
  { code: 'JOIN_COMMUNITY', label: 'I want to join a community', description: 'Find or participate in an oriented local community.' },
  { code: 'CREATE_COMMUNITY', label: 'I want to create a community', description: 'Start an oriented community around a legitimate local interest or activity.' },
];

export const SOKONI_SERVICE_OPTIONS = [
  'Boda',
  'Tuk-tuk',
  'Mamafua',
  'Technician',
  'Computer technician',
  'CCTV technician',
  'Electrician',
  'Plumber',
  'Mechanic',
  'Delivery',
  'Barber',
  'Salon',
  'Construction',
  'Other',
] as const;

export const SOKONI_TRANSPORT_OPTIONS = ['Boda', 'Tuk-tuk', 'Other transport'] as const;

export const SOKONI_SEEK_WORK_OPTIONS = [
  'Technician work',
  'Delivery work',
  'Driving / transport work',
  'General local work',
  'Freelance work',
  'Other opportunity',
] as const;

export interface SokoniOrientationContext {
  serviceTypes: string[];
  transportTypes: string[];
  opportunityTypes: string[];
  communityMode: 'JOIN' | 'CREATE' | 'BOTH' | null;
}

export const EMPTY_SOKONI_ORIENTATION_CONTEXT: SokoniOrientationContext = {
  serviceTypes: [],
  transportTypes: [],
  opportunityTypes: [],
  communityMode: null,
};
