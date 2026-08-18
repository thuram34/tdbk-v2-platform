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

  public composeDashboard(workspace: DbkWorkspaceState): ExperienceWidget[] {
    const widgets: ExperienceWidget[] = [
      {
        id: 'widget_overview',
        title: `${workspace.displayName} Overview`,
        widgetType: 'METRIC_CARD',
        span: 2,
        data: {
          primaryValue: workspace.status,
          secondaryValue: `Subscription Tier: ${workspace.subscriptionTier}`,
          trend: { direction: 'UP', percentage: 100, label: 'Authoritative Workspace Active' },
        },
      },
    ];

    const sector = workspace.sector as string;

    if (sector === 'EDUCATION' || workspace.blueprintId.includes('school')) {
      widgets.push(
        {
          id: 'widget_school_enrollment',
          title: 'Student Enrollment',
          widgetType: 'METRIC_CARD',
          span: 2,
          data: {
            primaryValue: '480 Active Students',
            secondaryValue: 'Capacity: 500 (96%)',
            trend: { direction: 'UP', percentage: 4.2, label: 'Term-on-Term Growth' },
          },
        },
        {
          id: 'widget_school_fees',
          title: 'Fee Collection & Arrears',
          widgetType: 'FINANCIAL_SUMMARY',
          span: 2,
          data: {
            primaryValue: 'KES 4,250,000',
            secondaryValue: 'Arrears: KES 320,000 (7.5%)',
            trend: { direction: 'UP', percentage: 12.8, label: 'M-Pesa Collections' },
          },
        }
      );
    } else if (sector === 'HARDWARE' || workspace.blueprintId.includes('hardware')) {
      widgets.push(
        {
          id: 'widget_hardware_sales',
          title: 'Daily POS Sales',
          widgetType: 'FINANCIAL_SUMMARY',
          span: 2,
          data: {
            primaryValue: 'KES 840,000',
            secondaryValue: '142 Cash & M-Pesa Invoices',
            trend: { direction: 'UP', percentage: 8.5, label: 'vs Yesterday' },
          },
        },
        {
          id: 'widget_hardware_low_stock',
          title: 'Low Stock Alerts',
          widgetType: 'ALERT_FEED',
          span: 2,
          data: {
            primaryValue: '8 SKUs Below Reorder Point',
            secondaryValue: 'Cement 50kg, Deformed Bars 12mm',
            items: [
              { sku: 'CEM-50KG', name: 'Simba Cement 50kg', qty: 14, min: 50 },
              { sku: 'STL-12MM', name: 'Deformed Bar 12mm', qty: 8, min: 30 },
            ],
          },
        }
      );
    } else if (sector === 'HEALTHCARE' || sector === 'CLINIC' || workspace.blueprintId.includes('clinic')) {
      widgets.push(
        {
          id: 'widget_clinic_queue',
          title: 'Triage & Outpatient Queue',
          widgetType: 'QUEUE_LIST',
          span: 2,
          data: {
            primaryValue: '12 Patients Waiting',
            secondaryValue: 'Average wait: 14 mins',
            items: [
              { id: 'Q-01', patient: 'OPD-8821', priority: 'URGENT', waitTime: '4m' },
              { id: 'Q-02', patient: 'OPD-8822', priority: 'ROUTINE', waitTime: '12m' },
            ],
          },
        },
        {
          id: 'widget_pharmacy_metrics',
          title: 'Pharmacy Dispensing',
          widgetType: 'METRIC_CARD',
          span: 2,
          data: {
            primaryValue: '84 Prescriptions Filled',
            secondaryValue: 'Stock coverage: 98.4%',
          },
        }
      );
    }

    widgets.push({
      id: 'widget_capabilities',
      title: 'Enabled Capabilities',
      widgetType: 'QUEUE_LIST',
      span: 2,
      data: {
        items: workspace.enabledCapabilities.map((c) => ({
          id: c,
          title: c.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          subtitle: 'Active Capability Module',
          status: 'OPERATIONAL',
        })),
      },
    });

    return widgets;
  }
}

export const dashboardComposer = DashboardComposer.getInstance();
