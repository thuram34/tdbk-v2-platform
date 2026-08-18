import { DbkWorkspaceState } from '../../platform/types';
import { ExperienceNavItem } from '../types';
import { capabilityViewRegistry } from '../registry/viewRegistry';
import { SecurityContext } from '../../kernel/types';
import { masterAuthority } from '../../kernel/master/masterAuthority';

export class NavigationEngine {
  private static instance: NavigationEngine;

  private constructor() {}

  public static getInstance(): NavigationEngine {
    if (!NavigationEngine.instance) {
      NavigationEngine.instance = new NavigationEngine();
    }
    return NavigationEngine.instance;
  }

  public buildNavigation(workspace: DbkWorkspaceState, context?: SecurityContext): ExperienceNavItem[] {
    const navItems: ExperienceNavItem[] = [
      {
        id: 'nav_overview',
        label: 'Overview & Dashboard',
        iconName: 'LayoutDashboard',
        category: 'OVERVIEW',
        route: `/dbk/${workspace.dbkId}/dashboard`,
        viewType: 'DASHBOARD',
        displayOrder: 0,
        isDefault: true,
      },
    ];

    const isMaster = context ? masterAuthority.isMasterAdmin(context.principal) || masterAuthority.isOwnerPortfolio(context.principal) : true;
    const roles = context?.principal.roles || [];
    const permissions = context?.principal.permissions || [];
    const isTenantAdmin = isMaster || roles.includes('TENANT_ADMIN') || roles.includes('SYSTEM_ADMIN') || roles.includes('STORE_OWNER') || roles.includes('SHOP_MANAGER') || roles.includes('SCHOOL_PRINCIPAL') || roles.includes('LOGISTICS_DIRECTOR') || roles.includes('MEDICAL_DIRECTOR') || permissions.includes('*') || permissions.includes('admin:*');

    let order = 1;
    for (const capId of workspace.enabledCapabilities) {
      // Role filtering for capabilities
      if (context && !isTenantAdmin) {
        if (roles.includes('TEACHER')) {
          // Teacher only sees academic, student, overview navigation
          if (capId === 'fee_management' || capId === 'school_fee_structure' || capId === 'mpesa_reconciliation' || capId === 'system_config') {
            continue;
          }
        }
      }

      const viewDef = capabilityViewRegistry.getViewDefinition(capId);
      if (viewDef) {
        let label = viewDef.defaultNavLabel;
        // Dynamic terminology substitutions
        if (capId === 'student_records' && (workspace.terminology as any)?.customer?.singular) {
          label = `${(workspace.terminology as any).customer.singular} Directory`;
        } else if (capId === 'stock_control' && (workspace.terminology as any)?.stock?.singular) {
          label = (workspace.terminology as any).stock.singular;
        } else if (capId === 'patient_queue' && (workspace.terminology as any)?.customer?.singular) {
          label = `${(workspace.terminology as any).customer.singular} Queue`;
        }

        navItems.push({
          id: `nav_${capId}`,
          label,
          iconName: viewDef.iconName,
          category: viewDef.category as any,
          capabilityId: capId,
          route: `/dbk/${workspace.dbkId}/${capId}`,
          viewType: viewDef.viewType as any,
          displayOrder: viewDef.displayOrder || order++,
        });
      }
    }

    // Settings navigation is restricted to tenant admins and master authorities
    if (isTenantAdmin) {
      navItems.push({
        id: 'nav_settings',
        label: 'Settings & Security',
        iconName: 'Settings',
        category: 'SETTINGS',
        route: `/dbk/${workspace.dbkId}/settings`,
        viewType: 'SETTINGS',
        displayOrder: 100,
      });
    }

    return navItems;
  }
}

export const dynamicNavigationEngine = NavigationEngine.getInstance();

