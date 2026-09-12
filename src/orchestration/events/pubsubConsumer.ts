import { Firestore, type DocumentReference } from '@google-cloud/firestore';
import { OAuth2Client } from 'google-auth-library';
import type { Application, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { eventBus } from './eventBus';
import type { EventEnvelope } from './types';

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  'project-d966df20-6e50-477b-8e2';

const MAX_MESSAGE_BYTES = 1024 * 1024;
const PROCESSING_LEASE_MS = 2 * 60 * 1000;

interface PubSubMessage {
  data?: string;
  messageId?: string;
  attributes?: Record<string, string>;
}

interface PubSubPushRequest {
  message?: PubSubMessage;
  subscription?: string;
}

interface ProcessingRecord {
  eventId: string;
  tenantId: string | null;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  leaseUntil?: number | null;
  completedAt?: string;
  failedAt?: string;
  lastError?: string | null;
  updatedAt: string;
}

class PubSubConsumerService {
  private readonly authClient = new OAuth2Client();
  private readonly firestore = new Firestore({ projectId: PROJECT_ID });

  private readonly audience = process.env.TDBK_PUBSUB_AUDIENCE || '';
  private readonly expectedServiceAccount = process.env.TDBK_PUBSUB_PUSH_SERVICE_ACCOUNT || '';

  private isLocalAuthBypassAllowed(): boolean {
    return process.env.NODE_ENV !== 'production' && process.env.TDBK_PUBSUB_AUTH_DISABLED === 'true';
  }

  private async verifyPushAuthorization(req: Request): Promise<void> {
    if (this.isLocalAuthBypassAllowed()) {
      return;
    }

    if (!this.audience || !this.expectedServiceAccount) {
      throw new Error('Pub/Sub authentication is not configured');
    }

    const authorization = req.header('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new Error('Missing Pub/Sub bearer token');
    }

    const ticket = await this.authClient.verifyIdToken({
      idToken: match[1],
      audience: this.audience,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Pub/Sub token has no payload');
    }

    const issuer = payload.iss;
    if (issuer !== 'https://accounts.google.com' && issuer !== 'accounts.google.com') {
      throw new Error('Invalid Pub/Sub token issuer');
    }

    if (payload.email !== this.expectedServiceAccount || payload.email_verified !== true) {
      throw new Error('Unexpected Pub/Sub service identity');
    }
  }

  private processingDocument(event: EventEnvelope): DocumentReference {
    const tenantKey = event.tenantId || '__system__';
    const key = createHash('sha256')
      .update(`${tenantKey}:${event.eventId}`)
      .digest('hex');

    return this.firestore.collection('eventProcessing').doc(key);
  }

  private async claimEvent(event: EventEnvelope): Promise<'CLAIMED' | 'COMPLETED' | 'IN_FLIGHT'> {
    const reference = this.processingDocument(event);
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const existing = snapshot.exists ? (snapshot.data() as ProcessingRecord) : undefined;

      if (existing?.status === 'COMPLETED') {
        return 'COMPLETED';
      }

      if (existing?.status === 'PROCESSING' && (existing.leaseUntil || 0) > now) {
        return 'IN_FLIGHT';
      }

      const record: ProcessingRecord = {
        eventId: event.eventId,
        tenantId: event.tenantId || null,
        status: 'PROCESSING',
        leaseUntil: now + PROCESSING_LEASE_MS,
        updatedAt: nowIso,
      };

      transaction.set(reference, record, { merge: true });
      return 'CLAIMED';
    });
  }

  private async completeEvent(event: EventEnvelope): Promise<void> {
    const now = new Date().toISOString();
    await this.processingDocument(event).set(
      {
        status: 'COMPLETED',
        completedAt: now,
        updatedAt: now,
        leaseUntil: null,
        lastError: null,
      },
      { merge: true },
    );
  }

  private async failEvent(event: EventEnvelope, error: unknown): Promise<void> {
    const safeMessage = error instanceof Error ? error.message : 'Unknown consumer failure';
    const now = new Date().toISOString();

    await this.processingDocument(event).set(
      {
        status: 'FAILED',
        failedAt: now,
        updatedAt: now,
        leaseUntil: null,
        lastError: safeMessage.slice(0, 1000),
      },
      { merge: true },
    );
  }

  private parseEnvelope(body: PubSubPushRequest): EventEnvelope {
    const message = body.message;
    if (!message?.data || typeof message.data !== 'string') {
      throw new Error('Missing Pub/Sub message.data');
    }

    const encoded = Buffer.from(message.data, 'base64');
    if (encoded.byteLength > MAX_MESSAGE_BYTES) {
      throw new Error('Pub/Sub message exceeds the 1 MiB consumer limit');
    }

    let envelope: EventEnvelope;
    try {
      envelope = JSON.parse(encoded.toString('utf8')) as EventEnvelope;
    } catch {
      throw new Error('Pub/Sub message.data is not valid JSON');
    }

    const validation = eventBus.validateEnvelope(envelope);
    if (!validation.valid) {
      throw new Error(`Invalid Event Envelope: ${validation.error}`);
    }

    if (envelope.tenantId !== null && typeof envelope.tenantId !== 'string') {
      throw new Error('Invalid tenantId in Event Envelope');
    }

    const attributes = message.attributes || {};
    const attributeChecks: Array<[keyof typeof attributes, string]> = [
      ['eventId', envelope.eventId],
      ['eventType', envelope.eventType],
      ['eventVersion', envelope.eventVersion],
      ['source', envelope.source],
    ];

    for (const [key, expected] of attributeChecks) {
      if (attributes[key] !== undefined && attributes[key] !== expected) {
        throw new Error(`Pub/Sub attribute mismatch for '${String(key)}'`);
      }
    }

    if (attributes.tenantId !== undefined && attributes.tenantId !== (envelope.tenantId || '')) {
      throw new Error('Pub/Sub tenantId attribute mismatch');
    }

    return envelope;
  }

  public async handle(req: Request, res: Response): Promise<void> {
    let claimedEnvelope: EventEnvelope | null = null;

    try {
      await this.verifyPushAuthorization(req);

      const envelope = this.parseEnvelope(req.body as PubSubPushRequest);
      const claim = await this.claimEvent(envelope);

      if (claim === 'COMPLETED') {
        console.info('[TDBK_PUBSUB_CONSUMER_DUPLICATE]', JSON.stringify({
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          tenantId: envelope.tenantId,
        }));
        res.status(204).send();
        return;
      }

      if (claim === 'IN_FLIGHT') {
        res.status(409).json({ error: { code: 'EVENT_IN_FLIGHT', message: 'Event is currently being processed' } });
        return;
      }

      claimedEnvelope = envelope;

      const result = await eventBus.publish(
        envelope,
        typeof envelope.metadata?.idempotencyKey === 'string'
          ? envelope.metadata.idempotencyKey
          : envelope.eventId,
      );

      await this.completeEvent(envelope);

      console.info('[TDBK_PUBSUB_CONSUMER]', JSON.stringify({
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        tenantId: envelope.tenantId,
        result,
      }));

      res.status(204).send();
    } catch (error) {
      if (claimedEnvelope) {
        try {
          await this.failEvent(claimedEnvelope, error);
        } catch (stateError) {
          console.error('[TDBK_PUBSUB_CONSUMER_STATE_ERROR]', stateError);
        }
      }

      const message = error instanceof Error ? error.message : 'Unknown Pub/Sub consumer failure';
      const authenticationFailure =
        message.includes('authentication') ||
        message.includes('bearer token') ||
        message.includes('token') ||
        message.includes('service identity');

      console.error('[TDBK_PUBSUB_CONSUMER_ERROR]', message);
      res.status(authenticationFailure ? 401 : 500).json({
        error: {
          code: 'PUBSUB_CONSUMER_ERROR',
          message: 'Pub/Sub message was not accepted',
        },
      });
    }
  }

  public register(app: Application, path = '/api/events/pubsub'): void {
    app.post(path, (req, res) => {
      void this.handle(req, res);
    });
  }
}

export const pubSubConsumer = new PubSubConsumerService();
