import React from 'react';
import { DbkShell } from './DbkShell';

interface DbkAppProps {
  dbkId: string;
}

export const DbkApp: React.FC<DbkAppProps> = ({ dbkId }) => {
  return (
    <DbkShell
      initialDbkId={dbkId}
      initialViewMode="WORKSPACE"
      onSwitchToMaster={() => { window.location.reload(); }}
    />
  );
};

export default DbkApp;
