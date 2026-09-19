import { SecurityContext } from '../../../kernel/types';
import { businessStateEngine } from '../../businessState/businessStateEngine';
export const businessStateTool = { execute: (context: SecurityContext, tenantId: string) => businessStateEngine.getCurrent(context, tenantId) };
