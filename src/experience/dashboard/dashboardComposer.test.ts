import { describe, expect, it } from 'vitest';
import { DashboardComposer } from './dashboardComposer';
import type { DbkWorkspaceState } from '../../platform/types';

describe('DashboardComposer', () => {
  it('projects only authoritative workspace counts and never injects sample business KPIs', () => {
    const workspace = {
      status: 'ACTIVE',
      subscriptionTier: 'FOUNDATION',
      workspaceVersion: 7,
      activeBranches: [
        { branchId: 'branch_hq', name: 'Mombasa HQ', isHeadquarters: true },
        { branchId: 'branch_nyali', name: 'Nyali', isHeadquarters: false },
      ],
      connections: [
        { provider: 'M-Pesa', ready: true, blockers: [], status: 'HEALTHY' },
        { provider: 'eTIMS', ready: false, blockers: ['Credentials required'], status: 'NOT_CONFIGURED' },
      ],
      enabledCapabilities: ['stock_control', 'pos_register'],
    } as unknown as DbkWorkspaceState;

    const widgets = DashboardComposer.getInstance().composeDashboard(workspace);
    const byId = Object.fromEntries(widgets.map((widget) => [widget.id, widget]));

    expect(byId.widget_workspace.data.primaryValue).toBe('ACTIVE');
    expect(byId.widget_branches.data.primaryValue).toBe(2);
    expect(byId.widget_connections.data.primaryValue).toBe('1 / 2');
    expect(byId.widget_capabilities.data.items?.map((item) => item.id)).toEqual(['stock_control', 'pos_register']);
    expect(byId.widget_connection_attention.data.alert?.message).toContain('Credentials required');

    const renderedValues = JSON.stringify(widgets);
    expect(renderedValues).not.toContain('480 Active Students');
    expect(renderedValues).not.toContain('KES 4,250,000');
    expect(renderedValues).not.toContain('KES 840,000');
  });

  it('does not show a setup warning when every registered connection is ready', () => {
    const workspace = {
      status: 'ACTIVE',
      subscriptionTier: 'FOUNDATION',
      workspaceVersion: 1,
      activeBranches: [],
      connections: [{ provider: 'M-Pesa', ready: true, blockers: [], status: 'HEALTHY' }],
      enabledCapabilities: [],
    } as unknown as DbkWorkspaceState;

    const widgets = DashboardComposer.getInstance().composeDashboard(workspace);

    expect(widgets.some((widget) => widget.id === 'widget_connection_attention')).toBe(false);
  });
});
