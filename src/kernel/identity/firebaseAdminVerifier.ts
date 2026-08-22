import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export async function verifyFirebaseIdToken(token: string) {
  const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  const credential = firebaseServiceAccount
    ? cert(JSON.parse(firebaseServiceAccount))
    : applicationDefault();

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT;

  if (getApps().length === 0) {
    initializeApp({
      credential,
      ...(projectId ? { projectId } : {}),
    });
  }

  return getAuth().verifyIdToken(token);
}
