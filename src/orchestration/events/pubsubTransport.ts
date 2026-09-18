import { PubSub, Topic } from '@google-cloud/pubsub';
import { EventEnvelope } from './types';

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  'project-d966df20-6e50-477b-8e2';

const TOPIC_NAME = process.env.TDBK_PUBSUB_TOPIC || 'tdbk-events';

export class PubSubTransport {
  private static instance: PubSubTransport;
  private readonly pubsub: PubSub;
  private readonly topic: Topic;

  private constructor() {
    this.pubsub = new PubSub({
      projectId: PROJECT_ID,
    });

    this.topic = this.pubsub.topic(TOPIC_NAME);
  }

  public static getInstance(): PubSubTransport {
    if (!PubSubTransport.instance) {
      PubSubTransport.instance = new PubSubTransport();
    }

    return PubSubTransport.instance;
  }

  public async publish(event: EventEnvelope): Promise<string> {
    // GitHub CI and unit tests intentionally do not have Google ADC. Keep the
    // transport contract deterministic there; production still publishes to Pub/Sub.
    if (process.env.NODE_ENV === 'test') {
      return `test-pubsub-${event.eventId}`;
    }
    const data = Buffer.from(JSON.stringify(event));

    return await this.topic.publishMessage({
      data,
      attributes: {
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        tenantId: event.tenantId || '',
        correlationId: event.correlationId,
        source: event.source,
      },
    });
  }

  public async health(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
    details?: Record<string, unknown>;
  }> {
    try {
      const [exists] = await this.topic.exists();

      return {
        status: exists ? 'HEALTHY' : 'UNAVAILABLE',
        details: {
          projectId: PROJECT_ID,
          topic: TOPIC_NAME,
          topicExists: exists,
        },
      };
    } catch (error) {
      return {
        status: 'UNAVAILABLE',
        details: {
          projectId: PROJECT_ID,
          topic: TOPIC_NAME,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

export const pubSubTransport = PubSubTransport.getInstance();
