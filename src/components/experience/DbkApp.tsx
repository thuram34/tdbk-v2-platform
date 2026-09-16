import React from 'react';

interface DbkAppProps {
  dbkId: string;
}

export const DbkApp: React.FC<DbkAppProps> = ({ dbkId }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-8">
        <h1 className="text-2xl font-bold">DBK: {dbkId}</h1>
        <p className="mt-2 text-slate-600">
          Customer DBK application boundary
        </p>
      </div>
    </div>
  );
};
