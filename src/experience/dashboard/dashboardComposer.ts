import { DbkWorkspaceState } from '../../platform/types';
import { ExperienceWidget } from '../types';

export class DashboardComposer {
  private static instance: DashboardComposer;

  private constructor() {}

  public static getInstance(): DashboardComposer {
    if (!DashboardComposer.instance) {
      DashboardComposer.instance = new DashboardComposer();
    }
    return DashboardComposer.instance;
  }

  /**
   * Build dashboard widgets only from authoritative workspace projection data.
   * Transactional KPIs belong to domain read models; never substitute sample figures.
   */
  public composeDashboard(workspace: DbkWorkspaceState): ExperienceWidget[] {
    const activeBranches = workspace.activeBranches || [];
    const enabledCapabilities = workspace.enabledCapabilities || [];
    const connections = workspace.connections || [];
    const readyConnections = connections.filter((connection) => connection.ready);
    const setupConnections = connections.filter((connection) => !connection.ready);

    const widgets: ExperienceWidget[] = [
      {
        id: 'widget_workspace',
        title: 'Workspace status',
        widgetType: 'METRIC_CARD',
        span: 2,
        data: {
          primaryValue: workspace.status,
          secondaryValue: `${workspace.subscriptionTier} plan · Workspace version ${workspace.workspaceVersion}`,
        },
      },
      {
        id: 'widget_branches',
        title: 'Active locations',
        widgetType: 'METRIC_CARD',
        data: {
          primaryValue: activeBranches.length,
          secondaryValue: activeBranches.map((branch) => branch.name).join(', ') || 'No active locations',
        },
      },
      {
        id: 'widget_connections',
        title: 'Integration readiness',
        widgetType: 'METRIC_CARD',
        data: {
          primaryValue: `${readyConnections.length} / ${connections.length}`,
          secondaryValue: connections.length === 0
            ? 'No integrations registered for this workspace'
            : setupConnections.length === 0
              ? 'All registered integrations report ready'
              : `${setupConnections.length} integration(s) need configuration or attention`,
        },
      },
      {
        id: 'widget_capabilities',
        title: 'Enabled capabilities',
        widgetType: 'QUEUE_LIST',
        span: 2,
        data: {
          items: enabledCapabilities.map((capabilityId) => ({
            id: capabilityId,
            title: capabilityId.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            subtitle: 'Enabled in this workspace',
            status: 'ENABLED',
          })),
        },
      },
    ];

    if (setupConnections.length > 0) {
      widgets.push({
        id: 'widget_connection_attention',
        title: 'Integration setup required',
        widgetType: 'ALERT_BANNER',
        span: 3,
        data: {
          alert: {
            level: 'WARNING',
            message: setupConnections.map((connection) => `${connection.provider}: ${connection.blockers.join(', ') || connection.status}`).join(' · '),
          },
        },
      });
    }

    return widgets;
  }
}

export const dashboardComposer = DashboardComposer.getInstance();
