import React from 'react';
import { WorkspaceInstallPrompt } from '../pwa/WorkspaceInstallPrompt';
import { DbkShell } from './DbkShell';

interface DbkAppProps {
  dbkId: string;
  onLogout: () => Promise<void> | void;
}

export const DbkApp: React.FC<DbkAppProps> = ({ dbkId, onLogout }) => {
  return (
    <>
    <DbkShell
      initialDbkId={dbkId}
      initialViewMode="WORKSPACE"
      onSwitchToMaster={() => { window.location.assign('/'); }}
    />
    <WorkspaceInstallPrompt dbkId={dbkId} onLogout={onLogout} />
    </>
  );
};

export default DbkApp;
