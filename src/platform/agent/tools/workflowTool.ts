import { SecurityContext } from '../../../kernel/types';
import { tdbkControlPlane } from '../../controlPlane/controlPlane';
export const workflowTool = { execute: async (context: SecurityContext) => { const snapshot = await tdbkControlPlane.getSnapshot(context); return snapshot.dbks.map((dbk) => ({ dbkId: dbk.dbkId, workflowCount: dbk.workflowCount, outbox: dbk.outbox })); } };
