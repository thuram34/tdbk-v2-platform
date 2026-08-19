const principal = {
  id: 'usr_master_admin_console',
  tenantId: 'master',
  branchId: null,
  roles: ['TDBK_MASTER_ADMIN'],
  permissions: ['*'],
  authTime: Date.now(),
  tokenSource: 'SESSION',
  isMaster: true,
};

function isMasterAdmin(principal) {
  if (!principal) return false;
  const isMaster = principal.isMaster === true || String(principal.isMaster) === 'true';
  const roles = Array.isArray(principal.roles) ? principal.roles : [];
  return isMaster && roles.includes('TDBK_MASTER_ADMIN');
}

function isOwnerPortfolio(principal) {
  if (!principal) return false;
  const isMaster = principal.isMaster === true || String(principal.isMaster) === 'true';
  const roles = Array.isArray(principal.roles) ? principal.roles : [];
  return roles.includes('BUSINESS_OWNER') || roles.includes('OWNER_OPERATOR') || roles.includes('TDBK_MASTER_ADMIN') || isMaster;
}

console.log('isMasterAdmin:', isMasterAdmin(principal));
console.log('isOwnerPortfolio:', isOwnerPortfolio(principal));

