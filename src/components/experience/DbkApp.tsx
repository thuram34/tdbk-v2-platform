import React from 'react';
import { WorkspaceInstallPrompt } from '../pwa/WorkspaceInstallPrompt';
import { DbkShell } from './DbkShell';

interface DbkAppProps {
  dbkId: string;
  autoOpenInstall?: boolean;
  onLogout: () => Promise<void> | void;
}

export const DbkApp: React.FC<DbkAppProps> = ({ dbkId, autoOpenInstall = false, onLogout }) => {
  return (
    <>
    <DbkShell
      initialDbkId={dbkId}
      initialViewMode="WORKSPACE"
      onSwitchToMaster={() => { window.location.assign('/'); }}
    />
    <WorkspaceInstallPrompt dbkId={dbkId} autoOpen={autoOpenInstall} onLogout={onLogout} />
    </>
  );
};

export default DbkApp;
