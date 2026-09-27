import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { auth, db, storage } from '../../client/firebase';
import { getSokoniCommercialOffering, getSokoniPublicationDecision } from '../sokoniCommercialConfig';
import type { SokoniOrientationContext } from '../sokoniParticipationConfig';

export type SokoniParticipantKind =
  | 'BUSINESS'
  | 'INDIVIDUAL'
  | 'BUYER'
  | 'SERVICE_PROVIDER'
  | 'SELLER'
  | 'TRANSPORT_PROVIDER'
  | 'DELIVERY_PROVIDER'
  | 'BODA_OPERATOR'
  | 'TUKTUK_OPERATOR'
  | 'TECHNICIAN'
  | 'ORGANIZATION'
  | 'COMMUNITY'
  | 'OTHER';

export type SokoniPublicationStatus = 'DRAFT' | 'READY' | 'ACTIVE';
export type SokoniCommercialState = 'NONE' | 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED';
export type SokoniTdbkRelationship = 'NOT_ENROLLED' | 'ENROLLED';

export interface SokoniMediaRef { mediaId: string; url: string; storagePath: string; mimeType: string; createdAt: string; }
export interface SokoniListing { id: string; kind: 'PRODUCT' | 'SERVICE'; name: string; description: string; mediaIds: string[]; }
export interface SokoniParticipant {
  id: string;
  participantKind: SokoniParticipantKind;
  orientations?: string[];
  orientationContext?: SokoniOrientationContext;
  publicName: string;
  category: string;
  description: string;
  location: { country: 'Kenya'; county: string; area: string; precision: 'AREA' };
  publicContacts: { phone: string; other?: string };
  media: SokoniMediaRef[];
  listings: SokoniListing[];
  publicationStatus: SokoniPublicationStatus;
  commercial: { offeringCode: string | null; state: SokoniCommercialState };
  tdbkRelationship: SokoniTdbkRelationship;
  createdAt: string;
  updatedAt: string;
}
export interface SokoniParticipantRegistrationInput {
  participantKind: SokoniParticipantKind;
  orientations: string[];
  orientationContext: SokoniOrientationContext;
  publicName: string;
  category: string;
  description: string;
  county: string;
  area: string;
  publicPhone: string;
  publicContact?: string;
  offeringCode?: string | null;
  photos: File[];
  listings: Array<{ kind: 'PRODUCT' | 'SERVICE'; name: string; description: string; photoIndexes?: number[] }>;
}

const COLLECTION = 'sokoniParticipants';
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

async function ensureSokoniWriteIdentity(): Promise<void> {
  if (!auth) throw new Error('Sokoni registration requires Firebase Authentication configuration.');
  if (!auth.currentUser) await signInAnonymously(auth);
}

function validateInput(input: SokoniParticipantRegistrationInput): void {
  if (!input.orientations.length) throw new Error('Select at least one reason for joining Sokoni.');
  if (!input.publicName.trim()) throw new Error('A public name is required.');
  if (!input.category.trim()) throw new Error('A category is required.');
  if (!input.description.trim()) throw new Error('A public description is required.');
  if (!input.area.trim()) throw new Error('A discovery area is required.');
  if (!input.publicPhone.trim()) throw new Error('A public phone number is required.');
  if (input.photos.length > MAX_PHOTOS) throw new Error(`A maximum of ${MAX_PHOTOS} photos can be added at once.`);
  input.photos.forEach((photo) => {
    if (!photo.type.startsWith('image/')) throw new Error('Only image files can be used as Sokoni participant media.');
    if (photo.size > MAX_PHOTO_BYTES) throw new Error('Each Sokoni photo must be 5 MB or smaller.');
  });
  if (input.offeringCode && !getSokoniCommercialOffering(input.offeringCode)) throw new Error('The selected Sokoni commercial offering is not configured.');
}

async function uploadParticipantMedia(participantId: string, files: File[]): Promise<SokoniMediaRef[]> {
  if (!files.length) return [];
  if (!storage) throw new Error('Sokoni media storage is not configured.');
  const media: SokoniMediaRef[] = [];
  try {
    for (const file of files) {
      const mediaId = crypto.randomUUID();
      const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'bin' : 'bin';
      const storagePath = `sokoni/participants/${participantId}/${mediaId}.${extension}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      media.push({ mediaId, url, storagePath, mimeType: file.type, createdAt: new Date().toISOString() });
    }
    return media;
  } catch (error) {
    await Promise.allSettled(media.map((item) => deleteObject(ref(storage, item.storagePath))));
    throw error;
  }
}

export async function saveSokoniParticipant(input: SokoniParticipantRegistrationInput): Promise<SokoniParticipant> {
  validateInput(input);
  if (!db) throw new Error('Sokoni persistence is not configured.');
  await ensureSokoniWriteIdentity();

  const participantRef = doc(collection(db, COLLECTION));
  const participantId = participantRef.id;
  const media = await uploadParticipantMedia(participantId, input.photos);
  const now = new Date().toISOString();
  const selectedOffering = getSokoniCommercialOffering(input.offeringCode);
  const publicationDecision = getSokoniPublicationDecision(input.offeringCode);
  const commercialState: SokoniCommercialState = publicationDecision.commercialState;
  const publicationStatus: SokoniPublicationStatus = publicationDecision.publicationStatus;
  const listings: SokoniListing[] = input.listings.filter((item) => item.name.trim()).map((item) => ({
    id: crypto.randomUUID(),
    kind: item.kind,
    name: item.name.trim(),
    description: item.description.trim(),
    mediaIds: Array.from(new Set((item.photoIndexes || []).map((index) => media[index]?.mediaId).filter(Boolean) as string[])),
  }));
  const record: SokoniParticipant = {
    id: participantId,
    participantKind: input.participantKind,
    orientations: Array.from(new Set(input.orientations.filter(Boolean))),
    orientationContext: input.orientationContext,
    publicName: input.publicName.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
    location: { country: 'Kenya', county: input.county.trim() || 'Mombasa', area: input.area.trim(), precision: 'AREA' },
    publicContacts: { phone: input.publicPhone.trim(), ...(input.publicContact?.trim() ? { other: input.publicContact.trim() } : {}) },
    media,
    listings,
    publicationStatus,
    commercial: { offeringCode: input.offeringCode || null, state: commercialState },
    tdbkRelationship: 'NOT_ENROLLED',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(participantRef, record);
    return record;
  } catch (error) {
    if (storage && media.length) await Promise.allSettled(media.map((item) => deleteObject(ref(storage, item.storagePath))));
    throw error;
  }
}

export async function listSokoniParticipants(area?: string, participantKind?: SokoniParticipantKind): Promise<SokoniParticipant[]> {
  if (!db) return [];
  const activeQuery = query(collection(db, COLLECTION), where('publicationStatus', '==', 'ACTIVE'), limit(100));
  const snapshot = await getDocs(activeQuery);
  return snapshot.docs.map((item) => item.data() as SokoniParticipant)
    .filter((item) => !area || item.location.area.toLowerCase() === area.toLowerCase())
    .filter((item) => !participantKind || item.participantKind === participantKind);
}

export async function getSokoniParticipant(participantId: string): Promise<SokoniParticipant | null> {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, COLLECTION, participantId));
  if (!snapshot.exists()) return null;
  const participant = snapshot.data() as SokoniParticipant;
  return participant.publicationStatus === 'ACTIVE' ? participant : null;
}
