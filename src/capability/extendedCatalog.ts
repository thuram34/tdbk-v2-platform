import { CapabilityDefinition, CapabilityCategory } from './types';
const now='2026-10-07T00:00:00Z';
function cap(id:string,name:string,category:CapabilityCategory,blueprints:CapabilityDefinition['supportedBlueprints'],description:string,deps:string[]=[]):CapabilityDefinition{
  return {capabilityId:id,name,description,category,version:'1.0.0',supportedBlueprints:blueprints,dependencies:deps,requiredPermissions:[],requiredRoles:['TENANT_ADMIN','DBK_ADMIN','STAFF'],entitlementRequirements:{minimumTier:'FOUNDATION'},configurationSchema:{requiresConfiguration:false},implementationStatus:'IMPLEMENTED',lifecycleStatus:'AVAILABLE',createdAt:now,updatedAt:now};
}
export const EXTENDED_CAPABILITY_CATALOG:CapabilityDefinition[]=[
  cap('bom_management','Bill of Materials','MANUFACTURING',['MANUFACTURING'],'Authoritative BOM definitions.'),
  cap('production_orders','Production Orders','MANUFACTURING',['MANUFACTURING'],'Production order lifecycle and output records.',['bom_management']),
  cap('work_centres','Work Centres & Capacity','MANUFACTURING',['MANUFACTURING'],'Work-centre and capacity records.'),
  cap('manufacturing_inventory','Manufacturing Inventory','INVENTORY',['MANUFACTURING'],'Raw material, WIP and finished-good records.'),
  cap('material_issue','Material Issue & Consumption','INVENTORY',['MANUFACTURING'],'Material issue and consumption records.',['manufacturing_inventory','production_orders']),
  cap('quality_control','Quality Control','MANUFACTURING',['MANUFACTURING'],'Inspection and release records.',['production_orders']),
  cap('manufacturing_procurement','Manufacturing Procurement','PURCHASING',['MANUFACTURING'],'Supplier procurement records.'),
  cap('production_costing','Production Costing','FINANCE',['MANUFACTURING'],'Production cost and variance records.',['production_orders']),
  cap('project_register','Project & Site Register','PROJECTS',['CONSTRUCTION'],'Project and site records.'),
  cap('boq_management','Bill of Quantities','PROJECTS',['CONSTRUCTION'],'BOQ item and approved variation records.',['project_register']),
  cap('project_progress','Site Progress Tracking','PROJECTS',['CONSTRUCTION'],'Milestone and site progress records.',['project_register']),
  cap('project_costing','Project Cost Control','FINANCE',['CONSTRUCTION'],'Committed, actual and forecast project costs.',['project_register']),
  cap('construction_procurement','Construction Procurement','PURCHASING',['CONSTRUCTION'],'Construction supplier and LPO records.',['project_register']),
  cap('site_inventory','Site Materials Inventory','INVENTORY',['CONSTRUCTION'],'Materials received and issued at project sites.',['project_register']),
  cap('labour_tracking','Labour & Site Attendance','WORKFORCE',['CONSTRUCTION'],'Worker attendance and allocation records.',['project_register']),
  cap('progress_billing','Progress Billing','FINANCE',['CONSTRUCTION'],'Approved progress claims and invoices.',['project_register','boq_management']),
  cap('member_registry','Member Registry','COMMUNITY',['COMMUNITY'],'Members and household records.'),
  cap('beneficiary_registry','Beneficiary Registry','COMMUNITY',['COMMUNITY'],'Beneficiary and support records.'),
  cap('community_projects','Community Projects','PROJECTS',['COMMUNITY'],'Community project records.'),
  cap('program_tracking','Program Monitoring','PROJECTS',['COMMUNITY'],'Program indicators and outcomes.',['community_projects']),
  cap('donation_management','Donation & Pledge Management','FINANCE',['COMMUNITY'],'Donation and pledge records.'),
  cap('contribution_receipts','Contribution Receipts','FINANCE',['COMMUNITY'],'Contribution receipt records.',['donation_management']),
  cap('volunteer_management','Volunteer Management','WORKFORCE',['COMMUNITY'],'Volunteer records and assignments.'),
  cap('community_messaging','Community Messaging','COMMUNICATION',['COMMUNITY'],'Community communication requests.')
];