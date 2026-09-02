/**
 * TDBK V2 MULTI-SURFACE RENDERING ENGINE
 * 
 * Architectural Philosophy:
 * HEADLESS & STATELESS.
 * One approved business event or data source projects to multiple physical and digital surfaces:
 * - Website / Workspace
 * - WhatsApp Business
 * - Mobile Companion
 * - Parent / Customer Portal
 * - TV Wall Display (Waiting Rooms, Receptions)
 * - LED Matrix Display (Counters, Tills)
 * - Classroom Interactive Display
 * - Headless API JSON
 */

import { SurfaceType, SurfaceRenderPayload } from './types';

export class MultiSurfaceRenderer {
  private static instance: MultiSurfaceRenderer;

  private constructor() {}

  public static getInstance(): MultiSurfaceRenderer {
    if (!MultiSurfaceRenderer.instance) {
      MultiSurfaceRenderer.instance = new MultiSurfaceRenderer();
    }
    return MultiSurfaceRenderer.instance;
  }

  /**
   * Generates a tailored rendering payload for a specific surface target
   */
  public renderToSurface(
    surface: SurfaceType,
    spaceId: string,
    eventData: {
      title: string;
      sourceEvent: string;
      primaryMessage: string;
      secondaryDetails?: string;
      items?: Array<{ key: string; value: string }>;
    }
  ): SurfaceRenderPayload {
    switch (surface) {
      case 'TV_DISPLAY':
        return {
          surface: 'TV_DISPLAY',
          title: eventData.title,
          sourceEvent: eventData.sourceEvent,
          targetSpaceId: spaceId,
          content: {
            primaryText: eventData.primaryMessage.toUpperCase(),
            subText: eventData.secondaryDetails || 'Please proceed to the designated station',
            items: eventData.items,
            displayTheme: 'DARK',
            refreshIntervalSeconds: 15,
          },
          generatedAt: new Date().toISOString(),
        };

      case 'CLASSROOM_DISPLAY':
        return {
          surface: 'CLASSROOM_DISPLAY',
          title: 'Classroom Noticeboard',
          sourceEvent: eventData.sourceEvent,
          targetSpaceId: spaceId,
          content: {
            primaryText: eventData.primaryMessage,
            subText: eventData.secondaryDetails || 'Current Lesson in Progress',
            items: eventData.items,
            displayTheme: 'LIGHT',
            refreshIntervalSeconds: 60,
          },
          generatedAt: new Date().toISOString(),
        };

      case 'LED_DISPLAY':
        return {
          surface: 'LED_DISPLAY',
          title: 'Counter LED Ticker',
          sourceEvent: eventData.sourceEvent,
          targetSpaceId: spaceId,
          content: {
            primaryText: eventData.primaryMessage.substring(0, 32),
            displayTheme: 'HIGH_CONTRAST',
            refreshIntervalSeconds: 5,
          },
          generatedAt: new Date().toISOString(),
        };

      case 'WHATSAPP':
        return {
          surface: 'WHATSAPP',
          title: 'WhatsApp Business Message',
          sourceEvent: eventData.sourceEvent,
          targetSpaceId: spaceId,
          content: {
            primaryText: `*${eventData.title}*\n\n${eventData.primaryMessage}\n\n_${eventData.secondaryDetails || ''}_`,
            items: eventData.items,
          },
          generatedAt: new Date().toISOString(),
        };

      case 'PARENT_PORTAL':
      case 'CUSTOMER_PORTAL':
        return {
          surface,
          title: eventData.title,
          sourceEvent: eventData.sourceEvent,
          targetSpaceId: spaceId,
          content: {
            primaryText: eventData.primaryMessage,
            subText: eventData.secondaryDetails,
            items: eventData.items,
            qrCodeUrl: `https://tdbk.biz/verify?e=${encodeURIComponent(eventData.sourceEvent)}`,
          },
          generatedAt: new Date().toISOString(),
        };

      default:
        return {
          surface: 'WEB_WORKSPACE',
          title: eventData.title,
          sourceEvent: eventData.sourceEvent,
          targetSpaceId: spaceId,
          content: {
            primaryText: eventData.primaryMessage,
            subText: eventData.secondaryDetails,
            items: eventData.items,
          },
          generatedAt: new Date().toISOString(),
        };
    }
  }
}

export const multiSurfaceRenderer = MultiSurfaceRenderer.getInstance();
