import { SecurityContext } from '../../../kernel/types';
import { tdbkControlPlane } from '../../controlPlane/controlPlane';
export const controlPlaneTool = { execute: (context: SecurityContext) => tdbkControlPlane.getSnapshot(context) };
